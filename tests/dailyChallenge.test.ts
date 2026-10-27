import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildDailyChallenge, hashSeed, seededShuffle } from '../src/utils/dailyChallenge'
import { dailyPool } from '../src/utils/quizBuild'

test('hashSeed stable aur 32-bit hai', () => {
  assert.equal(hashSeed('2026-10-27'), hashSeed('2026-10-27'))
  assert.notEqual(hashSeed('2026-10-27'), hashSeed('2026-10-28'))
  assert.ok(hashSeed('x') >= 0 && hashSeed('x') <= 0xffffffff)
})

test('seededShuffle same seed par same order deta hai', () => {
  const items = [1, 2, 3, 4, 5, 6, 7, 8]
  assert.deepEqual(seededShuffle(items, 42), seededShuffle(items, 42))
  assert.equal(seededShuffle(items, 42).length, items.length)
})

test('ek din ka challenge deterministic hota hai', () => {
  const pool = dailyPool()
  const a = buildDailyChallenge('2026-10-27', pool).map((question) => question.id)
  const b = buildDailyChallenge('2026-10-27', pool).map((question) => question.id)
  assert.deepEqual(a, b)
  assert.equal(a.length, 5)
  assert.equal(new Set(a).size, 5, 'duplicate sawaal daily challenge me')
})

test('alag din ka challenge alag set deta hai', () => {
  const pool = dailyPool()
  const a = buildDailyChallenge('2026-10-27', pool).map((question) => question.id).join('|')
  const b = buildDailyChallenge('2026-10-28', pool).map((question) => question.id).join('|')
  assert.notEqual(a, b)
})

test('daily challenge me ek subjective sawaal hota hai', () => {
  const quiz = buildDailyChallenge('2026-10-27', dailyPool(), 5)
  assert.ok(quiz.some((question) => question.type === 'subjective'))
})

test('khaali pool par daily challenge khaali hota hai', () => {
  assert.deepEqual(buildDailyChallenge('2026-10-27', []), [])
})
