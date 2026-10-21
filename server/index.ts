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
import {
  getAdminClient,
  getAdminOverview,
  getUserActivity,
  setUserAccess,
  checkSolveAllowed,
  ensureTrialAccess,
} from './admin.js'
import { listOverrides, upsertOverride, deleteOverride } from './notesStore.js'
import {
  addTeacher,
  authenticateTeacher,
  createTeacherToken,
  listTeachers,
  removeTeacher,
  verifyTeacherToken,
} from './teachers.js'

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
  TEACHER_SECRET: z.string().trim().optional().transform((v) => (v ? v : undefined)),
  TEACHER_SESSION_SECRET: z.string().trim().optional().transform((v) => (v ? v : undefined)),
  AI_DAILY_BUDGET: z.coerce.number().int().min(1).default(500),
}).parse(process.env)

// Teachers ke liye alag key; agar set na ho to admin key hi chalti hai.
const teacherSecret = env.TEACHER_SECRET ?? env.ADMIN_SECRET

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

app.get('/api/admin/user/:userId', adminAuth, async (request, response) => {
  const client = getAdminClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
  if (!client) {
    response.status(503).json({ code: 'ADMIN_DB_MISSING', message: 'Supabase admin is not configured.' })
    return
  }
  try {
    const { userId } = z.object({ userId: z.string().uuid() }).parse(request.params)
    const activity = await getUserActivity(client, userId, 300)
    response.json({ status: 'ok', activity })
  } catch (error) {
    console.error(error)
    response.status(502).json({ code: 'ADMIN_QUERY_FAILED', message: 'User data load nahi hua.' })
  }
})

// Teacher auth: naya email/password login Bearer token bhejta hai. Purani
// `x-teacher-key` (TEACHER_SECRET / ADMIN_SECRET) bhi chalti rehti hai.
const teacherAuth: express.RequestHandler = (request, response, next) => {
  const header = request.header('authorization') ?? ''
  if (header.toLowerCase().startsWith('bearer ')) {
    const session = verifyTeacherToken(header.slice(7).trim())
    if (!session) {
      response.status(401).json({ code: 'TEACHER_SESSION_INVALID', message: 'Session expire ho gaya, dobara login karo.' })
      return
    }
    response.locals.teacher = session
    next()
    return
  }
  if (!teacherSecret) {
    response.status(503).json({ code: 'TEACHER_NOT_CONFIGURED', message: 'Teacher panel server par configured nahi hai.' })
    return
  }
  const key = request.header('x-teacher-key')
  const expected = Buffer.from(teacherSecret)
  const actual = Buffer.from(key ?? '')
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    response.status(403).json({ code: 'TEACHER_FORBIDDEN', message: 'Galat teacher key.' })
    return
  }
  next()
}

// Admin: teacher accounts (email + password) manage karna.
app.get('/api/admin/teachers', adminAuth, async (_request, response) => {
  const client = getAdminClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
  if (!client) {
    response.status(503).json({ code: 'ADMIN_DB_MISSING', message: 'Supabase admin is not configured.' })
    return
  }
  try {
    const [teachers, overrides] = await Promise.all([listTeachers(client), listOverrides(client)])
    // Har teacher ke edits gino (notes updatedBy se).
    const stats = new Map<
      string,
      { edits: number; lastEditedAt: string | null; lastClass: number | null; lastChapter: string | null }
    >()
    for (const note of overrides) {
      const key = note.updatedBy.trim().toLowerCase()
      if (!key) continue
      const current = stats.get(key) ?? { edits: 0, lastEditedAt: null, lastClass: null, lastChapter: null }
      current.edits += 1
      if (!current.lastEditedAt || note.updatedAt > current.lastEditedAt) {
        current.lastEditedAt = note.updatedAt
        current.lastClass = note.class
        current.lastChapter = note.chapter
      }
      stats.set(key, current)
    }
    const rows = teachers.map((teacher) => {
      const stat = stats.get(teacher.email.toLowerCase())
      return {
        ...teacher,
        edits: stat?.edits ?? 0,
        lastEditedAt: stat?.lastEditedAt ?? null,
        lastClass: stat?.lastClass ?? null,
        lastChapter: stat?.lastChapter ?? null,
      }
    })
    const recent = overrides
      .slice()
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 8)
      .map((note) => ({
        class: note.class,
        chapter: note.chapter,
        updatedBy: note.updatedBy,
        updatedAt: note.updatedAt,
      }))
    response.json({ status: 'ok', teachers: rows, recent })
  } catch (error) {
    console.error(error)
    response.status(502).json({ code: 'ADMIN_QUERY_FAILED', message: 'Teachers load nahi hue.' })
  }
})

