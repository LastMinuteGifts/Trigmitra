// Quiz ke saare question sources ek jagah: formula library, PYQ bank aur
// sprint/daily challenge ke pools. UI sirf in builders ko call karta hai.

import { formulaCategories } from '../data/formulas'
import { getFormulaExample } from '../data/formulaExamples'
import { pyqQuestions } from '../data/pyqQuestions'
import type { DifficultyFilter, QuizDifficulty, QuizQuestion, QuizTypeFilter } from '../types/quiz'

export const QUIZ_COUNTS = [10, 15, 20, 30, 50]

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}

function difficultyFor(text: string): QuizDifficulty {
  let hash = 0
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0
  return (['Easy', 'Medium', 'Hard'] as const)[hash % 3]
}

function keywordsFromFormula(formula: string): string[] {
  return unique(
    formula
      .toLowerCase()
      // Decimal numbers (1.414) toot na jayein, isliye dot allowed hai.
      .replace(/[^a-z0-9.\u0900-\u097f]+/g, ' ')
      .split(' ')
      .filter((word) => word.length > 1)
      // "1.414" ke aage-peeche ka dot hata do.
      .map((word) => word.replace(/^\.+|\.+$/g, ''))
      .filter((word) => word.length > 1),
  )
}

interface FormulaEntryWithCat {
  formula: string
  label: string
  cat: string
  index: number
}

function formulaEntries(cats: string[] = []): FormulaEntryWithCat[] {
  return formulaCategories.flatMap((category) =>
    category.formulas
      .map((entry, index) => ({ ...entry, cat: category.name, index }))
      .filter(() => cats.length === 0 || cats.includes(category.name)),
  )
}

function formulaMcq(entry: FormulaEntryWithCat, pool: FormulaEntryWithCat[]): QuizQuestion {
  const example = getFormulaExample(entry.formula)
  const explain = example ? { q: example.q, steps: example.steps } : null
  const id = `formula-mcq:${entry.cat}:${entry.index}`
  const eq = entry.formula.indexOf('=')

  if (eq > 0) {
    const left = entry.formula.slice(0, eq).trim()
    const right = entry.formula.slice(eq + 1).trim()
    const sameCat = pool.filter((item) => item.cat === entry.cat && item.formula !== entry.formula)
    const distractPool = sameCat.length >= 3 ? sameCat : pool.filter((item) => item.formula !== entry.formula)
    const correct = right.slice(0, 60)
    const distractors = unique(
      shuffle(distractPool).map((item) => {
        const i = item.formula.indexOf('=')
        return (i > 0 ? item.formula.slice(i + 1).trim() : item.formula).slice(0, 60)
      }),
    ).filter((value) => value !== correct)
    const options = shuffle([correct, ...distractors.slice(0, 3)])
    return {
      id,
      type: 'mcq',
      prompt: `Complete: ${left} = ?`,
      sub: `${entry.cat} · ${entry.label}`,
      options,
      answer: options.indexOf(correct),
      explain,
      hint: explain ? `Yaad karo: ${explain.q}` : `Formula ka left side dekho — ${left}`,
      topic: entry.cat,
      difficulty: difficultyFor(entry.formula),
      formula: entry.formula,
    }
  }

  const correct = entry.formula.slice(0, 60)
  const distractors = unique(
    shuffle(pool.filter((item) => item.formula !== entry.formula)).map((item) => item.formula.slice(0, 60)),
  ).filter((value) => value !== correct)
  const options = shuffle([correct, ...distractors.slice(0, 3)])
  return {
    id,
    type: 'mcq',
    prompt: `Which one is "${entry.label}"?`,
    sub: entry.cat,
    options,
    answer: options.indexOf(correct),
    explain,
    hint: explain ? `Yaad karo: ${explain.q}` : 'Formula ka naam padho aur match karo.',
    topic: entry.cat,
    difficulty: difficultyFor(entry.formula),
    formula: entry.formula,
  }
}

function formulaSubjective(entry: FormulaEntryWithCat): QuizQuestion {
  const example = getFormulaExample(entry.formula)
  return {
    id: `formula-sub:${entry.cat}:${entry.index}`,
    type: 'subjective',
    prompt: `"${entry.label}" (${entry.cat}) ka formula likho aur ek line me batao ye kab use hota hai.`,
    sub: `${entry.cat} · ${entry.label}`,
    options: [],
    answer: -1,
    explain: example ? { q: example.q, steps: example.steps } : null,
    hint: `Formula ka naam "${entry.label}" hai — left side aur right side dhyan me laao.`,
    topic: entry.cat,
    difficulty: 'Medium',
    formula: entry.formula,
    modelAnswer: `${entry.formula}. ${example?.q ?? `${entry.label} wale sawaal me use hota hai.`}`,
    keywords: keywordsFromFormula(entry.formula),
  }
}

