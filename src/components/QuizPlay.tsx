import { Check, Lightbulb, SkipForward, Target } from 'lucide-react'
import type { QuizAnswerRecord, QuizQuestion } from '../types/quiz'
import { similarityLabel } from '../utils/answerCheck'

interface QuizPlayProps {
  question: QuizQuestion
  index: number
  total: number
  score: number
  best: number
  elapsed: string
  sprintLeft: number | null
  answer: QuizAnswerRecord | null
  draft: string
  hintOpen: boolean
  similarity: number
  sprint: boolean
  reinforced: boolean
  onDraft: (value: string) => void
  onPick: (index: number) => void
  onCheckText: () => void
  onSelfMark: (correct: boolean) => void
  onHint: () => void
  onSkip: () => void
  onNext: () => void
  onEnd: () => void
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D']

export function QuizPlay({
  question,
  index,
  total,
  score,
  best,
  elapsed,
  sprintLeft,
  answer,
  draft,
  hintOpen,
  similarity,
  sprint,
  reinforced,
  onDraft,
  onPick,
  onCheckText,
  onSelfMark,
  onHint,
  onSkip,
  onNext,
  onEnd,
}: QuizPlayProps) {
  const answered = answer !== null && !answer.skipped
  const progress = total > 0 ? Math.round((Math.min(index, total) / total) * 100) : 0
  const isSubjective = question.type === 'subjective'
  const showExplanation = !sprint && (answered || (answer?.skipped ?? false))

  return (
    <>
      <div className="quiz-progress">
        <i style={{ width: `${progress}%` }} />
      </div>
      <div className="quiz-score-line">
        <span>
          <span className={isSubjective ? 'quiz-type-tag subjective' : 'quiz-type-tag'}>
            {isSubjective ? 'Subjective' : 'MCQ'}
          </span>
          {question.sub}
        </span>
        <span>
          {sprintLeft !== null ? <b className={sprintLeft <= 10 ? 'quiz-timer danger' : 'quiz-timer'}>⏱ {sprintLeft}s</b> : <b className="quiz-timer">⏱ {elapsed}</b>}
          {' '}Score: {score} · Best: {best}
        </span>
        <button type="button" className="text-button end-quiz-btn" onClick={onEnd}>
          End quiz
        </button>
      </div>

      <p className="quiz-prompt">{question.prompt}</p>
      {question.difficulty && <span className="quiz-difficulty">{question.difficulty}</span>}

      {isSubjective ? (
        <div className="quiz-subjective">
          <textarea
            className="quiz-answer-input"
            rows={4}
            value={draft}
            onChange={(event) => onDraft(event.target.value)}
            placeholder="Apna jawab yahan likho… (formula + ek line explanation)"
            disabled={answer !== null}
            aria-label="Subjective answer"
          />
          {answer === null ? (
            <button type="button" className="analyze-button quiz-next" onClick={onCheckText} disabled={draft.trim().length < 2}>
              <Check size={16} /> Jawab check karo
            </button>
          ) : (
            <div className="quiz-model-answer">
              <span className="section-kicker">MODEL ANSWER</span>
              <p>{question.modelAnswer ?? question.formula ?? '—'}</p>
              <div className="quiz-self-mark">
                {answer.text ? (
                  <span className="example-label">
                    Aapka jawab {similarityLabel(similarity)}
                    {answer.partial ? ' · thoda adhoora lag raha hai' : ''}
                  </span>
                ) : (
                  <span className="example-label">Question skip kiya gaya</span>
                )}
                {!answer.skipped && (
                  <div className="quiz-self-mark-buttons">
                    <button
                      type="button"
                      className={answer.correct ? 'cat-chip active' : 'cat-chip'}
                      onClick={() => onSelfMark(true)}
                    >
                      ✅ Sahi tha
                    </button>
                    <button
                      type="button"
                      className={!answer.correct ? 'cat-chip active' : 'cat-chip'}
                      onClick={() => onSelfMark(false)}
                    >
                      ❌ Galat tha
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="quiz-options">
          {question.options.map((option, optionIndex) => {
            const isAnswer = optionIndex === question.answer
            const isPicked = optionIndex === answer?.picked
            const cls =
              answer === null
                ? 'quiz-opt'
                : isAnswer
                  ? 'quiz-opt correct'
                  : isPicked
                    ? 'quiz-opt wrong'
                    : 'quiz-opt dim'
            return (
              <button
                key={optionIndex}
                type="button"
                className={cls}
                onClick={() => onPick(optionIndex)}
                disabled={answer !== null}
                aria-pressed={isPicked}
              >
                <span className="quiz-opt-letter">{OPTION_LETTERS[optionIndex]}</span>
                {answer !== null && isAnswer && <Check size={15} />}
                <span>{option}</span>
              </button>
            )
          })}
        </div>
      )}

      {hintOpen && (
        <div className="quiz-hint">
          <span className="section-kicker">HINT</span>
          <p>{question.hint ?? 'Formula ya definition yaad karo, phir options compare karo.'}</p>
        </div>
      )}

      {reinforced && !sprint && (
        <p className="quiz-reinforce">🎯 Isi topic ka ek aur sawaal next me aa raha hai — galti wahin clear karo.</p>
      )}

      {showExplanation && (
        <div className={answer?.correct ? 'quiz-explain correct' : 'quiz-explain'}>
          <span className="section-kicker">{answer?.correct ? "SAHI JAWAB — AISE AAYA" : "SAMJHO"}</span>
          {question.explain ? (
            <>
              <p>
                <b>Example:</b> {question.explain.q}
              </p>
              <ol className="example-steps">
                {question.explain.steps.map((step, stepIndex) => (
                  <li key={stepIndex}>{step}</li>
                ))}
              </ol>
            </>
          ) : (
            <p>
              Sahi jawab: <b>{isSubjective ? question.modelAnswer ?? question.formula : question.options[question.answer]}</b>
            </p>
          )}
        </div>
      )}

      <div className="quiz-play-actions">
        {answer === null && (
          <>
            {!hintOpen && !sprint && (
              <button type="button" className="outline-button" onClick={onHint}>
                <Lightbulb size={15} /> Hint
              </button>
            )}
            <button type="button" className="outline-button" onClick={onSkip}>
              <SkipForward size={15} /> Skip
            </button>
          </>
        )}
        {answer !== null && (
          <button className="analyze-button quiz-next" onClick={onNext}>
            {index + 1 >= total ? 'See result' : 'Next question'} <Target size={16} />
          </button>
        )}
      </div>
      <p className="quiz-shortcuts example-label">Shortcut: 1–4 option · H hint · Enter next · S skip</p>
    </>
  )
}

export default QuizPlay