// Admin: ek teacher ne kaun se notes edit kiye.
app.get('/api/admin/teachers/:email/notes', adminAuth, async (request, response) => {
  const client = getAdminClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
  if (!client) {
    response.status(503).json({ code: 'ADMIN_DB_MISSING', message: 'Supabase admin is not configured.' })
    return
  }
  try {
    const { email } = z.object({ email: z.string().trim().toLowerCase().min(3).max(160) }).parse(request.params)
    const notes = (await listOverrides(client))
      .filter((note) => note.updatedBy.trim().toLowerCase() === email)
      .map((note) => ({
        class: note.class,
        chapter: note.chapter,
        summary: note.summary,
        points: note.points,
        updatedAt: note.updatedAt,
      }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    response.json({ status: 'ok', notes })
  } catch (error) {
    if (error instanceof z.ZodError) {
      response.status(400).json({ code: 'ADMIN_BAD_INPUT', message: 'Galat email.' })
      return
    }
    console.error(error)
    response.status(502).json({ code: 'ADMIN_QUERY_FAILED', message: 'Teacher edits load nahi hue.' })
  }
})

app.post('/api/admin/teachers', adminAuth, async (request, response) => {
  const client = getAdminClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
  if (!client) {
    response.status(503).json({ code: 'ADMIN_DB_MISSING', message: 'Supabase admin is not configured.' })
    return
  }
  try {
    const body = z.object({
      email: z.string().trim().email().max(160),
      name: z.string().trim().max(80).optional(),
      password: z.string().min(8).max(200),
    }).parse(request.body)
    const teacher = await addTeacher(client, body, 'admin')
    response.status(201).json({ status: 'ok', teacher })
  } catch (error) {
    if (error instanceof z.ZodError) {
      response.status(400).json({ code: 'ADMIN_BAD_INPUT', message: 'Email sahi do aur password kam se kam 8 characters ka rakho.' })
      return
    }
    if (error instanceof Error && error.message === 'TEACHER_EXISTS') {
      response.status(409).json({ code: 'TEACHER_EXISTS', message: 'Is email ka teacher account pehle se hai.' })
      return
    }
    console.error(error)
    response.status(502).json({ code: 'ADMIN_SAVE_FAILED', message: 'Teacher account nahi bana.' })
  }
})

app.delete('/api/admin/teachers', adminAuth, async (request, response) => {
  const client = getAdminClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
  if (!client) {
    response.status(503).json({ code: 'ADMIN_DB_MISSING', message: 'Supabase admin is not configured.' })
    return
  }
  try {
    const body = z.object({ email: z.string().trim().email().max(160) }).parse(request.body)
    const removed = await removeTeacher(client, body.email)
    response.json({ status: 'ok', removed })
  } catch (error) {
    if (error instanceof z.ZodError) {
      response.status(400).json({ code: 'ADMIN_BAD_INPUT', message: 'Galat email.' })
      return
    }
    console.error(error)
    response.status(502).json({ code: 'ADMIN_SAVE_FAILED', message: 'Teacher account nahi hata.' })
  }
})

// Login par sakht limit: 10 min me max 12 attempts per IP.
const teacherLoginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 12,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { code: 'TEACHER_LOGIN_RATE', message: 'Bahut zyada login attempts. Thodi der baad try karo.' },
})