function applyFilters(
  questions: QuizQuestion[],
  difficulty: DifficultyFilter,
  typeFilter: QuizTypeFilter,
): QuizQuestion[] {
  let pool = questions
  if (typeFilter !== 'mixed') pool = pool.filter((question) => question.type === typeFilter)
  if (difficulty !== 'Mixed') pool = pool.filter((question) => question.difficulty === difficulty)
  return pool
}

/**
 * Formula library se quiz. `typeFilter` 'mixed' ho to MCQ ke saath-subjective
 * sawaal bhi aate hain. Default 'mcq' hai taaki purana behaviour safe rahe.
 */
export function buildQuiz(
  count: number,
  cats: string[] = [],
  difficulty: DifficultyFilter = 'Mixed',
  typeFilter: QuizTypeFilter = 'mcq',
): QuizQuestion[] {
  const entries = formulaEntries(cats)
  const mcqs = entries.map((entry) => formulaMcq(entry, entries))
  const subjectives = entries.map((entry) => formulaSubjective(entry))
  const all = typeFilter === 'mixed' ? [...mcqs, ...subjectives] : typeFilter === 'subjective' ? subjectives : mcqs

  let pool = applyFilters(all, difficulty, typeFilter)
  // Difficulty filter se pool chhota pad jaye to filter hata do — count poora mile.
  if (pool.length < Math.min(count, 3)) pool = all

  const limit = Math.min(Math.max(count, 1), pool.length)
  const picked: QuizQuestion[] = []
  // Mixed mode me har 5th sawaal subjective rakho (agar available hai).
  if (typeFilter === 'mixed') {
    const subjectivePool = shuffle(pool.filter((question) => question.type === 'subjective'))
    const mcqPool = shuffle(pool.filter((question) => question.type === 'mcq'))
    const subjectiveCount = Math.min(subjectivePool.length, Math.max(1, Math.round(limit / 5)))
    for (let i = 0; i < subjectiveCount && picked.length < limit; i++) picked.push(subjectivePool[i])
    let mi = 0
    while (picked.length < limit && mi < mcqPool.length) picked.push(mcqPool[mi++])
    // PyQ ki tarah baaki subjective se bhar do.
    let si = subjectiveCount
    while (picked.length < limit && si < subjectivePool.length) picked.push(subjectivePool[si++])
    return shuffle(picked)
  }

  return shuffle(pool).slice(0, limit)
}

/** PYQ bank se quiz — topic, difficulty aur question type ke hisaab se. */
export function buildPyqQuiz(
  count: number,
  topics: string[] = [],
  difficulty: DifficultyFilter = 'Mixed',
  typeFilter: QuizTypeFilter = 'mixed',
  classNum?: number,
): QuizQuestion[] {
  const byTopic = topics.length > 0 ? pyqQuestions.filter((q) => q.topic && topics.includes(q.topic)) : [...pyqQuestions]
  let base = byTopic.length >= Math.min(count, 3) ? byTopic : [...pyqQuestions]

  if (classNum) {
    const inClass = base.filter((q) => q.classNum === classNum)
    if (inClass.length >= Math.min(count, 5)) base = inClass
  }

  let pool = applyFilters(base, difficulty, typeFilter)
  if (pool.length === 0) {
    pool = typeFilter === 'mixed' ? base : base.filter((question) => question.type === typeFilter)
  }
  if (pool.length === 0) pool = base
  if (typeFilter === 'mixed') {
    const weird = pool.filter((q) => q.type === 'subjective')
    const mcq = pool.filter((q) => q.type === 'mcq')
    const picked = [...mcq, ...weird.slice(0, Math.max(1, Math.round(count / 6)))]
    return shuffle(picked).slice(0, Math.min(count, pool.length))
  }
  return shuffle(pool).slice(0, Math.min(count, pool.length))
}

/** Formula sprint — 60 second me zyada se zyada MCQs. */
export function buildSprintQuiz(): QuizQuestion[] {
  const entries = formulaEntries()
  return shuffle(entries.map((entry) => formulaMcq(entry, entries))).slice(0, 40)
}

/** Daily challenge ka mixed pool (PYQ + formula). */
export function dailyPool(): QuizQuestion[] {
  const entries = formulaEntries()
  const formulas = shuffle(entries.map((entry) => formulaMcq(entry, entries))).slice(0, 30)
  const subjectives = shuffle(entries.map((entry) => formulaSubjective(entry))).slice(0, 8)
  return [...pyqQuestions, ...formulas, ...subjectives]
}

export function topicOptions(): string[] {
  return formulaCategories.map((category) => category.name)
}
