import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CLASS_LEVELS, classFromUser, classLabel, parseClassLevel } from '../src/utils/studentClass'

test('parseClassLevel valid numbers leta hai', () => {
  assert.equal(parseClassLevel(7), 7)
  assert.equal(parseClassLevel('10'), 10)
  assert.equal(parseClassLevel(1), 1)
})

test('parseClassLevel invalid values par null deta hai', () => {
  assert.equal(parseClassLevel(0), null)
  assert.equal(parseClassLevel(11), null)
  assert.equal(parseClassLevel(4.5), null)
  assert.equal(parseClassLevel('abc'), null)
  assert.equal(parseClassLevel(''), null)
  assert.equal(parseClassLevel(null), null)
  assert.equal(parseClassLevel(undefined), null)
  assert.equal(parseClassLevel({}), null)
})

test('classFromUser metadata se class nikaalta hai', () => {
  assert.equal(classFromUser({ user_metadata: { class_level: 8 } }), 8)
  assert.equal(classFromUser({ user_metadata: { class_level: '9' } }), 9)
  assert.equal(classFromUser({ user_metadata: {} }), null)
  assert.equal(classFromUser({ user_metadata: null }), null)
  assert.equal(classFromUser(null), null)
  assert.equal(classFromUser(undefined), null)
})

test('classLabel readable label deta hai', () => {
  assert.equal(classLabel(6), 'Class 6')
  assert.equal(classLabel(null), 'Class set nahi hai')
})

test('CLASS_LEVELS 1 se 10 tak hai', () => {
  assert.deepEqual([...CLASS_LEVELS], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
})
