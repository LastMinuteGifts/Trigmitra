// Quiz ki local memory — best score, adhura quiz, topic-wise accuracy, streak,
// daily challenge, attempts aur leaderboard. Sab localStorage me, try/catch ke saath.

import type { QuizDifficulty } from '../types/quiz'

export const QUIZ_BEST_KEY = 'anknawab_quiz_best'
export const QUIZ_PROGRESS_KEY = 'anknawab_quiz_progress'
export const QUIZ_STATS_KEY = 'anknawab_quiz_stats'
export const QUIZ_ATTEMPTS_KEY = 'anknawab_quiz_attempts'
export const QUIZ_STREAK_KEY = 'anknawab_quiz_streak'
export const QUIZ_DAILY_KEY = 'anknawab_quiz_daily'
export const QUIZ_LEADER_KEY = 'anknawab_quiz_leaderboard'
export const QUIZ_NAME_KEY = 'anknawab_quiz_name'

export interface TopicStat {
  correct: number
  total: number
}

export interface QuizStats {
  topics: Record<string, TopicStat>
  total: number
  correct: number
}

export interface AttemptRecord {
  at: string
  score: number
  total: number
  topics: string[]
  mode: string
  seconds: number
  difficulty: QuizDifficulty | 'Mixed'
}

export interface StreakState {
  count: number
  lastDay: string
  best: number
}

export interface DailyState {
  day: string
  score: number
  total: number
  best: number
  attempts: number
}

export interface LeaderEntry {
  name: string
  score: number
  total: number
  day: string
  mode: string
  /** Quiz ke waqt student ki class. Purani entries me missing ho sakti hai. */
  classNum?: number | null
}

/**
 * Class-wise leaderboard: class do to sirf usi class ke entries, `null` do to
 * saare (All classes). Purani class-less entries sirf "All classes" me aati hain.
 */
export function filterLeaderboard(entries: LeaderEntry[], classNum: number | null): LeaderEntry[] {
  if (classNum === null) return entries
  return entries.filter((entry) => entry.classNum === classNum)
}

/** Heading ke liye scope label. */
export function leaderboardScope(classNum: number | null): string {
  return classNum ? `Class ${classNum}` : 'All classes'
}

function storage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    return window.localStorage
  } catch {
    return null
  }
}

