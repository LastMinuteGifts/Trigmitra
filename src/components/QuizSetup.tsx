import type { ChangeEvent, RefObject } from 'react'
import { CalendarDays, Check, FileText, Flame, GraduationCap, Search, Target, Trophy, Upload, UserRound, Zap } from 'lucide-react'
import type { QuizReviewItem, DifficultyFilter, QuizMode, QuizTypeFilter } from '../types/quiz'
import type { DailyState, QuizStats, WeakTopic } from '../utils/quizStore'
import { MistakesSection } from './MistakesSection'

export interface ChipOption {
  key: string
  cats: string[]
}

export interface ChipGroup {
  label: string
  options: ChipOption[]
}

interface SavedSummary {
  idx: number
  total: number
  score: number
}

interface QuizSetupProps {
  quizClass: string
  onClass: (value: string) => void
  mode: QuizMode
  onMode: (mode: QuizMode) => void
  difficulty: DifficultyFilter
  onDifficulty: (value: DifficultyFilter) => void
  typeFilter: QuizTypeFilter
  onTypeFilter: (value: QuizTypeFilter) => void
  searchedGroups: ChipGroup[]
  selectedCats: string[]
  maxCats: number
  atMax: boolean
  topicQuery: string
  onTopicQuery: (value: string) => void
  onToggleCat: (name: string) => void
  count: number
  onCount: (value: number) => void
  setupError: string | null
  savedQuiz: SavedSummary | null
  onResume: () => void
  onDiscard: () => void
  onStart: () => void
  onStartDaily: () => void
  onPracticeWeak: () => void
  streak: number
  daily: DailyState
  dailyPoolSize: number
  best: number
  stats: QuizStats
  weak: WeakTopic[]
  /** Pichhle quiz ke galat + skip/chhoote sawaal (setup par bhi dikhte hain). */
  mistakes: QuizReviewItem[]
  playerName: string
  onName: (value: string) => void
  /** Login account ki class (agar hai to select ki zaroorat nahi). */
  accountClass: number | null
  /** Login account ka naam (leaderboard isi naam se bharega). */
  accountName: string
  pdfBusy: boolean
  pdfName: string | null
  pdfInput: RefObject<HTMLInputElement | null>
  onPdfSelected: (event: ChangeEvent<HTMLInputElement>) => void
}

const DIFFICULTIES: DifficultyFilter[] = ['Mixed', 'Easy', 'Medium', 'Hard']
// Daily challenge abhi website par nahi dikhana — true karne par wapas aa jayega.
const SHOW_DAILY_CHALLENGE = false
const TYPE_FILTERS: { key: QuizTypeFilter; label: string }[] = [
  { key: 'mixed', label: 'Mixed (MCQ + Subjective)' },
  { key: 'mcq', label: 'Sirf MCQ' },
  { key: 'subjective', label: 'Sirf Subjective' },
]

