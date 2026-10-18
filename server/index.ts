import 'dotenv/config'
import crypto from 'node:crypto'
import cors from 'cors'
import express, { type ErrorRequestHandler } from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import multer from 'multer'
import { z } from 'zod'
import { solveMathsImage, solveMathsText, askDoubt, generateMcqsFromText } from './aiClient.js'
import { buildDemoSolution } from './localSolver.js'
import { getAdminClient, getAdminOverview, setUserAccess, checkSolveAllowed, ensureTrialAccess } from './admin.js'

const env = z.object({
  PORT: z.coerce.number().default(4000),
  CLIENT_ORIGIN: z.string().default('http://127.0.0.1:5173,http://localhost:5173'),
  AI_API_KEY: z.string().trim().optional().transform((v) => (v ? v : undefined)),
  AI_API_URL: z.string().url().default('https://api.openai.com/v1/chat/completions'),
  AI_MODEL: z.string().default('gpt-4o-mini'),
  AI_MODELS: z.string().optional(),
  DEMO_MODE: z.string().default('true'),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_KEY: z.string().trim().optional().transform((v) => (v ? v : undefined)),
  ADMIN_SECRET: z.string().trim().optional().transform((v) => (v ? v : undefined)),
  AI_DAILY_BUDGET: z.coerce.number().int().min(1).default(500),
}).parse(process.env)

const aiModels = (env.AI_MODELS ?? env.AI_MODEL).split(',').map((s) => s.trim()).filter(Boolean)

const normalizeOrigin = (value: string) => value.trim().replace(/\/+$/, '').toLowerCase()
const allowedOrigins = env.CLIENT_ORIGIN.split(',').map(normalizeOrigin).filter(Boolean)

const app = express()
// Render proxy ke peeche sahi client IP ke liye (warna rate-limit bekaar).
app.set('trust proxy', 1)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => {
    callback(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype))
  },
})

app.use(helmet())
app.use(cors({
  origin: (origin, callback) => {
    // Same-origin / curl / mobile app (no Origin header) ko allow karo.
    if (!origin || allowedOrigins.includes(normalizeOrigin(origin))) {
      callback(null, true)
      return
    }
    callback(new Error(`CORS blocked for origin: ${origin}`))
  },
}))
app.use(express.json({ limit: '32kb' }))
app.use(rateLimit({ windowMs: 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false }))

// Solve endpoint par sakht limit: 10 min me max 12 AI calls per IP (abuse guard).
const solveLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 12,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { code: 'RATE_LIMITED', message: 'Bahut zyada requests. Thodi der rukkar phir try karo.' },
})

// Roz ka AI budget cap (bill protection): exceed ho to demo fallback.
let budgetDay = new Date().toISOString().slice(0, 10)
let budgetUsed = 0
function budgetLeft(): boolean {
  const today = new Date().toISOString().slice(0, 10)
  if (today !== budgetDay) {
    budgetDay = today
    budgetUsed = 0
  }
  return budgetUsed < env.AI_DAILY_BUDGET
}
function budgetSpend(): void {
  budgetUsed++
}

app.get('/api/health', (_request, response) => {
  response.json({
    status: 'ok',
    service: 'sutra-api',
    aiConfigured: Boolean(env.AI_API_KEY),
    demoMode: env.DEMO_MODE === 'true',
  })
})

// Bina image ke demo solution check karne ke liye (frontend test ke liye).
app.get('/api/demo', (_request, response) => {
  response.json({ status: 'demo', solution: buildDemoSolution() })
})

