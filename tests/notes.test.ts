import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formulaCategories } from '../src/data/formulas'
import { ncertChapters } from '../src/data/ncertChapters'
import { categoryNotes, formulasForChapter, resolveChapterNote } from '../src/data/notes'

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
