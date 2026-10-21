import crypto from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Teacher accounts (email + password) ka storage.
 *
 * Koi naya DB table nahi — accounts Supabase Storage me `teachers.json` file ki
 * tarah rakhe jaate hain, passwords scrypt hash ke roop me. Login par ek
 * HMAC-signed session token milta hai, jise teacher APIs Bearer header me bhejte hain.
 */

export interface TeacherAccount {
  email: string
  name: string
  hash: string
  createdAt: string
  createdBy: string
}

export type TeacherStore = Record<string, TeacherAccount>

export interface TeacherSummary {
  email: string
  name: string
  createdAt: string
  createdBy: string
}

export interface TeacherSession {
  email: string
  name: string
}

const BUCKET = 'anknawab-notes'
const FILE = 'teachers.json'
const CACHE_MS = 10_000
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000
const SCRYPT_KEYLEN = 64

let bucketReady = false
let cache: { store: TeacherStore; at: number } | null = null

// Galat email par bhi scrypt chalao taaki response time se pata na chale
// ki account exist karta hai ya nahi.
const DUMMY_HASH = hashPassword('anknawab-dummy-password')

const normalizeEmail = (value: string) => value.trim().toLowerCase()

const summaryOf = (account: TeacherAccount): TeacherSummary => ({
  email: account.email,
  name: account.name,
  createdAt: account.createdAt,
  createdBy: account.createdBy,
})

function sessionSecret(): string {
  return (process.env.TEACHER_SESSION_SECRET ?? '').trim() || (process.env.ADMIN_SECRET ?? '').trim()
}

async function ensureBucket(client: SupabaseClient): Promise<void> {
  if (bucketReady) return
  const { error } = await client.storage.createBucket(BUCKET, { public: false })
  if (error && !/exist/i.test(error.message)) {
    throw new Error(`TEACHERS_BUCKET_${error.message}`)
  }
  bucketReady = true
}

async function loadTeachers(client: SupabaseClient): Promise<TeacherStore> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.store
  await ensureBucket(client)
  const { data, error } = await client.storage.from(BUCKET).download(FILE)
  if (error || !data) {
    cache = { store: {}, at: Date.now() }
    return cache.store
  }
  try {
    const blob = data as unknown as { text: () => Promise<string> }
    const parsed = JSON.parse(await blob.text()) as TeacherStore
    cache = { store: parsed ?? {}, at: Date.now() }
  } catch {
    cache = { store: {}, at: Date.now() }
  }
  return cache.store
}

async function saveTeachers(client: SupabaseClient, store: TeacherStore): Promise<void> {
  await ensureBucket(client)
  const body = new Blob([JSON.stringify(store)], { type: 'application/json' })
  const { error } = await client.storage.from(BUCKET).upload(FILE, body, {
    upsert: true,
    contentType: 'application/json',
    cacheControl: 'no-cache',
  })
  if (error) throw new Error(`TEACHERS_SAVE_${error.message}`)
  cache = { store, at: Date.now() }
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16)
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN)
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false
  const salt = Buffer.from(parts[1], 'hex')
  const expected = Buffer.from(parts[2], 'hex')
  if (!salt.length || !expected.length) return false
  const actual = crypto.scryptSync(password, salt, expected.length)
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual)
}

export function createTeacherToken(session: TeacherSession): string {
  const secret = sessionSecret()
  if (!secret) throw new Error('TEACHER_NOT_CONFIGURED')
  const payload = Buffer.from(
    JSON.stringify({ email: session.email, name: session.name, exp: Date.now() + TOKEN_TTL_MS }),
  ).toString('base64url')
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${signature}`
}

export function verifyTeacherToken(token: string): TeacherSession | null {
  const secret = sessionSecret()
  if (!secret) return null
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return null
  const expected = crypto.createHmac('sha256', secret).update(payload).digest()
  const actual = Buffer.from(signature, 'base64url')
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      email?: string
      name?: string
      exp?: number
    }
    if (!data.email || !data.exp || data.exp < Date.now()) return null
    return { email: data.email, name: data.name ?? 'Teacher' }
  } catch {
    return null
  }
}

export async function listTeachers(client: SupabaseClient): Promise<TeacherSummary[]> {
  const store = await loadTeachers(client)
  return Object.values(store)
    .map(summaryOf)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export async function addTeacher(
  client: SupabaseClient,
  input: { email: string; name?: string; password: string },
  createdBy: string,
): Promise<TeacherSummary> {
  const email = normalizeEmail(input.email)
  const store = await loadTeachers(client)
  if (store[email]) throw new Error('TEACHER_EXISTS')
  const account: TeacherAccount = {
    email,
    name: (input.name ?? '').trim().slice(0, 80) || email.split('@')[0],
    hash: hashPassword(input.password),
    createdAt: new Date().toISOString(),
    createdBy: createdBy.slice(0, 80),
  }
  store[email] = account
  await saveTeachers(client, store)
  return summaryOf(account)
}

export async function removeTeacher(client: SupabaseClient, emailInput: string): Promise<boolean> {
  const email = normalizeEmail(emailInput)
  const store = await loadTeachers(client)
  if (!store[email]) return false
  delete store[email]
  await saveTeachers(client, store)
  return true
}

/**
 * Email + password check. Agar abhi koi teacher account nahi hai aur env me
 * TEACHER_EMAIL / TEACHER_PASSWORD set hain, to pehla account unse ban jaata hai
 * (deploy ke turant baad login karne ke liye).
 */
export async function authenticateTeacher(
  client: SupabaseClient,
  emailInput: string,
  password: string,
): Promise<TeacherSummary | null> {
  const email = normalizeEmail(emailInput)
  const store = await loadTeachers(client)

  if (!Object.keys(store).length) {
    const envEmail = normalizeEmail(process.env.TEACHER_EMAIL ?? '')
    const envPassword = process.env.TEACHER_PASSWORD ?? ''
    if (envEmail && envPassword && email === envEmail && password === envPassword) {
      const account: TeacherAccount = {
        email,
        name: 'Teacher',
        hash: hashPassword(envPassword),
        createdAt: new Date().toISOString(),
        createdBy: 'env',
      }
      store[email] = account
      await saveTeachers(client, store)
      return summaryOf(account)
    }
  }

  const account = store[email]
  if (!account) {
    verifyPassword(password, DUMMY_HASH)
    return null
  }
  if (!verifyPassword(password, account.hash)) return null
  return summaryOf(account)
}
