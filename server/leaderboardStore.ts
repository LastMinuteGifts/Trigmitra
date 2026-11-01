import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Shared leaderboard — Supabase Storage me ek JSON file ki tarah.
 * Koi naya DB table nahi chahiye (notes/teachers jaisa pattern).
 */

export interface SharedLeaderEntry {
  name: string
  score: number
  total: number
  day: string
  mode: string
  classNum: number | null
}

const BUCKET = 'anknawab-leaderboard'
const FILE = 'leaderboard.json'
const CACHE_MS = 5_000
const MAX_ENTRIES = 50

let bucketReady = false
let cache: { entries: SharedLeaderEntry[]; at: number } | null = null

async function ensureBucket(client: SupabaseClient): Promise<void> {
  if (bucketReady) return
  const { error } = await client.storage.createBucket(BUCKET, { public: false })
  if (error && !/exist/i.test(error.message)) {
    throw new Error(`LEADERBOARD_BUCKET_${error.message}`)
  }
  bucketReady = true
}

export async function loadSharedLeaderboard(client: SupabaseClient): Promise<SharedLeaderEntry[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.entries
  await ensureBucket(client)
  const { data, error } = await client.storage.from(BUCKET).download(FILE)
  if (error || !data) {
    cache = { entries: [], at: Date.now() }
    return cache.entries
  }
  try {
    const blob = data as unknown as { text: () => Promise<string> }
    const parsed = JSON.parse(await blob.text()) as unknown
    const list = Array.isArray(parsed) ? (parsed as SharedLeaderEntry[]) : []
    const clean = list
      .filter((entry) => entry && typeof entry.score === 'number' && typeof entry.total === 'number')
      .map((entry) => ({
        name: String(entry.name ?? 'Guest').trim().slice(0, 18) || 'Guest',
        score: Math.max(0, Math.trunc(entry.score)),
        total: Math.max(1, Math.trunc(entry.total)),
        day: typeof entry.day === 'string' ? entry.day.slice(0, 10) : new Date().toISOString().slice(0, 10),
        mode: typeof entry.mode === 'string' ? entry.mode.slice(0, 24) : 'topics',
        classNum: typeof entry.classNum === 'number' ? entry.classNum : null,
      }))
    cache = { entries: clean, at: Date.now() }
  } catch {
    cache = { entries: [], at: Date.now() }
  }
  return cache.entries
}

async function saveSharedLeaderboard(client: SupabaseClient, entries: SharedLeaderEntry[]): Promise<void> {
  await ensureBucket(client)
  const body = new Blob([JSON.stringify(entries)], { type: 'application/json' })
  const { error } = await client.storage.from(BUCKET).upload(FILE, body, {
    upsert: true,
    contentType: 'application/json',
    cacheControl: 'no-cache',
  })
  if (error) throw new Error(`LEADERBOARD_SAVE_${error.message}`)
  cache = { entries, at: Date.now() }
}

function sortEntries(entries: SharedLeaderEntry[]): SharedLeaderEntry[] {
  return [...entries].sort((a, b) => {
    const aPct = a.total > 0 ? a.score / a.total : 0
    const bPct = b.total > 0 ? b.score / b.total : 0
    return bPct - aPct || b.score - a.score
  })
}

export async function addSharedLeaderEntry(
  client: SupabaseClient,
  entry: SharedLeaderEntry,
): Promise<SharedLeaderEntry[]> {
  const list = await loadSharedLeaderboard(client)
  const clean: SharedLeaderEntry = {
    name: String(entry.name ?? 'Guest').trim().slice(0, 18) || 'Guest',
    score: Math.max(0, Math.trunc(entry.score)),
    total: Math.max(1, Math.trunc(entry.total)),
    day: typeof entry.day === 'string' ? entry.day.slice(0, 10) : new Date().toISOString().slice(0, 10),
    mode: typeof entry.mode === 'string' ? entry.mode.slice(0, 24) : 'topics',
    classNum: typeof entry.classNum === 'number' ? entry.classNum : null,
  }
  const next = sortEntries([...list, clean]).slice(0, MAX_ENTRIES)
  await saveSharedLeaderboard(client, next)
  return next
}