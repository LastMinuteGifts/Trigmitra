import { useEffect, useState } from 'react'
import { Award, Check, RotateCcw, Sparkles, Target, X } from 'lucide-react'
import { formulaCategories } from '../data/formulas'
import { supabase } from '../lib/supabase'

export interface QuizQuestion {
  prompt: string
  sub: string
  options: string[]
  answer: number
}

interface BankEntry {
  formula: string
  label: string
  cat: string
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function buildQuiz(count = 10, focusCats: string[] = []): QuizQuestion[] {
  const pool: BankEntry[] = formulaCategories.flatMap((c) => c.formulas.map((f) => ({ ...f, cat: c.name })))
  let picked: BankEntry[]
  if (focusCats.length > 0) {
    const focus = shuffle(pool.filter((p) => focusCats.includes(p.cat)))
    const rest = shuffle(pool.filter((p) => !focusCats.includes(p.cat)))
    const nFocus = Math.min(focus.length, Math.round(count * 0.7))
    picked = shuffle([...focus.slice(0, nFocus), ...rest.slice(0, count - nFocus)]).slice(0, count)
    if (picked.length < count) {
      picked = [...picked, ...shuffle(pool).slice(0, count - picked.length)]
    }
  } else {
    picked = shuffle(pool).slice(0, Math.min(count, pool.length))
  }
  return picked.map((entry) => {
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
    }
  })
}

const BEST_KEY = 'anknawab_quiz_best'
const UNLOCK_COUNT = 10

function getBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY) ?? 0) || 0
  } catch {
    return 0
  }
}

export default function QuizModal({ onClose }: { onClose: () => void }) {
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null)
  const [personalCats, setPersonalCats] = useState<string[] | null>(null)
  const [solvedTotal, setSolvedTotal] = useState(0)
  const [checking, setChecking] = useState(true)
  const [idx, setIdx] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(() => getBest())

  // Login user ke topics lao — 10+ solves par personal quiz unlock.
  useEffect(() => {
    let cancelled = false
    const check = async () => {
      try {
        if (!supabase) return
        const { data } = await supabase.auth.getUser()
        if (!data.user || cancelled) return
        const res = await supabase.from('solutions').select('topic').limit(200)
        if (cancelled) return
        const rows = ((res.data ?? []) as Array<{ topic: string }>)
        const counts = new Map<string, number>()
        for (const r of rows) {
          const t = (r.topic || '').trim()
          if (formulaCategories.some((c) => c.name === t)) {
            counts.set(t, (counts.get(t) ?? 0) + 1)
          }
        }
        if (rows.length >= UNLOCK_COUNT && counts.size > 0) {
          const top = [...counts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([name]) => name)
          setPersonalCats(top)
          setSolvedTotal(rows.length)
        } else {
          setQuestions(buildQuiz(10))
        }
      } finally {
        if (!cancelled) setChecking(false)
      }
    }
    check()
    return () => {
      cancelled = true
    }
  }, [])

  const done = questions !== null && idx >= questions.length
  const current = questions ? questions[Math.min(idx, questions.length - 1)] : null
  const progress = questions
    ? Math.round((Math.min(idx, questions.length) / questions.length) * 100)
    : 0

  const startAll = () => {
    setQuestions(buildQuiz(10))
    setIdx(0)
    setPicked(null)
    setScore(0)
  }

  const startPersonal = () => {
    setQuestions(buildQuiz(10, personalCats ?? []))
    setIdx(0)
    setPicked(null)
    setScore(0)
  }

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
    setPicked(null)
    setIdx((i) => i + 1)
  }

  const restart = () => {
    setQuestions(buildQuiz(10, []))
    setIdx(0)
    setPicked(null)
    setScore(0)
  }

  return (
    <div className="example-overlay" role="dialog" aria-modal="true" aria-label="Practice quiz" onClick={onClose}>
      <div className="example-box quiz-box" onClick={(event) => event.stopPropagation()}>
        <div className="example-head">
          <div>
            <span className="section-kicker">PRACTICE QUIZ</span>
            <h3>
              {!questions
                ? 'Quiz ready ho raha...'
                : done
                  ? 'Result!'
                  : `Question ${Math.min(idx + 1, questions.length)} / ${questions.length}`}
            </h3>
          </div>
          <button className="close-upload" aria-label="Close quiz" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {!questions ? (
          <div className="quiz-menu">
            <div className="reading-state">
              <div className="reading-orbit">
                <Target size={25} />
              </div>
              <h3>Tumhare topics ka quiz!</h3>
              <p>
                Tumne {solvedTotal} questions solve kiye — zyada tar <b>{(personalCats ?? []).join(', ')}</b> me.
                Is quiz me 70% sawal tumhare topics se ayenge.
              </p>
              <div className="loading-line">
                <span />
              </div>
            </div>
            {!checking && (
              <>
                <button className="analyze-button quiz-next" onClick={startPersonal}>
                  <Sparkles size={16} /> My topics quiz — Start
                </button>
                <button className="outline-button quiz-next" type="button" onClick={startAll}>
                  <Target size={16} /> All topics quiz
                </button>
              </>
            )}
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
            {picked !== null && (
              <button className="analyze-button quiz-next" onClick={next}>
                {idx + 1 >= questions.length ? 'See result' : 'Next question'} <Target size={16} />
              </button>
            )}
          </>
        ) : done && questions ? (
          <div className="quiz-result">
            <Award size={40} />
            <h3>{score} / {questions.length}</h3>
            <p>
              {score === questions.length
                ? 'Perfect! Tum to Nawab nikle!'
                : score >= 7
                  ? 'Bahut khoob! Thodi aur practice.'
                  : 'Koi baat nahi — formulas revise karke phir try karo.'}
            </p>
            <p className="example-label">Best score: {Math.max(best, score)} / {questions.length}</p>
            <div className="quiz-result-actions">
              <button className="analyze-button" onClick={restart}>
                <RotateCcw size={16} /> Play again
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
