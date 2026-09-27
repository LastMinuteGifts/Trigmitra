import { mathsTutorSystemPrompt } from './aiPrompt.js'
import { structuredSolutionSchema, type StructuredSolution } from './solutionSchema.js'

interface VisionConfig {
  apiKey?: string
  apiUrl: string
  model: string
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

export async function solveMathsImage(image: Buffer, mimetype: string, config: VisionConfig, studentClass?: number): Promise<StructuredSolution> {
  if (!config.apiKey) {
    throw new Error('AI_PROVIDER_NOT_CONFIGURED')
  }

  const taskText = studentClass
    ? `Analyze this Class ${studentClass} maths question image and return the required JSON. The student studies in Class ${studentClass}, so match your explanation level to that class.`
    : 'Analyze this school maths question image (Class 1 to 10) and return the required JSON.'

  const response = await fetch(config.apiUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: mathsTutorSystemPrompt },
        { role: 'user', content: [{ type: 'text', text: taskText }, { type: 'image_url', image_url: { url: `data:${mimetype};base64,${image.toString('base64')}` } }] },
      ],
    }),
  })

  if (!response.ok) throw new Error(`AI_PROVIDER_${response.status}`)
  const payload = await response.json() as ChatCompletionResponse
  const content = payload.choices?.[0]?.message?.content
  if (!content) throw new Error('AI_EMPTY_RESPONSE')

  return structuredSolutionSchema.parse(sanitizeSolutionText(extractJson(content)))
}
