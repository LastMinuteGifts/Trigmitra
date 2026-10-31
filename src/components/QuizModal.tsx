import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { X } from 'lucide-react'
import { formulaCategories } from '../data/formulas'
import { ncertChapters } from '../data/ncertChapters'
import { extractPdfText } from '../utils/pdfText'
import { generateQuizFromText } from '../utils/quizApi'
import { checkSubjectiveAnswer, type SubjectiveCheck } from '../utils/answerCheck'
import { gradePhotoAnswer } from '../utils/gradeApi'
import { buildDailyChallenge } from '../utils/dailyChallenge'
import { buildPyqQuiz, buildQuiz, buildSprintQuiz, dailyPool, QUIZ_COUNTS } from '../utils/quizBuild'
import {
  QUIZ_BEST_KEY,
  QUIZ_PROGRESS_KEY,
  addAttempt,
  addLeaderEntry,
  formatSeconds,
  loadDaily,
  loadLeaderboard,
  loadMistakes,
  loadPlayerName,
  loadStats,
  loadStreak,
  readJSON,
  recordTopicAnswer,
  removeKey,
  saveDaily,
  saveMistakes,
  savePlayerName,
  todayKey,
  touchStreak,
  weakTopics,
  writeJSON,
  type DailyState,
  type LeaderEntry,
  type QuizStats,
  type StreakState,
} from '../utils/quizStore'
import type { DifficultyFilter, QuizAnswerRecord, QuizMode, QuizQuestion, QuizReviewItem, QuizTypeFilter } from '../types/quiz'
import QuizPlay from './QuizPlay'
import QuizResult, { type ReviewItem } from './QuizResult'
import QuizSetup, { type ChipGroup } from './QuizSetup'

export type { QuizExplain, QuizQuestion } from '../types/quiz'
export { buildQuiz, QUIZ_COUNTS }

// Har sawaal ka time limit — MCQ 30 second, subjective 3 minute.
const MCQ_SECONDS = 30
const SUBJECTIVE_SECONDS = 180

interface SavedQuiz {
  questions: QuizQuestion[]
  idx: number
  answers: Record<string, QuizAnswerRecord>
  startedAt: number
  mode: QuizMode
}

function loadBest(): number {
  try {
    return Number(localStorage.getItem(QUIZ_BEST_KEY) ?? 0) || 0
  } catch {
    return 0
  }
}

function saveBest(score: number) {
  try {
    localStorage.setItem(QUIZ_BEST_KEY, String(score))
  } catch {
    // ignore
  }
}

function normalizeSavedQuestion(raw: unknown, index: number): QuizQuestion | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Partial<QuizQuestion>
  if (typeof record.prompt !== 'string' || !record.prompt) return null
  const options = Array.isArray(record.options) ? record.options.filter((item): item is string => typeof item === 'string') : []
  const type = record.type === 'subjective' ? 'subjective' : 'mcq'
  return {
    id: typeof record.id === 'string' && record.id ? record.id : `saved-${index}`,
    type,
    prompt: record.prompt,
    sub: typeof record.sub === 'string' ? record.sub : '',
    options,
    answer: typeof record.answer === 'number' ? record.answer : -1,
    explain: record.explain ?? null,
    hint: record.hint,
    topic: record.topic,
    difficulty: record.difficulty,
    formula: record.formula,
    modelAnswer: record.modelAnswer,
    keywords: record.keywords,
    classNum: record.classNum,
    source: record.source,
  }
}

function loadSavedQuiz(): SavedQuiz | null {
  const data = readJSON<Record<string, unknown> | null>(QUIZ_PROGRESS_KEY, null)
  if (!data || !Array.isArray(data.questions) || data.questions.length === 0) return null

  const questions = (data.questions as unknown[])
    .map((item, index) => normalizeSavedQuestion(item, index))
    .filter((item): item is QuizQuestion => item !== null)
  if (questions.length === 0) return null

  const idx = typeof data.idx === 'number' && data.idx >= 0 && data.idx < questions.length ? Math.floor(data.idx) : 0
  const answers: Record<string, QuizAnswerRecord> =
    data.answers && typeof data.answers === 'object' ? (data.answers as Record<string, QuizAnswerRecord>) : {}

  // Purane format me sirf current question ka `picked` tha — usse record banao.
  if (Object.keys(answers).length === 0 && typeof data.picked === 'number') {
    const question = questions[idx]
    answers[question.id] = {
      questionId: question.id,
      picked: data.picked,
      text: '',
      correct: question.answer === data.picked,
      skipped: false,
      hintUsed: false,
    }
  }

  return {
    questions,
    idx,
    answers,
    startedAt: typeof data.startedAt === 'number' ? data.startedAt : Date.now(),
    mode: (data.mode as QuizMode) ?? 'topics',
  }
}

