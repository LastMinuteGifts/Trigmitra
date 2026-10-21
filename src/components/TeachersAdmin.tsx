import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { BookOpen, GraduationCap, Plus, RefreshCw, Search, Trash2 } from 'lucide-react'

interface TeacherRow {
  email: string
  name: string
  createdAt: string
  createdBy: string
  edits: number
  lastEditedAt: string | null
}

interface TeacherEdit {
  class: number
  chapter: string
  summary: string
  points: string[]
  updatedAt: string
}

const apiBase = () => import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'

const fmtDate = (iso: string | null) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

const initials = (row: TeacherRow) => {
  const source = row.name || row.email
  const parts = source.split(/[\s.@_-]+/).filter(Boolean)
  return (parts[0]?.[0] ?? 'T').toUpperCase() + (parts[1]?.[0] ?? '').toUpperCase()
}

export default function TeachersAdmin({ adminKey }: { adminKey: string }) {
  const [teachers, setTeachers] = useState<TeacherRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState({ email: '', name: '', password: '' })
  const [adding, setAdding] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [edits, setEdits] = useState<TeacherEdit[]>([])
  const [editsLoading, setEditsLoading] = useState(false)
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${apiBase()}/admin/teachers`, {
        headers: { 'x-admin-key': adminKey.trim() },
      })
      const payload = (await response.json().catch(() => ({}))) as {
        teachers?: TeacherRow[]
        message?: string
      }
      if (!response.ok) throw new Error(payload.message ?? 'Teachers load nahi hue.')
      setTeachers(payload.teachers ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Teachers load nahi hue.')
    } finally {
      setLoading(false)
    }
  }, [adminKey])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!selected) {
      setEdits([])
      return
    }
    let active = true
    setEditsLoading(true)
    setError(null)
    void (async () => {
      try {
        const response = await fetch(
          `${apiBase()}/admin/teachers/${encodeURIComponent(selected)}/notes`,
          { headers: { 'x-admin-key': adminKey.trim() } },
        )
        const payload = (await response.json().catch(() => ({}))) as {
          notes?: TeacherEdit[]
          message?: string
        }
        if (!active) return
        if (!response.ok) throw new Error(payload.message ?? 'Edits load nahi hue.')
        setEdits(payload.notes ?? [])
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Edits load nahi hue.')
      } finally {
        if (active) setEditsLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [selected, adminKey])

  const add = async (event: FormEvent) => {
    event.preventDefault()
    if (!draft.email.trim() || draft.password.length < 8) {
      setError('Email do aur password kam se kam 8 characters ka rakho.')
      return
    }
    setAdding(true)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch(`${apiBase()}/admin/teachers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey.trim() },
        body: JSON.stringify({
          email: draft.email.trim(),
          name: draft.name.trim() || undefined,
          password: draft.password,
        }),
      })
      const payload = (await response.json().catch(() => ({}))) as { message?: string }
      if (!response.ok) throw new Error(payload.message ?? 'Account nahi bana.')
      setDraft({ email: '', name: '', password: '' })
      setNotice('Teacher account ban gaya.')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Account nahi bana.')
    } finally {
      setAdding(false)
    }
  }

  const remove = async (email: string) => {
    setDeleting(true)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch(`${apiBase()}/admin/teachers`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey.trim() },
        body: JSON.stringify({ email }),
      })
      const payload = (await response.json().catch(() => ({}))) as { message?: string }
      if (!response.ok) throw new Error(payload.message ?? 'Account nahi hata.')
      if (selected === email) setSelected(null)
      setConfirmEmail(null)
      setNotice('Teacher account hata diya.')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Account nahi hata.')
    } finally {
      setDeleting(false)
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return teachers
    return teachers.filter(
      (teacher) =>
        teacher.email.toLowerCase().includes(q) || teacher.name.toLowerCase().includes(q),
    )
  }, [teachers, query])

  const totalEdits = teachers.reduce((sum, teacher) => sum + teacher.edits, 0)

  return (
    <div className="teachers-admin">
      <div className="teacher-stats">
        <div className="teacher-stat">
          <GraduationCap size={18} />
          <b>{teachers.length}</b>
          <span>teachers</span>
        </div>
        <div className="teacher-stat">
          <BookOpen size={18} />
          <b>{totalEdits}</b>
          <span>notes edited</span>
        </div>
        <button className="tool-btn teacher-refresh" type="button" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      <form className="teacher-add-card" onSubmit={add}>
        <div className="teacher-add-head">
          <span className="section-kicker">ADD TEACHER</span>
          <span>Naya account banao — teacher isi email/password se login karega.</span>
        </div>
        <div className="teacher-add-grid">
          <label className="auth-field">
            Email
            <input
              type="email"
              value={draft.email}
              onChange={(event) => setDraft((prev) => ({ ...prev, email: event.target.value }))}
              placeholder="teacher@school.com"
              autoComplete="off"
              required
            />
          </label>
          <label className="auth-field">
            Name
            <input
              value={draft.name}
              onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Optional"
              autoComplete="off"
            />
          </label>
          <label className="auth-field">
            Password
            <input
              type="password"
              value={draft.password}
              onChange={(event) => setDraft((prev) => ({ ...prev, password: event.target.value }))}
              placeholder="8+ characters"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          <button className="analyze-button" type="submit" disabled={adding}>
            <Plus size={16} /> {adding ? 'Adding...' : 'Add teacher'}
          </button>
        </div>
      </form>

      {error && <div className="upload-error">{error}</div>}
      {notice && <div className="teacher-notice">{notice}</div>}

      <div className="admin-toolbar">
        <label className="auth-field admin-search-field">
          <div className="admin-search">
            <Search size={15} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Naam ya email..."
            />
          </div>
        </label>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Teacher</th>
              <th>Notes edited</th>
              <th>Last edit</th>
              <th>Joined</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((teacher) => (
              <tr
                key={teacher.email}
                className={selected === teacher.email ? 'teacher-row is-selected' : 'teacher-row'}
                onClick={() => setSelected(selected === teacher.email ? null : teacher.email)}
              >
                <td data-label="Teacher">
                  <div className="teacher-cell">
                    <span className="teacher-cell-avatar">{initials(teacher)}</span>
                    <div>
                      <b>{teacher.name || teacher.email.split('@')[0]}</b>
                      <span>{teacher.email}</span>
                    </div>
                  </div>
                </td>
                <td data-label="Notes edited">
                  <b>{teacher.edits}</b>
                </td>
                <td data-label="Last edit">{fmtDate(teacher.lastEditedAt)}</td>
                <td data-label="Joined">{fmtDate(teacher.createdAt)}</td>
                <td className="teacher-row-actions" onClick={(event) => event.stopPropagation()}>
                  {confirmEmail === teacher.email ? (
                    <div className="teacher-confirm">
                      <span>Delete?</span>
                      <button
                        className="tool-btn teacher-remove"
                        type="button"
                        onClick={() => void remove(teacher.email)}
                        disabled={deleting}
                      >
                        Haan
                      </button>
                      <button className="tool-btn" type="button" onClick={() => setConfirmEmail(null)}>
                        Nahi
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        className="tool-btn"
                        type="button"
                        onClick={() => setSelected(teacher.email)}
                      >
                        Edits
                      </button>
                      <button
                        className="tool-btn teacher-remove"
                        type="button"
                        onClick={() => setConfirmEmail(teacher.email)}
                        aria-label={`${teacher.email} delete karo`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="example-label">
                  {loading ? 'Load ho raha hai...' : 'Koi teacher nahi mila.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="admin-section teacher-edit-panel">
          <div className="teacher-edit-head">
            <div>
              <span className="section-kicker">TEACHER EDITS</span>
              <h3>{selected}</h3>
            </div>
            <span className="teacher-edit-count">{edits.length} notes edited</span>
          </div>
          {editsLoading ? (
            <p className="example-label">Edits load ho rahe hain...</p>
          ) : edits.length === 0 ? (
            <p className="example-label">Is teacher ne abhi koi note edit nahi kiya.</p>
          ) : (
            <div className="teacher-edit-list">
              {edits.map((edit) => (
                <details className="teacher-edit-item" key={`${edit.class}-${edit.chapter}`}>
                  <summary>
                    <span className="teacher-class-chip">Class {edit.class}</span>
                    <b>{edit.chapter}</b>
                    <span className="teacher-edit-time">{fmtDateTime(edit.updatedAt)}</span>
                  </summary>
                  <p className="teacher-edit-summary">{edit.summary}</p>
                  {edit.points.length > 0 && (
                    <ul className="teacher-edit-points">
                      {edit.points.map((point, index) => (
                        <li key={index}>{point}</li>
                      ))}
                    </ul>
                  )}
                </details>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
