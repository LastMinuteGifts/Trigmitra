import { z } from 'zod'

const identitySchema = z.object({
  name: z.string(),
  formula: z.string(),
  reason: z.string(),
})

const diagramSpecSchema = z.object({
  shape: z.enum(['rightTriangle', 'triangle', 'circle', 'rectangle', 'angle', 'bpt', 'graph', 'circleFigure']),
  // rightTriangle: [leg1, leg2, hyp] | triangle: [AB, BC, CA] | circle: [radius] | rectangle: [length, width] | angle: [degrees] | bpt: [AD, DB, AE, EC?] | graph: ["x1,y1", ...] | circleFigure: [radius?]
  values: z.array(z.string().max(24)).min(0).max(10),
  // Sirf circleFigure ke liye: points/chords/tangent/angle ki details.
  details: z.object({
    points: z.array(z.string().max(4)).min(2).max(6),
    chords: z.array(z.tuple([z.string().max(4), z.string().max(4)])).max(4).optional(),
    diameter: z.tuple([z.string().max(4), z.string().max(4)]).optional(),
    tangents: z.array(z.string().max(4)).max(3).optional(),
    angles: z.array(z.object({ at: z.string().max(4), label: z.string().max(10) })).max(4).optional(),
  }).nullish().transform((value) => value ?? undefined),
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
