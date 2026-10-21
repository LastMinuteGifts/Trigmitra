const apiBase = () => import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'

export interface TeacherSession {
  email: string
  name: string
}

export interface TeacherLoginResult {
  token: string
  teacher: TeacherSession
}

export const TEACHER_TOKEN_KEY = 'anknawab_teacher_token'

export async function teacherLogin(email: string, password: string): Promise<TeacherLoginResult> {
  const response = await fetch(`${apiBase()}/teacher/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const payload = (await response.json().catch(() => ({}))) as {
    token?: string
    teacher?: TeacherSession
    message?: string
  }
  if (!response.ok || !payload.token || !payload.teacher) {
    throw new Error(payload.message ?? 'Login nahi ho paya.')
  }
  return { token: payload.token, teacher: payload.teacher }
}

export async function fetchTeacherSession(token: string): Promise<TeacherSession | null> {
  try {
    const response = await fetch(`${apiBase()}/teacher/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) return null
    const payload = (await response.json()) as { teacher?: TeacherSession }
    return payload.teacher ?? null
  } catch {
    return null
  }
}

export function teacherAuthHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` }
}
