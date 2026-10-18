import { useState } from 'react'
import { HelpCircle, Send } from 'lucide-react'
import type { StructuredSolution } from '../types/solution'
import VoiceButton from './VoiceButton'

interface ChatMsg {
  role: 'user' | 'ai'
  text: string
}

export default function DoubtBox({ solution }: { solution: StructuredSolution }) {
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const send = async () => {
    const text = input.trim()
    if (!text || busy) return
    const history: ChatMsg[] = [...msgs, { role: 'user' as const, text }].slice(-8)
    setMsgs(history)
    setInput('')
    setBusy(true)
    setError(null)
    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'
      const response = await fetch(`${apiUrl}/doubt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history.map((m) => ({
            role: m.role === 'ai' ? 'assistant' : 'user',
            content: m.text.slice(0, 1000),
          })),
          context: {
            question: solution.question,
            finalAnswer: solution.finalAnswer,
            steps: solution.steps.map((s) => `${s.stepNumber}. ${s.expression} — ${s.explanation}`),
          },
        }),
      })
      const payload = (await response.json()) as { reply?: string; message?: string }
      if (!response.ok || !payload.reply) {
        throw new Error(payload.message ?? 'Jawab nahi aaya.')
      }
      setMsgs((prev) => [...prev, { role: 'ai', text: payload.reply as string }])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kuch gadbad hui.')
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <div className="doubt-box">
        <button className="outline-button doubt-toggle" type="button" onClick={() => setOpen(true)}>
          <HelpCircle size={16} /> Ask a doubt — kuch samajh na aaya?
        </button>
      </div>
    )
  }

  return (
    <div className="doubt-box">
      <div className="doubt-thread" aria-live="polite">
        {msgs.length === 0 && (
          <div className="doubt-msg ai">Poochho! Jaise: "step 2 me ye value kahan se aayi?"</div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'doubt-msg user' : 'doubt-msg ai'}>
            {m.text}
          </div>
        ))}
        {busy && <div className="doubt-msg ai typing">Soch raha hun...</div>}
      </div>
      {error && <div className="upload-error">{error}</div>}
      <div className="doubt-input-row">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Apna doubt likho..."
          maxLength={500}
          onKeyDown={(event) => {
            if (event.key === 'Enter') send()
          }}
        />
        <VoiceButton onText={(text) => setInput((prev) => (prev ? `${prev} ${text}` : text))} />
        <button className="doubt-send" type="button" onClick={send} disabled={busy} aria-label="Send doubt">
          <Send size={17} />
        </button>
      </div>
    </div>
  )
}
