import { useState } from 'react'
import type { QuizReviewItem } from '../types/quiz'

function isCorrectLabel(answer: QuizReviewItem['answer']): string {
  if (!answer) return 'Attempt nahi hua'
  if (answer.skipped) return 'Skip kiya'
  return answer.correct ? 'Sahi' : 'Galat'
}

/** Ek sawaal ka full review card — result aur setup dono par same. */
export function ReviewItemCard({ question, answer, index }: QuizReviewItem & { index?: number }) {
  return (
    <div className="quiz-review-item">
      <div className="quiz-review-head">
        <span className="section-kicker">{index != null ? `Q${index + 1} · ` : ''}{question.sub}</span>
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
  )
}

interface MistakesSectionProps {
  items: QuizReviewItem[]
  /** Result par khula, setup par band (default). */
  defaultOpen?: boolean
}

/** Sirf galat + skip/chhoote sawaal ka alag section. */
export function MistakesSection({ items, defaultOpen = true }: MistakesSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  if (items.length === 0) return null

  const wrongTotal = items.filter((item) => item.answer && !item.answer.skipped && !item.answer.correct).length
  const missedTotal = items.length - wrongTotal

  return (
    <div className="quiz-mistakes">
      <div className="quiz-mistakes-head">
        <span className="section-kicker">❌ GALAT & CHHOOTE SAWAAL · {items.length}</span>
        <button type="button" className="text-button quiz-mistakes-toggle" onClick={() => setOpen((value) => !value)}>
          {open ? 'Band karo' : 'Dekho'}
        </button>
      </div>
      <p className="quiz-mistakes-sub">
        {wrongTotal > 0 ? `${wrongTotal} galat` : ''}
        {wrongTotal > 0 && missedTotal > 0 ? ' · ' : ''}
        {missedTotal > 0 ? `${missedTotal} skip/chhoote` : ''}
        {' — '}yahan se sahi jawab aur explanation padho.
      </p>
      {open && (
        <div className="quiz-mistakes-list">
          {items.map((item, index) => (
            <ReviewItemCard key={`${item.question.id}-${index}`} {...item} index={index} />
          ))}
        </div>
      )}
    </div>
  )
}

export default MistakesSection
