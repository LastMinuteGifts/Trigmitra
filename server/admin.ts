import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let adminClient: SupabaseClient | null = null

export function getAdminClient(url?: string, serviceKey?: string): SupabaseClient | null {
  if (!url || !serviceKey) return null
  if (!adminClient) {
    adminClient = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return adminClient
}

export interface AdminSolutionRow {
  id: string
  userId: string
  userEmail: string
  question: string
  topic: string
  questionType: string
  difficulty: string
  finalAnswer: string
  isDemo: boolean
  createdAt: string
}

export interface AdminUserRow {
  id: string
  email: string
  createdAt: string
  lastSignIn: string
  solves: number
  solvesToday: number
  plan: string
  expiresAt: string
  accessActive: boolean
  dailyLimit: number | null
}

export interface AdminOverview {
  totalSolutions: number
  totalUsers: number
  demoCount: number
  topics: Array<{ topic: string; count: number }>
  last7Days: Array<{ day: string; count: number }>
  solutions: AdminSolutionRow[]
  users: AdminUserRow[]
}

export async function getAdminOverview(
  client: SupabaseClient,
  limit: number,
): Promise<AdminOverview> {
  const { data: usersData } = await client.auth.admin.listUsers({ page: 1, perPage: 200 })
  const users = usersData?.users ?? []
  const emailById = new Map(users.map((u) => [u.id, u.email ?? '(no email)']))

  // Har user ke solves gino (halki query, sirf user_id).
  const { data: countRows } = await client.from('solutions').select('user_id').limit(2000)
  const solvesByUser = new Map<string, number>()
  for (const row of countRows ?? []) {
    const uid = row.user_id as string
    solvesByUser.set(uid, (solvesByUser.get(uid) ?? 0) + 1)
  }

  // Aaj ke solves gino (UTC day) — daily limit ke liye.
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)
  const { data: todayRows } = await client
    .from('solutions')
    .select('user_id')
    .gte('created_at', todayStart.toISOString())
    .limit(5000)
  const todayByUser = new Map<string, number>()
  for (const row of todayRows ?? []) {
    const uid = row.user_id as string
    todayByUser.set(uid, (todayByUser.get(uid) ?? 0) + 1)
  }

  // Access grants: kis user ka access kab tak valid hai.
  const { data: grants } = await client.from('access_grants').select('user_id, plan, expires_at, daily_limit')
  const grantByUser = new Map(
    (grants ?? []).map((g) => [
      g.user_id as string,
      {
        plan: g.plan as string,
        expiresAt: g.expires_at as string,
        dailyLimit: (g.daily_limit as number | null) ?? null,
      },
    ]),
  )
  const now = Date.now()

  const { data: rows, error } = await client
    .from('solutions')
    .select('id, user_id, question, topic, question_type, difficulty, final_answer, is_demo, created_at')
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 200))
  if (error) throw new Error(`ADMIN_DB_${error.code ?? 'ERROR'}`)

  const { count: totalSolutions } = await client
    .from('solutions')
    .select('id', { count: 'exact', head: true })

  const topicMap = new Map<string, number>()
  const dayMap = new Map<string, number>()
  let demoCount = 0
  const solutions: AdminSolutionRow[] = (rows ?? []).map((row) => {
    const topic = (row.topic as string) || 'General'
    topicMap.set(topic, (topicMap.get(topic) ?? 0) + 1)
    const day = String(row.created_at).slice(0, 10)
    dayMap.set(day, (dayMap.get(day) ?? 0) + 1)
    if (row.is_demo) demoCount++
    return {
      id: row.id as string,
      userId: row.user_id as string,
      userEmail: emailById.get(row.user_id as string) ?? row.user_id as string,
      question: row.question as string,
      topic,
      questionType: (row.question_type as string) || '',
      difficulty: (row.difficulty as string) || '',
      finalAnswer: (row.final_answer as string) || '',
      isDemo: Boolean(row.is_demo),
      createdAt: row.created_at as string,
    }
  })

  return {
    totalSolutions: totalSolutions ?? solutions.length,
    totalUsers: users.length,
    demoCount,
    topics: [...topicMap.entries()]
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    last7Days: [...dayMap.entries()]
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => (a.day < b.day ? 1 : -1))
      .slice(0, 7),
    solutions,
    users: users.map((u) => {
      const grant = grantByUser.get(u.id)
      const active = !!grant && new Date(grant.expiresAt).getTime() > now
      return {
        id: u.id,
        email: u.email ?? '(no email)',
        createdAt: u.created_at,
        lastSignIn: u.last_sign_in_at ?? '',
        solves: solvesByUser.get(u.id) ?? 0,
        solvesToday: todayByUser.get(u.id) ?? 0,
        plan: grant?.plan ?? '',
        expiresAt: grant?.expiresAt ?? '',
        accessActive: active,
        dailyLimit: grant?.dailyLimit ?? null,
      }
    }),
  }
}

const PLAN_DAYS: Record<string, number> = { week: 7, month: 30, year: 365 }

