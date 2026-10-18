import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseQuizPayload } from '../src/utils/quizPayload'

const good = {
  prompt: 'sin²θ + cos²θ ka maan kya hai?',
  sub: 'Trigonometry',
  options: ['1', '0', '2', '1/2'],
  answer: 0,
  explain: { q: 'Identity lagao', steps: ['sin²θ + cos²θ = 1'] },
}

test('valid questions pass through aur explain normalize ho', () => {
  const out = parseQuizPayload([good], 10)
  assert.equal(out.length, 1)
  assert.deepEqual(out[0].options, ['1', '0', '2', '1/2'])
  assert.equal(out[0].answer, 0)
  assert.equal(out[0].sub, 'Trigonometry')
  assert.deepEqual(out[0].explain, { q: 'Identity lagao', steps: ['sin²θ + cos²θ = 1'] })
})

test('duplicate options wala question drop ho jata hai', () => {
  const bad = { ...good, options: ['1', '1', '2', '3'] }
  assert.deepEqual(parseQuizPayload([bad], 10), [])
})

test('galat answer index wala question drop ho jata hai', () => {
  assert.deepEqual(parseQuizPayload([{ ...good, answer: 7 }], 10), [])
  assert.deepEqual(parseQuizPayload([{ ...good, answer: -1 }], 10), [])
})

test('missing ya galat fields wale questions skip hote hain', () => {
  const payload = [
    null,
    'nope',
    { prompt: '', options: ['a', 'b', 'c', 'd'], answer: 0 },
    { prompt: 'ok?', options: ['a', 'b', 'c'], answer: 0 },
    good,
  ]
  const out = parseQuizPayload(payload, 10)
  assert.equal(out.length, 1)
  assert.equal(out[0].prompt, good.prompt)
})

test('explain halka-phulka ho to null ban jata hai', () => {
  const out = parseQuizPayload([{ ...good, explain: { q: '', steps: [] } }], 10)
  assert.equal(out.length, 1)
  assert.equal(out[0].explain, null)
})

test('count ki respect karta hai aur non-array par khaali deta hai', () => {
  const many = Array.from({ length: 12 }, (_, i) => ({ ...good, prompt: `Q${i}` }))
  assert.equal(parseQuizPayload(many, 5).length, 5)
  assert.deepEqual(parseQuizPayload('not-an-array', 5), [])
})
