// Subjective jawab ka local check — bina AI ke, keywords aur similarity se.
// Final faisla student khud karta hai (self-mark), ye sirf suggestion deta hai.

const STOP_WORDS = new Set([
  'ka', 'ki', 'ke', 'hai', 'hain', 'hoga', 'hogi', 'hota', 'hoti', 'se', 'me', 'mein', 'par', 'aur', 'ya',
  'kya', 'ko', 'kar', 'karo', 'karke', 'liye', 'ek', 'do', 'ye', 'yeh', 'wo', 'woh', 'is', 'us', 'to', 'bhi',
  'the', 'a', 'an', 'of', 'is', 'are', 'and', 'or', 'to', 'in', 'on', 'for', 'with', 'be',
])

const MATH_ALIASES: Record<string, string> = {
  '²': '2',
  '³': '3',
  '√': 'sqrt',
  'π': 'pi',
  'θ': 'theta',
  '½': '1/2',
  '−': '-',
  '×': '*',
  '÷': '/',
  '°': 'deg',
}

/** Text ko compare karne layak normal form me laao. */
export function normalizeAnswer(text: string): string {
  let out = text.toLowerCase()
  for (const [from, to] of Object.entries(MATH_ALIASES)) {
    out = out.split(from).join(to)
  }
  return out
    .replace(/[^a-z0-9\u0900-\u097f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function words(text: string): string[] {
  return normalizeAnswer(text)
    .split(' ')
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word))
}

/**
 * 0 se 1 ke beech score: student ke jawab me model answer / keywords kitne mile.
 * Formula-type jawab ke liye keywords zyada weight rakhte hain.
 */
export function answerMatch(userAnswer: string, modelAnswer = '', keywords: string[] = []): number {
  const normalized = normalizeAnswer(userAnswer)
  if (!normalized) return 0
  const compact = normalized.replace(/ /g, '')

  const keyWords = [...new Set(keywords.flatMap((keyword) => words(keyword)))]
  const modelWords = [...new Set(words(modelAnswer))].filter((word) => !keyWords.includes(word))
  if (keyWords.length === 0 && modelWords.length === 0) return 0

  const has = (word: string) => normalized.includes(word) || compact.includes(word.replace(/ /g, ''))
  const keyHits = keyWords.filter(has).length
  const modelHits = modelWords.filter(has).length

  const keyScore = keyWords.length > 0 ? keyHits / keyWords.length : 0
  const modelScore = modelWords.length > 0 ? modelHits / modelWords.length : 0

  // Keywords ya model answer — jo zyada cover hua wahi score hai. Poora keyword
  // match hone par chhota bonus, taaki formula wala jawab confident lage.
  const coverage = Math.max(keyScore, modelScore)
  const bonus = keyWords.length > 0 && keyHits === keyWords.length ? 0.15 : 0

  return Math.max(0, Math.min(1, coverage + bonus))
}

/** Auto-check ka verdict — 60% se zyada match ho to sahi maan lo. */
export function looksCorrect(similarity: number): boolean {
  return similarity >= 0.6
}

/** Result screen ke liye percentage. */
export function similarityLabel(similarity: number): string {
  return `${Math.round(similarity * 100)}% match`
}
