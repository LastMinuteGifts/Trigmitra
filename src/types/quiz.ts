// Quiz ka shared data model — runner, setup, review aur AI payload sab yahi
// types use karte hain taaki MCQ aur subjective sawaal ek hi shape me chalein.

export interface QuizExplain {
  q: string
  steps: string[]
}

export type QuizDifficulty = 'Easy' | 'Medium' | 'Hard'

/** MCQ ke options hote hain, subjective me student apna jawab likhta hai. */
export type QuizQuestionType = 'mcq' | 'subjective'

export interface QuizQuestion {
  id: string
  type: QuizQuestionType
  prompt: string
  /** Header line, jaise "Trigonometry · Double angle" ya "Maths · PYQ". */
  sub: string
  /** Subjective questions me khaali array. */
  options: string[]
  /** MCQ me correct option ka index, subjective me -1. */
  answer: number
  explain: QuizExplain | null
  hint?: string
  /** formulaCategories ka category naam — weak-topic tracking ke liye. */
  topic?: string
  difficulty?: QuizDifficulty
  formula?: string
  /** Subjective questions ka expected answer. */
  modelAnswer?: string
  /** Subjective jawab check karne ke keywords. */
  keywords?: string[]
  classNum?: number
  /** "CBSE 2024" jaisa source tag (PYQ me). */
  source?: string
}

export type QuizMode = 'topics' | 'pyq' | 'sprint' | 'pdf' | 'daily'

export type QuizTypeFilter = 'mixed' | 'mcq' | 'subjective'

export type DifficultyFilter = 'Mixed' | QuizDifficulty

/** Ek sawaal par student ka record — review screen isi se banti hai. */
export interface QuizAnswerRecord {
  questionId: string
  /** MCQ me chuna option, subjective me null. */
  picked: number | null
  /** Subjective me likha jawab. */
  text: string
  correct: boolean
  skipped: boolean
  hintUsed: boolean
  /** Subjective ka aadha-adhoor jawab (auto-check se pata chala). */
  partial?: boolean
}
