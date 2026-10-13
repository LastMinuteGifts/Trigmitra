import { z } from 'zod'

const identitySchema = z.object({
  name: z.string(),
  formula: z.string(),
  reason: z.string(),
})

const diagramSpecSchema = z.object({
  shape: z.enum(['rightTriangle', 'triangle', 'circle', 'rectangle', 'angle', 'bpt', 'graph']),
  // rightTriangle: [leg1, leg2, hyp] | triangle: [AB, BC, CA] | circle: [radius] | rectangle: [length, width] | angle: [degrees] | bpt: [AD, DB, AE, EC?] | graph: ["x1,y1", "x2,y2", ...] points
  values: z.array(z.string().max(24)).min(1).max(10),
  caption: z.string().max(200).nullish().transform((value) => value ?? undefined),
})

const diagramSchema = z.object({
  svg: z.string().min(10).max(8000),
  caption: z.string().max(200).nullish().transform((value) => value ?? undefined),
})

const stepSchema = z.object({
  stepNumber: z.number().int().positive(),
  expression: z.string(),
  explanation: z.string(),
  // AI aksar identityUsed: null bhejta hai — use undefined me normalize karo.
  identityUsed: identitySchema.nullish().transform((value) => value ?? undefined),
  // Jis step me figure zaroori ho, wahan diagram. Koi limit nahi.
  diagram: diagramSchema.nullish().transform((value) => value ?? undefined),
  // Perfect figure ke liye shape+values (engine khud banayega). Raw svg se behtar.
  diagramSpec: diagramSpecSchema.nullish().transform((value) => value ?? undefined),
})

export const structuredSolutionSchema = z.object({
  question: z.string(),
  topic: z.string(),
  questionType: z.string(),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']),
  given: z.array(z.string()),
  required: z.string(),
  // Sirf word problems me: pehle kahani Hinglish me samjhao. Warna missing.
  wordProblemMeaning: z.string().max(600).nullish().transform((value) => value ?? undefined),
  steps: z.array(stepSchema),
  identitiesUsed: z.array(identitySchema),
  finalAnswer: z.string(),
  // Figure zaroori ho tabhi AI bhejega, warna field missing rahega.
  diagram: diagramSchema.nullish().transform((value) => value ?? undefined),
  diagramSpec: diagramSpecSchema.nullish().transform((value) => value ?? undefined),
  examTip: z.string().nullish().transform((value) => value ?? undefined),
  practiceQuestion: z.string().nullish().transform((value) => value ?? undefined),
})

export type StructuredSolution = z.infer<typeof structuredSolutionSchema>