function countAnswered(answers: Record<string, QuizAnswerRecord>): number {
  return Object.values(answers).filter((answer) => answer && !answer.skipped).length
}

/** Photo ko panel me dikhane ke liye data URL banao. */
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(new Error('Photo padhi nahi ja saki'))
    reader.readAsDataURL(file)
  })
}

function scoreOf(answers: Record<string, QuizAnswerRecord>): number {
  return Object.values(answers).filter((answer) => answer && answer.correct && !answer.skipped).length
}

export function QuizRunner({ onExit, playerName: initialName, playerClass }: { onExit: () => void; playerName?: string; playerClass?: number | null }) {
  const [phase, setPhase] = useState<'setup' | 'asking' | 'done'>('setup')
  const [mode, setMode] = useState<QuizMode>('topics')
  const [quizClass, setQuizClass] = useState(playerClass ? String(playerClass) : 'All')
  const [selectedCats, setSelectedCats] = useState<string[]>([])
  const [topicQuery, setTopicQuery] = useState('')
  const [count, setCount] = useState(10)
  const [difficulty, setDifficulty] = useState<DifficultyFilter>('Mixed')
  const [typeFilter, setTypeFilter] = useState<QuizTypeFilter>('mixed')
  const [setupError, setSetupError] = useState<string | null>(null)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [pdfName, setPdfName] = useState<string | null>(null)
  const pdfInput = useRef<HTMLInputElement>(null)

  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, QuizAnswerRecord>>({})
  const [draft, setDraft] = useState('')
  const [hintOpen, setHintOpen] = useState(false)
  // Subjective ka auto-check result — verdict, matched/missing points ke saath.
  const [answerCheck, setAnswerCheck] = useState<SubjectiveCheck | null>(null)
  // Photo se solve karke AI check karne ki state.
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const gradeTokenRef = useRef(0)
  const [reinforced, setReinforced] = useState(false)
  const [startedAt, setStartedAt] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())
  const [sprintLeft, setSprintLeft] = useState<number | null>(null)
  // Har sawaal ka apna countdown — MCQ 30s, subjective 3 min (sprint me nahi).
  const [questionLeft, setQuestionLeft] = useState<number | null>(null)
  const [finalSeconds, setFinalSeconds] = useState(0)
  const [savedQuiz, setSavedQuiz] = useState<SavedQuiz | null>(() => loadSavedQuiz())
  const [best, setBest] = useState(() => loadBest())
  const [stats, setStats] = useState<QuizStats>(() => loadStats())
  const [streak, setStreak] = useState<StreakState>(() => loadStreak())
  const [daily, setDaily] = useState<DailyState>(() => loadDaily())
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>(() => loadLeaderboard())
  const [playerName, setPlayerName] = useState(() => initialName?.trim() || loadPlayerName())
  const [reviewOpen, setReviewOpen] = useState(false)
  // Pichhle quiz ke galat + chhoote sawaal — setup page par bhi dikhte hain.
  const [lastMistakes, setLastMistakes] = useState<QuizReviewItem[]>(() => loadMistakes())
  const statsDone = useRef<Set<string>>(new Set())

  const groups = useMemo<ChipGroup[]>(() => {
    if (mode === 'pyq') {
      return [{ label: '', options: formulaCategories.map((category) => ({ key: category.name, cats: [category.name] })) }]
    }
    if (quizClass === 'All') {
      return [{ label: '', options: formulaCategories.map((category) => ({ key: category.name, cats: [category.name] })) }]
    }
    const list = ncertChapters[Number(quizClass)] ?? []
    const toOption = (chapter: { name: string; cat: string }) => ({ key: chapter.name, cats: [chapter.cat] })
    const maths = list.filter((chapter) => chapter.subject === 'Maths').map(toOption)
    const physics = list.filter((chapter) => chapter.subject === 'Physics').map(toOption)
    const chemistry = list.filter((chapter) => chapter.subject === 'Chemistry').map(toOption)
    const out: ChipGroup[] = []
    if (maths.length) out.push({ label: 'Maths', options: maths })
    if (physics.length) out.push({ label: 'Physics', options: physics })
    if (chemistry.length) out.push({ label: 'Chemistry', options: chemistry })
    return out
  }, [quizClass, mode])

  const allOptions = useMemo(() => groups.flatMap((group) => group.options), [groups])

  const searchedGroups = useMemo(() => {
    const query = topicQuery.trim().toLowerCase()
    return groups
      .map((group) => ({
        label: group.label,
        options: query ? group.options.filter((option) => option.key.toLowerCase().includes(query)) : group.options,
      }))
      .filter((group) => group.options.length > 0)
  }, [groups, topicQuery])

  useEffect(() => {
    setSelectedCats([])
    setSetupError(null)
  }, [quizClass])

  useEffect(() => {
    setSelectedCats([])
  }, [mode])

  const pool = useMemo(() => dailyPool(), [])
  const weak = useMemo(() => weakTopics(stats), [stats])

  const current = questions[Math.min(idx, Math.max(questions.length - 1, 0))]
  const currentAnswer = current ? answers[current.id] ?? null : null
  const score = scoreOf(answers)
  const answeredNow = countAnswered(answers)
  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000))
  // Leaderboard kis class me jayega: login ki class, warna quiz setup me chuni class.
  const activeClass = playerClass ?? (quizClass === 'All' ? null : Number(quizClass))

  // Timer sirf quiz ke dauraan tick karta hai.
  useEffect(() => {
    if (phase !== 'asking') return
    const timer = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(timer)
  }, [phase])

  // Sprint ka countdown + auto-finish.
  useEffect(() => {
    if (phase !== 'asking' || mode !== 'sprint') {
      setSprintLeft(null)
      return
    }
    setSprintLeft(Math.max(0, 60 - elapsed))
  }, [phase, mode, elapsed])

  // Har naye sawaal par timer reset: MCQ 30s, subjective 180s.
  useEffect(() => {
    if (phase !== 'asking' || mode === 'sprint' || !current) {
      setQuestionLeft(null)
      return
    }
    setQuestionLeft(current.type === 'mcq' ? MCQ_SECONDS : SUBJECTIVE_SECONDS)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, idx, mode])

  // Countdown — sirf jab tak jawab nahi diya. 0 hote hi sawaal chhoot jata hai.
  const timerQuestionRef = useRef<string | null>(null)
  useEffect(() => {
    if (phase !== 'asking' || questionLeft === null || currentAnswer || photoBusy || !current) return
    if (questionLeft > 0) {
      timerQuestionRef.current = current.id
      const timer = window.setTimeout(() => setQuestionLeft((value) => (value === null ? null : Math.max(0, value - 1))), 1000)
      return () => window.clearTimeout(timer)
    }
    // Sirf usi sawaal ka timeout lo jiska timer chalu tha (naya sawaal galti se na chhoote).
    if (timerQuestionRef.current !== current.id) return
    skip()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, questionLeft, currentAnswer, current, photoBusy])

  // Khelte waqt progress save — sprint chhod ke (timer wala quiz resume nahi hota).
  useEffect(() => {
    if (phase !== 'asking' || questions.length === 0 || mode === 'sprint') return
    writeJSON(QUIZ_PROGRESS_KEY, { questions, idx, answers, startedAt, mode })
  }, [phase, questions, idx, answers, startedAt, mode])

  const commitStat = (question: QuizQuestion, correct: boolean) => {
    if (statsDone.current.has(question.id)) return
    statsDone.current.add(question.id)
    setStats(recordTopicAnswer(question.topic ?? question.sub, correct))
  }

  // Photo state reset + purani AI request ko bekaar karo.
  const resetPhoto = () => {
    gradeTokenRef.current++
    setPhotoBusy(false)
    setPhotoError(null)
    setPhotoPreview(null)
  }

  const begin = (quiz: QuizQuestion[], nextMode: QuizMode) => {
    if (quiz.length === 0) {
      setSetupError('Is selection par sawaal nahi mile — doosra topic ya difficulty try karo.')
      return
    }
    const stamp = Date.now()
    statsDone.current = new Set()
    setQuestions(quiz)
    setIdx(0)
    setAnswers({})
    setDraft('')
    setHintOpen(false)
    setAnswerCheck(null)
    resetPhoto()
    setReinforced(false)
    setReviewOpen(false)
    setStartedAt(stamp)
    setNow(stamp)
    setSprintLeft(nextMode === 'sprint' ? 60 : null)
    setMode(nextMode)
    setSavedQuiz(null)
    setSetupError(null)
    removeKey(QUIZ_PROGRESS_KEY)
    setPhase('asking')
  }

  const resolveCats = (): string[] => {
    const optionMap = new Map(allOptions.map((option) => [option.key, option.cats]))
    const validKeys = selectedCats.filter((key) => optionMap.has(key))
    return [...new Set(validKeys.flatMap((key) => optionMap.get(key) ?? []))]
  }

  const startQuiz = () => {
    if (mode === 'sprint') {
      begin(buildSprintQuiz(), 'sprint')
      return
    }
    if (mode === 'topics' && selectedCats.length === 0) {
      setSetupError('Kam se kam 1 topic chuno.')
      return
    }
    const cats = resolveCats()
    const classNum = activeClass ?? undefined
    const quiz =
      mode === 'pyq'
        ? buildPyqQuiz(count, cats, difficulty, typeFilter, classNum)
        : buildQuiz(count, cats, difficulty, typeFilter)
    begin(quiz, mode)
  }

  const startDaily = () => {
    begin(buildDailyChallenge(todayKey(), pool, 5), 'daily')
  }

  const practiceWeak = () => {
    const topics = weak.map((item) => item.topic)
    if (topics.length === 0) {
      setSetupError('Abhi weak topics ka data nahi hai — pehle kuch quizzes khelo.')
      return
    }
    setSelectedCats([])
    const cats = [...new Set(formulaCategories.filter((category) => topics.includes(category.name)).map((category) => category.name))]
    begin(buildQuiz(Math.min(15, Math.max(10, count)), cats, 'Mixed', typeFilter), 'topics')
  }

  const startGeneratedQuiz = (quiz: QuizQuestion[]) => {
    begin(quiz, 'pdf')
  }

  const onPdfSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || pdfBusy) return
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setSetupError('Sirf PDF file upload karo.')
      return
    }
    if (file.size > 12 * 1024 * 1024) {
      setSetupError('PDF 12 MB se choti honi chahiye.')
      return
    }
    setSetupError(null)
    setPdfName(file.name)
    setPdfBusy(true)
    try {
      const text = await extractPdfText(file)
      if (text.length < 80) {
        throw new Error('Is PDF me text nahi mila — shayad scanned hai. Text wali PDF ya photo try karo.')
      }
      const n = Math.min(50, Math.max(10, Math.floor(Number(count) || 10)))
      const quiz = await generateQuizFromText(text, n, quizClass === 'All' ? undefined : Number(quizClass))
      startGeneratedQuiz(quiz)
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : 'PDF se quiz nahi bana. Doosri PDF try karo.')
    } finally {
      setPdfBusy(false)
    }
  }

  // `extra` sirf us case ke liye jab aakhri sawaal skip karte waqt uska record
  // abhi state me nahi pahuncha hota — warna wo answer count se chhoot jata.
  const finishQuiz = (extra?: Record<string, QuizAnswerRecord>) => {
    if (phase !== 'asking') return
    const finalAnswers = extra ? { ...answers, ...extra } : answers
    const finalScore = scoreOf(finalAnswers)
    for (const question of questions) {
      const answer = finalAnswers[question.id]
      if (answer && !answer.skipped) commitStat(question, answer.correct)
    }
    const day = todayKey()
    const seconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000))
    setFinalSeconds(seconds)
    if (countAnswered(finalAnswers) > 0) setStreak(touchStreak(day))
    if (finalScore > best) {
      setBest(finalScore)
      saveBest(finalScore)
    }
    const topics = [...new Set(questions.map((question) => question.topic ?? question.sub))]
    addAttempt({ at: new Date().toISOString(), score: finalScore, total: questions.length, topics, mode, seconds, difficulty })
    if (mode === 'daily') setDaily(saveDaily(finalScore, questions.length, day))
    setLeaderboard(addLeaderEntry({ name: (playerName || 'Guest').slice(0, 18), score: finalScore, total: questions.length, day, mode, classNum: activeClass }))
    // Agla setup page bhi yahi galtiyan dikhaye.
    const missed = questions
      .map((question) => ({ question, answer: finalAnswers[question.id] ?? null }))
      .filter((item) => !item.answer || item.answer.skipped || !item.answer.correct)
    setLastMistakes(missed)
    saveMistakes(missed)
    removeKey(QUIZ_PROGRESS_KEY)
    setReviewOpen(false)
    setSprintLeft(null)
    setPhase('done')
  }

  // Sprint ka time khatam → result.
  useEffect(() => {
    if (phase === 'asking' && mode === 'sprint' && sprintLeft === 0) finishQuiz()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sprintLeft, phase, mode])

  const recordAnswer = (record: Omit<QuizAnswerRecord, 'questionId'>) => {
    if (!current) return
    const full: QuizAnswerRecord = { ...record, questionId: current.id }
    setAnswers((previous) => ({ ...previous, [current.id]: full }))
    return full
  }

  /**
   * Adaptive practice: jawab galat hua to isi topic ka agla sawaal turant
   * next par le aao, taaki galti wahin clear ho.
   */
  const reinforce = (question: QuizQuestion) => {
    const from = questions.findIndex(
      (item, itemIndex) => itemIndex > idx && item.topic === question.topic && item.id !== question.id,
    )
    if (from < 0 || question.topic === undefined) return false
    setQuestions((previous) => {
      const at = previous.findIndex((item) => item.id === questions[from]?.id)
      if (at < 0) return previous
      const next = [...previous]
      const [item] = next.splice(at, 1)
      next.splice(idx + 1, 0, item)
      return next
    })
    return true
  }

  const pick = (optionIndex: number) => {
    if (!current || current.type !== 'mcq' || answers[current.id]) return
    const correct = optionIndex === current.answer
    recordAnswer({ picked: optionIndex, text: '', correct, skipped: false, hintUsed: hintOpen })
    commitStat(current, correct)
    if (!correct && reinforce(current)) setReinforced(true)
  }

  const checkText = () => {
    if (!current || current.type !== 'subjective' || answers[current.id] || photoBusy || draft.trim().length < 2) return
    const result = checkSubjectiveAnswer(draft, current.modelAnswer, current.keywords)
    setAnswerCheck(result)
    recordAnswer({
      picked: null,
      text: draft.trim(),
      correct: result.correct,
      skipped: false,
      hintUsed: hintOpen,
      partial: result.verdict === 'partial',
    })
    if (!result.correct && reinforce(current)) setReinforced(true)
  }

  /** Paper par solve ki hui photo AI se check karao. */
  const checkPhoto = async (file: File) => {
    if (!current || current.type !== 'subjective' || answers[current.id] || photoBusy) return
    const question = current
    const token = ++gradeTokenRef.current
    setPhotoBusy(true)
    setPhotoError(null)
    try {
      const preview = await readAsDataUrl(file)
      if (token === gradeTokenRef.current && preview) setPhotoPreview(preview)
    } catch {
      // Preview optional hai — check phir bhi chalta rahe.
    }
    try {
      const result = await gradePhotoAnswer({
        file,
        prompt: question.prompt,
        modelAnswer: question.modelAnswer ?? question.formula ?? '',
        keywords: question.keywords,
        answerText: draft,
        studentClass: activeClass,
      })
      if (token !== gradeTokenRef.current) return
      setAnswerCheck(result)
      recordAnswer({
        picked: null,
        text: result.transcript?.trim() || '📷 Paper par solve karke photo bheji',
        correct: result.correct,
        skipped: false,
        hintUsed: hintOpen,
        partial: result.verdict === 'partial',
      })
      if (!result.correct && reinforce(question)) setReinforced(true)
    } catch (error) {
      if (token !== gradeTokenRef.current) return
      setPhotoError(error instanceof Error ? error.message : 'AI check nahi ho paya.')
    } finally {
      if (token === gradeTokenRef.current) setPhotoBusy(false)
    }
  }

  const selfMark = (correct: boolean) => {
    if (!current) return
    const existing = answers[current.id]
    if (!existing) return
    setAnswers((previous) => ({ ...previous, [current.id]: { ...existing, correct, partial: false } }))
    commitStat(current, correct)
  }

  const goNext = () => {
    if (current) {
      const answer = answers[current.id]
      if (answer && !answer.skipped) commitStat(current, answer.correct)
    }
    if (idx + 1 >= questions.length) {
      finishQuiz()
      return
    }
    setIdx((value) => value + 1)
    setDraft('')
    setHintOpen(false)
    setAnswerCheck(null)
    resetPhoto()
    setReinforced(false)
  }

  const skip = () => {
    if (!current) return
    resetPhoto()
    let nextAnswers = answers
    if (!answers[current.id]) {
      const record: QuizAnswerRecord = {
        questionId: current.id,
        picked: null,
        text: '',
        correct: false,
        skipped: true,
        hintUsed: hintOpen,
      }
      nextAnswers = { ...answers, [current.id]: record }
      recordAnswer({ picked: null, text: '', correct: false, skipped: true, hintUsed: hintOpen })
      if (idx + 1 >= questions.length) {
        finishQuiz(nextAnswers)
        return
      }
    }
    if (idx + 1 >= questions.length) finishQuiz()
    else {
      setIdx((value) => value + 1)
      setDraft('')
      setHintOpen(false)
      setAnswerCheck(null)
      resetPhoto()
      setReinforced(false)
    }
  }

  const toggleCat = (name: string) => {
    setSetupError(null)
    setSelectedCats((previous) => {
      if (previous.includes(name)) return previous.filter((item) => item !== name)
      if (previous.length >= 3) {
        setSetupError('Sirf 3 topics tak chun sakte ho.')
        return previous
      }
      return [...previous, name]
    })
  }

  const resumeQuiz = () => {
    if (!savedQuiz) return
    const stamp = Date.now()
    setQuestions(savedQuiz.questions)
    setIdx(savedQuiz.idx)
    setAnswers(savedQuiz.answers)
    setStartedAt(stamp)
    setNow(stamp)
    setMode(savedQuiz.mode)
    setSprintLeft(null)
    setSavedQuiz(null)
    setDraft('')
    setHintOpen(false)
    setAnswerCheck(null)
    resetPhoto()
    setReinforced(false)
    statsDone.current = new Set(Object.keys(savedQuiz.answers))
    setPhase('asking')
  }

  const discardSaved = () => {
    removeKey(QUIZ_PROGRESS_KEY)
    setSavedQuiz(null)
  }

  const backToSetup = () => {
    removeKey(QUIZ_PROGRESS_KEY)
    setPhase('setup')
    setMode((currentMode) => (currentMode === 'daily' ? 'topics' : currentMode))
    setAnswers({})
    setIdx(0)
    setDraft('')
    setHintOpen(false)
    resetPhoto()
    setReviewOpen(false)
    setQuestions([])
  }

  const changeName = (value: string) => {
    setPlayerName(value)
    savePlayerName(value)
  }

  const review: ReviewItem[] = questions.map((question) => ({ question, answer: answers[question.id] ?? null }))
  // Result ka alag section: galat + skipped (ya attempt na hua) sawaal only.
  const mistakes = review.filter((item) => !item.answer || item.answer.skipped || !item.answer.correct)
  const accuracy = answeredNow > 0 ? score / answeredNow : 0
  const atMax = selectedCats.length >= 3

  // Keyboard shortcuts — 1-4 option, H hint, S skip, Enter next/check.
  useEffect(() => {
    if (phase !== 'asking') return
    const handler = (event: KeyboardEvent) => {
      if (phase !== 'asking') return
      const target = event.target as HTMLElement | null
      const typing = target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      if (typing) {
        if (event.key === 'Enter' && target?.tagName === 'TEXTAREA' && current && !answers[current.id]) {
          event.preventDefault()
          checkText()
        }
        return
      }
      if (event.key === 'h' || event.key === 'H') {
        if (currentAnswer === null && sprintLeft === null) setHintOpen(true)
      } else if (event.key === 's' || event.key === 'S') {
        if (currentAnswer === null) skip()
      } else if (event.key === 'Enter') {
        if (currentAnswer !== null) goNext()
      } else if (['1', '2', '3', '4'].includes(event.key)) {
        if (current?.type === 'mcq' && currentAnswer === null) pick(Number(event.key) - 1)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, current, currentAnswer, draft, hintOpen, answers, sprintLeft])

  const printMode = mode === 'daily' ? 'Daily challenge' : mode === 'sprint' ? 'Formula sprint' : mode === 'pyq' ? 'Board PYQ' : mode === 'pdf' ? 'PDF quiz' : 'Topics'

  return (
    <div className="example-box quiz-box quiz-page-box">
      <div className="example-head">
        <div>
          <span className="section-kicker">{`PRACTICE QUIZ · ${printMode.toUpperCase()}`}</span>
          <h3>
            {phase === 'setup'
              ? 'Quiz setup karo'
              : phase === 'done'
                ? 'Result!'
                : `Question ${Math.min(idx + 1, questions.length)} / ${questions.length}`}
          </h3>
        </div>
        <button className="close-upload" aria-label="Close quiz" onClick={onExit}>
          <X size={20} />
        </button>
      </div>

      {phase === 'setup' ? (
        <QuizSetup
          quizClass={quizClass}
          onClass={setQuizClass}
          mode={mode}
          onMode={(nextMode) => {
            setMode(nextMode)
            setSetupError(null)
          }}
          difficulty={difficulty}
          onDifficulty={setDifficulty}
          typeFilter={typeFilter}
          onTypeFilter={setTypeFilter}
          searchedGroups={searchedGroups}
          selectedCats={selectedCats}
          maxCats={3}
          atMax={atMax}
          topicQuery={topicQuery}
          onTopicQuery={setTopicQuery}
          onToggleCat={toggleCat}
          count={count}
          onCount={setCount}
          setupError={setupError}
          savedQuiz={
            savedQuiz
              ? { idx: savedQuiz.idx, total: savedQuiz.questions.length, score: scoreOf(savedQuiz.answers) }
              : null
          }
          onResume={resumeQuiz}
          onDiscard={discardSaved}
          onStart={startQuiz}
          onStartDaily={startDaily}
          onPracticeWeak={practiceWeak}
          mistakes={lastMistakes}
          streak={streak.count}
          daily={daily}
          dailyPoolSize={pool.length}
          best={best}
          stats={stats}
          weak={weak}
          playerName={playerName}
          onName={changeName}
          accountClass={playerClass ?? null}
          accountName={initialName?.trim() ?? ''}
          pdfBusy={pdfBusy}
          pdfName={pdfName}
          pdfInput={pdfInput}
          onPdfSelected={onPdfSelected}
        />
      ) : phase === 'asking' && current ? (
        <QuizPlay
          question={current}
          index={idx}
          total={questions.length}
          score={score}
          best={best}
          elapsed={formatSeconds(elapsed)}
          sprintLeft={sprintLeft}
          questionLeft={questionLeft}
          answer={currentAnswer}
          draft={draft}
          hintOpen={hintOpen}
          check={answerCheck}
          photoBusy={photoBusy}
          photoError={photoError}
          photoPreview={photoPreview}
          sprint={sprintLeft !== null}
          reinforced={reinforced}
          onDraft={setDraft}
          onPick={pick}
          onCheckText={checkText}
          onCheckPhoto={checkPhoto}
          onSelfMark={selfMark}
          onHint={() => setHintOpen(true)}
          onSkip={skip}
          onNext={goNext}
          onEnd={() => finishQuiz()}
        />
      ) : phase === 'done' && questions.length > 0 ? (
        <QuizResult
          score={score}
          attempted={answeredNow}
          total={questions.length}
          seconds={finalSeconds || elapsed}
          best={best}
          mode={mode}
          streak={streak}
          daily={daily}
          accuracy={accuracy}
          review={review}
          mistakes={mistakes}
          reviewOpen={reviewOpen}
          weak={weak}
          leaderboard={leaderboard}
          playerName={playerName}
          playerClass={activeClass}
          onNameChange={changeName}
          nameLocked={!!initialName?.trim()}
          onToggleReview={() => setReviewOpen((value) => !value)}
          onPracticeWeak={practiceWeak}
          onNewQuiz={backToSetup}
          onExit={onExit}
        />
      ) : null}
    </div>
  )
}

export default function QuizPage({ onExit, playerName, playerClass }: { onExit: () => void; playerName?: string; playerClass?: number | null }) {
  return (
    <div className="quiz-page">
      <button type="button" className="text-button quiz-back" onClick={onExit}>
        ← Back to site
      </button>
      <QuizRunner onExit={onExit} playerName={playerName} playerClass={playerClass} />
    </div>
  )
}
