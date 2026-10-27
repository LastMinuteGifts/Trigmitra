// Student ki class (1-10) Supabase ke user_metadata me `class_level` ke roop
// me save hoti hai. Alag table ki zaroorat nahi — login ke saath hi mil jati
// hai aur har device par sync rehti hai.

export const CLASS_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const

/** Kisi bhi value se valid class number (1-10), warna null. */
export function parseClassLevel(value: unknown): number | null {
  const num = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (!Number.isInteger(num)) return null
  return num >= 1 && num <= 10 ? num : null
}

/** Supabase user object se class level nikalo. */
export function classFromUser(
  user: { user_metadata?: Record<string, unknown> | null } | null | undefined,
): number | null {
  return parseClassLevel(user?.user_metadata?.class_level)
}

/** Screen par dikhane ke liye label. */
export function classLabel(level: number | null): string {
  return level ? `Class ${level}` : 'Class set nahi hai'
}
