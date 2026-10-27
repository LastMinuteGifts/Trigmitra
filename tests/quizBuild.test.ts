import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildPyqQuiz, buildQuiz, buildSprintQuiz } from '../src/utils/quizBuild'

test('buildQuiz mixed mode me MCQ aur subjective dono deta hai', () => {
  const quiz = buildQuiz(10, [], 'Mixed', 'mixed')
  assert.equal(quiz.length, 10)
  assert.ok(quiz.some((question) => question.type === 'mcq'), 'koi MCQ nahi')
  assert.ok(quiz.some((question) => question.type === 'subjective'), 'koi subjective nahi')
  assert.equal(new Set(quiz.map((question) => question.id)).size, quiz.length, 'duplicate ids')
})

test('buildQuiz subjective filter sirf subjective deta hai', () => {
  const quiz = buildQuiz(10, [], 'Mixed', 'subjective')
  assert.ok(quiz.length > 0)
  for (const question of quiz) {
    assert.equal(question.type, 'subjective')
    assert.equal(question.options.length, 0)
    assert.equal(question.answer, -1)
  }
})

test('buildQuiz difficulty filter lagata hai', () => {
  const quiz = buildQuiz(10, [], 'Easy', 'mcq')
  assert.ok(quiz.length > 0)
  for (const question of quiz) assert.equal(question.difficulty, 'Easy')
})

test('PYQ quiz sirf chune hue topic ke sawaal deta hai', () => {
  const quiz = buildPyqQuiz(10, ['Algebra'], 'Mixed', 'mcq')
  assert.ok(quiz.length >= 3)
  for (const question of quiz) {
    assert.equal(question.topic, 'Algebra')
    assert.equal(question.type, 'mcq')
  }
})

test('PYQ quiz subjective filter respect karta hai', () => {
  const quiz = buildPyqQuiz(10, [], 'Mixed', 'subjective')
  assert.ok(quiz.length > 0)
  for (const question of quiz) assert.equal(question.type, 'subjective')
})

test('PYQ quiz Hard difficulty par sirf Hard sawaal deta hai', () => {
  const quiz = buildPyqQuiz(5, [], 'Hard', 'mcq')
  assert.ok(quiz.length > 0, 'Hard MCQ pool khaali hai')
  for (const question of quiz) assert.equal(question.difficulty, 'Hard')
})

test('PYQ quiz class filter lagata hai jab enough sawaal hon', () => {
  const quiz = buildPyqQuiz(5, [], 'Mixed', 'mcq', 9)
  assert.ok(quiz.length > 0)
  for (const question of quiz) assert.equal(question.classNum, 9)
})

test('sprint quiz 40 MCQs deta hai', () => {
  const quiz = buildSprintQuiz()
  assert.equal(quiz.length, 40)
  for (const question of quiz) {
    assert.equal(question.type, 'mcq')
    assert.equal(question.options.length, 4)
  }
})
