import { z } from 'zod'

const explainSchema = z.object({
  q: z.string().max(400),
  steps: z.array(z.string().max(300)).min(1).max(8),
})

/** AI se aane wala ek MCQ. `answer` options array ka index hai. */
export const quizQuestionSchema = z.object({
  prompt: z.string().min(3).max(500),
  sub: z.string().max(120).nullish().transform((value) => value ?? ''),
  options: z.array(z.string().min(1).max(200)).length(4),
  answer: z.number().int().min(0).max(3),
  explain: explainSchema.nullish().transform((value) => value ?? null),
})

export const quizResponseSchema = z.object({
  questions: z.array(quizQuestionSchema).min(1).max(50),
})

export type QuizQuestionPayload = z.infer<typeof quizQuestionSchema>
