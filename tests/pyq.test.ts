import assert from 'node:assert/strict'
import { test } from 'node:test'
import { pyqQuestions } from '../src/data/pyqQuestions'
import { formulaCategories } from '../src/data/formulas'

const topics = new Set(formulaCategories.map((category) => category.name))

test('PYQ bank me kaafi sawaal hain aur ids unique hain', () => {
  assert.ok(pyqQuestions.length >= 40, `sirf ${pyqQuestions.length} PYQ hain`)
  const ids = pyqQuestions.map((question) => question.id)
  assert.equal(new Set(ids).size, ids.length, 'duplicate PYQ id')
})

test('har PYQ ka valid type, topic aur difficulty hai', () => {
  for (const question of pyqQuestions) {
    assert.ok(question.type === 'mcq' || question.type === 'subjective', `type galat: ${question.id}`)
    assert.ok(question.topic && topics.has(question.topic), `topic galat: ${question.id} → ${question.topic}`)
    assert.ok(['Easy', 'Medium', 'Hard'].includes(question.difficulty ?? ''), `difficulty galat: ${question.id}`)
    assert.ok(question.prompt.length > 5, `prompt chhota: ${question.id}`)
    assert.ok((question.hint ?? '').length > 3, `hint missing: ${question.id}`)
    assert.ok(question.explain && question.explain.steps.length > 0, `explain missing: ${question.id}`)
    assert.ok(question.classNum && question.classNum >= 1 && question.classNum <= 10, `class galat: ${question.id}`)
  }
})

test('MCQ PYQ me 4 distinct options aur valid answer index hote hain', () => {
  for (const question of pyqQuestions.filter((item) => item.type === 'mcq')) {
    assert.equal(question.options.length, 4, `options 4 nahi: ${question.id}`)
    assert.equal(new Set(question.options).size, 4, `duplicate option: ${question.id}`)
    assert.ok(question.answer >= 0 && question.answer < 4, `answer index galat: ${question.id}`)
    assert.equal(question.options.length, 4)
  }
})

test('subjective PYQ me model answer aur keywords hote hain', () => {
  const subjective = pyqQuestions.filter((item) => item.type === 'subjective')
  assert.ok(subjective.length >= 5, 'kam se kam 5 subjective PYQ chahiye')
  for (const question of subjective) {
    assert.equal(question.options.length, 0, `subjective me options nahi hone chahiye: ${question.id}`)
    assert.equal(question.answer, -1, `subjective ka answer -1 hona chahiye: ${question.id}`)
    assert.ok((question.modelAnswer ?? '').length > 20, `model answer chhota: ${question.id}`)
    assert.ok((question.keywords ?? []).length >= 3, `keywords kam: ${question.id}`)
  }
})

test('har subject ke PYQ hain', () => {
  const subjects = new Set(pyqQuestions.map((question) => question.sub.split(' · ')[0]))
  assert.ok(subjects.has('Maths'))
  assert.ok(subjects.has('Physics'))
  assert.ok(subjects.has('Chemistry'))
})
