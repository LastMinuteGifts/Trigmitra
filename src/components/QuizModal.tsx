import { useMemo, useState } from 'react'
import { Award, Check, RotateCcw, Search, Target, X } from 'lucide-react'
import { formulaCategories } from '../data/formulas'
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

// Har category kis class range ke liye hai (approx, NCERT pattern).
const CAT_CLASSES: Record<string, [number, number]> = {
  Arithmetic: [1, 8],
  'Number System': [6, 9],
  Geometry: [6, 10],
  Mensuration: [6, 10],
  Algebra: [7, 10],
  Statistics: [7, 10],
  Trigonometry: [9, 10],
  Motion: [9, 10],
  'Force & Energy': [8, 10],
  Light: [10, 10],
  Electricity: [10, 10],
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

function getBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY) ?? 0) || 0
  } catch {
    return 0
  }
}

export default function QuizModal({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<'setup' | 'asking' | 'done'>('setup')
  const [quizClass, setQuizClass] = useState<string>('All')
  const [selectedCats, setSelectedCats] = useState<string[]>([])
  const [topicQuery, setTopicQuery] = useState('')
  const [count, setCount] = useState(10)
  const [setupError, setSetupError] = useState<string | null>(null)

  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [idx, setIdx] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(() => getBest())

  const visibleCats = useMemo(() => {
    if (quizClass === 'All') return formulaCategories.map((c) => c.name)
    const n = Number(quizClass)
    return formulaCategories
      .filter((c) => {
        const range = CAT_CLASSES[c.name]
        return range ? n >= range[0] && n <= range[1] : true
      })
      .map((c) => c.name)
  }, [quizClass])

  const searchedCats = useMemo(() => {
    const q = topicQuery.trim().toLowerCase()
    if (!q) return visibleCats
    return visibleCats.filter((name) => name.toLowerCase().includes(q))
  }, [visibleCats, topicQuery])

  const toggleCat = (name: string) => {
    setSetupError(null)
    setSelectedCats((prev) => (prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]))
  }

  const startQuiz = () => {
    const valid = selectedCats.filter((c) => visibleCats.includes(c))
    if (valid.length < 3) {
      setSetupError('Kam se kam 3 topics chuno.')
      return
    }
    const n = Math.min(50, Math.max(10, Math.floor(Number(count) || 10)))
    setCount(n)
    setQuestions(buildQuiz(n, valid))
    setIdx(0)
    setPicked(null)
    setScore(0)
    setPhase('asking')
  }

  const done = phase === 'done'
  const current = questions[Math.min(idx, Math.max(questions.length - 1, 0))]
  const progress = questions.length > 0 ? Math.round((Math.min(idx, questions.length) / questions.length) * 100) : 0

  const pick = (i: number) => {
    if (picked !== null || !current) return
    setPicked(i)
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
      setPhase('done')
    } else {
      setPicked(null)
      setIdx((i) => i + 1)
    }
  }

  const backToSetup = () => {
    setPhase('setup')
    setPicked(null)
    setIdx(0)
    setScore(0)
  }

  return (
    <div className="example-overlay" role="dialog" aria-modal="true" aria-label="Practice quiz" onClick={onClose}>
      <div className="example-box quiz-box" onClick={(event) => event.stopPropagation()}>
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
          <button className="close-upload" aria-label="Close quiz" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {phase === 'setup' ? (
          <div className="quiz-setup">
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
              <span className="section-kicker">TOPICS · MIN 3 ({selectedCats.length} selected)</span>
            </div>
            <label className="auth-field">
              <div className="admin-search">
                <Search size={15} />
                <input
                  value={topicQuery}
                  onChange={(event) => setTopicQuery(event.target.value)}
                  placeholder="Topic search karo..."
                />
              </div>
            </label>
            <div className="cat-chips quiz-cats">
              {searchedCats.map((name) => (
                <button
                  key={name}
                  type="button"
                  role="checkbox"
                  aria-checked={selectedCats.includes(name)}
                  className={selectedCats.includes(name) ? 'cat-chip active' : 'cat-chip'}
                  onClick={() => toggleCat(name)}
                >
                  {selectedCats.includes(name) ? <Check size={13} /> : null} {name}
                </button>
              ))}
              {searchedCats.length === 0 && <p className="example-label">Koi topic nahi mila.</p>}
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
            <h3>{score} / {questions.length}</h3>
            <p>
              {score === questions.length
                ? 'Perfect! Tum to Nawab nikle!'
                : score / questions.length >= 0.7
                  ? 'Bahut khoob! Thodi aur practice.'
                  : 'Koi baat nahi — formulas revise karke phir try karo.'}
            </p>
            <p className="example-label">Best score: {Math.max(best, score)} / {questions.length}</p>
            <div className="quiz-result-actions">
              <button className="analyze-button" onClick={backToSetup}>
                <RotateCcw size={16} /> New quiz
              </button>
              <button className="outline-button" type="button" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
