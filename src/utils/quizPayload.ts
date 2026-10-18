import type { QuizQuestion } from '../components/QuizModal'

/**
 * Server/AI se aaya payload validate karke saaf MCQ list banao.
 * Galat ya ambiguous question (duplicate options, out-of-range answer) skip ho jate hain.
 */
export function parseQuizPayload(raw: unknown, count: number): QuizQuestion[] {
  if (!Array.isArray(raw)) return []
  const out: QuizQuestion[] = []

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>

    const prompt = typeof record.prompt === 'string' ? record.prompt.trim() : ''
    if (!prompt) continue

    const options = Array.isArray(record.options)
      ? record.options
          .filter((value): value is string => typeof value === 'string')
          .map((value) => value.trim())
          .filter(Boolean)
      : []
    if (options.length !== 4 || new Set(options).size !== 4) continue

    const answer = typeof record.answer === 'number' ? Math.trunc(record.answer) : -1
    if (answer < 0 || answer > 3) continue

    let explain: QuizQuestion['explain'] = null
    const rawExplain = record.explain
    if (rawExplain && typeof rawExplain === 'object') {
      const ex = rawExplain as Record<string, unknown>
      const exampleQ = typeof ex.q === 'string' ? ex.q.trim() : ''
      const steps = Array.isArray(ex.steps)
        ? ex.steps
            .filter((value): value is string => typeof value === 'string')
            .map((value) => value.trim())
            .filter(Boolean)
        : []
      if (exampleQ && steps.length > 0) explain = { q: exampleQ, steps }
    }

    out.push({
      prompt,
      sub: typeof record.sub === 'string' ? record.sub.trim() : '',
      options,
      answer,
      explain,
    })
    if (out.length >= count) break
  }

  return out
}
