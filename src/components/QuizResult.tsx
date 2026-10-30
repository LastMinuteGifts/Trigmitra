import { useEffect, useState } from 'react'
import { Award, RotateCcw, Trophy } from 'lucide-react'
import type { QuizAnswerRecord, QuizQuestion } from '../types/quiz'
import type { DailyState, LeaderEntry, StreakState, WeakTopic } from '../utils/quizStore'
import { filterLeaderboard, formatSeconds, leaderboardScope } from '../utils/quizStore'
import { CLASS_LEVELS } from '../utils/studentClass'

export interface ReviewItem {
  question: QuizQuestion
  answer: QuizAnswerRecord | null
}

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
  review: ReviewItem[]
  wrongCount: number
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
  onRetryWrong: () => void
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

function isCorrectLabel(answer: QuizAnswerRecord | null): string {
  if (!answer) return 'Attempt nahi hua'
  if (answer.skipped) return 'Skip kiya'
  return answer.correct ? 'Sahi' : 'Galat'
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
  wrongCount,
  reviewOpen,
  weak,
  leaderboard,
  playerName,
  playerClass,
  onNameChange,
  nameLocked,
  onToggleReview,
  onRetryWrong,
  onPracticeWeak,
  onNewQuiz,
  onExit,
}: QuizResultProps) {
  const overall = total > 0 ? score / total : 0
  // Leaderboard class-wise: default user ki apni class, chaho to "All classes".
  const [boardClass, setBoardClass] = useState<number | null>(playerClass)
  // Account me class badli to leaderboard bhi usi class ka dikhe.
  useEffect(() => {
    if (playerClass) setBoardClass(playerClass)
  }, [playerClass])
  const board = filterLeaderboard(leaderboard, boardClass)
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
            <Trophy size={13} /> TOP SCORES · {leaderboardScope(boardClass).toUpperCase()} (IS DEVICE PAR)
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
          {reviewOpen ? 'Review band karo' : `Review answers (${review.length})`}
        </button>
        {wrongCount > 0 && (
          <button className="outline-button" type="button" onClick={onRetryWrong}>
            <RotateCcw size={15} /> Sirf galat ({wrongCount})
          </button>
        )}
        <button className="analyze-button" onClick={onNewQuiz}>
          <RotateCcw size={16} /> New quiz
        </button>
        <button className="outline-button" type="button" onClick={onExit}>
          Back to site
        </button>
      </div>

      {reviewOpen && (
        <div className="quiz-review">
          {review.map(({ question, answer }, index) => (
            <div className="quiz-review-item" key={question.id}>
              <div className="quiz-review-head">
                <span className="section-kicker">Q{index + 1} · {question.sub}</span>
                <span
                  className={
                    answer?.correct ? 'quiz-review-badge correct' : answer?.skipped ? 'quiz-review-badge skipped' : 'quiz-review-badge wrong'
                  }
                >
                  {isCorrectLabel(answer)}
                </span>
              </div>
              <p className="quiz-review-prompt">{question.prompt}</p>
              {question.type === 'subjective' ? (
                <>
                  <p className="quiz-review-answer"><b>Tumhara jawab:</b> {answer?.text || '—'}</p>
                  <p className="quiz-review-answer"><b>Model answer:</b> {question.modelAnswer ?? question.formula ?? '—'}</p>
                </>
              ) : (
                <>
                  <p className="quiz-review-answer">
                    <b>Tumhara jawab:</b>{' '}
                    {answer?.picked != null ? question.options[answer.picked] : '—'}
                  </p>
                  <p className="quiz-review-answer correct">
                    <b>Sahi jawab:</b> {question.options[question.answer]}
                  </p>
                </>
              )}
              {question.explain && (
                <details className="quiz-review-explain">
                  <summary>Explanation dekho</summary>
                  <p>{question.explain.q}</p>
                  <ol className="example-steps">
                    {question.explain.steps.map((step, stepIndex) => (
                      <li key={stepIndex}>{step}</li>
                    ))}
                  </ol>
                </details>
              )}
              {answer?.hintUsed && <span className="example-label">Hint use hua</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default QuizResult
