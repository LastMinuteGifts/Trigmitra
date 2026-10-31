import { useRef, type ChangeEvent } from 'react'
import { Camera, Check, Lightbulb, Loader2, SkipForward, Target } from 'lucide-react'
import type { QuizAnswerRecord, QuizQuestion } from '../types/quiz'
import type { SubjectiveCheck } from '../utils/answerCheck'

interface QuizPlayProps {
  question: QuizQuestion
  index: number
  total: number
  score: number
  best: number
  elapsed: string
  sprintLeft: number | null
  /** Is sawaal ka bacha hua time (seconds) — sprint me null. */
  questionLeft: number | null
  answer: QuizAnswerRecord | null
  draft: string
  hintOpen: boolean
  /** Subjective auto-check ka result (null = abhi check nahi hua). */
  check: SubjectiveCheck | null
  /** Photo AI check chal raha hai? */
  photoBusy: boolean
  /** Photo check me aayi dikkat (unclear photo, network…). */
  photoError: string | null
  /** Student ki bheji hui photo ka data URL (preview ke liye). */
  photoPreview: string | null
  sprint: boolean
  reinforced: boolean
  onDraft: (value: string) => void
  onPick: (index: number) => void
  onCheckText: () => void
  onCheckPhoto: (file: File) => void
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
  questionLeft,
  answer,
  draft,
  hintOpen,
  check,
  photoBusy,
  photoError,
  photoPreview,
  sprint,
  reinforced,
  onDraft,
  onPick,
  onCheckText,
  onCheckPhoto,
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
  const questionDanger = questionLeft !== null && questionLeft <= (isSubjective ? 15 : 5)
  const questionClock =
    questionLeft === null
      ? ''
      : `${Math.floor(questionLeft / 60)}:${String(questionLeft % 60).padStart(2, '0')}`
  const photoInput = useRef<HTMLInputElement>(null)

  const onPhotoPicked = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    // Same photo dobara chunne par bhi change event chale.
    event.target.value = ''
    if (file) onCheckPhoto(file)
  }

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
          {questionLeft !== null ? (
            <b
              className={questionDanger ? 'quiz-timer danger' : 'quiz-timer'}
              title={isSubjective ? 'Is sawaal ke liye 3 minute' : 'Is sawaal ke liye 30 second'}
            >
              ⏱ {questionClock}
            </b>
          ) : sprintLeft !== null ? (
            <b className={sprintLeft <= 10 ? 'quiz-timer danger' : 'quiz-timer'}>⏱ {sprintLeft}s</b>
          ) : (
            <b className="quiz-timer">⏱ {elapsed}</b>
          )}
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
            <>
              <div className="quiz-answer-actions">
                <button
                  type="button"
                  className="analyze-button quiz-next"
                  onClick={onCheckText}
                  disabled={draft.trim().length < 2 || photoBusy}
                >
                  <Check size={16} /> Jawab check karo
                </button>
                <button
                  type="button"
                  className="outline-button quiz-photo-btn"
                  onClick={() => photoInput.current?.click()}
                  disabled={photoBusy}
                >
                  {photoBusy ? <Loader2 size={16} className="quiz-spin" /> : <Camera size={16} />}
                  {photoBusy ? 'AI check kar raha hai…' : 'Paper ki photo bhejo'}
                </button>
                <input
                  ref={photoInput}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="quiz-photo-input"
                  onChange={onPhotoPicked}
                />
              </div>
              <p className="quiz-photo-note">
                Paper par solve karke photo bhejo — <b>AI khud check karega</b>. Ya apna jawab type karke check karo.
              </p>
              {photoError && (
                <p className="quiz-photo-error" role="alert">⚠️ {photoError}</p>
              )}
            </>
          ) : (
            <div className="quiz-model-answer">
              <span className="section-kicker">MODEL ANSWER</span>
              <p>{question.modelAnswer ?? question.formula ?? '—'}</p>
              {photoPreview && (
                <figure className="quiz-photo-preview">
                  <img src={photoPreview} alt="Aapka paper par solve kiya jawab" />
                  <figcaption>Aapki bheji hui photo — AI ne yahi padha</figcaption>
                </figure>
              )}
              <div className="quiz-auto-check">
                {answer.text ? (
                  <>
                    <div className="quiz-auto-head">
                      <span
                        className={
                          answer.correct
                            ? 'quiz-auto-badge correct'
                            : check?.verdict === 'partial'
                              ? 'quiz-auto-badge partial'
                              : 'quiz-auto-badge wrong'
                        }
                      >
                        {answer.correct ? '✅ Sahi' : check?.verdict === 'partial' ? '🟡 Aadha sahi' : '❌ Galat'}
                      </span>
                      {check && <span className="quiz-auto-score">{Math.round(check.score * 100)}% match</span>}
                      {check?.source === 'ai' && <span className="quiz-ai-tag">🤖 AI checked</span>}
                    </div>
                    {check && <p className="quiz-auto-summary">{check.summary}</p>}
                    {check?.source === 'ai' && check.transcript && (
                      <p className="quiz-ai-transcript"><b>AI ne padha:</b> {check.transcript}</p>
                    )}
                    {check && (check.matched.length > 0 || check.missing.length > 0) && (
                      <div className="quiz-auto-points">
                        {check.matched.map((point) => (
                          <span key={`hit-${point}`} className="quiz-auto-point hit">
                            ✓ {point}
                          </span>
                        ))}
                        {check.missing.map((point) => (
                          <span key={`miss-${point}`} className="quiz-auto-point miss">
                            ✗ {point}
                          </span>
                        ))}
                      </div>
                    )}
                    {!answer.skipped && (
                      <details className="quiz-auto-override">
                        <summary>Auto-check se sehmat nahi? Khud badlo</summary>
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
                      </details>
                    )}
                  </>
                ) : (
                  <span className="example-label">Question skip kiya gaya</span>
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
