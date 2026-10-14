import { useEffect, useState } from 'react'
import { History, LogOut, Trash2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { StructuredSolution } from '../types/solution'

export interface HistoryItem {
  id: string
  question: string
  topic: string
  questionType: string
  difficulty: string
  finalAnswer: string
  isDemo: boolean
  createdAt: string
  solution: StructuredSolution
}

interface HistoryModalProps {
  userEmail: string | null
  onClose: () => void
  onLogin: () => void
  onLogout: () => void
  onView: (solution: StructuredSolution, isDemo: boolean) => void
}

export default function HistoryModal({ userEmail, onClose, onLogin, onLogout, onView }: HistoryModalProps) {
  const [items, setItems] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const db = supabase
    if (!db || !userEmail) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      const { data, error } = await db
        .from('solutions')
        .select('id, question, topic, question_type, difficulty, final_answer, is_demo, created_at, solution')
        .order('created_at', { ascending: false })
        .limit(50)
      if (cancelled) return
      if (error) {
        setError('History load nahi hui. Phir try karo.')
      } else {
        setItems(
          (data ?? []).map((row) => ({
            id: row.id as string,
            question: row.question as string,
            topic: (row.topic as string) || 'General',
            questionType: (row.question_type as string) || '',
            difficulty: (row.difficulty as string) || '',
            finalAnswer: (row.final_answer as string) || '',
            isDemo: Boolean(row.is_demo),
            createdAt: row.created_at as string,
            solution: row.solution as StructuredSolution,
          })),
        )
      }
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [userEmail])

  const removeItem = async (id: string) => {
    const db = supabase
    if (!db) return
    setItems((prev) => prev.filter((item) => item.id !== id))
    await db.from('solutions').delete().eq('id', id)
  }

  const topics = new Set(items.map((item) => item.topic)).size

  return (
    <div className="example-overlay" role="dialog" aria-modal="true" aria-label="History" onClick={onClose}>
      <div className="example-box history-box" onClick={(event) => event.stopPropagation()}>
        <div className="example-head">
          <div>
            <span className="section-kicker">TRACK PROGRESS</span>
            <h3>Tumhari history</h3>
          </div>
          <button className="close-upload" aria-label="Close history" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {!userEmail ? (
          <div className="history-login">
            <History size={28} />
            <p>Login karoge to solved questions yahan save rahenge.</p>
            <button className="analyze-button" onClick={onLogin}>
              Login / Signup
            </button>
          </div>
        ) : (
          <>
            <div className="history-user">
              <span>{userEmail}</span>
              <button className="text-button" onClick={onLogout}>
                <LogOut size={14} /> Logout
              </button>
            </div>
            <div className="history-stats">
              <div>
                <b>{items.length}</b>
                <span>solved</span>
              </div>
              <div>
                <b>{topics}</b>
                <span>topics</span>
              </div>
            </div>
            {loading && <p className="example-label">History load ho rahi...</p>}
            {error && <div className="upload-error">{error}</div>}
            {!loading && items.length === 0 && !error && (
              <p className="example-label">Abhi kuch solve nahi kiya. Pehla question solve karo!</p>
            )}
            <div className="history-list">
              {items.map((item) => (
                <article key={item.id} className="history-item" onClick={() => onView(item.solution, item.isDemo)}>
                  <div>
                    <span className="history-topic">{item.topic}</span>
                    <p>{item.question}</p>
                    <small>
                      {new Date(item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      {item.difficulty ? ` · ${item.difficulty}` : ''}
                      {item.isDemo ? ' · demo' : ''}
                    </small>
                  </div>
                  <button
                    className="history-del"
                    aria-label="Delete"
                    onClick={(event) => {
                      event.stopPropagation()
                      removeItem(item.id)
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
