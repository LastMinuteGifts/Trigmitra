import { useState } from 'react'
import { Copy, Printer, Share2 } from 'lucide-react'
import type { StructuredSolution } from '../types/solution'
import { copySolution, printSolution, shareSolution } from '../utils/solutionShare'

/** Solution panel ke actions: Share, Copy aur Save-as-PDF. */
export default function SolutionActions({ solution }: { solution: StructuredSolution }) {
  const [note, setNote] = useState<string | null>(null)

  const flash = (message: string) => {
    setNote(message)
    window.setTimeout(() => setNote(null), 2200)
  }

  return (
    <div className="solution-actions">
      <button
        type="button"
        className="solution-action"
        onClick={async () => {
          const result = await shareSolution(solution)
          if (result === 'whatsapp') flash('WhatsApp khol diya')
          if (result === 'failed') flash('Share nahi ho paya')
        }}
      >
        <Share2 size={15} /> Share
      </button>
      <button
        type="button"
        className="solution-action"
        onClick={async () => {
          flash((await copySolution(solution)) ? 'Copy ho gaya!' : 'Copy nahi hua')
        }}
      >
        <Copy size={15} /> Copy
      </button>
      <button type="button" className="solution-action" onClick={printSolution}>
        <Printer size={15} /> PDF
      </button>
      {note && <span className="solution-action-note">{note}</span>}
    </div>
  )
}
