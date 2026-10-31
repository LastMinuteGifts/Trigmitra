import { supabase } from '../lib/supabase'
import type { SubjectiveCheck } from './answerCheck'

/** AI se check hua jawab — local check se alag, isliye source bhi aata hai. */
export interface AiGradeResult extends SubjectiveCheck {
  source: 'ai'
  transcript?: string
}

export interface GradePhotoInput {
  file: File
  prompt: string
  modelAnswer: string
  keywords?: string[]
  answerText?: string
  studentClass?: number | null
}

// Phone ki 5-8 MB photo bhejne se pehle chhoti karo (AI tokens + bandwidth bachao).
const MAX_SIDE = 1400

function apiBase(): string {
  return import.meta.env?.VITE_API_BASE_URL || 'http://localhost:4000/api'
}

async function compressImage(file: File): Promise<File | Blob> {
  if (!file.type.startsWith('image/')) return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return file
    context.drawImage(bitmap, 0, 0, width, height)
    bitmap.close?.()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    return blob ?? file
  } catch {
    // Purane browser me createImageBitmap na ho to original photo hi bhejo.
    return file
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  if (!supabase) return {}
  try {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    return token ? { Authorization: `Bearer ${token}` } : {}
  } catch {
    return {}
  }
}

/** Photo ko backend par bhej kar AI se check karwao. */
export async function gradePhotoAnswer(input: GradePhotoInput): Promise<AiGradeResult> {
  const form = new FormData()
  const image = await compressImage(input.file)
  form.append('answerImage', image, image instanceof File ? image.name : 'answer.jpg')
  form.append('prompt', input.prompt)
  form.append('modelAnswer', input.modelAnswer)
  if (input.keywords?.length) form.append('keywords', JSON.stringify(input.keywords.slice(0, 16)))
  if (input.answerText?.trim()) form.append('answerText', input.answerText.trim())
  if (input.studentClass) form.append('studentClass', String(input.studentClass))

  const headers = await authHeaders()

  let response: Response
  try {
    response = await fetch(`${apiBase()}/grade`, { method: 'POST', headers, body: form })
  } catch {
    throw new Error('Server tak nahi pahunch paye. Internet check karke photo dobara bhejo.')
  }

  const payload = (await response.json().catch(() => null)) as
    | { check?: AiGradeResult; message?: string; code?: string }
    | null

  if (!response.ok || !payload?.check) {
    throw new Error(payload?.message ?? 'AI check nahi ho paya. Photo dobara bhejo ya jawab likh kar check karo.')
  }

  const check = payload.check
  return {
    ...check,
    correct: check.verdict === 'correct',
    verdict: check.verdict,
    source: 'ai',
  }
}
