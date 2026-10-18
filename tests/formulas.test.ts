import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formulaCategories } from '../src/data/formulas'

test('har category ka naam aur kam se kam ek formula ho', () => {
  assert.ok(formulaCategories.length >= 15, 'formula categories kam lag rahi hain')
  for (const category of formulaCategories) {
    assert.ok(category.name.trim().length > 0, 'category name missing')
    assert.ok(category.formulas.length > 0, `${category.name} me koi formula nahi`)
  }
})

test('har formula entry complete ho', () => {
  for (const category of formulaCategories) {
    for (const entry of category.formulas) {
      assert.ok(entry.formula.trim().length > 0, `${category.name} me blank formula`)
      assert.ok(entry.label.trim().length > 0, `${category.name} me blank label`)
    }
  }
})

test('category names unique ho', () => {
  const names = formulaCategories.map((category) => category.name)
  assert.equal(new Set(names).size, names.length, 'duplicate category name')
})
