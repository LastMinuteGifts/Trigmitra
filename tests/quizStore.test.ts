import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { LeaderEntry } from '../src/utils/quizStore'
import { filterLeaderboard, leaderboardScope } from '../src/utils/quizStore'

function entry(name: string, score: number, classNum?: number | null): LeaderEntry {
  return {
    name,
    score,
    total: 10,
    day: '2026-10-27',
    mode: 'topics',
    ...(classNum === undefined ? {} : { classNum }),
  }
}

const board: LeaderEntry[] = [
  entry('Aarav', 9, 8),
  entry('Bilal', 7, 8),
  entry('Chand', 10, 9),
  entry('Dua', 5, 9),
  entry('Emaan', 6, null),
  entry('Faraz', 8),
]

test('filterLeaderboard sirf usi class ki entries deta hai', () => {
  assert.deepEqual(
    filterLeaderboard(board, 8).map((e) => e.name),
    ['Aarav', 'Bilal'],
  )
  assert.deepEqual(
    filterLeaderboard(board, 9).map((e) => e.name),
    ['Chand', 'Dua'],
  )
})

test('filterLeaderboard null par saari entries (All classes) deta hai', () => {
  assert.deepEqual(
    filterLeaderboard(board, null).map((e) => e.name),
    ['Aarav', 'Bilal', 'Chand', 'Dua', 'Emaan', 'Faraz'],
  )
})

test('filterLeaderboard missing class wali entry kisi class me nahi aati', () => {
  assert.equal(filterLeaderboard(board, 8).includes(board[5]), false)
  assert.equal(filterLeaderboard(board, 7).length, 0)
})

test('empty leaderboard par filter khali list deta hai', () => {
  assert.deepEqual(filterLeaderboard([], 6), [])
  assert.deepEqual(filterLeaderboard([], null), [])
})

test('leaderboardScope heading label deta hai', () => {
  assert.equal(leaderboardScope(9), 'Class 9')
  assert.equal(leaderboardScope(1), 'Class 1')
  assert.equal(leaderboardScope(null), 'All classes')
})
