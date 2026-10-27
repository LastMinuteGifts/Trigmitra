import assert from 'node:assert/strict'
import { test } from 'node:test'
import { answerMatch, looksCorrect, normalizeAnswer, similarityLabel } from '../src/utils/answerCheck'

const model = 'x = (−b ± √(b² − 4ac)) / 2a. Discriminant D = b² − 4ac batata hai roots real hain ya nahi.'
const keywords = ['−b', '√', 'b² − 4ac', '2a', 'discriminant', 'real']

test('normalizeAnswer superscript aur symbols handle karta hai', () => {
  assert.equal(normalizeAnswer('sin²θ + cos²θ = 1'), 'sin2theta cos2theta 1')
  assert.equal(normalizeAnswer('  Hello,   WORLD!  '), 'hello world')
})

test('sahi formula wala jawab high match deta hai', () => {
  const score = answerMatch('x = (−b ± √(b² − 4ac)) / 2a, D = b² − 4ac se roots ka nature pata chalta hai', model, keywords)
  assert.ok(score >= 0.6, `score kam hai: ${score}`)
  assert.ok(looksCorrect(score))
})

test('bilkul galat jawab low match deta hai', () => {
  const score = answerMatch('mujhe nahi pata bhai', model, keywords)
  assert.ok(score < 0.6, `score zyada hai: ${score}`)
  assert.equal(looksCorrect(score), false)
})

test('khaali jawab ka score zero hota hai', () => {
  assert.equal(answerMatch('', model, keywords), 0)
  assert.equal(answerMatch('   ', model, []), 0)
})

test('keywords na ho to model answer se compare hota hai', () => {
  const score = answerMatch('area of circle is pi r square', 'Area of circle = πr²', [])
  assert.ok(score > 0, 'model answer match hona chahiye')
})

test('similarityLabel percentage dikhata hai', () => {
  assert.equal(similarityLabel(0.734), '73% match')
  assert.equal(similarityLabel(1), '100% match')
})
