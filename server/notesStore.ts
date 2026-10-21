import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Teacher-edited chapter notes ka storage.
 *
 * Koi naya DB table nahi chahiye — notes ek chhoti JSON file ki tarah
 * Supabase Storage bucket me rakhe jaate hain. Bucket pehli baar khud ban jaata
 * hai (service key se), isliye deploy ke baad koi manual migration nahi chalti.
 */

export interface NoteOverride {
  summary: string
  points: string[]
  updatedAt: string
  updatedBy: string
}

/** key = `${class}::${chapter}` */
export type NotesStore = Record<string, NoteOverride>

export interface ListedOverride extends NoteOverride {
  class: number
  chapter: string
}

const BUCKET = 'anknawab-notes'
const FILE = 'chapter-notes.json'
const CACHE_MS = 10_000

let bucketReady = false
let cache: { store: NotesStore; at: number } | null = null

const keyOf = (classNum: number, chapter: string) => `${classNum}::${chapter}`

async function ensureBucket(client: SupabaseClient): Promise<void> {
  if (bucketReady) return
  const { error } = await client.storage.createBucket(BUCKET, { public: false })
  if (error && !/exist/i.test(error.message)) {
    throw new Error(`NOTES_BUCKET_${error.message}`)
  }
  bucketReady = true
}

export async function loadStore(client: SupabaseClient): Promise<NotesStore> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.store
  await ensureBucket(client)
  const { data, error } = await client.storage.from(BUCKET).download(FILE)
  if (error || !data) {
    cache = { store: {}, at: Date.now() }
    return cache.store
  }
  try {
    const blob = data as unknown as { text: () => Promise<string> }
    const parsed = JSON.parse(await blob.text()) as NotesStore
    cache = { store: parsed ?? {}, at: Date.now() }
  } catch {
    cache = { store: {}, at: Date.now() }
  }
  return cache.store
}

async function saveStore(client: SupabaseClient, store: NotesStore): Promise<void> {
  await ensureBucket(client)
  const body = new Blob([JSON.stringify(store)], { type: 'application/json' })
  const { error } = await client.storage.from(BUCKET).upload(FILE, body, {
    upsert: true,
    contentType: 'application/json',
    cacheControl: 'no-cache',
  })
  if (error) throw new Error(`NOTES_SAVE_${error.message}`)
  cache = { store, at: Date.now() }
}

export async function listOverrides(
  client: SupabaseClient,
  classNum?: number,
): Promise<ListedOverride[]> {
  const store = await loadStore(client)
  return Object.entries(store)
    .map(([key, value]) => {
      const idx = key.indexOf('::')
      return {
        class: Number(key.slice(0, idx)),
        chapter: key.slice(idx + 2),
        ...value,
      }
    })
    .filter((row) => (classNum ? row.class === classNum : true))
    .sort((a, b) => a.class - b.class || a.chapter.localeCompare(b.chapter))
}

export async function upsertOverride(
  client: SupabaseClient,
  input: { class: number; chapter: string; summary: string; points: string[]; updatedBy?: string },
): Promise<ListedOverride> {
  const store = await loadStore(client)
  const override: NoteOverride = {
    summary: input.summary.trim(),
    points: input.points.map((point) => point.trim()).filter(Boolean),
    updatedAt: new Date().toISOString(),
    updatedBy: (input.updatedBy ?? '').trim().slice(0, 80),
  }
  store[keyOf(input.class, input.chapter)] = override
  await saveStore(client, store)
  return { class: input.class, chapter: input.chapter, ...override }
}

export async function deleteOverride(
  client: SupabaseClient,
  classNum: number,
  chapter: string,
): Promise<boolean> {
  const store = await loadStore(client)
  const key = keyOf(classNum, chapter)
  if (!(key in store)) return false
  delete store[key]
  await saveStore(client, store)
  return true
}
