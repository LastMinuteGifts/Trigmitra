import { useEffect, useState } from 'react'
import { Award, RotateCcw, Trophy } from 'lucide-react'
import type { QuizReviewItem } from '../types/quiz'
import type { DailyState, LeaderEntry, StreakState, WeakTopic } from '../utils/quizStore'
import { filterLeaderboard, formatSeconds, leaderboardScope } from '../utils/quizStore'
import { fetchSharedLeaderboard } from '../utils/leaderboardApi'
import { CLASS_LEVELS } from '../utils/studentClass'
import { MistakesSection, ReviewItemCard } from './MistakesSection'

export type ReviewItem = QuizReviewItem

interface QuizResultProps {
  score: number
  attempted: number
  total: number
  seconds: number
  best: number
  mode: string
  streak: StreakState
  daily: DailyState
  accuracy: number
  /** Sab sawaal (review ke liye). */
  review: ReviewItem[]
  /** Sirf galat + skipped sawaal — result ka alag section. */
  mistakes: ReviewItem[]
  reviewOpen: boolean
  weak: WeakTopic[]
  leaderboard: LeaderEntry[]
  playerName: string
  /** Login wale user ki class — leaderboard default isi class ka dikhta hai. */
  playerClass: number | null
  onNameChange: (name: string) => void
  /** Naam login account se aa raha hai — to result par naam badalne ka option nahi. */
  nameLocked?: boolean
  onToggleReview: () => void
  onPracticeWeak: () => void
  onNewQuiz: () => void
  onExit: () => void
}

function message(accuracy: number): string {
  if (accuracy >= 0.95) return 'Perfect! Tum to Nawab nikle! 👑'
  if (accuracy >= 0.7) return 'Bahut khoob! Thodi aur practice aur tum topper ho.'
  if (accuracy >= 0.4) return 'Theek hai — galtiyan review karo, agla quiz pakka better hoga.'
  return 'Koi baat nahi — hints aur explanations padho, phir dobara try karo.'
}