app.post('/api/solve', solveLimiter, upload.single('questionImage'), async (request, response) => {
  const body = (request.body ?? {}) as { questionText?: unknown; description?: unknown; studentClass?: unknown }
  const questionText = typeof body.questionText === 'string' ? body.questionText.trim().slice(0, 2000) : ''
  const description = typeof body.description === 'string' ? body.description.trim().slice(0, 1000) : ''
  if (!request.file && !questionText) {
    response.status(400).json({ code: 'IMAGE_OR_TEXT_REQUIRED', message: 'Question image ya typed question me se ek chahiye.' })
    return
  }

  // Logged-in user: access + daily limit (server-side sakht check).
  const authHeader = request.header('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const adminClient = getAdminClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
    if (adminClient) {
      const { data } = await adminClient.auth.getUser(authHeader.slice(7))
      if (data.user) {
        const check = await checkSolveAllowed(adminClient, data.user.id)
        if (!check.allowed) {
          response.status(403).json({ code: 'ACCESS_OR_LIMIT', message: check.reason ?? 'Access allowed nahi hai.' })
          return
        }
      }
    }
  }

  // AI key nahi hai → offline demo solution do taaki UI kabhi atak na jaye.
  if (!env.AI_API_KEY && env.DEMO_MODE === 'true') {
    response.json({
      status: 'demo',
      message: 'Demo mode: AI key configure nahi hai, isliye sample solution dikhaya ja raha hai.',
      errorCode: 'AI_PROVIDER_NOT_CONFIGURED',
      solution: buildDemoSolution(),
    })
    return
  }

  try {
    const studentClass = z.coerce.number().int().min(1).max(10).optional().parse(
      (request.body as { studentClass?: unknown } | undefined)?.studentClass ?? undefined,
    )
    if (!budgetLeft()) {
      throw new Error('AI_BUDGET_OVER')
    }
    const config = {
      apiKey: env.AI_API_KEY,
      apiUrl: env.AI_API_URL,
      model: env.AI_MODEL,
      models: aiModels,
    }
    const solution = request.file
      ? await solveMathsImage(request.file.buffer, request.file.mimetype, config, studentClass, description || undefined)
      : await solveMathsText(questionText, config, studentClass)
    budgetSpend()
    response.json({ status: 'complete', solution })
  } catch (error) {
    // AI fail ho jaye to bhi demo fallback do (agar DEMO_MODE on hai).
    if (env.DEMO_MODE === 'true') {
      console.error('AI failed, serving demo solution:', error)
      response.json({
        status: 'demo',
        message: 'AI se connect nahi ho paya, isliye sample solution dikhaya ja raha hai.',
        errorCode: error instanceof Error ? error.message : 'UNKNOWN',
        solution: buildDemoSolution(),
      })
      return
    }
    if (error instanceof Error && error.message === 'AI_PROVIDER_NOT_CONFIGURED') {
      response.status(503).json({ code: 'AI_PROVIDER_NOT_CONFIGURED', message: 'AI provider is not configured yet. Server par AI_API_KEY set karo ya DEMO_MODE=true rakho.' })
      return
    }
    console.error(error)
    response.status(502).json({ code: 'AI_ANALYSIS_FAILED', message: 'Question analyze nahi ho paya. Please try again.' })
  }
})

// Login hote hi naye user ko ek baar trial access (1 month + 10/day) mile.
// Idempotent: pehle se grant ho to kuch nahi hota, sirf status wapas aata hai.
app.post('/api/access/claim', async (request, response) => {
  const adminClient = getAdminClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
  if (!adminClient) {
    response.status(503).json({ code: 'ADMIN_DB_MISSING', message: 'Supabase admin is not configured.' })
    return
  }
  const authHeader = request.header('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    response.status(401).json({ code: 'AUTH_REQUIRED', message: 'Login karke phir try karo.' })
    return
  }
  const { data } = await adminClient.auth.getUser(authHeader.slice(7))
  if (!data.user) {
    response.status(401).json({ code: 'AUTH_REQUIRED', message: 'Login karke phir try karo.' })
    return
  }
  try {
    const result = await ensureTrialAccess(adminClient, data.user.id)
    response.json({ status: 'ok', access: result })
  } catch (error) {
    console.error(error)
    response.status(502).json({ code: 'ACCESS_CLAIM_FAILED', message: 'Access set nahi hua.' })
  }
})

const adminAuth: express.RequestHandler = (request, response, next) => {
  if (!env.ADMIN_SECRET) {
    response.status(503).json({ code: 'ADMIN_NOT_CONFIGURED', message: 'Admin is not configured on server.' })
    return
  }
  const key = request.header('x-admin-key')
  const expected = Buffer.from(env.ADMIN_SECRET)
  const actual = Buffer.from(key ?? '')
  // Timing-safe compare taaki key guess karna mushkil ho.
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    response.status(403).json({ code: 'ADMIN_FORBIDDEN', message: 'Wrong admin key.' })
    return
  }
  next()
}

app.get('/api/admin/overview', adminAuth, async (request, response) => {
  const client = getAdminClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
  if (!client) {
    response.status(503).json({ code: 'ADMIN_DB_MISSING', message: 'Supabase admin is not configured.' })
    return
  }
  try {
    const limit = z.coerce.number().int().min(1).max(200).optional().parse(request.query.limit ?? undefined) ?? 100
    const overview = await getAdminOverview(client, limit)
    response.json({ status: 'ok', overview })
  } catch (error) {
    console.error(error)
    response.status(502).json({ code: 'ADMIN_QUERY_FAILED', message: 'Admin data load nahi hua.' })
  }
})

app.post('/api/admin/access', adminAuth, async (request, response) => {
  const client = getAdminClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
  if (!client) {
    response.status(503).json({ code: 'ADMIN_DB_MISSING', message: 'Supabase admin is not configured.' })
    return
  }
  try {
    const body = z.object({
      userId: z.string().uuid(),
      plan: z.enum(['none', 'week', 'month', 'year']),
      dailyLimit: z.number().int().min(1).max(1000).nullish(),
    }).parse(request.body)
    const result = await setUserAccess(client, body.userId, body.plan, body.dailyLimit ?? null)
    response.json({ status: 'ok', access: result })
  } catch (error) {
    if (error instanceof z.ZodError) {
      response.status(400).json({ code: 'ADMIN_BAD_INPUT', message: 'Galat input.' })
      return
    }
    console.error(error)
    response.status(502).json({ code: 'ADMIN_SAVE_FAILED', message: 'Access save nahi hua.' })
  }
})