export function readJSON<T>(key: string, fallback: T): T {
  const store = storage()
  if (!store) return fallback
  try {
    const raw = store.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function writeJSON(key: string, value: unknown): void {
  const store = storage()
  if (!store) return
  try {
    store.setItem(key, JSON.stringify(value))
  } catch {
    // quota / private mode — ignore
  }
}

export function removeKey(key: string): void {
  const store = storage()
  if (!store) return
  try {
    store.removeItem(key)
  } catch {
    // ignore
  }
}

/** Local date YYYY-MM-DD (UTC nahi, taaki raat 12 baje ke baad naya din lage). */
export function todayKey(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function previousDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  if (!y || !m || !d) return ''
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() - 1)
  return todayKey(date)
}

const EMPTY_STATS: QuizStats = { topics: {}, total: 0, correct: 0 }

export function loadStats(): QuizStats {
  const stats = readJSON<QuizStats>(QUIZ_STATS_KEY, EMPTY_STATS)
  if (!stats || typeof stats !== 'object' || !stats.topics) return { ...EMPTY_STATS }
  return {
    topics: stats.topics,
    total: Number(stats.total) || 0,
    correct: Number(stats.correct) || 0,
  }
}

/** Ek jawab ki accuracy topic ke khaate me daalo. */
export function recordTopicAnswer(topic: string | undefined, correct: boolean): QuizStats {
  const stats = loadStats()
  const key = (topic ?? 'General').trim() || 'General'
  const entry = stats.topics[key] ?? { correct: 0, total: 0 }
  stats.topics[key] = { correct: entry.correct + (correct ? 1 : 0), total: entry.total + 1 }
  stats.total += 1
  stats.correct += correct ? 1 : 0
  writeJSON(QUIZ_STATS_KEY, stats)
  return stats
}

export function topicAccuracy(stat: TopicStat | undefined): number {
  if (!stat || stat.total === 0) return 0
  return stat.correct / stat.total
}

export interface WeakTopic {
  topic: string
  accuracy: number
  total: number
}

/** Sabse kam accuracy wale topics (kam se kam 2 attempt hue ho). */
export function weakTopics(stats: QuizStats, limit = 3): WeakTopic[] {
  return Object.entries(stats.topics)
    .filter(([, stat]) => stat.total >= 2)
    .map(([topic, stat]) => ({ topic, accuracy: topicAccuracy(stat), total: stat.total }))
    .filter((entry) => entry.accuracy < 0.75)
    .sort((a, b) => a.accuracy - b.accuracy || b.total - a.total)
    .slice(0, limit)
}

const MAX_ATTEMPTS = 30

export function loadAttempts(): AttemptRecord[] {
  const list = readJSON<AttemptRecord[]>(QUIZ_ATTEMPTS_KEY, [])
  return Array.isArray(list) ? list : []
}

export function addAttempt(attempt: AttemptRecord): AttemptRecord[] {
  const list = [attempt, ...loadAttempts()].slice(0, MAX_ATTEMPTS)
  writeJSON(QUIZ_ATTEMPTS_KEY, list)
  return list
}

export function loadStreak(): StreakState {
  const raw = readJSON<StreakState>(QUIZ_STREAK_KEY, { count: 0, lastDay: '', best: 0 })
  return {
    count: Math.max(0, Number(raw.count) || 0),
    lastDay: typeof raw.lastDay === 'string' ? raw.lastDay : '',
    best: Math.max(0, Number(raw.best) || 0),
  }
}

/**
 * Quiz complete hone par streak update: kal khela tha to +1, aaj pehle hi khela
 * hai to same, warna 1 se shuru.
 */
export function touchStreak(day = todayKey()): StreakState {
  const current = loadStreak()
  let count = 1
  if (current.lastDay === day) count = Math.max(1, current.count)
  else if (current.lastDay === previousDay(day)) count = current.count + 1

  const next: StreakState = { count, lastDay: day, best: Math.max(current.best, count) }
  writeJSON(QUIZ_STREAK_KEY, next)
  return next
}

export function loadDaily(day = todayKey()): DailyState {
  const raw = readJSON<DailyState>(QUIZ_DAILY_KEY, { day, score: 0, total: 0, best: 0, attempts: 0 })
  if (raw.day !== day) return { day, score: 0, total: 0, best: 0, attempts: 0 }
  return {
    day,
    score: Number(raw.score) || 0,
    total: Number(raw.total) || 0,
    best: Number(raw.best) || 0,
    attempts: Number(raw.attempts) || 0,
  }
}

export function saveDaily(score: number, total: number, day = todayKey()): DailyState {
  const current = loadDaily(day)
  const next: DailyState = {
    day,
    score,
    total,
    best: Math.max(current.best, score),
    attempts: current.attempts + 1,
  }
  writeJSON(QUIZ_DAILY_KEY, next)
  return next
}

const MAX_LEADER = 10

export function loadLeaderboard(): LeaderEntry[] {
  const list = readJSON<LeaderEntry[]>(QUIZ_LEADER_KEY, [])
  return Array.isArray(list) ? list.filter((entry) => entry && typeof entry.score === 'number') : []
}

export function addLeaderEntry(entry: LeaderEntry): LeaderEntry[] {
  const list = [...loadLeaderboard(), entry]
    .sort((a, b) => {
      const aPct = a.total > 0 ? a.score / a.total : 0
      const bPct = b.total > 0 ? b.score / b.total : 0
      return bPct - aPct || b.score - a.score
    })
    .slice(0, MAX_LEADER)
  writeJSON(QUIZ_LEADER_KEY, list)
  return list
}

export function loadPlayerName(): string {
  const store = storage()
  if (!store) return 'Guest'
  try {
    return store.getItem(QUIZ_NAME_KEY)?.trim() || 'Guest'
  } catch {
    return 'Guest'
  }
}

export function savePlayerName(name: string): string {
  const clean = name.trim().slice(0, 18) || 'Guest'
  const store = storage()
  if (store) {
    try {
      store.setItem(QUIZ_NAME_KEY, clean)
    } catch {
      // ignore
    }
  }
  return clean
}

export function formatSeconds(total: number): string {
  const safe = Math.max(0, Math.floor(total))
  const m = Math.floor(safe / 60)
  const s = safe % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
