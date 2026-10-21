/** Teacher panel se save kiye gaye notes — public chapter page inhe default notes ke upar merge karta hai. */

export interface NoteOverrideDTO {
  class: number
  chapter: string
  summary: string
  points: string[]
  updatedAt: string
  updatedBy: string
}

export interface NoteOverrideContent {
  summary: string
  points: string[]
}

export async function fetchNoteOverrides(
  classNum: number,
  signal?: AbortSignal,
): Promise<Record<string, NoteOverrideContent>> {
  const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'
  const response = await fetch(`${apiBase}/notes?class=${classNum}`, { signal })
  if (!response.ok) return {}
  const payload = (await response.json()) as { notes?: NoteOverrideDTO[] }
  const map: Record<string, NoteOverrideContent> = {}
  for (const note of payload.notes ?? []) {
    map[note.chapter] = { summary: note.summary, points: note.points }
  }
  return map
}

/** Base note + teacher override ko mila kar final content. */
export function mergeNote(
  base: { summary: string; points: string[] },
  override?: NoteOverrideContent | null,
): { summary: string; points: string[] } {
  const summary = override?.summary?.trim() ? override.summary : base.summary
  const points = override?.points?.length ? override.points : base.points
  return { summary, points }
}
