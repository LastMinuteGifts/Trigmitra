import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  BookOpen,
  Check,
  KeyRound,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react'
import { chaptersForClass, resolveChapterNote } from '../data/notes'

interface NoteOverrideRow {
  class: number
  chapter: string
  summary: string
  points: string[]
  updatedAt: string
  updatedBy: string
}

const STORAGE_KEY = 'anknawab_teacher_key'
const CLASS_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const SUBJECTS = ['All', 'Maths', 'Physics', 'Chemistry'] as const

const apiBase = () => import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'

/** Teacher panel: chapter ke notes + key points add / edit / remove. */
export default function TeacherPanel({ onClose }: { onClose: () => void }) {
  const [teacherKey, setTeacherKey] = useState(() => sessionStorage.getItem(STORAGE_KEY) ?? '')
  const [authed, setAuthed] = useState(false)
  const [overrides, setOverrides] = useState<NoteOverrideRow[]>([])
  const [classNum, setClassNum] = useState(10)
  const [subject, setSubject] = useState<(typeof SUBJECTS)[number]>('All')
  const [query, setQuery] = useState('')
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const [summary, setSummary] = useState('')
  const [points, setPoints] = useState<string[]>([''])
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const overrideMap = useMemo(() => {
    const map = new Map<string, NoteOverrideRow>()
    overrides.forEach((row) => map.set(`${row.class}::${row.chapter}`, row))
    return map
  }, [overrides])

  const chapters = useMemo(() => {
    const q = query.trim().toLowerCase()
    return chaptersForClass(classNum).filter(
      (chapter) =>
        (subject === 'All' || chapter.subject === subject) &&
        (!q || chapter.name.toLowerCase().includes(q)),
    )
  }, [classNum, subject, query])

  const selected = useMemo(() => {
    if (selectedName) {
      const hit = chapters.find((chapter) => chapter.name === selectedName)
      if (hit) return hit
    }
    return chapters[0] ?? null
  }, [chapters, selectedName])

  const currentOverride = selected ? overrideMap.get(`${classNum}::${selected.name}`) : undefined

  useEffect(() => {
    if (!selected) {
      setSummary('')
      setPoints([''])
      return
    }
    const override = overrideMap.get(`${classNum}::${selected.name}`)
    if (override) {
      setSummary(override.summary)
      setPoints(override.points.length ? override.points : [''])
    } else {
      const base = resolveChapterNote(selected)
      setSummary(base.summary)
      setPoints(base.points.length ? base.points : [''])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classNum, selected?.name, overrides])

  const loadNotes = async () => {
    if (!teacherKey.trim()) {
      setError('Pehle teacher key likho.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`${apiBase()}/teacher/notes`, {
        headers: { 'x-teacher-key': teacherKey.trim() },
      })
      const payload = (await response.json()) as { notes?: NoteOverrideRow[]; message?: string }
      if (!response.ok) throw new Error(payload.message ?? 'Notes load nahi hue.')
      sessionStorage.setItem(STORAGE_KEY, teacherKey.trim())
      setOverrides(payload.notes ?? [])
      setAuthed(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kuch gadbad hui.')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (sessionStorage.getItem(STORAGE_KEY)) void loadNotes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const save = async () => {
    if (!selected) return
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch(`${apiBase()}/teacher/notes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-teacher-key': teacherKey.trim() },
        body: JSON.stringify({
          class: classNum,
          chapter: selected.name,
          summary,
          points: points.filter((point) => point.trim()),
        }),
      })
      const payload = (await response.json()) as { note?: NoteOverrideRow; message?: string }
      if (!response.ok || !payload.note) throw new Error(payload.message ?? 'Notes save nahi hue.')
      const saved = payload.note
      setOverrides((prev) => [
        ...prev.filter((row) => !(row.class === classNum && row.chapter === selected.name)),
        saved,
      ])
      setNotice('Notes save ho gaye.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Notes save nahi hue.')
    } finally {
      setSaving(false)
    }
  }

  const reset = async () => {
    if (!selected) return
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch(`${apiBase()}/teacher/notes`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-teacher-key': teacherKey.trim() },
        body: JSON.stringify({ class: classNum, chapter: selected.name }),
      })
      const payload = (await response.json()) as { removed?: boolean; message?: string }
      if (!response.ok) throw new Error(payload.message ?? 'Reset nahi hua.')
      setOverrides((prev) => prev.filter((row) => !(row.class === classNum && row.chapter === selected.name)))
      setNotice('Default notes wapas aa gaye.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reset nahi hua.')
    } finally {
      setSaving(false)
    }
  }

  const logout = () => {
    sessionStorage.removeItem(STORAGE_KEY)
    setAuthed(false)
    setOverrides([])
    setTeacherKey('')
    setNotice(null)
    setError(null)
  }

  const updatePoint = (index: number, value: string) =>
    setPoints((prev) => prev.map((point, i) => (i === index ? value : point)))
  const removePoint = (index: number) =>
    setPoints((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)))
  const addPoint = () => setPoints((prev) => [...prev, ''])

  return (
    <div className="admin-dash teacher-dash">
      <aside className="admin-side">
        <div className="admin-brand">
          <img src="./logo-icon.svg" alt="AnkNawab" />
          <div>
            <b>ANKNAWAB</b>
            <span>teacher panel</span>
          </div>
        </div>
        <nav className="admin-nav" aria-label="Teacher sections">
          <button className="active" type="button">
            <BookOpen size={17} /> Chapter notes
          </button>
        </nav>
        <div className="admin-side-foot">
          <button type="button" onClick={onClose}>
            <ArrowLeft size={16} /> Back to site
          </button>
          {authed && (
            <button type="button" onClick={logout}>
              <KeyRound size={16} /> Log out
            </button>
          )}
        </div>
      </aside>
      <main className="admin-main">
        {!authed ? (
          <div className="admin-login-card">
            <span className="section-kicker">TEACHERS ONLY</span>
            <h2>Teacher panel</h2>
            <p className="example-label">
              Chapter ke notes aur key points add / edit / remove karne ke liye teacher key dalo.
            </p>
            <label className="auth-field">
              Teacher key
              <input
                type="password"
                value={teacherKey}
                onChange={(event) => setTeacherKey(event.target.value)}
                placeholder="TEACHER_SECRET"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void loadNotes()
                }}
              />
            </label>
            {error && <div className="upload-error">{error}</div>}
            <button className="analyze-button auth-submit" onClick={loadNotes} disabled={busy}>
              {busy ? 'Ruko...' : (<><KeyRound size={16} /> Open panel</>)}
            </button>
          </div>
        ) : (
          <>
            <header className="admin-topbar">
              <div>
                <span className="section-kicker">CHAPTER NOTES EDITOR</span>
                <h2>Notes &amp; key points</h2>
              </div>
              <div className="admin-top-actions">
                <button className="tool-btn" type="button" onClick={loadNotes} disabled={busy}>
                  <RefreshCw size={15} /> Refresh
                </button>
              </div>
            </header>

            <div className="teacher-controls">
              <div className="teacher-classes" role="tablist" aria-label="Class">
                {CLASS_OPTIONS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={value === classNum}
                    className={value === classNum ? 'notes-class is-active' : 'notes-class'}
                    onClick={() => {
                      setClassNum(value)
                      setSelectedName(null)
                    }}
                  >
                    {value}
                  </button>
                ))}
              </div>
              <div className="teacher-filters">
                {SUBJECTS.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className={name === subject ? 'cat-chip active' : 'cat-chip'}
                    onClick={() => {
                      setSubject(name)
                      setSelectedName(null)
                    }}
                  >
                    {name}
                  </button>
                ))}
                <label className="auth-field teacher-search">
                  <div className="admin-search">
                    <Search size={15} />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Chapter dhundo..."
                      aria-label="Search chapter"
                    />
                  </div>
                </label>
              </div>
            </div>

            <div className="teacher-layout">
              <div className="teacher-chapters">
                {chapters.length === 0 && <p className="example-label">Koi chapter nahi mila.</p>}
                {chapters.map((chapter) => {
                  const isCustom = overrideMap.has(`${classNum}::${chapter.name}`)
                  return (
                    <button
                      key={chapter.name}
                      type="button"
                      className={`teacher-chapter${selected?.name === chapter.name ? ' is-active' : ''}`}
                      onClick={() => setSelectedName(chapter.name)}
                    >
                      <span>{chapter.name}</span>
                      <span className="teacher-chapter-tags">
                        {isCustom && <i className="teacher-custom">edited</i>}
                        <i className={`notes-subject subject-${chapter.subject.toLowerCase()}`}>
                          {chapter.subject}
                        </i>
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="teacher-editor">
                {selected ? (
                  <>
                    <div className="teacher-editor-head">
                      <div>
                        <h3>{selected.name}</h3>
                        <div className="notes-tags" style={{ marginTop: 6 }}>
                          <span className={`notes-subject subject-${selected.subject.toLowerCase()}`}>
                            {selected.subject}
                          </span>
                          <span className="notes-cat">{selected.cat}</span>
                          {currentOverride ? (
                            <span className="notes-edited">Custom note</span>
                          ) : (
                            <span className="teacher-default">Default note</span>
                          )}
                        </div>
                      </div>
                      <div className="teacher-editor-actions">
                        <button className="analyze-button" type="button" onClick={save} disabled={saving}>
                          {saving ? 'Saving...' : (<><Check size={16} /> Save</>)}
                        </button>
                        {currentOverride && (
                          <button className="tool-btn" type="button" onClick={reset} disabled={saving}>
                            <RotateCcw size={15} /> Reset
                          </button>
                        )}
                      </div>
                    </div>

                    {notice && <div className="teacher-notice">{notice}</div>}
                    {error && <div className="upload-error">{error}</div>}

                    <label className="teacher-label">
                      Summary
                      <textarea
                        className="teacher-textarea"
                        value={summary}
                        onChange={(event) => setSummary(event.target.value)}
                        rows={4}
                        maxLength={2000}
                        placeholder="Chapter ka short summary..."
                      />
                    </label>

                    <div className="teacher-points">
                      <div className="teacher-points-head">
                        <span className="section-kicker">KEY POINTS</span>
                        <button className="tool-btn" type="button" onClick={addPoint}>
                          <Plus size={15} /> Add point
                        </button>
                      </div>
                      {points.map((point, index) => (
                        <div className="teacher-point-row" key={index}>
                          <span className="teacher-point-num">{index + 1}</span>
                          <input
                            className="teacher-point-input"
                            value={point}
                            maxLength={500}
                            onChange={(event) => updatePoint(index, event.target.value)}
                            placeholder="Important point..."
                          />
                          <button
                            className="tool-btn teacher-remove"
                            type="button"
                            onClick={() => removePoint(index)}
                            aria-label="Remove point"
                            disabled={points.length === 1}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ))}
                    </div>

                    {currentOverride && (
                      <p className="teacher-meta">
                        Last saved {new Date(currentOverride.updatedAt).toLocaleString('en-IN')}
                        {currentOverride.updatedBy ? ` · ${currentOverride.updatedBy}` : ''}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="example-label">Left se ek chapter chuno.</p>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
