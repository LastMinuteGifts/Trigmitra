import { z } from 'zod'

/**
 * AI ka subjective grading response. AI kabhi score ko 0-100 me bhej deta hai,
 * isliye use 0-1 me normalize karte hain.
 */
export const gradeResponseSchema = z.object({
  verdict: z.enum(['correct', 'partial', 'wrong']).optional(),
  score: z
    .coerce.number()
    .transform((value) => (value > 1 ? value / 100 : value))
    .pipe(z.number().min(0).max(1))
    .optional(),
  readable: z.boolean().optional(),
  summary: z.string().max(600).default(''),
  matched: z.array(z.string().max(120)).max(12).default([]),
  missing: z.array(z.string().max(120)).max(12).default([]),
  transcript: z.string().max(1500).optional(),
})

export type GradePayload = z.infer<typeof gradeResponseSchema>
