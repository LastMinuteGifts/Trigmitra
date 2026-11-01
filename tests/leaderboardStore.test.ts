import assert from 'node:assert/strict'
import { test } from 'node:test'
import { normalizeLeaderEntry } from '../server/leaderboardStore'

test('leaderboard entry clean aur normalize ho jaati hai', () => {
  const entry = normalizeLeaderEntry({
    name: '  Asad Khan bahut lamba naam  ',
    score: 8,
    total: 10,
    day: '2026-11-01',
    mode: 'topics',
    classNum: 10,
  })
  assert.ok(entry)
  assert.equal(entry.score, 8)
  assert.equal(entry.total, 10)
  assert.equal(entry.classNum, 10)
  assert.equal(entry.day, '2026-11-01')
  assert.ok(entry.name.length <= 18)
})

test('junk total (bogus/test row) reject ho jaata hai', () => {
  assert.equal(normalizeLeaderEntry({ name: 'TestCheck', score: 0, total: 200 }), null)
  assert.equal(normalizeLeaderEntry({ name: 'X', score: 0, total: 0 }), null)
})

test('score total se zyada ya negative ho to entry reject', () => {
  assert.equal(normalizeLeaderEntry({ name: 'X', score: 11, total: 10 }), null)
  assert.equal(normalizeLeaderEntry({ name: 'X', score: -1, total: 10 }), null)
  assert.equal(normalizeLeaderEntry({ name: 'X', score: 5, total: Number.NaN }), null)
})

test('galat class chup-chaap null ho jaati hai, entry nahi girti', () => {
  const entry = normalizeLeaderEntry({ name: 'X', score: 5, total: 10, classNum: 42 })
  assert.ok(entry)
  assert.equal(entry.classNum, null)
})

test('khaali naam par Guest aur galat day par aaj ki date', () => {
  const entry = normalizeLeaderEntry({ name: '   ', score: 5, total: 10, day: 'kal' })
  assert.ok(entry)
  assert.equal(entry.name, 'Guest')
  assert.match(entry.day, /^\d{4}-\d{2}-\d{2}$/)
})
