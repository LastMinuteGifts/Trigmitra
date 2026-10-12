export type Difficulty = 'Easy' | 'Medium' | 'Hard'

export interface IdentityReference {
  name: string
  formula: string
  reason: string
}

export interface SolutionStep {
  stepNumber: number
  expression: string
  explanation: string
  identityUsed?: IdentityReference
}

export interface DiagramReference {
  svg: string
  caption?: string
}

export interface StructuredSolution {
  question: string
  topic: string
  questionType: string
  difficulty: Difficulty
  given: string[]
  required: string
  steps: SolutionStep[]
  identitiesUsed: IdentityReference[]
  finalAnswer: string
  diagram?: DiagramReference
  examTip?: string
  practiceQuestion?: string
}
