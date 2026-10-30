import assert from 'node:assert/strict'
import { test } from 'node:test'
import { answerMatch, checkSubjectiveAnswer, looksCorrect, normalizeAnswer, similarityLabel } from '../src/utils/answerCheck'

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

test('number ke alag format barabar mane jaate hain', () => {
  const check = checkSubjectiveAnswer('answer 0.75 hai', 'answer 3/4 hai', ['3/4'])
  assert.equal(check.verdict, 'correct')
  assert.deepEqual(check.matched, ['3/4'])

  const percent = checkSubjectiveAnswer('75%', '3/4', ['3/4'])
  assert.equal(percent.verdict, 'correct')
})

test('synonym (prove/siddh, area/kshetrafal) match ho jaata hai', () => {
  const check = checkSubjectiveAnswer('siddh karo ki area barabar hai', 'prove that area is equal', ['prove', 'area', 'equal'])
  assert.equal(check.matched.length, 3)
  assert.equal(check.verdict, 'correct')
})

test('adhoora jawab partial verdict deta hai aur missing points batata hai', () => {
  const check = checkSubjectiveAnswer('x = -b/2a aur discriminant', model, keywords)
  assert.equal(check.verdict, 'partial')
  assert.equal(check.correct, false)
  assert.ok(check.missing.length > 0, 'missing points hone chahiye')
  assert.ok(check.summary.length > 0)
})

test('khaali jawab ka auto verdict wrong hota hai', () => {
  const check = checkSubjectiveAnswer('', model, keywords)
  assert.equal(check.correct, false)
  assert.equal(check.verdict, 'wrong')
  assert.equal(check.score, 0)
})

test('jude hue math tokens match hote hain (sin²θ me sin)', () => {
  const check = checkSubjectiveAnswer('sin²θ + cos²θ = 1', 'sin²θ + cos²θ = 1', ['sin', 'cos'])
  assert.equal(check.verdict, 'correct')
  assert.deepEqual(check.matched, ['sin', 'cos'])
})

test('model answer ke formula sentence se match hota hai', () => {
  const check = checkSubjectiveAnswer('πr²', 'Area = πr². Area of circle wale sawaal me use hota hai.', ['area'])
  assert.equal(check.verdict, 'correct')
})

test('b² − 4ac wale jawab me 4ac keyword match hota hai', () => {
  const check = checkSubjectiveAnswer('x = (-b ± √(b² - 4ac)) / 2a', 'x = (−b ± √(b² − 4ac)) / 2a', ['4ac', '2a'])
  assert.equal(check.verdict, 'correct')
})
