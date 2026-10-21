import { useEffect, useRef, useState, Fragment } from 'react'
import {
  ArrowLeft,
  Bell,
  Check,
  Copy,
  Download,
  FileText,
  FlaskConical,
  GraduationCap,
  KeyRound,
  ListChecks,
  RotateCw,
  Search,
  Tags,
  Users,
  X,
} from 'lucide-react'
import TeacherAccountsModal from './TeacherAccountsModal'

interface AdminSolution {
  id: string
  userEmail: string
  question: string
  topic: string
  questionType: string
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

interface AdminUserActivity {
  userId: string
  email: string
  totalSolves: number
  solvesToday: number
  solutions: AdminSolution[]
}

const STORAGE_KEY = 'anknawab_admin_key'
const SEEN_KEY = 'anknawab_admin_seen'

export default function AdminPanel({ onClose }: { onClose: () => void }) {
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem(STORAGE_KEY) ?? '')
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'solutions' | 'users' | 'user-detail'>('solutions')
  const [topicFilter, setTopicFilter] = useState<string | null>(null)
  const [demoOnly, setDemoOnly] = useState(false)
  const topicsRef = useRef<HTMLDivElement>(null)
  const [drafts, setDrafts] = useState<Record<string, { plan: string; limit: string }>>({})
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [userActivity, setUserActivityState] = useState<AdminUserActivity | null>(null)
  const [expandedSolId, setExpandedSolId] = useState<string | null>(null)
  const [solSort, setSolSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'createdAt', dir: 'desc' })
  const [usrSort, setUsrSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'createdAt', dir: 'desc' })
  const [accessBusy, setAccessBusy] = useState(false)
  const [copyMsg, setCopyMsg] = useState<string | null>(null)
  const [teachersOpen, setTeachersOpen] = useState(false)
  const [seenAt, setSeenAt] = useState(() => {
    try {
      return Number(localStorage.getItem(SEEN_KEY) ?? 0) || 0
    } catch {
      return 0
    }
  })
  // Users tab kholte hi alerts seen mark ho jate hain.
  useEffect(() => {
    if (view === 'users' && overview) {
      const now = Date.now()
      try {
        localStorage.setItem(SEEN_KEY, String(now))
      } catch {
        // ignore
      }
      setSeenAt(now)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])
  // Copy toast hatayein.
  useEffect(() => {
    if (!copyMsg) return
    const t = window.setTimeout(() => setCopyMsg(null), 1800)
    return () => window.clearTimeout(t)
  }, [copyMsg])

  const draftOf = (u: AdminUser) =>
    drafts[u.id] ?? { plan: u.accessActive ? u.plan : '', limit: u.dailyLimit?.toString() ?? '' }

  const sortRows = (rows: any[], key: string, dir: 'asc' | 'desc') =>
    [...rows].sort((a, b) => {
      const av = (a as any)[key]
      const bv = (b as any)[key]
      if (av === bv) return 0
      const c = av < bv ? -1 : 1
      return dir === 'asc' ? c : -c
    })

  const fmtDate = (iso: string | null) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const fmtTime = (iso: string | null) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  }

  const dailyCounts = (solutions: AdminSolution[]) => {
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today)
      d.setUTCDate(d.getUTCDate() - 6 + i)
      return String(d).slice(0, 10)
    })
    const counts: Record<string, number> = {}
    days.forEach((d) => (counts[d] = 0))
    solutions.forEach((s) => {
      const day = String(s.createdAt).slice(0, 10)
      if (counts[day] !== undefined) counts[day]++
    })
    return days.map((day) => ({ day, count: counts[day] ?? 0 }))
  }

  const exportCSV = (title: string, cols: { key: string; label: string }[], rows: any[]) => {
    const esc = (v: unknown) => {
      let s = String(v ?? '')
      if (s.includes(',') || s.includes('"') || s.includes('\n')) s = '"' + s.replace(/"/g, '""') + '"'
      return s
    }
    const header = cols.map((c) => `"${c.label}"`).join(',')
    const lines = rows.map((r) => cols.map((c) => esc(r[c.key])).join(','))
    const csv = [header, ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const copyEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email)
      setCopyMsg('Email copy kar liya')
    } catch {
      setCopyMsg('Copy nahi hua')
    }
  }

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

  const loadUserActivity = async (userId: string) => {
    if (!adminKey.trim()) {
      setError('Pehle admin key likho.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'
      const response = await fetch(`${apiUrl}/admin/user/${encodeURIComponent(userId)}`, {
        headers: { 'x-admin-key': adminKey.trim() },
      })
      const payload = (await response.json()) as { activity?: AdminUserActivity; message?: string }
      if (!response.ok || !payload.activity) {
        throw new Error(payload.message ?? 'Load nahi hua.')
      }
      setUserActivityState(payload.activity)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kuch gadbad hui.')
    } finally {
      setBusy(false)
    }
  }

  const revokeAccess = async (userId: string) => {
    setAccessBusy(true)
    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'
      const response = await fetch(`${apiUrl}/admin/access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey.trim() },
        body: JSON.stringify({ userId, plan: 'none' }),
      })
      const payload = (await response.json()) as { message?: string }
      if (!response.ok) throw new Error(payload.message ?? 'Access wapas nahi liya gaya.')
      setError(null)
      setAccessBusy(false)
      await load()
      if (userActivity) await loadUserActivity(userId)
    } catch (e) {
      setAccessBusy(false)
      setError(e instanceof Error ? e.message : 'Access wapas nahi liya gaya.')
    }
  }

  const grantTrial = async (userId: string) => {
    setAccessBusy(true)
    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'
      const response = await fetch(`${apiUrl}/admin/access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey.trim() },
        body: JSON.stringify({ userId, plan: 'month', dailyLimit: 10 }),
      })
      const payload = (await response.json()) as { message?: string }
      if (!response.ok) throw new Error(payload.message ?? 'Trial nahi diya gaya.')
      setError(null)
      setAccessBusy(false)
      await load()
      if (userActivity) await loadUserActivity(userId)
    } catch (e) {
      setAccessBusy(false)
      setError(e instanceof Error ? e.message : 'Trial nahi diya gaya.')
    }
  }

  const setAccess = async (userId: string, plan: string, limitStr: string) => {
    let dailyLimit: number | null = null
    if (limitStr.trim() !== '') {
      dailyLimit = Number(limitStr)
      if (!Number.isInteger(dailyLimit) || dailyLimit < 1 || dailyLimit > 1000) {
        setError('Daily limit 1 se 1000 tak number me likho (khali = unlimited).')
        return
      }
    }
    setAccessBusy(true)
    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'
      const response = await fetch(`${apiUrl}/admin/access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey.trim() },
        body: JSON.stringify({ userId, plan, dailyLimit }),
      })
      const payload = (await response.json()) as { message?: string }
      if (!response.ok) throw new Error(payload.message ?? 'Save nahi hua.')
      setDrafts((prev) => {
        const next = { ...prev }
        delete next[userId]
        return next
      })
      setAccessBusy(false)
      await load()
    } catch (e) {
      setAccessBusy(false)
      setError(e instanceof Error ? e.message : 'Access save nahi hua.')
    }
  }

  const openUserDetail = (userId: string) => {
    setSelectedUserId(userId)
    setView('user-detail')
    loadUserActivity(userId)
  }

  const q = query.trim().toLowerCase()
  const baseSolutions = (overview?.solutions ?? []).filter(
    (s) =>
      (!topicFilter || s.topic === topicFilter) &&
      (!demoOnly || s.isDemo) &&
      (!q ||
        s.userEmail.toLowerCase().includes(q) ||
        s.question.toLowerCase().includes(q) ||
        s.topic.toLowerCase().includes(q)),
  )
  const rows = sortRows(baseSolutions, solSort.key, solSort.dir)
  const clearFilters = () => {
    setTopicFilter(null)
    setDemoOnly(false)
    setQuery('')
  }
  const userRows = sortRows(
    (overview?.users ?? [])
      .filter((u) => !q || u.email.toLowerCase().includes(q))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    usrSort.key,
    usrSort.dir,
  )
  const unread = (overview?.users ?? []).filter(
    (u) => u.createdAt && new Date(u.createdAt).getTime() > seenAt,
  ).length
  const isNewUser = (iso: string) =>
    !!iso && Date.now() - new Date(iso).getTime() < 7 * 24 * 60 * 60 * 1000
  const maxTopic = Math.max(1, ...(overview?.topics.map((t) => t.count) ?? [1]))
  const maxDay = Math.max(1, ...(overview?.last7Days.map((d) => d.count) ?? [1]))
  const avgSolves =
    overview && overview.totalUsers
      ? Math.round((overview.totalSolutions / overview.totalUsers) * 10) / 10
    : 0

  const sortHeader = (
    key: string,
    label: string,
    cfg: { key: string; dir: 'asc' | 'desc' },
    setCfg: (v: { key: string; dir: 'asc' | 'desc' }) => void,
  ) => {
    const active = cfg.key === key
    const nextDir = active && cfg.dir === 'asc' ? 'desc' : 'asc'
    return (
      <th
        key={key}
        onClick={() => setCfg({ key, dir: nextDir })}
        className="sort-head"
        title="Sort karne ke liye click karein"
      >
        {label} {active ? (cfg.dir === 'asc' ? '↑' : '↓') : ''}
      </th>
    )
  }

  const accessBadge = (u: AdminUser) => {
    if (!u.accessActive) return <span className="access-badge expired">No access</span>
    if (!u.plan) return <span className="access-badge none">None</span>
    return <span className="access-badge active">{u.plan}</span>
  }

  return (
    <>
    <div className="admin-dash">
      <aside className="admin-side">
        <div className="admin-brand">
          <img src="./logo-icon.svg?v=3" alt="AnkNawab" />
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
        {copyMsg && <span className="copy-toast">{copyMsg}</span>}
        <div className="admin-side-foot">
          {overview && (
            <button type="button" onClick={() => setTeachersOpen(true)}>
              <GraduationCap size={16} /> Teacher accounts
            </button>
          )}
          <button type="button" onClick={() => { window.location.hash = '#/teacher' }}>
            <FileText size={16} /> Notes editor
          </button>
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
                <span className="section-kicker">
                  {view === 'users'
                    ? 'USERS'
                    : view === 'user-detail'
                      ? 'USER ACTIVITY'
                      : 'OVERVIEW'}
                </span>
                <h2>
                  {view === 'users'
                    ? 'All users'
                    : view === 'user-detail'
                      ? userActivity?.email ?? 'User'
                      : 'Dashboard'}
                </h2>
              </div>
              <div className="admin-top-actions">
                <button className="tool-btn bell-btn" type="button" onClick={() => setView('users')} title="New user alerts">
                  <Bell size={15} /> Alerts
                  {unread > 0 && <span className="bell-count">{unread}</span>}
                </button>
                <button className="tool-btn" type="button" onClick={load} disabled={busy}>
                  <RotateCw size={15} /> Refresh
                </button>
              </div>
              </header>
              {view !== 'user-detail' && (
                <div className="admin-cards">
              <button type="button" className="admin-card" onClick={() => setView('users')} title="See all users">
                <div className="admin-card-icon blue"><Users size={18} /></div>
                <div><b>{overview.totalUsers}</b><span>total users</span></div>
              </button>
              <button
                type="button"
                className="admin-card"
                onClick={() => { setView('solutions'); setTopicFilter(null); setDemoOnly(false) }}
                title="See all solutions"
              >
                <div className="admin-card-icon coral"><FileText size={18} /></div>
                <div><b>{overview.totalSolutions}</b><span>solutions</span></div>
              </button>
              <button
                type="button"
                className="admin-card"
                onClick={() => { setView('solutions'); setTopicFilter(null); setDemoOnly(true) }}
                title="See demo fallbacks only"
              >
                <div className="admin-card-icon yellow"><FlaskConical size={18} /></div>
                <div><b>{overview.demoCount}</b><span>demo fallback</span></div>
              </button>
              <button
                type="button"
                className="admin-card"
                onClick={() => {
                  setView('solutions')
                  setTopicFilter(null)
                  setDemoOnly(false)
                  topicsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
                title="See topic breakdown"
              >
                <div className="admin-card-icon green"><Tags size={18} /></div>
                <div><b>{overview.topics.length}</b><span>topics</span></div>
              </button>
                <button type="button" className="admin-card">
                  <div className="admin-card-icon blue"><ListChecks size={18} /></div>
                  <div><b>{avgSolves}</b><span>avg solves / user</span></div>
                </button>
              </div>
              )}
            <div className="admin-cols">
            {overview.topics.length > 0 && (
              <div className="admin-section" ref={topicsRef}>
                <span className="section-kicker">TOP TOPICS · TAP TO FILTER</span>
                <div className="topic-bars">
                  {overview.topics.slice(0, 6).map((t) => (
                    <div
                      className={topicFilter === t.topic ? 'topic-bar-row selected' : 'topic-bar-row'}
                      key={t.topic}
                      role="button"
                      tabIndex={0}
                      title={`Filter by ${t.topic}`}
                      onClick={() => {
                        setView('solutions')
                        setDemoOnly(false)
                        setTopicFilter((prev) => (prev === t.topic ? null : t.topic))
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          setView('solutions')
                          setDemoOnly(false)
                          setTopicFilter((prev) => (prev === t.topic ? null : t.topic))
                        }
                      }}
                    >
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
              {view === 'users' ? (
                <button className="analyze-button" type="button" onClick={() => exportCSV('anknawab-users', [
                  { key: 'email', label: 'User' },
                  { key: 'joined', label: 'Joined' },
                  { key: 'lastActive', label: 'Last active' },
                  { key: 'solves', label: 'Total solves' },
                  { key: 'todaySolves', label: "Today's solves" },
                  { key: 'plan', label: 'Plan' },
                  { key: 'access', label: 'Access' },
                  { key: 'limit', label: 'Daily limit' },
                ], userRows.map((u) => ({
                  email: u.email,
                  joined: fmtDate(u.createdAt),
                  lastActive: fmtDate(u.lastSignIn),
                  solves: u.solves,
                  todaySolves: u.solvesToday,
                  plan: u.plan || '—',
                  access: u.accessActive ? 'Active' : 'No access',
                  limit: u.dailyLimit ?? '∞',
                })))}>
                  <Download size={16} /> Export users CSV
                </button>
              ) : view === 'user-detail' && userActivity ? (
                <button className="analyze-button" type="button" onClick={() => exportCSV(`anknawab-${userActivity.email.replace(/[^a-z0-9]/gi,'_')}`, [
                  { key: 'date', label: 'Date' },
                  { key: 'question', label: 'Question' },
                  { key: 'type', label: 'Type' },
                  { key: 'topic', label: 'Topic' },
                  { key: 'answer', label: 'Answer preview' },
                ], userActivity.solutions.map((s) => ({
                  date: fmtDate(s.createdAt),
                  question: s.question,
                  type: s.questionType || 'General',
                  topic: s.topic,
                  answer: s.finalAnswer,
                })))}>
                  <Download size={16} /> Export this user CSV
                </button>
              ) : (
                <button className="analyze-button" type="button" onClick={() => exportCSV('anknawab-solutions', [
                  { key: 'date', label: 'Date' },
                  { key: 'user', label: 'User' },
                  { key: 'question', label: 'Question' },
                  { key: 'topic', label: 'Topic' },
                  { key: 'type', label: 'Type' },
                  { key: 'demo', label: 'Demo' },
                ], rows.map((s) => ({
                  date: fmtDate(s.createdAt),
                  user: s.userEmail,
                  question: s.question,
                  topic: s.topic,
                  type: s.questionType || 'General',
                  demo: s.isDemo ? 'Yes' : 'No',
                })))}>
                  <Download size={16} /> Export solutions CSV
                </button>
              )}
            </div>
            {error && <div className="upload-error">{error}</div>}
            {(topicFilter || demoOnly) && view === 'solutions' && (
              <div className="filter-bar">
                <span>Filtered:</span>
                {topicFilter && (
                  <button type="button" className="filter-chip" onClick={() => setTopicFilter(null)}>
                    {topicFilter} ×
                  </button>
                )}
                {demoOnly && (
                  <button type="button" className="filter-chip" onClick={() => setDemoOnly(false)}>
                    demo only ×
                  </button>
                )}
                <button type="button" className="text-button filter-clear" onClick={clearFilters}>
                  Clear all
                </button>
              </div>
            )}
            {view === 'users' ? (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      {sortHeader('email', 'User', usrSort, setUsrSort)}
                      {sortHeader('solves', 'Solves', usrSort, setUsrSort)}
                      {sortHeader('solvesToday', 'Today', usrSort, setUsrSort)}
                      <th>Access</th>
                      {sortHeader('createdAt', 'Joined', usrSort, setUsrSort)}
                      {sortHeader('lastSignIn', 'Last active', usrSort, setUsrSort)}
                    </tr>
                  </thead>
                  <tbody>
                    {userRows.map((u) => (
                      <tr key={u.id}>
                        <td data-label="User">
                          <button
                            type="button"
                            className="admin-user-link"
                            onClick={(event) => {
                              event.stopPropagation()
                              openUserDetail(u.id)
                            }}
                            title="View user activity"
                          >
                            {u.email}
                            <Copy size={13} style={{ marginLeft: 6, verticalAlign: 'middle' }} />
                          </button>
                          {isNewUser(u.createdAt) && <span className="pill-new">new</span>}
                        </td>
                        <td data-label="Solves">
                          <b>{u.solves}</b>
                          <small className="access-until">{u.solvesToday} today</small>
                        </td>
                        <td data-label="Today">{u.solvesToday}</td>
                        <td data-label="Access">
                          {accessBadge(u)}
                          <div className="access-row">
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
                          {u.lastSignIn ? ' ' + fmtTime(u.lastSignIn) : ''}
                        </td>
                      </tr>
                    ))}
                    {userRows.length === 0 && <tr><td colSpan={6} className="example-label">Koi user nahi mila.</td></tr>}
                  </tbody>
                </table>
              </div>
            ) : view === 'user-detail' && userActivity ? (
              <div className="admin-detail-wrap">
                <header className="admin-topbar">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button type="button" className="tool-btn" onClick={() => setView('users')}>
                      <ArrowLeft size={15} /> Users wapas
                    </button>
                    <div>
                      <span className="section-kicker">USER ACTIVITY</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <h2>{userActivity.email}</h2>
                        <button
                          type="button"
                          className="tool-btn"
                          onClick={() => copyEmail(userActivity.email)}
                          title="Copy email"
                        >
                          <Copy size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="admin-top-actions">
                    {accessBusy ? (
                      <button className="tool-btn" disabled>Updating...</button>
                    ) : (
                      <>
                        <button
                          className="tool-btn"
                          type="button"
                          onClick={() => revokeAccess(selectedUserId!)}
                        >
                          <X size={15} /> Revoke access
                        </button>
                        <button
                          className="tool-btn"
                          type="button"
                          onClick={() => grantTrial(selectedUserId!)}
                        >
                          <KeyRound size={15} /> Grant 1-month trial
                        </button>
                        <button className="tool-btn" type="button" onClick={() => loadUserActivity(selectedUserId!)}>
                          <RotateCw size={15} /> Refresh
                        </button>
                      </>
                    )}
                  </div>
                </header>
                <div className="admin-cards">
                  <button type="button" className="admin-card">
                    <div className="admin-card-icon blue"><FileText size={18} /></div>
                    <div><b>{userActivity.totalSolves}</b><span>total solves</span></div>
                  </button>
                  <button type="button" className="admin-card">
                    <div className="admin-card-icon green"><RotateCw size={18} /></div>
                    <div><b>{userActivity.solvesToday}</b><span>today's solves</span></div>
                  </button>
                  <button type="button" className="admin-card">
                    <div className="admin-card-icon yellow"><ListChecks size={18} /></div>
                    <div><b>{userActivity.solutions.length}</b><span>in history</span></div>
                  </button>
                </div>
                <div className="admin-section">
                  <span className="section-kicker">SOLVES PER DAY (LAST 7 DAYS)</span>
                  <div className="daily-chart">
                    {dailyCounts(userActivity.solutions).map((d) => (
                      <div key={d.day} className="daily-bar" title={`${d.day}: ${d.count} solves`}>
                        <span className="daily-bar-label">{d.day.slice(5)}</span>
                        <span
                          className="daily-bar-fill"
                          style={{ height: `${d.count === 0 ? 0 : Math.max(30, Math.round((d.count / 20) * 100))}%` }}
                        />
                        <span className="daily-bar-count">{d.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Question</th>
                        <th>Type</th>
                        <th>Topic</th>
                        <th>Answer preview</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userActivity.solutions.map((s) => (
                        <tr key={s.id}>
                          <td data-label="Date">
                            {fmtDate(s.createdAt)}
                            <div style={{ fontSize: '11px', color: '#667587', marginTop: 2 }}>
                              {fmtTime(s.createdAt)}
                            </div>
                          </td>
                          <td data-label="Question" title={s.question}>
                            {s.question.length > 100 ? `${s.question.slice(0, 100)}…` : s.question}
                          </td>
                          <td data-label="Type">
                            <span className="history-topic">{s.questionType || 'General'}</span>
                          </td>
                          <td data-label="Topic">{s.topic}</td>
                          <td data-label="Answer preview">
                            {s.finalAnswer.length > 80 ? `${s.finalAnswer.slice(0, 80)}…` : s.finalAnswer}
                          </td>
                        </tr>
                      ))}
                      {userActivity.solutions.length === 0 && (
                        <tr>
                          <td colSpan={5} className="example-label">
                            Is user ne abhi kuch solve nahi kiya.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      {sortHeader('createdAt', 'Date', solSort, setSolSort)}
                      {sortHeader('userEmail', 'User', solSort, setSolSort)}
                      <th>Question</th>
                      {sortHeader('topic', 'Topic', solSort, setSolSort)}
                      {sortHeader('questionType', 'Type', solSort, setSolSort)}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((s) => (
                      <Fragment key={s.id}>
                        <tr
                          key={`row-${s.id}`}
                          className={expandedSolId === s.id ? 'expanded-row' : ''}
                          onClick={() => setExpandedSolId(expandedSolId === s.id ? null : s.id)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td data-label="Date">
                            {fmtDate(s.createdAt)}
                            <div style={{ fontSize: '11px', color: '#667587', marginTop: 2 }}>
                              {fmtTime(s.createdAt)}
                            </div>
                          </td>
                          <td data-label="User">
                            <span className="admin-user">{s.userEmail}</span>
                            {s.isDemo && <span className="pill-demo">demo</span>}
                          </td>
                          <td data-label="Question" title={s.question}>
                            {s.question.length > 110 ? `${s.question.slice(0, 110)}…` : s.question}
                          </td>
                          <td data-label="Topic">
                            <span className="history-topic">{s.topic}</span>
                          </td>
                          <td data-label="Type">
                            <span className="history-topic">{s.questionType || 'General'}</span>
                          </td>
                        </tr>
                        {expandedSolId === s.id && (
                          <tr key={`exp-${s.id}`}>
                            <td colSpan={5}>
                              <div className="sol-expand">
                                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                                  <span className="history-topic" style={{ marginRight: 8 }}>{s.difficulty}</span>
                                  <span className="history-topic" style={{ background: 'rgba(240, 91, 69, 0.12)', color: '#c24a38' }}>
                                    {s.isDemo ? 'Demo' : 'Real'}
                                  </span>
                                </div>
                                <div style={{ marginBottom: 8 }}>
                                  <b style={{ color: '#1d2938' }}>Question:</b> <span style={{ whiteSpace: 'pre-wrap', display: 'block', marginTop: 4 }}>{s.question}</span>
                                </div>
                                <div style={{ marginBottom: 8 }}>
                                  <b style={{ color: '#1d2938' }}>Answer:</b> <span style={{ whiteSpace: 'pre-wrap', display: 'block', marginTop: 4 }}>{s.finalAnswer}</span>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                    {rows.length === 0 && <tr><td colSpan={5} className="example-label">Kuch nahi mila.</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>
    </div>
    {teachersOpen && (
      <TeacherAccountsModal adminKey={adminKey} onClose={() => setTeachersOpen(false)} />
    )}
    </>
  )
}
