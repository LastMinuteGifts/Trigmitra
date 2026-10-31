import { mathsTutorSystemPrompt } from './aiPrompt.js'
import { structuredSolutionSchema, type StructuredSolution } from './solutionSchema.js'
import { quizResponseSchema, type QuizQuestionPayload } from './quizSchema.js'
import { gradeResponseSchema, type GradePayload } from './gradeSchema.js'

interface VisionConfig {
  apiKey?: string
  apiUrl: string
  model: string
  models: string[]
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>
}

function extractJson(content: string): unknown {
  // AI aksar ```json ... ``` fences me JSON deta hai — unhe hatao.
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const raw = (fenced?.[1] ?? content).trim()
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('AI_INVALID_JSON')
  }
  return JSON.parse(raw.slice(start, end + 1))
}

/**
 * AI kabhi-kabhi LaTeX me likh deta hai ($, \sin, \theta, ^2 ...).
 * Frontend me math renderer nahi hai, isliye sabko readable
 * Unicode text me badlo: sin²(θ), √, ×, ÷, 3/4 ...
 */
export function sanitizeMathText(text: string): string {
  let out = text
  // LaTeX delimiters: $$...$$, $...$, \(...\), \[...\]
  out = out.replace(/\$\$/g, '').replace(/\$/g, '')
  out = out.replace(/\\\(/g, '').replace(/\\\)/g, '').replace(/\\\[/g, '').replace(/\\\]/g, '')
  // \frac{a}{b} -> a/b, \sqrt{a} -> √(a)
  out = out.replace(/\\d?frac\{([^{}]+)\}\{([^{}]+)\}/g, '$1/$2')
  out = out.replace(/\\sqrt\{([^{}]+)\}/g, '√($1)')
  // Trig commands: \sin -> sin ... (sec/tan pehle, taaki \sec galat na kate)
  out = out.replace(/\\(cosec|csc|cot|sec|tan|sin|cos)\b/g, '$1')
  out = out.replace(/\\theta\b/g, 'θ')
  // Common symbols
  out = out.replace(/\\times/g, '×').replace(/\\div/g, '÷').replace(/\\cdot/g, '·')
  out = out.replace(/\\degree/g, '°').replace(/\\circ/g, '°')
  out = out.replace(/\\neq?\b/g, '≠').replace(/\\le\b/g, '≤').replace(/\\ge\b/g, '≥')
  out = out.replace(/\\pm/g, '±').replace(/\\infty/g, '∞')
  // Powers: ^2 -> ² (pehle ^{2} wale form)
  out = out.replace(/\^\{2\}/g, '²').replace(/\^\{3\}/g, '³')
  out = out.replace(/\^2/g, '²').replace(/\^3/g, '³').replace(/\^0/g, '⁰').replace(/\^1/g, '¹')
  out = out.replace(/\^\{([^}]+)\}/g, '^$1')
  // Bachi-khuchi braces aur backslash hatao
  out = out.replace(/[{}]/g, '').replace(/\\/g, '')
  // "theta" shabd -> θ symbol (user ki demand)
  out = out.replace(/\btheta\b/gi, 'θ')
  out = out.replace(/[ \t]{2,}/g, ' ')
  return out.trim()
}

/** Poore solution object ki har string ko saaf karo. */
export function sanitizeSolutionText(value: unknown): unknown {
  if (typeof value === 'string') return sanitizeMathText(value)
  if (Array.isArray(value)) return value.map(sanitizeSolutionText)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, val]) => [key, sanitizeSolutionText(val)]))
  }
  return value
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** 404 = model retired (doosra model try karo). 429/5xx = transient (retry karo). */
function providerStatus(error: unknown): number | null {
  if (error instanceof Error) {
    const match = error.message.match(/^AI_PROVIDER_(\d+)$/)
    if (match) return Number(match[1])
  }
  return null
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: unknown
}

async function requestOnce<T>(
  config: VisionConfig,
  model: string,
  messages: ChatMessage[],
  parse: (content: string) => T,
  jsonMode: boolean,
  temperature: number,
): Promise<T> {
  const response = await fetch(config.apiUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      temperature,
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
      messages,
    }),
  })

  if (!response.ok) throw new Error(`AI_PROVIDER_${response.status}`)
  const payload = await response.json() as ChatCompletionResponse
  const content = payload.choices?.[0]?.message?.content
  if (!content) throw new Error('AI_EMPTY_RESPONSE')

  return parse(content)
}

