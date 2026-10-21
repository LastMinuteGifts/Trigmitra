import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { KeyRound, Plus, ShieldCheck, Trash2, X } from 'lucide-react'

interface TeacherAccount {
  email: string
  name: string
  createdAt: string
  createdBy: string
}

const apiBase = () => import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'

/** Admin: teacher login accounts banayein / hatayein. */
export default function TeacherAccountsModal({
  adminKey,
  onClose,
}: {
  adminKey: string
  onClose: () => void
}) {
  const [teachers, setTeachers] = useState<TeacherAccount[]>([])
  const [draft, setDraft] = useState({ email: '', name: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`${apiBase()}/admin/teachers`, {
        headers: { 'x-admin-key': adminKey.trim() },
      })
      const payload = (await response.json().catch(() => ({}))) as {
        teachers?: TeacherAccount[]
        message?: string
      }
      if (!response.ok) throw new Error(payload.message ?? 'Teachers load nahi hue.')
      setTeachers(payload.teachers ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Teachers load nahi hue.')
    } finally {
      setBusy(false)
    }
  }, [adminKey])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const add = async (event: FormEvent) => {
    event.preventDefault()
    if (!draft.email.trim() || draft.password.length < 8) {
      setError('Email do aur password kam se kam 8 characters ka rakho.')
      return
    }
    setBusy(true)
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
      setBusy(false)
    }
  }

  const remove = async (email: string) => {
    setBusy(true)
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
      setNotice('Teacher account hata diya.')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Account nahi hata.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="teacher-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="teacher-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="teacher-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="teacher-modal-head">
          <div>
            <span className="section-kicker">TEACHER ACCESS</span>
            <h2 id="teacher-modal-title">Teacher accounts</h2>
            <p className="example-label">
              Sirf yahan bane accounts hi teacher panel me login kar sakte hain.
            </p>
          </div>
          <button className="tool-btn" type="button" onClick={onClose} aria-label="Band karo">
            <X size={16} />
          </button>
        </header>

        <form className="teacher-account-form" onSubmit={add}>
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
            Name <span className="teacher-optional">(optional)</span>
            <input
              value={draft.name}
              onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Jaise: Rakesh Sir"
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
          <button className="analyze-button" type="submit" disabled={busy}>
            <Plus size={16} /> Add teacher
          </button>
        </form>

        {error && <div className="upload-error">{error}</div>}
        {notice && <div className="teacher-notice">{notice}</div>}

        <div className="teacher-account-list">
          {teachers.length === 0 && !busy && (
            <p className="example-label">Abhi koi teacher account nahi hai.</p>
          )}
          {teachers.map((account) => (
            <div className="teacher-account-row" key={account.email}>
              <span className="teacher-account-avatar">
                <ShieldCheck size={16} />
              </span>
              <div className="teacher-account-info">
                <b>{account.name}</b>
                <span>{account.email}</span>
              </div>
              <span className="teacher-account-date">
                {new Date(account.createdAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
              <button
                className="tool-btn teacher-remove"
                type="button"
                onClick={() => void remove(account.email)}
                disabled={busy}
                aria-label={`${account.email} hatao`}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>

        <p className="teacher-modal-foot">
          <KeyRound size={13} /> Password hash hokar save hota hai. Reset chahiye to account hata ke dobara banao.
        </p>
      </div>
    </div>
  )
}
