import 'dotenv/config'
import cors from 'cors'
import express, { type ErrorRequestHandler } from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import multer from 'multer'
import { z } from 'zod'
import { solveMathsImage } from './aiClient.js'
import { buildDemoSolution } from './localSolver.js'

const env = z.object({
  PORT: z.coerce.number().default(4000),
  CLIENT_ORIGIN: z.string().default('http://127.0.0.1:5173,http://localhost:5173'),
  AI_API_KEY: z.string().optional(),
  AI_API_URL: z.string().url().default('https://api.openai.com/v1/chat/completions'),
  AI_MODEL: z.string().default('gpt-4o-mini'),
  DEMO_MODE: z.string().default('true'),
}).parse(process.env)

const allowedOrigins = env.CLIENT_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean)

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
    if (!origin || allowedOrigins.includes(origin)) {
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
  if (!request.file) {
    response.status(400).json({ code: 'IMAGE_REQUIRED', message: 'Question image is required.' })
    return
  }

  // AI key nahi hai → offline demo solution do taaki UI kabhi atak na jaye.
  if (!env.AI_API_KEY && env.DEMO_MODE === 'true') {
    response.json({
      status: 'demo',
      message: 'Demo mode: AI key configure nahi hai, isliye sample solution dikhaya ja raha hai.',
      solution: buildDemoSolution(),
    })
    return
  }

  try {
    const solution = await solveMathsImage(request.file.buffer, request.file.mimetype, {
      apiKey: env.AI_API_KEY,
      apiUrl: env.AI_API_URL,
      model: env.AI_MODEL,
    })
    response.json({ status: 'complete', solution })
  } catch (error) {
    // AI fail ho jaye to bhi demo fallback do (agar DEMO_MODE on hai).
    if (env.DEMO_MODE === 'true') {
      console.error('AI failed, serving demo solution:', error)
      response.json({
        status: 'demo',
        message: 'AI se connect nahi ho paya, isliye sample solution dikhaya ja raha hai.',
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

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    response.status(413).json({ code: 'IMAGE_TOO_LARGE', message: 'Image must be smaller than 10 MB.' })
    return
  }

  if (error instanceof multer.MulterError || error.message === 'Unexpected field') {
    response.status(415).json({ code: 'UNSUPPORTED_IMAGE', message: 'Use a JPG, PNG, or WEBP image.' })
    return
  }

  response.status(500).json({ code: 'SERVER_ERROR', message: 'Something went wrong. Please try again.' })
}

app.use(errorHandler)
app.listen(env.PORT, () => {
  console.log(`Sutra API listening on http://localhost:${env.PORT}`)
})