/** Access do (plan + daily limit) ya wapas lo ('none'). Expiry automatic — har check par compare hota hai. */
export async function setUserAccess(
  client: SupabaseClient,
  userId: string,
  plan: string,
  dailyLimit?: number | null,
): Promise<{ plan: string; expiresAt: string; dailyLimit: number | null } | null> {
  if (plan === 'none') {
    const { error } = await client.from('access_grants').delete().eq('user_id', userId)
    if (error) throw new Error(`ADMIN_DB_${error.code ?? 'ERROR'}`)
    return null
  }
  const days = PLAN_DAYS[plan]
  if (!days) throw new Error('ADMIN_BAD_PLAN')
  const limit = dailyLimit ?? null
  if (limit !== null && (!Number.isInteger(limit) || limit < 1 || limit > 1000)) {
    throw new Error('ADMIN_BAD_LIMIT')
  }
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
  const { error } = await client.from('access_grants').upsert(
    { user_id: userId, plan, granted_at: new Date().toISOString(), expires_at: expiresAt, daily_limit: limit },
    { onConflict: 'user_id' },
  )
  if (error) throw new Error(`ADMIN_DB_${error.code ?? 'ERROR'}`)
  return { plan, expiresAt, dailyLimit: limit }
}

const TRIAL_PLAN = 'month'
const TRIAL_DAILY_LIMIT = 10

/**
 * Naye user ke liye ek baar free trial: 1 month + 10 questions/day.
 * Pehle se koi grant row ho (active ya expired) to kuch nahi badalta —
 * isse logout/login se baar-baar trial milne wali galti nahi hoti.
 */
export async function ensureTrialAccess(
  client: SupabaseClient,
  userId: string,
): Promise<{ granted: boolean; plan?: string; expiresAt?: string; dailyLimit?: number | null }> {
  const { data: existing } = await client
    .from('access_grants')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (existing) return { granted: false }
  const expiresAt = new Date(Date.now() + PLAN_DAYS[TRIAL_PLAN] * 24 * 60 * 60 * 1000).toISOString()
  const { error } = await client.from('access_grants').insert({
    user_id: userId,
    plan: TRIAL_PLAN,
    granted_at: new Date().toISOString(),
    expires_at: expiresAt,
    daily_limit: TRIAL_DAILY_LIMIT,
  })
  if (error) {
    // Race: do parallel login ne ek saath try kiya — ek insert jeet gaya, dusra ignore.
    if (error.code === '23505') return { granted: false }
    throw new Error(`ADMIN_DB_${error.code ?? 'ERROR'}`)
  }
  return { granted: true, plan: TRIAL_PLAN, expiresAt, dailyLimit: TRIAL_DAILY_LIMIT }
}

export interface AdminUserActivity {
  userId: string
  email: string
  totalSolves: number
  solvesToday: number
  solutions: AdminSolutionRow[]
}

/** Ek specific user ka solve history — kaunsa question, kab, kis topic par, type kya tha. */
export async function getUserActivity(
  client: SupabaseClient,
  userId: string,
  limit: number,
): Promise<AdminUserActivity> {
  const { data: usersData } = await client.auth.admin.listUsers({ page: 1, perPage: 200 })
  const email = usersData?.users?.find((u) => u.id === userId)?.email ?? '(no email)'

  const { data: rows } = await client
    .from('solutions')
    .select('id, question, topic, question_type, difficulty, final_answer, is_demo, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 300))

  const { count: totalCount } = await client
    .from('solutions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)

  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)
  const { count: todayCount } = await client
    .from('solutions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', todayStart.toISOString())

  return {
    userId,
    email,
    totalSolves: totalCount ?? (rows?.length ?? 0),
    solvesToday: todayCount ?? 0,
    solutions: (rows ?? []).map((row) => ({
      id: row.id as string,
      userId,
      userEmail: email,
      question: row.question as string,
      topic: (row.topic as string) || 'General',
      questionType: (row.question_type as string) || '',
      difficulty: (row.difficulty as string) || '',
      finalAnswer: (row.final_answer as string) || '',
      isDemo: Boolean(row.is_demo),
      createdAt: row.created_at as string,
    })),
  }
}

/** Solve se pehle: grant valid + aaj ka quota bacha? Returns {allowed, reason} */
export async function checkSolveAllowed(
  client: SupabaseClient,
  userId: string,
): Promise<{ allowed: boolean; reason?: string; limit?: number; used?: number }> {
  const { data: grant } = await client
    .from('access_grants')
    .select('expires_at, daily_limit')
    .eq('user_id', userId)
    .maybeSingle()
  if (!grant || new Date(grant.expires_at as string).getTime() <= Date.now()) {
    return { allowed: false, reason: 'Your access has expired. Please contact the admin for access.' }
  }
  const limit = (grant.daily_limit as number | null) ?? null
  if (limit === null) return { allowed: true }
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)
  const { count } = await client
    .from('solutions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', todayStart.toISOString())
  const used = count ?? 0
  if (used >= limit) {
    return { allowed: false, reason: `Daily limit reached! You have used all ${limit} questions for today. Please try again tomorrow.`, limit, used }
  }
  return { allowed: true, limit, used }
}
