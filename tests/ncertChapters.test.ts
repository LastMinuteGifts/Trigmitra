import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formulaCategories } from '../src/data/formulas'
import { ncertChapters } from '../src/data/ncertChapters'

const validCats = new Set(formulaCategories.map((category) => category.name))
const validSubjects = new Set(['Maths', 'Physics', 'Chemistry'])

test('har chapter ek real formula-category se juda ho', () => {
  const problems: string[] = []
  for (const [cls, chapters] of Object.entries(ncertChapters)) {
    for (const chapter of chapters) {
      if (!validCats.has(chapter.cat)) problems.push(`class ${cls} / ${chapter.name} -> ${chapter.cat}`)
      if (!validSubjects.has(chapter.subject)) {
        problems.push(`class ${cls} / ${chapter.name} -> subject ${chapter.subject}`)
      }
    }
  }
  assert.deepEqual(problems, [], 'bad chapter mappings mile')
})

test('ek class ke andar chapter names unique ho', () => {
  for (const [cls, chapters] of Object.entries(ncertChapters)) {
    const names = chapters.map((chapter) => chapter.name)
    assert.equal(new Set(names).size, names.length, `class ${cls} me duplicate chapter name`)
  }
})
