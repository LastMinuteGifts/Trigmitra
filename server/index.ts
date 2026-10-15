import 'dotenv/config'
import cors from 'cors'
import express, { type ErrorRequestHandler } from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import multer from 'multer'
import { z } from 'zod'
import { solveMathsImage, solveMathsText } from './aiClient.js'
import { buildDemoSolution } from './localSolver.js'
import { getAdminClient, getAdminOverview, setUserAccess, checkSolveAllowed } from './admin.js'

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
}).parse(process.env)

const aiModels = (env.AI_MODELS ?? env.AI_MODEL).split(',').map((s) => s.trim()).filter(Boolean)

const normalizeOrigin = (value: string) => value.trim().replace(/\/+$/, '').toLowerCase()
const allowedOrigins = env.CLIENT_ORIGIN.split(',').map(normalizeOrigin).filter(Boolean)

const app = express()
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

app.post('/api/solve', upload.single('questionImage'), async (request, response) => {
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
    const config = {
      apiKey: env.AI_API_KEY,
      apiUrl: env.AI_API_URL,
      model: env.AI_MODEL,
      models: aiModels,
    }
    const solution = request.file
      ? await solveMathsImage(request.file.buffer, request.file.mimetype, config, studentClass, description || undefined)
      : await solveMathsText(questionText, config, studentClass)
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

const adminAuth: express.RequestHandler = (request, response, next) => {
  if (!env.ADMIN_SECRET) {
    response.status(503).json({ code: 'ADMIN_NOT_CONFIGURED', message: 'Admin is not configured on server.' })
    return
  }
  const key = request.header('x-admin-key')
  if (!key || key !== env.ADMIN_SECRET) {
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
