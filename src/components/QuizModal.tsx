import { useEffect, useMemo, useState } from 'react'
import { Award, Check, RotateCcw, Search, Target, X } from 'lucide-react'
import { formulaCategories } from '../data/formulas'
import { ncertChapters } from '../data/ncertChapters'
import { getFormulaExample } from '../data/formulaExamples'

export interface QuizExplain {
  q: string
  steps: string[]
}

export interface QuizQuestion {
  prompt: string
  sub: string
  options: string[]
  answer: number
  explain: QuizExplain | null
}

interface BankEntry {
  formula: string
  label: string
  cat: string
}

// Class chuni ho to us class ke NCERT chapters chips me dikhte hain (Maths aur
// Physics alag groups me), warna generic topic chips.
interface ChipOption {
  key: string
  cats: string[]
}

interface ChipGroup {
  label: string
  options: ChipOption[]
}

export const QUIZ_COUNTS = [10, 15, 20, 30, 50]

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function buildQuiz(count: number, cats: string[] = []): QuizQuestion[] {
  const all: BankEntry[] = formulaCategories.flatMap((c) => c.formulas.map((f) => ({ ...f, cat: c.name })))
  const pool = cats.length > 0 ? all.filter((p) => cats.includes(p.cat)) : all
  const picked = shuffle(pool).slice(0, Math.min(Math.max(count, 1), pool.length))
  return picked.map((entry) => {
    const ex = getFormulaExample(entry.formula)
    const explain: QuizExplain | null = ex ? { q: ex.q, steps: ex.steps } : null
    const eq = entry.formula.indexOf('=')
    if (eq > 0) {
      const left = entry.formula.slice(0, eq).trim()
      const right = entry.formula.slice(eq + 1).trim()
      const sameCat = pool.filter((p) => p.cat === entry.cat && p.formula !== entry.formula)
      const distractPool = sameCat.length >= 3 ? sameCat : pool.filter((p) => p.formula !== entry.formula)
      const distractors = shuffle(distractPool)
        .slice(0, 3)
        .map((d) => {
          const i = d.formula.indexOf('=')
          return (i > 0 ? d.formula.slice(i + 1).trim() : d.formula).slice(0, 60)
        })
      const options = shuffle([right.slice(0, 60), ...distractors])
      return {
        prompt: `Complete: ${left} = ?`,
        sub: `${entry.cat} · ${entry.label}`,
        options,
        answer: options.indexOf(right.slice(0, 60)),
        explain,
      }
    }
    const distractors = shuffle(pool.filter((p) => p.formula !== entry.formula))
      .slice(0, 3)
      .map((d) => d.formula.slice(0, 60))
    const options = shuffle([entry.formula.slice(0, 60), ...distractors])
    return {
      prompt: `Which one is "${entry.label}"?`,
      sub: entry.cat,
      options,
      answer: options.indexOf(entry.formula.slice(0, 60)),
      explain,
    }
  })
}

const BEST_KEY = 'anknawab_quiz_best'
const PROGRESS_KEY = 'anknawab_quiz_progress'

interface SavedQuiz {
  questions: QuizQuestion[]
  idx: number
  score: number
  picked: number | null
  answered: number
}

function loadSavedQuiz(): SavedQuiz | null {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as SavedQuiz
    if (!Array.isArray(data.questions) || data.questions.length === 0) return null
    if (typeof data.idx !== 'number' || data.idx < 0 || data.idx >= data.questions.length) return null
    return {
      questions: data.questions,
      idx: data.idx,
      score: typeof data.score === 'number' ? data.score : 0,
      picked: typeof data.picked === 'number' ? data.picked : null,
      answered: typeof data.answered === 'number' ? data.answered : 0,
    }
  } catch {
    return null
  }
}

function clearProgress() {
  try {
    localStorage.removeItem(PROGRESS_KEY)
  } catch {
    // ignore
  }
}

function getBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY) ?? 0) || 0
  } catch {
    return 0
  }
}

