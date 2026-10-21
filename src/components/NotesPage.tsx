import { useMemo, useState } from 'react'
import { ArrowRight, BookOpen, Lightbulb, Search, Sigma, X } from 'lucide-react'
import { chaptersForClass, formulasForChapter, resolveChapterNote } from '../data/notes'

const CLASS_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

/** Class-wise chapter notes page — summary, key points aur formulas (alag page par). */
export default function NotesPage({ onBack }: { onBack?: () => void }) {
  const [classNum, setClassNum] = useState(10)
  const [query, setQuery] = useState('')
  const [selectedName, setSelectedName] = useState<string | null>(null)

  const chapters = useMemo(() => chaptersForClass(classNum), [classNum])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return chapters
    return chapters.filter((chapter) => chapter.name.toLowerCase().includes(q))
  }, [chapters, query])

  const selected = useMemo(() => {
    if (selectedName) {
      const hit = filtered.find((chapter) => chapter.name === selectedName)
      if (hit) return hit
    }
    return filtered[0] ?? null
  }, [filtered, selectedName])

  const note = selected ? resolveChapterNote(selected) : null
  const formulas = selected ? formulasForChapter(selected.cat) : []

  const pickClass = (value: number) => {
    setClassNum(value)
    setSelectedName(null)
  }

  const startQuiz = () => {
    window.location.hash = '#/quiz'
  }

  const backHome = () => {
    window.location.hash = '#/'
    onBack?.()
  }

  return (
    <section className="section-block notes-page" aria-labelledby="notes-page-title">
      <div className="notes-page-header">
        <div>
          <button className="back-button" type="button" onClick={backHome}>
            <X size={16} /> Wapas home par
          </button>
          <span className="section-kicker">REVISION · CHAPTER NOTES</span>
          <h2 id="notes-page-title">Chapter ka concept, ek nazar me.</h2>
        </div>
      </div>

      <div className="notes-toolbar">
        <div className="notes-classes" role="tablist" aria-label="Class">
          {CLASS_OPTIONS.map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={value === classNum}
              className={value === classNum ? 'notes-class is-active' : 'notes-class'}
              onClick={() => pickClass(value)}
            >
              {value}
            </button>
          ))}
        </div>
        <label className="notes-search">
          <Search size={15} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Chapter dhundo..."
            aria-label="Search chapter"
          />
        </label>
      </div>

      <div className="notes-body">
        <div className="notes-list" role="list">
          {filtered.length === 0 && <p className="notes-empty">Is class me koi chapter nahi mila.</p>}
          {filtered.map((chapter) => (
            <button
              key={chapter.name}
              type="button"
              role="listitem"
              className={selected?.name === chapter.name ? 'notes-item is-active' : 'notes-item'}
              onClick={() => setSelectedName(chapter.name)}
            >
              <span className="notes-item-name">{chapter.name}</span>
              <span className={`notes-subject subject-${chapter.subject.toLowerCase()}`}>{chapter.subject}</span>
            </button>
          ))}
        </div>

        <div className="notes-detail">
          {selected && note ? (
            <>
              <div className="notes-detail-head">
                <h3>{selected.name}</h3>
                <div className="notes-tags">
                  <span className={`notes-subject subject-${selected.subject.toLowerCase()}`}>{selected.subject}</span>
                  <span className="notes-cat">{selected.cat}</span>
                </div>
              </div>

              <p className="notes-summary">{note.summary}</p>

              {note.points.length > 0 && (
                <div className="notes-block">
                  <h4>
                    <Lightbulb size={15} /> Key points
                  </h4>
                  <ul>
                    {note.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </div>
              )}

              {formulas.length > 0 && (
                <div className="notes-block">
                  <h4>
                    <Sigma size={15} /> Formulas
                  </h4>
                  <ul className="notes-formulas">
                    {formulas.map((entry) => (
                      <li key={entry.formula}>
                        <code>{entry.formula}</code>
                        <span>{entry.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <button className="analyze-button notes-quiz" type="button" onClick={startQuiz}>
                <BookOpen size={16} /> Is chapter ka quiz <ArrowRight size={16} />
              </button>
            </>
          ) : (
            <p className="notes-empty">Left se ek chapter chuno.</p>
          )}
        </div>
      </div>
    </section>
  )
}
