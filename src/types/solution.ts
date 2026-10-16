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
  diagram?: DiagramReference
  diagramSpec?: DiagramSpec
}

export interface DiagramReference {
  svg: string
  caption?: string
}

export type DiagramShape = 'rightTriangle' | 'triangle' | 'circle' | 'rectangle' | 'angle' | 'bpt' | 'graph' | 'circleFigure'

export interface DiagramSpec {
  shape: DiagramShape
  values: string[]
  caption?: string
  details?: {
    points: string[]
    chords?: [string, string][]
    diameter?: [string, string]
    tangents?: string[]
    angles?: Array<{ at: string; label: string }>
  }
}

export interface StructuredSolution {
  question: string
  topic: string
  questionType: string
  difficulty: Difficulty
  given: string[]
  required: string
  wordProblemMeaning?: string
  steps: SolutionStep[]
  identitiesUsed: IdentityReference[]
  finalAnswer: string
  diagram?: DiagramReference
  diagramSpec?: DiagramSpec
  examTip?: string
  practiceQuestion?: string
}
