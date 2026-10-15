import { useState } from 'react'
import { ArrowLeft, Check, FileText, FlaskConical, KeyRound, RotateCw, Search, Tags, Users } from 'lucide-react'

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

interface AdminUser {
  id: string
  email: string
  createdAt: string
  lastSignIn: string
  solves: number
  solvesToday: number
  plan: string
  expiresAt: string
  accessActive: boolean
  dailyLimit: number | null
}

interface AdminOverview {
  totalSolutions: number
  totalUsers: number
  demoCount: number
  topics: Array<{ topic: string; count: number }>
  last7Days: Array<{ day: string; count: number }>
  solutions: AdminSolution[]
  users: AdminUser[]
}

const STORAGE_KEY = 'anknawab_admin_key'

export default function AdminPanel({ onClose }: { onClose: () => void }) {
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem(STORAGE_KEY) ?? '')
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'solutions' | 'users'>('solutions')
  const [drafts, setDrafts] = useState<Record<string, { plan: string; limit: string }>>({})
  const draftOf = (u: AdminUser) =>
    drafts[u.id] ?? { plan: u.accessActive ? u.plan : '', limit: u.dailyLimit?.toString() ?? '' }

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

  // Access + daily limit save karo.
  const setAccess = async (userId: string, plan: string, limitStr: string) => {
    if (!adminKey.trim()) {
      setError('Pehle admin key likho.')
      return
    }
    let dailyLimit: number | null = null
    if (limitStr.trim() !== '') {
      dailyLimit = Number(limitStr)
      if (!Number.isInteger(dailyLimit) || dailyLimit < 1 || dailyLimit > 1000) {
        setError('Daily limit 1 se 1000 tak number me likho (khali = unlimited).')
        return
      }
    }
    setBusy(true)
    setError(null)
    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'
      const response = await fetch(`${apiUrl}/admin/access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey.trim() },
        body: JSON.stringify({ userId, plan, dailyLimit }),
      })
      const payload = (await response.json()) as { message?: string }
      if (!response.ok) {
        throw new Error(payload.message ?? 'Save nahi hua.')
      }
      setDrafts((prev) => {
        const next = { ...prev }
        delete next[userId]
        return next
      })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kuch gadbad hui.')
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
  const userRows = (overview?.users ?? []).filter(
    (u) => !q || u.email.toLowerCase().includes(q),
  )
  const maxTopic = Math.max(1, ...(overview?.topics.map((t) => t.count) ?? [1]))
  const maxDay = Math.max(1, ...(overview?.last7Days.map((d) => d.count) ?? [1]))

  return (
    <div className="admin-dash">
      <aside className="admin-side">
        <div className="admin-brand">
          <img src="./logo-icon.svg" alt="AnkNawab" />
          <div>
            <b>ANKNAWAB</b>
            <span>admin console</span>
          </div>
        </div>
        {overview && (
          <nav className="admin-nav" aria-label="Admin sections">
            <button
              className={view === 'solutions' ? 'active' : ''}
              onClick={() => setView('solutions')}
            >
              <FileText size={17} /> Solutions
            </button>
            <button
              className={view === 'users' ? 'active' : ''}
              onClick={() => setView('users')}
            >
              <Users size={17} /> Users ({overview.totalUsers})
            </button>
          </nav>
        )}
        <div className="admin-side-foot">
          <button type="button" onClick={onClose}>
            <ArrowLeft size={16} /> Back to site
          </button>
        </div>
      </aside>
      <main className="admin-main">
        {!overview ? (
          <div className="admin-login-card">
            <span className="section-kicker">ADMIN ONLY</span>
            <h2>Admin panel</h2>
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
          </div>
        ) : (
          <>
            <header className="admin-topbar">
              <div>
                <span className="section-kicker">{view === 'users' ? 'USERS' : 'OVERVIEW'}</span>
                <h2>{view === 'users' ? 'All users' : 'Dashboard'}</h2>
              </div>
              <button className="tool-btn" type="button" onClick={load} disabled={busy}>
                <RotateCw size={15} /> Refresh
              </button>
            </header>
            <div className="admin-cards">
              <div className="admin-card">
                <div className="admin-card-icon blue"><Users size={18} /></div>
                <div><b>{overview.totalUsers}</b><span>total users</span></div>
              </div>
              <div className="admin-card">
                <div className="admin-card-icon coral"><FileText size={18} /></div>
                <div><b>{overview.totalSolutions}</b><span>solutions</span></div>
              </div>
              <div className="admin-card">
                <div className="admin-card-icon yellow"><FlaskConical size={18} /></div>
                <div><b>{overview.demoCount}</b><span>demo fallback</span></div>
              </div>
              <div className="admin-card">
                <div className="admin-card-icon green"><Tags size={18} /></div>
                <div><b>{overview.topics.length}</b><span>topics</span></div>
              </div>
            </div>
            <div className="admin-cols">
              {overview.topics.length > 0 && (
                <div className="admin-section">
                  <span className="section-kicker">TOP TOPICS</span>
                  <div className="topic-bars">
                    {overview.topics.slice(0, 6).map((t) => (
                      <div className="topic-bar-row" key={t.topic}>
                        <span>{t.topic}</span>
                        <div className="topic-bar"><i style={{ width: `${Math.round((t.count / maxTopic) * 100)}%` }} /></div>
                        <b>{t.count}</b>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {overview.last7Days.length > 0 && (
                <div className="admin-section">
                  <span className="section-kicker">LAST 7 DAYS</span>
                  <div className="week-bars">
                    {overview.last7Days.map((d) => (
                      <div className="week-bar" key={d.day} title={`${d.day}: ${d.count}`}>
                        <i style={{ height: `${Math.max(8, Math.round((d.count / maxDay) * 100))}%` }} />
                        <span>{d.day.slice(5)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="admin-toolbar">
              <label className="auth-field admin-search-field">
                <div className="admin-search">
                  <Search size={15} />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={view === 'users' ? 'Email...' : 'Email, question ya topic...'}
                  />
                </div>
              </label>
            </div>
            {error && <div className="upload-error">{error}</div>}
            {view === 'users' ? (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Solves</th>
                      <th>Access</th>
                      <th>Joined</th>
                      <th>Last active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userRows.map((u) => (
                      <tr key={u.id}>
                        <td data-label="User">
                          <span className="admin-user">{u.email}</span>
                        </td>
                        <td data-label="Solves">
                          <b>{u.solves}</b>
                          <small className="access-until">{u.solvesToday} today</small>
                        </td>
                        <td data-label="Access">
                          <select
                            className="access-select"
                            value={draftOf(u).plan}
                            onChange={(event) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [u.id]: { ...draftOf(u), plan: event.target.value },
                              }))
                            }
                            disabled={busy}
                            aria-label={`Access for ${u.email}`}
                          >
                            <option value="">No access</option>
                            <option value="week">1 week</option>
                            <option value="month">1 month</option>
                            <option value="year">1 year</option>
                          </select>
                          <div className="access-row">
                            <input
                              className="limit-input"
                              type="number"
                              min={1}
                              max={1000}
                              placeholder="∞/day"
                              title="Daily limit (khali = unlimited)"
                              value={draftOf(u).limit}
                              onChange={(event) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [u.id]: { ...draftOf(u), limit: event.target.value },
                                }))
                              }
                              disabled={busy}
                              aria-label={`Daily limit for ${u.email}`}
                            />
                            <button
                              className="tool-btn access-save"
                              type="button"
                              onClick={() => setAccess(u.id, draftOf(u).plan, draftOf(u).limit)}
                              disabled={busy}
                              aria-label={`Save access for ${u.email}`}
                            >
                              <Check size={15} />
                            </button>
                          </div>
                          {u.accessActive && u.expiresAt && (
                            <small className="access-until">
                              till {new Date(u.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            </small>
                          )}
                          {!u.accessActive && u.expiresAt && (
                            <small className="access-expired">expired</small>
                          )}
                        </td>
                        <td data-label="Joined">
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                        </td>
                        <td data-label="Last active">
                          {u.lastSignIn ? new Date(u.lastSignIn).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {userRows.length === 0 && <p className="example-label">Koi user nahi mila.</p>}
              </div>
            ) : (
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
                        <td data-label="User">
                          <span className="admin-user">{s.userEmail}</span>
                          {s.isDemo && <span className="pill-demo">demo</span>}
                        </td>
                        <td data-label="Question" title={s.question}>
                          {s.question.length > 90 ? `${s.question.slice(0, 90)}…` : s.question}
                        </td>
                        <td data-label="Topic">
                          <span className="history-topic">{s.topic}</span>
                        </td>
                        <td data-label="Date">
                          {new Date(s.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length === 0 && <p className="example-label">Kuch nahi mila.</p>}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
