import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formulaCategories } from '../src/data/formulas'
import { ncertChapters } from '../src/data/ncertChapters'
import { categoryNotes, formulasForChapter, resolveChapterNote } from '../src/data/notes'
import { mergeNote } from '../src/utils/notesApi'

test('har formula-category ke liye notes hain', () => {
  for (const category of formulaCategories) {
    assert.ok(categoryNotes[category.name], `${category.name} ke notes missing hain`)
  }
})

test('har chapter ka summary aur key points mile', () => {
  for (const chapters of Object.values(ncertChapters)) {
    for (const chapter of chapters) {
      const note = resolveChapterNote(chapter)
      assert.ok(note.summary.trim().length > 0, `${chapter.name} ka summary khaali hai`)
      assert.ok(note.points.length > 0, `${chapter.name} ke key points khaali hain`)
    }
  }
})

test('har chapter ki category me formulas hon', () => {
  for (const chapters of Object.values(ncertChapters)) {
    for (const chapter of chapters) {
      assert.ok(
        formulasForChapter(chapter.cat).length > 0,
        `${chapter.name} (${chapter.cat}) ke formulas nahi mile`,
      )
    }
  }
})

test('teacher override base note ko replace karta hai', () => {
  const base = { summary: 'base summary', points: ['a', 'b'] }
  assert.deepEqual(mergeNote(base, { summary: 'custom summary', points: ['x'] }), {
    summary: 'custom summary',
    points: ['x'],
  })
})

test('override khaali ho to base note hi rehta hai', () => {
  const base = { summary: 'base summary', points: ['a'] }
  assert.deepEqual(mergeNote(base, null), base)
  assert.deepEqual(mergeNote(base, { summary: '   ', points: [] }), base)
})
