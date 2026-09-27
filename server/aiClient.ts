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

export async function solveMathsImage(image: Buffer, mimetype: string, config: VisionConfig): Promise<StructuredSolution> {
  if (!config.apiKey) {
    throw new Error('AI_PROVIDER_NOT_CONFIGURED')
  }

  const response = await fetch(config.apiUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: mathsTutorSystemPrompt },
        { role: 'user', content: [{ type: 'text', text: 'Analyze this Class 10 maths question image and return the required JSON.' }, { type: 'image_url', image_url: { url: `data:${mimetype};base64,${image.toString('base64')}` } }] },
      ],
    }),
  })

  if (!response.ok) throw new Error(`AI_PROVIDER_${response.status}`)
  const payload = await response.json() as ChatCompletionResponse
  const content = payload.choices?.[0]?.message?.content
  if (!content) throw new Error('AI_EMPTY_RESPONSE')

  return structuredSolutionSchema.parse(extractJson(content))
}
