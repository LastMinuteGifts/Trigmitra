import assert from 'node:assert/strict'
import { test } from 'node:test'
import { QUIZ_COUNTS, buildQuiz } from '../src/components/QuizModal'

test('buildQuiz maanga hua number of questions deta hai', () => {
  assert.equal(buildQuiz(10).length, 10)
  assert.equal(buildQuiz(30).length, 30)
})

test('har question me 4 distinct options aur valid answer index ho', () => {
  for (const question of buildQuiz(30)) {
    assert.equal(question.options.length, 4, `options 4 nahi hain: ${question.prompt}`)
    assert.equal(new Set(question.options).size, 4, `duplicate option: ${question.prompt}`)
    assert.ok(question.answer >= 0 && question.answer < question.options.length, 'answer index galat')
    assert.ok(question.prompt.length > 0)
  }
})

test('category filter sirf chuni hui category ke questions deta hai', () => {
  const quiz = buildQuiz(5, ['Trigonometry'])
  assert.ok(quiz.length > 0)
  for (const question of quiz) {
    assert.ok(question.sub.startsWith('Trigonometry'), `filter fail: ${question.sub}`)
  }
})

test('quiz counts sorted aur positive hon', () => {
  const sorted = [...QUIZ_COUNTS].sort((a, b) => a - b)
  assert.deepEqual([...QUIZ_COUNTS], sorted)
  assert.ok(QUIZ_COUNTS.every((count) => count > 0 && count % 5 === 0))
})