async function runWithRetry<T>(
  config: VisionConfig,
  buildMessages: () => ChatMessage[],
  parse: (content: string) => T,
  jsonMode = true,
  temperature = 0.1,
): Promise<T> {
  const models = config.models.length > 0 ? config.models : [config.model]
  let lastError: unknown = new Error('AI_NO_MODEL_TRIED')

  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        return await requestOnce(config, model, buildMessages(), parse, jsonMode, temperature)
      } catch (error) {
        lastError = error
        const status = providerStatus(error)
        // Galat key / bad request → retry bekar, turant haar mano.
        if (status === 400 || status === 401 || status === 403) throw error
        // Retired model → agla model try karo.
        if (status === 404) break
        // Transient (429/5xx/parse/network): thoda rukkar dobara.
        if (attempt < 2) await sleep(4000)
      }
    }
    await sleep(2000)
  }

  throw lastError
}

const parseSolution = (content: string): StructuredSolution =>
  structuredSolutionSchema.parse(sanitizeSolutionText(extractJson(content)))

function classHint(studentClass?: number): string {
  return studentClass ? ` The student studies in Class ${studentClass}, so match your explanation level to that class.` : ''
}

export async function solveMathsImage(
  image: Buffer,
  mimetype: string,
  config: VisionConfig,
  studentClass?: number,
  description?: string,
): Promise<StructuredSolution> {
  if (!config.apiKey) {
    throw new Error('AI_PROVIDER_NOT_CONFIGURED')
  }

  let taskText = studentClass
    ? `Analyze this Class ${studentClass} question image (Maths, Physics or Chemistry) and return the required JSON.${classHint(studentClass)}`
    : 'Analyze this school question image (Class 1 to 10, Maths, Physics or Chemistry) and return the required JSON.'
  if (description) {
    taskText += ` Student's note about this photo: "${description}". Use it as a hint.`
  }

  return runWithRetry(config, () => [
    { role: 'system', content: mathsTutorSystemPrompt },
    { role: 'user', content: [{ type: 'text', text: taskText }, { type: 'image_url', image_url: { url: `data:${mimetype};base64,${image.toString('base64')}` } }] },
  ], parseSolution)
}

/** Bina photo: typed question + optional note seedha solve karo. */
export async function solveMathsText(
  questionText: string,
  config: VisionConfig,
  studentClass?: number,
): Promise<StructuredSolution> {
  if (!config.apiKey) {
    throw new Error('AI_PROVIDER_NOT_CONFIGURED')
  }

  const taskText = `Solve this school question typed by the student (Class 1 to 10, Maths, Physics numerical or Chemistry problem) and return the required JSON.${classHint(studentClass)} Question: "${questionText}"`

  return runWithRetry(config, () => [
    { role: 'system', content: mathsTutorSystemPrompt },
    { role: 'user', content: taskText },
  ], parseSolution)
}

const doubtSystemPrompt = `You are AnkNawab, a friendly Indian school teacher (Classes 1 to 10, Maths + Physics numericals + Chemistry). The student just saw a step-by-step solution and now has a DOUBT about it. Answer ONLY the doubt in simple Hinglish, under 80 words. Plain text only with Unicode math (θ ² √ × ÷ − °), never LaTeX ($, backslashes).`

export interface DoubtTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface DoubtContext {
  question: string
  finalAnswer: string
  steps: string[]
}

/** Solution par follow-up doubt ka jawab do (plain text). */
export async function askDoubt(
  turns: DoubtTurn[],
  context: DoubtContext,
  config: VisionConfig,
): Promise<string> {
  if (!config.apiKey) {
    throw new Error('AI_PROVIDER_NOT_CONFIGURED')
  }

  const contextText = `Solved question: "${context.question}". Final answer: ${context.finalAnswer}. Steps: ${context.steps.join(' | ')}`
  return runWithRetry(
    config,
    () => [
      { role: 'system', content: doubtSystemPrompt },
      { role: 'user', content: contextText },
      ...turns.map((t) => ({ role: t.role, content: t.content })),
    ],
    (content) => sanitizeMathText(content).slice(0, 1500),
    false,
    0.3,
  )
}

const quizSystemPrompt = `You are AnkNawab, a question-paper generator for Indian school students (Classes 1 to 10: Maths, Physics numericals, Chemistry). You receive raw text extracted from a student's book page or question paper PDF.

Task: create multiple-choice questions STRICTLY from the given text.

Rules:
- Only use concepts, formulas, definitions, values and numericals that actually appear in the text. Never invent topics.
- Exactly 4 options per question, exactly ONE correct, and 3 plausible but clearly wrong distractors.
- Mix mostly direct recall with a few application/numerical questions.
- "prompt" = the question (max 140 characters). "sub" = short topic or chapter tag (max 40 characters).
- Keep maths in plain Unicode text (θ ² ³ √ × ÷ − ° π ½), NEVER LaTeX ($, backslashes, \\frac, ^).
- Explanation in simple Hinglish, technical terms in English.
- Every question gets "explain": {"q": one-line setup/example, "steps": [2 to 4 short lines]} showing how the correct option is reached.
- Return ONLY valid JSON in this shape: {"questions":[{"prompt":"","sub":"","options":["","","",""],"answer":0,"explain":{"q":"","steps":[""]}}]}
- "answer" is the 0-based index of the correct option.
- Generate exactly the requested number of questions. No Markdown fences, no extra text.`