export function QuizResult({
  score,
  attempted,
  total,
  seconds,
  best,
  mode,
  streak,
  daily,
  accuracy,
  review,
  mistakes,
  reviewOpen,
  weak,
  leaderboard,
  playerName,
  playerClass,
  onNameChange,
  nameLocked,
  onToggleReview,
  onPracticeWeak,
  onNewQuiz,
  onExit,
}: QuizResultProps) {
  const overall = total > 0 ? score / total : 0
  // Leaderboard class-wise: default user ki apni class, chaho to "All classes".
  const [boardClass, setBoardClass] = useState<number | null>(playerClass)
  // Shared (global) leaderboard — selected class ke liye backend se fetch.
  const [boardEntries, setBoardEntries] = useState<LeaderEntry[]>(leaderboard)
  // Account me class badli to leaderboard bhi usi class ka dikhe.
  useEffect(() => {
    if (playerClass) setBoardClass(playerClass)
  }, [playerClass])
  useEffect(() => {
    let cancelled = false
    fetchSharedLeaderboard(boardClass).then((list) => {
      if (cancelled || !list) return
      setBoardEntries(list)
    })
    return () => {
      cancelled = true
    }
  }, [boardClass])
  // Fallback: agar backend na chale to passed-in (local cache) list use karo.
  useEffect(() => {
    if (boardEntries.length === 0 && leaderboard.length > 0) {
      setBoardEntries(filterLeaderboard(leaderboard, boardClass))
    }
  }, [leaderboard, boardClass, boardEntries.length])
  const board = filterLeaderboard(boardEntries, boardClass)
  // Sirf sabse recent matching entry highlight karo (same score wale purane na ho).
  const meIndex = board.findLastIndex((entry) => entry.name === playerName && entry.score === score)

  return (
    <div className="quiz-result">
      <Award size={40} />
      <h3>{score} / {total}</h3>
      <p>{message(overall)}</p>

      <div className="quiz-result-stats">
        <span>🎯 {Math.round(accuracy * 100)}% attempted accuracy</span>
        <span>📊 {Math.round(overall * 100)}% score</span>
        <span>⏱ {formatSeconds(seconds)}</span>
        <span>🔥 {streak.count} day streak</span>
        <span>🏅 Best: {Math.max(best, score)}</span>
      </div>

      <p className="example-label">
        {attempted} of {total} attempted · {total - attempted} chhoot gaye
        {mode === 'daily' ? ` · Daily challenge best: ${daily.best}` : ''}
      </p>

      <MistakesSection items={mistakes} />

      {weak.length > 0 && (
        <div className="quiz-weak">
          <span className="section-kicker">IN TOPICS PAR KAAM KARO</span>
          <div className="quiz-weak-list">
            {weak.map((item) => (
              <span key={item.topic} className="quiz-weak-chip">
                {item.topic} <i>{Math.round(item.accuracy * 100)}%</i>
              </span>
            ))}
          </div>
          <button type="button" className="outline-button" onClick={onPracticeWeak}>
            Weak topics practice karo
          </button>
        </div>
      )}

      <div className="quiz-leaderboard">
        <div className="quiz-leaderboard-head">
          <span className="section-kicker">
            <Trophy size={13} /> TOP SCORES · {leaderboardScope(boardClass).toUpperCase()} (GLOBAL)
          </span>
          <div className="quiz-leaderboard-controls">
            <label className="quiz-name-field">
              Class
              <select
                value={boardClass ? String(boardClass) : 'all'}
                onChange={(event) => {
                  const value = event.target.value
                  setBoardClass(value === 'all' ? null : Number(value))
                }}
                aria-label="Leaderboard class"
              >
                <option value="all">All classes</option>
                {CLASS_LEVELS.map((n) => (
                  <option key={n} value={String(n)}>
                    Class {n}
                  </option>
                ))}
              </select>
            </label>
            {!nameLocked && (
              <label className="quiz-name-field">
                Naam
                <input
                  value={playerName}
                  maxLength={18}
                  onChange={(event) => onNameChange(event.target.value)}
                  aria-label="Leaderboard name"
                />
              </label>
            )}
          </div>
        </div>
        {board.length === 0 ? (
          <p className="example-label">
            {boardClass
              ? `Class ${boardClass} ka pehla score tumhara — leaderboard yahan se shuru!`
              : 'Pehla score tumhara — leaderboard tumse shuru!'}
          </p>
        ) : (
          <ol className="quiz-leaderboard-list">
            {board.slice(0, 5).map((entry, index) => (
              <li key={`${entry.day}-${index}-${entry.name}`} className={index === meIndex ? 'is-me' : undefined}>
                <b>{index + 1}</b>
                <span>
                  {entry.name}
                  {boardClass === null && entry.classNum ? (
                    <em className="quiz-leader-class">Class {entry.classNum}</em>
                  ) : null}
                </span>
                <i>{entry.score}/{entry.total}</i>
              </li>
            ))}
          </ol>
        )}
        {playerClass === null && (
          <p className="example-label quiz-leaderboard-hint">
            Apni class login me set karo — phir leaderboard seedha tumhari class ka khulega.
          </p>
        )}
      </div>

      <div className="quiz-result-actions">
        <button className="outline-button" type="button" onClick={onToggleReview}>
          {reviewOpen ? 'Review band karo' : `Saare sawaal dekho (${review.length})`}
        </button>
        <button className="analyze-button" onClick={onNewQuiz}>
          <RotateCcw size={16} /> New quiz
        </button>
        <button className="outline-button" type="button" onClick={onExit}>
          Back to site
        </button>
      </div>

      {reviewOpen && (
        <div className="quiz-review">
          {review.map((item, index) => (
            <ReviewItemCard key={item.question.id} {...item} index={index} />
          ))}
        </div>
      )}
    </div>
  )
}

export default QuizResult
