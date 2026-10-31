// Subjective jawab ka local auto-check — bina AI ke. Keywords, synonyms aur
// number equivalence (3/4 = 0.75 = 75%) se score nikalta hai.
// Faisla automatic hota hai; galat lage to student override kar sakta hai.

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
  '¼': '1/4',
  '¾': '3/4',
  '−': '-',
  '×': '*',
  '÷': '/',
  '°': 'deg',
}

/** Same matlab wale shabd ek hi token bana do, taaki paraphrase match ho. */
const SYNONYMS: Record<string, string> = {
  sqrt: 'root',
  roots: 'root',
  values: 'value',
  squares: 'square',
  equals: 'equal',
  barabar: 'equal',
  prove: 'proof',
  proved: 'proof',
  siddh: 'proof',
  kshetrafal: 'area',
  aayatan: 'volume',
  trijya: 'radius',
  vyas: 'diameter',
  yog: 'sum',
  antar: 'difference',
  guna: 'product',
  bhag: 'division',
  ghat: 'power',
  power: 'power',
}

/** Text ko compare karne layak normal form me laao (numbers ka format bacha kar). */
export function normalizeAnswer(text: string): string {
  let out = text.toLowerCase()
  for (const [from, to] of Object.entries(MATH_ALIASES)) {
    out = out.split(from).join(to)
  }
  return out
    .replace(/[^a-z0-9.%/\-\u0900-\u097f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(text: string): string[] {
  return normalizeAnswer(text)
    .split(' ')
    .map((token) => token.replace(/^[./]+|[./]+$/g, ''))
    .filter(Boolean)
}

/** "-b/2a" jaise jude token ko tod kar hisse bhi lauta do (numbers ko chhod kar). */
function expand(token: string): string[] {
  if (toNumber(token) !== null) return [token]
  if (!/[/.]/.test(token)) return [token]
  const parts = token
    .split(/[/.]/)
    .map((part) => part.replace(/^[./]+|[./]+$/g, ''))
    .filter((part) => part.length > 0)
  return parts.length > 1 ? [token, ...parts] : [token]
}

function words(text: string): string[] {
  const base = tokenize(text).filter((word) => word.length > 1 && !STOP_WORDS.has(word))
  const out: string[] = []
  for (const word of base) {
    for (const part of expand(word)) {
      if (part.length > 1 && !STOP_WORDS.has(part) && !out.includes(part)) out.push(part)
    }
  }
  return out
}

/** Token ko number me badlo — "3/4", "0.75" aur "75%" sab 0.75 hain. */
function toNumber(token: string): number | null {
  const percent = token.endsWith('%')
  const raw = percent ? token.slice(0, -1) : token
  if (!/^-?\d+(?:\.\d+)?(?:\/-?\d+(?:\.\d+)?)?$/.test(raw)) return null
  let value: number
  if (raw.includes('/')) {
    const [a, b] = raw.split('/').map(Number)
    if (!b) return null
    value = a / b
  } else {
    value = Number(raw)
  }
  if (!Number.isFinite(value)) return null
  return percent ? value / 100 : value
}

function stem(word: string): string {
  return SYNONYMS[word] ?? word
}

/** Do tokens same matlab rakhte hain? (number, synonym ya plural) */
function tokenEq(a: string, b: string): boolean {
  if (a === b) return true
  const numA = toNumber(a)
  const numB = toNumber(b)
  if (numA !== null && numB !== null) return Math.abs(numA - numB) < 1e-6
  const stemA = stem(a)
  const stemB = stem(b)
  if (stemA === stemB) return true
  return stemA.length > 3 && stemB.length > 3 && (stemA === `${stemB}s` || stemB === `${stemA}s`)
}

function present(token: string, pool: string[]): boolean {
  return pool.some((candidate) => tokenEq(candidate, token) || looseMatch(candidate, token))
}

/**
 * Math me token jude hue aate hain: "sin²θ" = "sin2theta", "πr²" = "pir2",
 * "b²−4ac" = "b2-4ac". Isliye chhote hisse ko bade token ke andar bhi dhoondo.
 */
function looseMatch(candidate: string, token: string): boolean {
  if (candidate === token) return false
  if (token.length >= 3 && candidate.includes(token)) return true
  if (candidate.length >= 3 && token.includes(candidate)) return true
  // Do akshar wale math tokens (pi, 2a) sirf jude hue token ke shuru me milein.
  return token.length === 2 && candidate.startsWith(token) && /\d/.test(candidate)
}

interface KeywordGroup {
  raw: string
  tokens: string[]
}

function keywordGroups(keywords: string[]): KeywordGroup[] {
  const seen = new Set<string>()
  const groups: KeywordGroup[] = []
  for (const raw of keywords) {
    const tokens = words(raw)
    if (tokens.length === 0) continue
    const key = tokens.join(' ')
    if (seen.has(key)) continue
    seen.add(key)
    groups.push({ raw, tokens })
  }
  return groups
}

export interface SubjectiveCheck {
  /** 0 se 1 ke beech match score. */
  score: number
  /** Auto verdict — ab student ko khud mark karne ki zaroorat nahi. */
  correct: boolean
  verdict: 'correct' | 'partial' | 'wrong'
  /** Kaun se expected points mile. */
  matched: string[]
  /** Kaun se expected points chhoot gaye. */
  missing: string[]
  /** Ek line ka feedback. */
  summary: string
  /** Check kahan se aaya — local rules ya AI (photo). */
  source?: 'local' | 'ai'
  /** AI ne photo/answer se jo padha. */
  transcript?: string
}

/**
 * Subjective jawab check karo: keywords (ya keywords na ho to model answer) se
 * score, phir auto verdict + kya mila/kya chhoota.
 */
export function checkSubjectiveAnswer(userAnswer: string, modelAnswer = '', keywords: string[] = []): SubjectiveCheck {
  const tokens = words(userAnswer)
  const groups = keywordGroups(keywords)

  if (tokens.length === 0) {
    return {
      score: 0,
      correct: false,
      verdict: 'wrong',
      matched: [],
      missing: groups.map((group) => group.raw),
      summary: 'Jawab likha hi nahi gaya.',
      source: 'local',
    }
  }

  const matched: string[] = []
  const missing: string[] = []
  for (const group of groups) {
    if (group.tokens.every((token) => present(token, tokens))) matched.push(group.raw)
    else missing.push(group.raw)
  }
  const keywordScore = groups.length > 0 ? matched.length / groups.length : 0

  // Model answer ko sentence-wise compare karo: jawab ka koi ek sentence pura
  // match ho jaye to wahi best score maano (formula + example wale model answers
  // me example sentence score ko neeche nahi girata).
  const keywordTokens = new Set(groups.flatMap((group) => group.tokens))
  const sentences = modelAnswer
    .split(/[.!?।\n]+/)
    .map((sentence) => [...new Set(words(sentence))].filter((word) => ![...keywordTokens].some((token) => tokenEq(token, word))))
    .filter((sentenceTokens) => sentenceTokens.length > 0)
  const modelScore =
    sentences.length > 0
      ? Math.max(
          ...sentences.map(
            (sentenceTokens) =>
              sentenceTokens.filter((word) => present(word, tokens)).length / sentenceTokens.length,
          ),
        )
      : 0

  // Score: keyword coverage mukhya hai, lekin keywords adhoore/junk ho to model
  // answer se mila match bhi kaafi weight rakhta hai (paraphrase wale jawab ke liye).
  const score =
    groups.length > 0
      ? Math.max(keywordScore, keywordScore * 0.2 + modelScore * 0.8)
      : modelScore
  const verdict: SubjectiveCheck['verdict'] = score >= 0.6 ? 'correct' : score >= 0.4 ? 'partial' : 'wrong'

  // Summary me sirf padhne layak points dikhao (pure numbers "414, 732" jaise
  // artifacts confusing lagte hain).
  const readable = missing.filter((point) => /[a-z\u0900-\u097f]/i.test(point))
  const shown = (readable.length > 0 ? readable : []).slice(0, 2)

  let summary: string
  if (verdict === 'correct') {
    summary =
      groups.length > 0 && missing.length > 0
        ? `Sahi lag raha hai — ${matched.length}/${groups.length} points mile.`
        : 'Pura jawab match hua — sab expected points mile.'
  } else if (verdict === 'partial') {
    summary = shown.length > 0
      ? `Thoda adhoora: ${shown.join(', ')} missing hai — model answer se compare karo.`
      : 'Thoda adhoora lag raha hai — model answer se compare karke dekho.'
  } else if (shown.length > 0) {
    summary = `Match nahi hua — ${shown.join(', ')} expected tha.`
  } else {
    summary = 'Jawab model answer se match nahi hua — neeche model answer se compare karo.'
  }

  return {
    score: Math.max(0, Math.min(1, score)),
    correct: verdict === 'correct',
    verdict,
    matched,
    missing,
    summary,
    source: 'local',
  }
}

/** 0 se 1 ke beech score: student ke jawab me model answer / keywords kitne mile. */
export function answerMatch(userAnswer: string, modelAnswer = '', keywords: string[] = []): number {
  return checkSubjectiveAnswer(userAnswer, modelAnswer, keywords).score
}

/** Auto-check ka verdict — 60% se zyada match ho to sahi maan lo. */
export function looksCorrect(similarity: number): boolean {
  return similarity >= 0.6
}

/** Result screen ke liye percentage. */
export function similarityLabel(similarity: number): string {
  return `${Math.round(similarity * 100)}% match`
}
