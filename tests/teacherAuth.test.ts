import assert from 'node:assert/strict'
import { test } from 'node:test'
import crypto from 'node:crypto'
import {
  createTeacherToken,
  hashPassword,
  verifyPassword,
  verifyTeacherToken,
} from '../server/teachers'

process.env.ADMIN_SECRET = 'test-session-secret'

test('teacher password hash verify hota hai, galat password reject hota hai', () => {
  const hash = hashPassword('maths-teacher-123')
  assert.match(hash, /^scrypt\$[0-9a-f]+\$[0-9a-f]+$/)
  assert.equal(verifyPassword('maths-teacher-123', hash), true)
  assert.equal(verifyPassword('wrong-password', hash), false)
  assert.notEqual(hash, hashPassword('maths-teacher-123'))
})

test('teacher session token round-trip aur tamper-proof hai', () => {
  const token = createTeacherToken({ email: 'teacher@school.com', name: 'Rakesh Sir' })
  assert.deepEqual(verifyTeacherToken(token), { email: 'teacher@school.com', name: 'Rakesh Sir' })

  const [payload, signature] = token.split('.')
  const tampered = `${payload}.${signature.slice(0, -2)}aa`
  assert.equal(verifyTeacherToken(tampered), null)
  assert.equal(verifyTeacherToken('not-a-token'), null)
})

test('expired teacher token reject hota hai', () => {
  const payload = Buffer.from(
    JSON.stringify({ email: 'teacher@school.com', name: 'Rakesh Sir', exp: Date.now() - 1000 }),
  ).toString('base64url')
  const signature = crypto.createHmac('sha256', 'test-session-secret').update(payload).digest('base64url')
  assert.equal(verifyTeacherToken(`${payload}.${signature}`), null)
})
