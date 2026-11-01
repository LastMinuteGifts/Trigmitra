import type { LeaderEntry } from '../utils/quizStore'

const apiBase = () => import.meta.env?.VITE_API_BASE_URL || 'http://localhost:4000/api'

export async function fetchSharedLeaderboard(classNum: number | null): Promise<LeaderEntry[] | null> {
  try {
    const url = `${apiBase()}/leaderboard?classNum=${classNum === null ? 'all' : classNum}&limit=20`
    const response = await fetch(url)
    if (!response.ok) return null
    const payload = (await response.json()) as { entries?: LeaderEntry[] }
    return Array.isArray(payload.entries) ? payload.entries : []
  } catch {
    return null
  }
}

export async function submitSharedLeaderEntry(entry: LeaderEntry): Promise<LeaderEntry[] | null> {
  try {
    const response = await fetch(`${apiBase()}/leaderboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    })
    if (!response.ok) return null
    const payload = (await response.json()) as { entries?: LeaderEntry[] }
    return Array.isArray(payload.entries) ? payload.entries : null
  } catch {
    return null
  }
}