export function QuizRunner({ onExit }: { onExit: () => void }) {
  const [phase, setPhase] = useState<'setup' | 'asking' | 'done'>('setup')
  const [quizClass, setQuizClass] = useState<string>('All')
  const [selectedCats, setSelectedCats] = useState<string[]>([])
  const [topicQuery, setTopicQuery] = useState('')
  const [count, setCount] = useState(10)
  const [setupError, setSetupError] = useState<string | null>(null)

  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [savedQuiz, setSavedQuiz] = useState<SavedQuiz | null>(() => loadSavedQuiz())
  const [idx, setIdx] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [answered, setAnswered] = useState(0)
  const [best, setBest] = useState(() => getBest())

  // Khelte waqt progress save hota rahe — beech me chhoda to wapas milega.
  useEffect(() => {
    if (phase !== 'asking' || questions.length === 0) return
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify({ questions, idx, score, picked, answered }))
    } catch {
      // ignore
    }
  }, [phase, questions, idx, score, picked, answered])

  // Class chuni ho to us class ke NCERT chapters (Maths/Physics alag), warna generic topics.
  const groups = useMemo<ChipGroup[]>(() => {
    if (quizClass === 'All') {
      return [{ label: '', options: formulaCategories.map((c) => ({ key: c.name, cats: [c.name] })) }]
    }
    const list = ncertChapters[Number(quizClass)] ?? []
    const toOption = (ch: { name: string; cat: string }): ChipOption => ({ key: ch.name, cats: [ch.cat] })
    const maths = list.filter((c) => c.subject === 'Maths').map(toOption)
    const physics = list.filter((c) => c.subject === 'Physics').map(toOption)
    const out: ChipGroup[] = []
    if (maths.length) out.push({ label: 'Maths', options: maths })
    if (physics.length) out.push({ label: 'Physics', options: physics })
    return out
  }, [quizClass])

  const allOptions = useMemo(() => groups.flatMap((g) => g.options), [groups])

  // Class badalne par purani selection hatao (topics aur chapters alag hain).
  useEffect(() => {
    setSelectedCats([])
    setSetupError(null)
  }, [quizClass])

  const searchedGroups = useMemo(() => {
    const q = topicQuery.trim().toLowerCase()
    return groups
      .map((g) => ({
        label: g.label,
        options: q ? g.options.filter((o) => o.key.toLowerCase().includes(q)) : g.options,
      }))
      .filter((g) => g.options.length > 0)
  }, [groups, topicQuery])

  const toggleCat = (name: string) => {
    setSetupError(null)
    setSelectedCats((prev) => {
      if (prev.includes(name)) return prev.filter((c) => c !== name)
      if (prev.length >= 3) {
        setSetupError('Sirf 3 topics tak chun sakte ho.')
        return prev
      }
      return [...prev, name]
    })
  }

  const startQuiz = () => {
    const optionMap = new Map(allOptions.map((o) => [o.key, o.cats]))
    const validKeys = selectedCats.filter((k) => optionMap.has(k))
    if (validKeys.length < 1) {
      setSetupError('Kam se kam 1 topic chuno.')
      return
    }
    const cats = [...new Set(validKeys.flatMap((k) => optionMap.get(k) ?? []))]
    const n = Math.min(50, Math.max(10, Math.floor(Number(count) || 10)))
    setCount(n)
    setQuestions(buildQuiz(n, cats))
    setIdx(0)
    setPicked(null)
    setScore(0)
    setAnswered(0)
    setSavedQuiz(null)
    clearProgress()
    setPhase('asking')
  }

  const resumeQuiz = () => {
    if (!savedQuiz) return
    setQuestions(savedQuiz.questions)
    setIdx(savedQuiz.idx)
    setScore(savedQuiz.score)
    setPicked(savedQuiz.picked)
    setAnswered(savedQuiz.answered)
    setSavedQuiz(null)
    setPhase('asking')
  }

  const discardSaved = () => {
    clearProgress()
    setSavedQuiz(null)
  }

  const endQuiz = () => {
    clearProgress()
    setPhase('done')
  }

  const done = phase === 'done'
  const atMax = selectedCats.length >= 3
  const current = questions[Math.min(idx, Math.max(questions.length - 1, 0))]
  const progress = questions.length > 0 ? Math.round((Math.min(idx, questions.length) / questions.length) * 100) : 0

  const pick = (i: number) => {
    if (picked !== null || !current) return
    setPicked(i)
    setAnswered((a) => a + 1)
    if (i === current.answer) {
      const s = score + 1
      setScore(s)
      if (s > best) {
        setBest(s)
        try {
          localStorage.setItem(BEST_KEY, String(s))
        } catch {
          // ignore
        }
      }
    }
  }

  const next = () => {
    if (idx + 1 >= questions.length) {
      clearProgress()
      setPhase('done')
    } else {
      setPicked(null)
      setIdx((i) => i + 1)
    }
  }

  const backToSetup = () => {
    clearProgress()
    setPhase('setup')
    setPicked(null)
    setIdx(0)
    setScore(0)
    setAnswered(0)
  }

  return (
    <div className="example-box quiz-box quiz-page-box">
        <div className="example-head">
          <div>
            <span className="section-kicker">PRACTICE QUIZ</span>
            <h3>
              {phase === 'setup'
                ? 'Quiz setup karo'
                : done
                  ? 'Result!'
                  : `Question ${Math.min(idx + 1, questions.length)} / ${questions.length}`}
            </h3>
          </div>
          <button className="close-upload" aria-label="Close quiz" onClick={onExit}>
            <X size={20} />
          </button>
        </div>
        {phase === 'setup' ? (
          <div className="quiz-setup">
            {savedQuiz && (
              <div className="quiz-resume">
                <p>
                  Adhura quiz mila: <b>Q{savedQuiz.idx + 1}/{savedQuiz.questions.length}</b>, Score{' '}
                  <b>{savedQuiz.score}</b> — wahin se shuru karo?
                </p>
                <div className="quiz-resume-actions">
                  <button className="analyze-button" type="button" onClick={resumeQuiz}>
                    Resume quiz
                  </button>
                  <button className="outline-button" type="button" onClick={discardSaved}>
                    Discard
                  </button>
                </div>
              </div>
            )}
            <label className="auth-field">
              Class chuno
              <select value={quizClass} onChange={(event) => setQuizClass(event.target.value)}>
                <option value="All">All classes</option>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <option key={n} value={String(n)}>Class {n}</option>
                ))}
              </select>
            </label>
            <div className="quiz-topics-head">
              <span className="section-kicker">
                {quizClass === 'All' ? 'TOPICS' : `NCERT CHAPTERS · CLASS ${quizClass}`} · MAX 3 ({selectedCats.length} selected)
              </span>
            </div>
            <label className="auth-field">
              <div className="admin-search">
                <Search size={15} />
                <input
                  value={topicQuery}
                  onChange={(event) => setTopicQuery(event.target.value)}
                  placeholder={quizClass === 'All' ? 'Topic search karo...' : 'Chapter search karo...'}
                />
              </div>
            </label>
            <div className="chip-groups">
              {searchedGroups.map((group, gi) => (
                <div className="chip-group" key={group.label || `group-${gi}`}>
                  {group.label ? (
                    <span className="chip-group-head">
                      {group.label} <i>{group.options.length}</i>
                    </span>
                  ) : null}
                  <div className="cat-chips quiz-cats">
                    {group.options.map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        role="checkbox"
                        aria-checked={selectedCats.includes(opt.key)}
                        disabled={atMax && !selectedCats.includes(opt.key)}
                        className={selectedCats.includes(opt.key) ? 'cat-chip active' : 'cat-chip'}
                        onClick={() => toggleCat(opt.key)}
                      >
                        {selectedCats.includes(opt.key) ? <Check size={13} /> : null} {opt.key}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {searchedGroups.length === 0 && <p className="example-label">Koi topic nahi mila.</p>}
            </div>
            <div className="quiz-count-row">
              <span className="section-kicker">QUESTIONS (10–50)</span>
              <div className="quiz-count-chips">
                {[10, 15, 20, 30, 50].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={count === n ? 'cat-chip active' : 'cat-chip'}
                    onClick={() => setCount(n)}
                  >
                    {n}
                  </button>
                ))}
                <input
                  className="limit-input"
                  type="number"
                  min={10}
                  max={50}
                  value={count}
                  onChange={(event) => {
                    const v = Math.floor(Number(event.target.value) || 0)
                    setCount(Math.min(50, Math.max(10, v || 10)))
                  }}
                  aria-label="Custom question count"
                />
              </div>
            </div>
            {setupError && <div className="upload-error">{setupError}</div>}
            <button className="analyze-button quiz-next" onClick={startQuiz}>
              <Target size={16} /> Start quiz — {count} MCQs
            </button>
          </div>
        ) : !done && current ? (
          <>
            <div className="quiz-progress">
              <i style={{ width: `${progress}%` }} />
            </div>
            <div className="quiz-score-line">
              <span>{current.sub}</span>
              <span>Score: {score} · Best: {best}</span>
              <button type="button" className="text-button end-quiz-btn" onClick={endQuiz}>
                End quiz
              </button>
            </div>
            <p className="quiz-prompt">{current.prompt}</p>
            <div className="quiz-options">
              {current.options.map((opt, i) => {
                const isAnswer = i === current.answer
                const isPicked = i === picked
                const cls = picked === null
                  ? 'quiz-opt'
                  : isAnswer
                    ? 'quiz-opt correct'
                    : isPicked
                      ? 'quiz-opt wrong'
                      : 'quiz-opt dim'
                return (
                  <button key={i} type="button" className={cls} onClick={() => pick(i)} disabled={picked !== null}>
                    {picked !== null && isAnswer && <Check size={15} />}
                    <span>{opt}</span>
                  </button>
                )
              })}
            </div>
            {picked !== null && picked !== current.answer && (
              <div className="quiz-explain">
                <span className="section-kicker">SAMJHO</span>
                {current.explain ? (
                  <>
                    <p><b>Example:</b> {current.explain.q}</p>
                    <ol className="example-steps">
                      {current.explain.steps.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ol>
                  </>
                ) : (
                  <p>Sahi jawab: <b>{current.options[current.answer]}</b></p>
                )}
              </div>
            )}
            {picked !== null && (
              <button className="analyze-button quiz-next" onClick={next}>
                {idx + 1 >= questions.length ? 'See result' : 'Next question'} <Target size={16} />
              </button>
            )}
          </>
        ) : done && questions.length > 0 ? (
          <div className="quiz-result">
            <Award size={40} />
            <h3>{score} / {answered}</h3>
            <p>
              {answered > 0 && score === answered
                ? 'Perfect! Tum to Nawab nikle!'
                : answered > 0 && score / answered >= 0.7
                  ? 'Bahut khoob! Thodi aur practice.'
                  : 'Koi baat nahi — formulas revise karke phir try karo.'}
            </p>
            <p className="example-label">
              {answered} of {questions.length} attempted · Best score: {Math.max(best, score)}
            </p>
            <div className="quiz-result-actions">
              <button className="analyze-button" onClick={backToSetup}>
                <RotateCcw size={16} /> New quiz
              </button>
              <button className="outline-button" type="button" onClick={onExit}>
                Back to site
              </button>
            </div>
          </div>
        ) : null}
    </div>
  )
}

export default function QuizPage({ onExit }: { onExit: () => void }) {
  return (
    <div className="quiz-page">
      <button type="button" className="text-button quiz-back" onClick={onExit}>
        ← Back to site
      </button>
      <QuizRunner onExit={onExit} />
    </div>
  )
}