export function QuizSetup({
  quizClass,
  onClass,
  mode,
  onMode,
  difficulty,
  onDifficulty,
  typeFilter,
  onTypeFilter,
  searchedGroups,
  selectedCats,
  maxCats,
  atMax,
  topicQuery,
  onTopicQuery,
  onToggleCat,
  count,
  onCount,
  setupError,
  savedQuiz,
  onResume,
  onDiscard,
  onStart,
  onStartDaily,
  onPracticeWeak,
  streak,
  daily,
  dailyPoolSize,
  best,
  stats,
  weak,
  mistakes,
  playerName,
  onName,
  accountClass,
  accountName,
  pdfBusy,
  pdfName,
  pdfInput,
  onPdfSelected,
}: QuizSetupProps) {
  const showTopics = mode === 'topics' || mode === 'pyq'
  const dailyDone = daily.attempts > 0
  const started = best > 0 || stats.total > 0

  return (
    <div className="quiz-setup">
      {savedQuiz && (
        <div className="quiz-resume">
          <p>
            Adhura quiz mila: <b>Q{savedQuiz.idx + 1}/{savedQuiz.total}</b>, Score <b>{savedQuiz.score}</b> — wahin se shuru karo?
          </p>
          <div className="quiz-resume-actions">
            <button className="analyze-button" type="button" onClick={onResume}>
              Resume quiz
            </button>
            <button className="outline-button" type="button" onClick={onDiscard}>
              Discard
            </button>
          </div>
        </div>
      )}

      <div className="quiz-stats-strip">
        <span className="quiz-stat"><Flame size={14} /> <b>{streak}</b> day streak</span>
        <span className="quiz-stat"><Trophy size={14} /> Best <b>{best}</b></span>
        <span className="quiz-stat">
          <Target size={14} /> Accuracy{' '}
          <b>{stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0}%</b>
        </span>
        <span className="quiz-stat"><Zap size={14} /> {stats.total} sawaal practice</span>
      </div>

      {/* Pichhle quiz ke galat + chhoote sawaal — yahin se turant review. */}
      <MistakesSection items={mistakes} defaultOpen={false} />

      {SHOW_DAILY_CHALLENGE && (
        <div className="quiz-daily-card">
          <div>
            <span className="section-kicker">DAILY CHALLENGE · {daily.day}</span>
            <h4>
              {dailyDone ? `Aaj ka score: ${daily.score}/${daily.total}` : 'Aaj ke 5 sawaal — streak bachao!'}
            </h4>
            <p className="example-label">
              {dailyDone
                ? `Best: ${daily.best}/${daily.total} · Har din naya set`
                : `${dailyPoolSize} sawaalon me se aaj ke liye chune gaye 5`}
            </p>
          </div>
          <button type="button" className="quiz-button" onClick={onStartDaily}>
            <CalendarDays size={16} /> {dailyDone ? 'Dobara khelo' : 'Aaj ka challenge'}
          </button>
        </div>
      )}

      {weak.length > 0 && (
        <button type="button" className="quiz-suggest" onClick={onPracticeWeak}>
          <Target size={15} />
          <span>
            <b>Weak topics mil gaye:</b> {weak.map((item) => `${item.topic} (${Math.round(item.accuracy * 100)}%)`).join(', ')} — inhi
            par practice karo?
          </span>
        </button>
      )}

      {/* Class aur naam login account se aate hain — dobara poochne ki zaroorat nahi. */}
      {accountClass ? (
        <div className="quiz-account">
          <span className="quiz-account-chip">
            <GraduationCap size={15} /> Class {accountClass}
          </span>
          {accountName && (
            <span className="quiz-account-chip">
              <UserRound size={15} /> {accountName}
            </span>
          )}
          <small>Login account se</small>
        </div>
      ) : (
        <label className="auth-field">
          Class chuno
          <select value={quizClass} onChange={(event) => onClass(event.target.value)}>
            <option value="All">All classes</option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <option key={n} value={String(n)}>Class {n}</option>
            ))}
          </select>
        </label>
      )}

      {!accountName && (
        <label className="auth-field">
          Name for Leaderboard
          <input
            value={playerName}
            maxLength={18}
            onChange={(event) => onName(event.target.value)}
            placeholder="Apna naam likho"
          />
        </label>
      )}

      <div className="quiz-source">
        {([
          { key: 'topics', label: 'Topics / Chapters' },
          { key: 'pyq', label: 'Board PYQ' },
          { key: 'sprint', label: '⚡ Formula Sprint' },
          { key: 'pdf', label: 'PDF se quiz' },
        ] as const).map((item) => (
          <button
            key={item.key}
            type="button"
            className={mode === item.key ? 'cat-chip active' : 'cat-chip'}
            onClick={() => onMode(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {mode !== 'sprint' && (
        <p className="quiz-timer-note">
          ⏱ Har sawaal ka apna timer: <b>MCQ 30 second</b> · <b>Subjective 3 minute</b> — time khatam to sawaal chhoot jayega.
        </p>
      )}

      {showTopics && (
        <>
          <div className="quiz-topics-head">
            <span className="section-kicker">
              {mode === 'pyq' ? 'PYQ TOPICS' : quizClass === 'All' ? 'TOPICS' : `NCERT CHAPTERS · CLASS ${quizClass}`} · MAX {maxCats} (
              {selectedCats.length} selected)
            </span>
          </div>
          <label className="auth-field">
            <div className="admin-search">
              <Search size={15} />
              <input
                value={topicQuery}
                onChange={(event) => onTopicQuery(event.target.value)}
                placeholder={mode === 'pyq' ? 'PYQ topic search karo...' : quizClass === 'All' ? 'Topic search karo...' : 'Chapter search karo...'}
              />
            </div>
          </label>
          <div className="chip-groups">
            {searchedGroups.map((group, groupIndex) => (
              <div className="chip-group" key={group.label || `group-${groupIndex}`}>
                {group.label ? (
                  <span className="chip-group-head">
                    {group.label} <i>{group.options.length}</i>
                  </span>
                ) : null}
                <div className="cat-chips quiz-cats">
                  {group.options.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      role="checkbox"
                      aria-checked={selectedCats.includes(option.key)}
                      disabled={atMax && !selectedCats.includes(option.key)}
                      className={selectedCats.includes(option.key) ? 'cat-chip active' : 'cat-chip'}
                      onClick={() => onToggleCat(option.key)}
                    >
                      {selectedCats.includes(option.key) ? <Check size={13} /> : null} {option.key}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {searchedGroups.length === 0 && <p className="example-label">Koi topic nahi mila.</p>}
          </div>
        </>
      )}

      {mode === 'sprint' && (
        <div className="quiz-sprint-note">
          <Zap size={18} />
          <div>
            <h4>60-second Formula Sprint</h4>
            <p>Formula-based MCQs, timer chalega. Zyada sahi jawab = zyada score. Hint aur explanation band.</p>
          </div>
        </div>
      )}

      {(mode === 'topics' || mode === 'pyq') && (
        <>
          <div className="quiz-count-row">
            <span className="section-kicker">DIFFICULTY</span>
            <div className="quiz-count-chips">
              {DIFFICULTIES.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={difficulty === value ? 'cat-chip active' : 'cat-chip'}
                  onClick={() => onDifficulty(value)}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
          <div className="quiz-count-row">
            <span className="section-kicker">QUESTION TYPE</span>
            <div className="quiz-count-chips">
              {TYPE_FILTERS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={typeFilter === item.key ? 'cat-chip active' : 'cat-chip'}
                  onClick={() => onTypeFilter(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {mode !== 'sprint' && (
        <div className="quiz-count-row">
          <span className="section-kicker">QUESTIONS (10–50)</span>
          <div className="quiz-count-chips">
            {[10, 15, 20, 30, 50].map((n) => (
              <button
                key={n}
                type="button"
                className={count === n ? 'cat-chip active' : 'cat-chip'}
                onClick={() => onCount(n)}
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
              onChange={(event) => onCount(Math.min(50, Math.max(10, Math.floor(Number(event.target.value) || 0) || 10)))}
              aria-label="Custom question count"
            />
          </div>
        </div>
      )}

      {mode === 'pdf' && (
        <div className="quiz-pdf">
          <div className="quiz-pdf-icon">
            <FileText size={22} />
          </div>
          <h4>PDF se quiz banao</h4>
          <p>
            Apni book, notes ya question paper ki PDF upload karo. Us text se {count} MCQs banenge — phir wahin quiz khelo.
          </p>
          <input ref={pdfInput} type="file" accept="application/pdf,.pdf" hidden onChange={onPdfSelected} />
          <button className="analyze-button quiz-next" type="button" disabled={pdfBusy} onClick={() => pdfInput.current?.click()}>
            {pdfBusy ? (
              <>
                <span className="spinner" /> PDF padh kar quiz ban raha hai…
              </>
            ) : (
              <>
                <Upload size={16} /> PDF choose karo
              </>
            )}
          </button>
          {pdfName && <span className="upload-hint">Selected: {pdfName}</span>}
          <span className="upload-hint">Text wali PDF best hai · max 12 MB</span>
        </div>
      )}

      {setupError && <div className="upload-error">{setupError}</div>}

      {mode !== 'pdf' && (
        <button className="analyze-button quiz-next" onClick={onStart}>
          {mode === 'sprint' ? (
            <>
              <Zap size={16} /> Start 60-sec sprint
            </>
          ) : (
            <>
              <Target size={16} /> Start quiz — {count} {typeFilter === 'subjective' ? 'subjective' : 'questions'}
            </>
          )}
        </button>
      )}

      {!started && (
        <p className="example-label quiz-first-note">
          Pehli baar? “Topics / Chapters” chuno, difficulty “Mixed” rakho aur 10 sawaal se shuru karo.
        </p>
      )}
    </div>
  )
}

export default QuizSetup
