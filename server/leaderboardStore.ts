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
/** App me koi bhi quiz isse chhota hai — isse zyada "total" junk row hai (bot/test entry). */
const MAX_TOTAL = 100

interface RawLeaderEntry {
  name?: unknown
  score?: unknown
  total?: unknown
  day?: unknown
  mode?: unknown
  classNum?: unknown
}

/** Field-by-field clean + validation. Junk entry par `null` (leaderboard par nahi dikhegi). */
export function normalizeLeaderEntry(entry: RawLeaderEntry): SharedLeaderEntry | null {
  const score = Number(entry.score)
  const total = Number(entry.total)
  if (!Number.isFinite(score) || !Number.isFinite(total)) return null
  const cleanScore = Math.trunc(score)
  const cleanTotal = Math.trunc(total)
  if (cleanTotal < 1 || cleanTotal > MAX_TOTAL) return null
  if (cleanScore < 0 || cleanScore > cleanTotal) return null
  const classNum = Number(entry.classNum)
  return {
    name: String(entry.name ?? 'Guest').trim().slice(0, 18) || 'Guest',
    score: cleanScore,
    total: cleanTotal,
    day:
      typeof entry.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(entry.day)
        ? entry.day
        : new Date().toISOString().slice(0, 10),
    mode: typeof entry.mode === 'string' && entry.mode ? entry.mode.slice(0, 24) : 'topics',
    classNum: Number.isInteger(classNum) && classNum >= 1 && classNum <= 10 ? classNum : null,
  }
}

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
    const list = Array.isArray(parsed) ? (parsed as RawLeaderEntry[]) : []
    const clean = sortEntries(
      dedupe(
        list
          .map((entry) =>
            normalizeLeaderEntry({
              name: entry?.name,
              score: entry?.score,
              total: entry?.total,
              day: entry?.day,
              mode: entry?.mode,
              classNum: entry?.classNum,
            }),
          )
          .filter((entry): entry is SharedLeaderEntry => entry !== null),
      ),
    )
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

/** Ek hi quiz ek hi din me do baar submit hua? Wahi row do baar na dikhe. */
function dedupe(entries: SharedLeaderEntry[]): SharedLeaderEntry[] {
  const seen = new Set<string>()
  const out: SharedLeaderEntry[] = []
  for (const entry of entries) {
    const key = `${entry.name}|${entry.score}|${entry.total}|${entry.day}|${entry.mode}|${entry.classNum ?? 'all'}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(entry)
  }
  return out
}

export async function addSharedLeaderEntry(
  client: SupabaseClient,
  entry: SharedLeaderEntry,
): Promise<SharedLeaderEntry[]> {
  const list = await loadSharedLeaderboard(client)
  const clean = normalizeLeaderEntry({
    name: entry.name,
    score: entry.score,
    total: entry.total,
    day: entry.day,
    mode: entry.mode,
    classNum: entry.classNum,
  })
  if (!clean) throw new Error('LEADERBOARD_INVALID_ENTRY')
  const next = sortEntries(dedupe([...list, clean])).slice(0, MAX_ENTRIES)
  await saveSharedLeaderboard(client, next)
  return next
}