app.post('/api/teacher/login', teacherLoginLimiter, async (request, response) => {
  const client = getAdminClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
  if (!client) {
    response.status(503).json({ code: 'TEACHER_DB_MISSING', message: 'Teacher login server par configured nahi hai.' })
    return
  }
  if (!env.ADMIN_SECRET && !env.TEACHER_SESSION_SECRET) {
    response.status(503).json({ code: 'TEACHER_NOT_CONFIGURED', message: 'Teacher login server par configured nahi hai.' })
    return
  }
  try {
    const body = z.object({
      email: z.string().trim().email().max(160),
      password: z.string().min(1).max(200),
    }).parse(request.body)
    const teacher = await authenticateTeacher(client, body.email, body.password)
    if (!teacher) {
      response.status(401).json({ code: 'TEACHER_LOGIN_FAILED', message: 'Email ya password galat hai.' })
      return
    }
    const token = createTeacherToken({ email: teacher.email, name: teacher.name })
    response.json({ status: 'ok', token, teacher })
  } catch (error) {
    if (error instanceof z.ZodError) {
      response.status(400).json({ code: 'TEACHER_BAD_INPUT', message: 'Email aur password sahi bharo.' })
      return
    }
    console.error(error)
    response.status(502).json({ code: 'TEACHER_LOGIN_FAILED', message: 'Login nahi ho paya. Thodi der baad try karo.' })
  }
})

app.get('/api/teacher/me', teacherAuth, (_request, response) => {
  const session = response.locals.teacher as { email: string; name: string } | undefined
  response.json({
    status: 'ok',
    teacher: session ?? { email: 'access-key', name: 'Access key' },
  })
})

// Public: teacher ne jo notes edit kiye, woh chapter page par dikhein.
app.get('/api/notes', async (request, response) => {
  const client = getAdminClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
  if (!client) {
    response.json({ status: 'ok', notes: [] })
    return
  }
  try {
    const classNum = z.coerce.number().int().min(1).max(10).optional().parse(request.query.class ?? undefined)
    const notes = await listOverrides(client, classNum)
    response.json({ status: 'ok', notes })
  } catch (error) {
    // Public page kabhi break na ho — bas default notes dikhein.
    console.error('notes list failed:', error)
    response.json({ status: 'ok', notes: [] })
  }
})

app.get('/api/teacher/notes', teacherAuth, async (request, response) => {
  const client = getAdminClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
  if (!client) {
    response.status(503).json({ code: 'TEACHER_DB_MISSING', message: 'Supabase configured nahi hai.' })
    return
  }
  try {
    const classNum = z.coerce.number().int().min(1).max(10).optional().parse(request.query.class ?? undefined)
    const notes = await listOverrides(client, classNum)
    response.json({ status: 'ok', notes })
  } catch (error) {
    console.error(error)
    response.status(502).json({ code: 'TEACHER_QUERY_FAILED', message: 'Notes load nahi hue.' })
  }
})

app.put('/api/teacher/notes', teacherAuth, async (request, response) => {
  const client = getAdminClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
  if (!client) {
    response.status(503).json({ code: 'TEACHER_DB_MISSING', message: 'Supabase configured nahi hai.' })
    return
  }
  try {
    const body = z.object({
      class: z.coerce.number().int().min(1).max(10),
      chapter: z.string().trim().min(1).max(160),
      summary: z.string().trim().min(1).max(2000),
      points: z.array(z.string().trim().max(500)).max(40).default([]),
      updatedBy: z.string().trim().max(80).optional(),
    }).parse(request.body)
    const session = response.locals.teacher as { email?: string } | undefined
    const saved = await upsertOverride(client, {
      ...body,
      updatedBy: session?.email ?? body.updatedBy,
    })
    response.json({ status: 'ok', note: saved })
  } catch (error) {
    if (error instanceof z.ZodError) {
      response.status(400).json({ code: 'TEACHER_BAD_INPUT', message: 'Summary aur key points sahi bharo.' })
      return
    }
    console.error(error)
    response.status(502).json({ code: 'TEACHER_SAVE_FAILED', message: 'Notes save nahi hue.' })
  }
})

app.delete('/api/teacher/notes', teacherAuth, async (request, response) => {
  const client = getAdminClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
  if (!client) {
    response.status(503).json({ code: 'TEACHER_DB_MISSING', message: 'Supabase configured nahi hai.' })
    return
  }
  try {
    const body = z.object({
      class: z.coerce.number().int().min(1).max(10),
      chapter: z.string().trim().min(1).max(160),
    }).parse(request.body)
    const removed = await deleteOverride(client, body.class, body.chapter)
    response.json({ status: 'ok', removed })
  } catch (error) {
    if (error instanceof z.ZodError) {
      response.status(400).json({ code: 'TEACHER_BAD_INPUT', message: 'Galat input.' })
      return
    }
    console.error(error)
    response.status(502).json({ code: 'TEACHER_DELETE_FAILED', message: 'Notes reset nahi hue.' })
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
