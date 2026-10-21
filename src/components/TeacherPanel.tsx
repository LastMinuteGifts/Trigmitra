import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  BookOpen,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogIn,
  LogOut,
  Mail,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { chaptersForClass, resolveChapterNote } from '../data/notes'
import {
  fetchTeacherSession,
  teacherAuthHeaders,
  teacherLogin,
  TEACHER_TOKEN_KEY,
  type TeacherSession,
} from '../utils/teacherAuthApi'

interface NoteOverrideRow {
  class: number
  chapter: string
  summary: string
  points: string[]
  updatedAt: string
  updatedBy: string
}

const CLASS_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const SUBJECTS = ['All', 'Maths', 'Physics', 'Chemistry'] as const

const apiBase = () => import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'

/** Teacher panel: chapter ke notes + key points add / edit / remove. */
export default function TeacherPanel({ onClose }: { onClose: () => void }) {
  const [token, setToken] = useState(() => sessionStorage.getItem(TEACHER_TOKEN_KEY) ?? '')
  const [teacher, setTeacher] = useState<TeacherSession | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [authBusy, setAuthBusy] = useState(() => Boolean(sessionStorage.getItem(TEACHER_TOKEN_KEY)))
  const [authError, setAuthError] = useState<string | null>(null)
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

  const authed = Boolean(token && teacher)

  const endSession = (message?: string) => {
    sessionStorage.removeItem(TEACHER_TOKEN_KEY)
    setToken('')
    setTeacher(null)
    setOverrides([])
    setPassword('')
    if (message) setAuthError(message)
  }

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

  const loadNotes = async (authToken: string = token) => {
    if (!authToken) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`${apiBase()}/teacher/notes`, {
        headers: teacherAuthHeaders(authToken),
      })
      const payload = (await response.json().catch(() => ({}))) as {
        notes?: NoteOverrideRow[]
        message?: string
      }
      if (response.status === 401) {
        endSession('Session expire ho gaya — dobara login karo.')
        return
      }
      if (!response.ok) throw new Error(payload.message ?? 'Notes load nahi hue.')
      setOverrides(payload.notes ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kuch gadbad hui.')
    } finally {
      setBusy(false)
    }
  }

  const submitLogin = async () => {
    if (!email.trim() || !password) {
      setAuthError('Email aur password dono bharo.')
      return
    }
    setAuthBusy(true)
    setAuthError(null)
    try {
      const result = await teacherLogin(email.trim(), password)
      sessionStorage.setItem(TEACHER_TOKEN_KEY, result.token)
      setToken(result.token)
      setTeacher(result.teacher)
      setPassword('')
      await loadNotes(result.token)
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : 'Login nahi ho paya.')
    } finally {
      setAuthBusy(false)
    }
  }

  useEffect(() => {
    if (!token) return
    let active = true
    setAuthBusy(true)
    void (async () => {
      const session = await fetchTeacherSession(token)
      if (!active) return
      if (!session) {
        endSession('Session expire ho gaya — dobara login karo.')
        setAuthBusy(false)
        return
      }
      setTeacher(session)
      await loadNotes(token)
      if (active) setAuthBusy(false)
    })()
    return () => {
      active = false
    }
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
        headers: { 'Content-Type': 'application/json', ...teacherAuthHeaders(token) },
        body: JSON.stringify({
          class: classNum,
          chapter: selected.name,
          summary,
          points: points.filter((point) => point.trim()),
        }),
      })
      if (response.status === 401) {
        endSession('Session expire ho gaya — dobara login karo.')
        return
      }
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
        headers: { 'Content-Type': 'application/json', ...teacherAuthHeaders(token) },
        body: JSON.stringify({ class: classNum, chapter: selected.name }),
      })
      if (response.status === 401) {
        endSession('Session expire ho gaya — dobara login karo.')
        return
      }
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
    endSession()
    setEmail('')
    setAuthError(null)
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
          <img src="./logo-icon.svg?v=3" alt="AnkNawab" />
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
          {authed && teacher && (
            <div className="teacher-who">
              <b>{teacher.name}</b>
              <span>{teacher.email}</span>
            </div>
          )}
          <button type="button" onClick={() => { window.location.hash = '#/admin' }}>
            <KeyRound size={16} /> Back to admin
          </button>
          <button type="button" onClick={onClose}>
            <ArrowLeft size={16} /> Back to site
          </button>
          {authed && (
            <button type="button" onClick={logout}>
              <LogOut size={16} /> Log out
            </button>
          )}
        </div>
      </aside>
      <main className="admin-main">
        {!authed ? (
          token && authBusy ? (
            <div className="teacher-login-wrap">
              <div className="admin-login-card teacher-login-card teacher-login-loading">
                <RefreshCw size={20} className="teacher-spin" />
                <p className="example-label">Session check ho raha hai...</p>
              </div>
            </div>
          ) : (
          <div className="teacher-login-wrap">
            <div className="admin-login-card teacher-login-card">
              <div className="teacher-login-badge">
                <ShieldCheck size={14} /> Teachers only
              </div>
              <h2>Teacher sign in</h2>
              <p className="example-label">
                Chapter notes aur key points edit karne ke liye apne teacher account se login karo.
              </p>
              <label className="auth-field">
                Email
                <div className="teacher-input">
                  <Mail size={16} />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="teacher@school.com"
                    autoComplete="username"
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') void submitLogin()
                    }}
                  />
                </div>
              </label>
              <label className="auth-field">
                Password
                <div className="teacher-input">
                  <Lock size={16} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Password"
                    autoComplete="current-password"
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') void submitLogin()
                    }}
                  />
                  <button
                    className="teacher-eye"
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? 'Password hide karo' : 'Password dikhao'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>
              {authError && <div className="upload-error">{authError}</div>}
              <button className="analyze-button auth-submit" type="button" onClick={submitLogin} disabled={authBusy}>
                {authBusy ? 'Signing in...' : (<><LogIn size={16} /> Sign in</>)}
              </button>
              <p className="teacher-login-foot">Account nahi hai? Admin panel → Teacher accounts se banao.</p>
              <button className="teacher-back-link" type="button" onClick={onClose}>
                <ArrowLeft size={14} /> Wapas site par
              </button>
            </div>
          </div>
          )
        ) : (
          <>
            <header className="admin-topbar">
              <div>
                <span className="section-kicker">CHAPTER NOTES EDITOR</span>
                <h2>Notes &amp; key points</h2>
              </div>
              <div className="admin-top-actions">
                <button className="tool-btn" type="button" onClick={() => void loadNotes()} disabled={busy}>
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
