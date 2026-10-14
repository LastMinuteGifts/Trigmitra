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

export interface AdminOverview {
  totalSolutions: number
  totalUsers: number
  demoCount: number
  topics: Array<{ topic: string; count: number }>
  last7Days: Array<{ day: string; count: number }>
  solutions: AdminSolutionRow[]
}

export async function getAdminOverview(
  client: SupabaseClient,
  limit: number,
): Promise<AdminOverview> {
  const { data: usersData } = await client.auth.admin.listUsers({ page: 1, perPage: 200 })
  const users = usersData?.users ?? []
  const emailById = new Map(users.map((u) => [u.id, u.email ?? '(no email)']))

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
  }
}