// PDF text se quiz banane par halki limit (AI cost guard).
const quizLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { code: 'RATE_LIMITED', message: 'Bahut zyada requests. Thodi der rukkar phir try karo.' },
})

// PDF (frontend me text extract hota hai) se MCQs banao.
app.post('/api/quiz', quizLimiter, async (request, response) => {
  try {
    const body = z.object({
      text: z.string().min(50).max(14000),
      count: z.coerce.number().int().min(3).max(50).default(10),
      studentClass: z.coerce.number().int().min(1).max(10).optional(),
    }).parse(request.body)

    if (!env.AI_API_KEY && env.DEMO_MODE === 'true') {
      response.status(503).json({ code: 'AI_PROVIDER_NOT_CONFIGURED', message: 'AI abhi configured nahi hai.' })
      return
    }
    if (!budgetLeft()) {
      throw new Error('AI_BUDGET_OVER')
    }

    const questions = await generateMcqsFromText(
      body.text,
      body.count,
      { apiKey: env.AI_API_KEY, apiUrl: env.AI_API_URL, model: env.AI_MODEL, models: aiModels },
      body.studentClass,
    )
    budgetSpend()
    response.json({ status: 'ok', questions })
  } catch (error) {
    if (error instanceof z.ZodError) {
      response.status(400).json({ code: 'QUIZ_BAD_INPUT', message: 'PDF ka text sahi se nahi mila.' })
      return
    }
    if (error instanceof Error && (error.message === 'AI_PROVIDER_NOT_CONFIGURED' || error.message === 'AI_BUDGET_OVER')) {
      response.status(503).json({ code: error.message, message: 'AI abhi available nahi hai. Thodi der baad try karo.' })
      return
    }
    console.error(error)
    response.status(502).json({ code: 'QUIZ_FAILED', message: 'Is PDF se quiz nahi bana. Doosri PDF try karo.' })
  }
})

// Doubt chat par halki limit (free AI chat abuse guard).
const doubtLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { code: 'RATE_LIMITED', message: 'Bahut zyada requests. Thodi der rukkar phir try karo.' },
})

app.post('/api/doubt', doubtLimiter, async (request, response) => {
  try {
    const body = z.object({
      messages: z.array(z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(1000),
      })).min(1).max(8),
      context: z.object({
        question: z.string().max(1000).optional().default(''),
        finalAnswer: z.string().max(500).optional().default(''),
        steps: z.array(z.string().max(500)).max(12).optional().default([]),
      }).optional(),
    }).parse(request.body)
    if (!budgetLeft()) {
      throw new Error('AI_BUDGET_OVER')
    }
    const reply = await askDoubt(
      body.messages,
      {
        question: body.context?.question ?? '',
        finalAnswer: body.context?.finalAnswer ?? '',
        steps: body.context?.steps ?? [],
      },
      {
        apiKey: env.AI_API_KEY,
        apiUrl: env.AI_API_URL,
        model: env.AI_MODEL,
        models: aiModels,
      },
    )
    budgetSpend()
    response.json({ reply })
  } catch (error) {
    if (error instanceof z.ZodError) {
      response.status(400).json({ code: 'DOUBT_BAD_INPUT', message: 'Sawal sahi se bhejo.' })
      return
    }
    if (error instanceof Error && error.message === 'AI_PROVIDER_NOT_CONFIGURED') {
      response.status(503).json({ code: 'AI_PROVIDER_NOT_CONFIGURED', message: 'AI abhi configured nahi hai.' })
      return
    }
    console.error(error)
    response.status(502).json({ code: 'DOUBT_FAILED', message: 'Jawab nahi aaya. Phir try karo.' })
  }
})

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    response.status(413).json({ code: 'IMAGE_TOO_LARGE', message: 'Image must be smaller than 10 MB.' })
    return
  }

  if (error instanceof multer.MulterError || error.message === 'Unexpected field') {
    response.status(415).json({ code: 'UNSUPPORTED_IMAGE', message: 'Use a JPG, PNG, or WEBP image.' })
    return
  }

  if (error instanceof Error && error.message.startsWith('CORS blocked')) {
    response.status(403).json({ code: 'CORS_BLOCKED', message: 'This website is not allowed to use the API.' })
    return
  }

  response.status(500).json({ code: 'SERVER_ERROR', message: 'Something went wrong. Please try again.' })
}

app.use(errorHandler)
app.listen(env.PORT, () => {
  console.log(`Sutra API listening on http://localhost:${env.PORT}`)
})
