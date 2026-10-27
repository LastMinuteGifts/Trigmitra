// Daily challenge — har din ka set fix rehta hai (date se seed), taaki sab
// students ko same 5 sawaal milein aur kal dobara naya set aaye.

import type { QuizQuestion } from '../types/quiz'

/** FNV-1a hash — date string se stable number. */
export function hashSeed(text: string): number {
  let hash = 2166136261
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/** Mulberry32 PRNG — deterministic, fast, Math.random jaisa. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function seededShuffle<T>(items: T[], seed: number): T[] {
  const random = seededRandom(seed)
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/**
 * Din ka challenge: pehle ek subjective + chaar MCQ (agar pool me hain),
 * warna jo available hai usse 5 sawaal.
 */
export function buildDailyChallenge(day: string, pool: QuizQuestion[], count = 5): QuizQuestion[] {
  if (pool.length === 0) return []
  const seed = hashSeed(`anknawab-daily-${day}`)
  const shuffled = seededShuffle(pool, seed)
  const wanted = Math.min(count, shuffled.length)
  const subjective = shuffled.filter((question) => question.type === 'subjective')
  const mcq = shuffled.filter((question) => question.type === 'mcq')

  const picked: QuizQuestion[] = []
  if (subjective.length > 0) picked.push(subjective[0])
  for (const question of mcq) {
    if (picked.length >= wanted) break
    picked.push(question)
  }
  // Pool me MCQ kam pade to baaki subjective se bhar do.
  for (const question of subjective.slice(1)) {
    if (picked.length >= wanted) break
    if (!picked.includes(question)) picked.push(question)
  }
  return seededShuffle(picked, seed + 7).slice(0, wanted)
}

/** "Kal ka challenge" preview ke liye — agla din. */
export function nextDayKey(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
