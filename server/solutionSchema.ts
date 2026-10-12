import { z } from 'zod'

const identitySchema = z.object({
  name: z.string(),
  formula: z.string(),
  reason: z.string(),
})

const stepSchema = z.object({
  stepNumber: z.number().int().positive(),
  expression: z.string(),
  explanation: z.string(),
  // AI aksar identityUsed: null bhejta hai — use undefined me normalize karo.
  identityUsed: identitySchema.nullish().transform((value) => value ?? undefined),
})

const diagramSchema = z.object({
  svg: z.string().min(10).max(8000),
  caption: z.string().max(200).nullish().transform((value) => value ?? undefined),
})

export const structuredSolutionSchema = z.object({
  question: z.string(),
  topic: z.string(),
  questionType: z.string(),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']),
  given: z.array(z.string()),
  required: z.string(),
  steps: z.array(stepSchema),
  identitiesUsed: z.array(identitySchema),
  finalAnswer: z.string(),
  // Figure zaroori ho tabhi AI bhejega, warna field missing rahega.
  diagram: diagramSchema.nullish().transform((value) => value ?? undefined),
  examTip: z.string().nullish().transform((value) => value ?? undefined),
  practiceQuestion: z.string().nullish().transform((value) => value ?? undefined),
})

export type StructuredSolution = z.infer<typeof structuredSolutionSchema>
