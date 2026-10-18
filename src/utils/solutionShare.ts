import type { StructuredSolution } from '../types/solution'

const SHARE_URL = 'https://anknawab.unicalli.in/'

/** Solution ko plain text me badlo — share/copy ke liye. */
export function solutionToText(solution: StructuredSolution): string {
  const lines: string[] = []
  lines.push('ANKNAWAB — step-by-step solution')
  lines.push('')
  lines.push(`Q: ${solution.question}`)
  lines.push('')
  solution.steps.forEach((step) => {
    lines.push(`Step ${step.stepNumber}: ${step.expression}`)
    if (step.explanation) lines.push(`   ${step.explanation}`)
  })
  lines.push('')
  lines.push(`Final answer: ${solution.finalAnswer}`)
  if (solution.examTip) lines.push(`Exam tip: ${solution.examTip}`)
  lines.push('')
  lines.push(`Solved with ANKNAWAB — ${SHARE_URL}`)
  return lines.join('\n')
}

type ShareNavigator = Navigator & {
  share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>
}

/**
 * Native share sheet use karo; available na ho to WhatsApp pe bhej do.
 * Return value batata hai kya hua (UI feedback ke liye).
 */
export async function shareSolution(
  solution: StructuredSolution,
): Promise<'shared' | 'whatsapp' | 'failed'> {
  const text = solutionToText(solution)
  const nav = typeof navigator !== 'undefined' ? (navigator as ShareNavigator) : null
  if (nav && typeof nav.share === 'function') {
    try {
      await nav.share({ title: 'ANKNAWAB solution', text })
      return 'shared'
    } catch (error) {
      // User ne cancel kiya to chup-chaap ruk jao.
      if (error instanceof DOMException && error.name === 'AbortError') return 'shared'
    }
  }
  try {
    const win = window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
    return win ? 'whatsapp' : 'failed'
  } catch {
    return 'failed'
  }
}

/** Clipboard me copy karo (fallback ke saath). */
export async function copySolution(solution: StructuredSolution): Promise<boolean> {
  const text = solutionToText(solution)
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const area = document.createElement('textarea')
      area.value = text
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(area)
      return ok
    } catch {
      return false
    }
  }
}

/** Browser ke print dialog se "Save as PDF". */
export function printSolution(): void {
  window.print()
}
