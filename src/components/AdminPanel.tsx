import { useState } from 'react'
import { KeyRound, Search, X } from 'lucide-react'

interface AdminSolution {
  id: string
  userEmail: string
  question: string
  topic: string
  difficulty: string
  finalAnswer: string
  isDemo: boolean
  createdAt: string
}

interface AdminOverview {
  totalSolutions: number
  totalUsers: number
  demoCount: number
  topics: Array<{ topic: string; count: number }>
  solutions: AdminSolution[]
}

const STORAGE_KEY = 'anknawab_admin_key'

export default function AdminPanel({ onClose }: { onClose: () => void }) {
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem(STORAGE_KEY) ?? '')
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const load = async () => {
    if (!adminKey.trim()) {
      setError('Pehle admin key likho.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'
      const response = await fetch(`${apiUrl}/admin/overview?limit=100`, {
        headers: { 'x-admin-key': adminKey.trim() },
      })
      const payload = (await response.json()) as { overview?: AdminOverview; message?: string }
      if (!response.ok || !payload.overview) {
        throw new Error(payload.message ?? 'Load nahi hua.')
      }
      sessionStorage.setItem(STORAGE_KEY, adminKey.trim())
      setOverview(payload.overview)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kuch gadbad hui.')
    } finally {
      setBusy(false)
    }
  }

  const q = query.trim().toLowerCase()
  const rows = (overview?.solutions ?? []).filter(
    (s) =>
      !q ||
      s.userEmail.toLowerCase().includes(q) ||
      s.question.toLowerCase().includes(q) ||
      s.topic.toLowerCase().includes(q),
  )

  return (
    <div className="example-overlay" role="dialog" aria-modal="true" aria-label="Admin panel" onClick={onClose}>
      <div className="example-box admin-box" onClick={(event) => event.stopPropagation()}>
        <div className="example-head">
          <div>
            <span className="section-kicker">ADMIN ONLY</span>
            <h3>Admin panel</h3>
          </div>
          <button className="close-upload" aria-label="Close admin" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {!overview ? (
          <>
            <p className="example-label">Kaun kya solve kar raha hai — ye dekhne ke liye admin key dalo.</p>
            <label className="auth-field">
              Admin key
              <input
                type="password"
                value={adminKey}
                onChange={(event) => setAdminKey(event.target.value)}
                placeholder="Render me set ki hui key"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') load()
                }}
              />
            </label>
            {error && <div className="upload-error">{error}</div>}
            <button className="analyze-button auth-submit" onClick={load} disabled={busy}>
              {busy ? 'Ruko...' : (<><KeyRound size={16} /> Open panel</>)}
            </button>
          </>
        ) : (
          <>
            <div className="history-stats admin-stats">
              <div>
                <b>{overview.totalUsers}</b>
                <span>users</span>
              </div>
              <div>
                <b>{overview.totalSolutions}</b>
                <span>solutions</span>
              </div>
              <div>
                <b>{overview.demoCount}</b>
                <span>demo</span>
              </div>
            </div>
            {overview.topics.length > 0 && (
              <div className="subject-tags admin-topics">
                {overview.topics.map((t) => (
                  <span key={t.topic}>{t.topic} · {t.count}</span>
                ))}
              </div>
            )}
            <label className="auth-field">
              Search
              <div className="admin-search">
                <Search size={15} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Email, question ya topic..."
                />
              </div>
            </label>
            {error && <div className="upload-error">{error}</div>}
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Question</th>
                    <th>Topic</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => (
                    <tr key={s.id}>
                      <td data-label="User">{s.userEmail}</td>
                      <td data-label="Question" title={s.question}>
                        {s.question.length > 90 ? `${s.question.slice(0, 90)}…` : s.question}
                      </td>
                      <td data-label="Topic">{s.topic}</td>
                      <td data-label="Date">
                        {new Date(s.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length === 0 && <p className="example-label">Kuch nahi mila.</p>}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