/** Extract kiye gaye PDF text se MCQs banao. */
export async function generateMcqsFromText(
  text: string,
  count: number,
  config: VisionConfig,
  studentClass?: number,
): Promise<QuizQuestionPayload[]> {
  if (!config.apiKey) {
    throw new Error('AI_PROVIDER_NOT_CONFIGURED')
  }

  const taskText = `Generate exactly ${count} MCQs from this study material.${classHint(studentClass)}\n\n---STUDY MATERIAL START---\n${text}\n---STUDY MATERIAL END---`

  const parsed = await runWithRetry(
    config,
    () => [
      { role: 'system', content: quizSystemPrompt },
      { role: 'user', content: taskText },
    ],
    (content) => quizResponseSchema.parse(sanitizeSolutionText(extractJson(content))),
    true,
    0.4,
  )

  return parsed.questions.slice(0, count)
}

const gradeSystemPrompt = `You are AnkNawab, a fair Indian school teacher grading a STUDENT'S ANSWER to a subjective / board-style question (Classes 1 to 10: Maths, Physics numericals, Chemistry).

The student may answer by uploading a photo of their handwritten solution on paper, and/or by typing the answer. Compare the student's answer with the model answer and expected keywords. Judge the MEANING, not the handwriting style.

Rules:
- Accept any mathematically correct method or equivalent form: 3/4 = 0.75 = 75%, sin²θ + cos²θ = 1 is the same as 1 − sin²θ = cos²θ.
- Read symbols carefully: sin²A vs sin 2A, x vs ×, 0 vs O, √ vs 7, − vs =.
- If the photo is blank, too blurry, or contains no answer: set "readable": false, verdict "wrong", score 0, and say clearly in summary that the photo is not readable.
- "score" is a number from 0 to 1 (NOT percent).
- "matched" = short expected points the student actually got. "missing" = important expected points that are missing. Each item under 60 characters, max 6 items.
- "summary" = friendly Hinglish feedback, max 2 short sentences. No LaTeX.
- "transcript" = what you read from the student's answer (plain Unicode math like θ ² √ × ÷ − °, max 500 characters). If only typed text was given, repeat it briefly.
- Return ONLY valid JSON in this exact shape, no Markdown fences: {"verdict":"correct|partial|wrong","score":0.0,"readable":true,"summary":"","matched":[],"missing":[],"transcript":""}`

export interface GradeInput {
  prompt: string
  modelAnswer: string
  keywords?: string[]
  answerText?: string
  studentClass?: number
}

function cleanList(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].slice(0, 6)
}

function finalizeGrade(payload: GradePayload): GradePayload {
  const score = payload.score ?? (payload.verdict === 'correct' ? 0.8 : payload.verdict === 'partial' ? 0.5 : 0.2)
  // AI ka verdict meaningful hai (explanation missing par partial etc.) — use as-is.
  // Sirf tab derive karo jab AI ne verdict nahi diya.
  const verdict = payload.verdict ?? (score >= 0.6 ? 'correct' : score >= 0.4 ? 'partial' : 'wrong')
  return {
    ...payload,
    score,
    verdict,
    summary: payload.summary.trim() || (verdict === 'correct' ? 'Sahi jawab!' : 'Model answer se compare karo.'),
    matched: cleanList(payload.matched),
    missing: cleanList(payload.missing),
    transcript: payload.transcript?.trim().slice(0, 1200) || undefined,
  }
}

/** Student ke photo (aur optional typed text) ko model answer se compare karo. */
export async function gradeSubjectiveAnswer(
  input: GradeInput,
  config: VisionConfig,
  image?: { buffer: Buffer; mimetype: string },
): Promise<GradePayload> {
  if (!config.apiKey) {
    throw new Error('AI_PROVIDER_NOT_CONFIGURED')
  }

  const keywordLine = input.keywords?.length ? input.keywords.join(', ') : '(none)'
  const typedLine = input.answerText ? `\nTyped answer from student: "${input.answerText}"` : ''
  const contextText = `Question: ${input.prompt}
Model answer: ${input.modelAnswer}
Expected keywords / points: ${keywordLine}${typedLine}${classHint(input.studentClass)}`

  const userContent: unknown = image
    ? [
        { type: 'text', text: contextText },
        { type: 'image_url', image_url: { url: `data:${image.mimetype};base64,${image.buffer.toString('base64')}` } },
      ]
    : contextText

  return runWithRetry(
    config,
    () => [
      { role: 'system', content: gradeSystemPrompt },
      { role: 'user', content: userContent },
    ],
    (content) => finalizeGrade(gradeResponseSchema.parse(sanitizeSolutionText(extractJson(content)))),
    true,
    0.1,
  )
}
