import type { QuizQuestion } from '../components/QuizModal'
import { parseQuizPayload } from './quizPayload'

// Server ko bhejne se pehle text ki limit (backend ka JSON limit 32kb hai).
const MAX_TEXT = 14000

/** Backend se PDF text ke basis par MCQs mangaao. */
export async function generateQuizFromText(
  text: string,
  count: number,
  studentClass?: number,
): Promise<QuizQuestion[]> {
  const trimmed = text.replace(/[ \t]+/g, ' ').trim()
  if (trimmed.length < 50) {
    throw new Error('Is PDF me padhne layak text nahi mila.')
  }

  const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'

  let response: Response
  try {
    response = await fetch(`${apiBase}/quiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: trimmed.slice(0, MAX_TEXT), count, studentClass }),
    })
  } catch {
    throw new Error('Server tak nahi pahunch paye. Internet check karke phir try karo.')
  }

  const payload = (await response.json().catch(() => null)) as
    | { questions?: unknown; message?: string }
    | null

  if (!response.ok) {
    throw new Error(payload?.message ?? 'Quiz nahi ban paya. Phir try karo.')
  }

  const questions = parseQuizPayload(payload?.questions, count)
  if (questions.length === 0) {
    throw new Error('Is PDF se MCQs nahi ban paye. Doosri PDF try karo.')
  }
  return questions
}
