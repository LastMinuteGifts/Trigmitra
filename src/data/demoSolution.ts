import type { StructuredSolution } from '../types/solution'

/**
 * Client-side offline fallback — static FTP hosting (public_html)
 * par jab koi backend reachable nahi hota, tab bhi Solve kaam kare.
 */
export const demoSolution: StructuredSolution = {
  question: 'If tan A = 3/4, find the value of sin A + cos A.',
  topic: 'Trigonometry',
  questionType: 'Ratio Finding',
  difficulty: 'Easy',
  given: ['tan A = 3/4', 'A is an acute angle'],
  required: 'sin A + cos A ka maan',
  steps: [
    {
      stepNumber: 1,
      expression: 'tan A = opposite / adjacent = 3/4',
      explanation: 'tan ka matlab hota hai opposite side / adjacent side. Isliye hum 3 aur 4 ko right triangle ki do sides maan lete hain.',
    },
    {
      stepNumber: 2,
      expression: 'hypotenuse = √(3² + 4²) = √(9 + 16) = √25 = 5',
      explanation: 'Pythagoras theorem lagao: hypotenuse² = opposite² + adjacent². Isse hypotenuse 5 mil gaya.',
      identityUsed: {
        name: 'Pythagoras theorem',
        formula: 'hypotenuse² = opposite² + adjacent²',
        reason: 'Right triangle ki teesri side nikalne ke liye.',
      },
    },
    {
      stepNumber: 3,
      expression: 'sin A = opposite / hypotenuse = 3/5',
      explanation: 'sin ka formula hai opposite / hypotenuse, to sin A = 3/5 hoga.',
      identityUsed: {
        name: 'Sine ratio',
        formula: 'sin A = opposite / hypotenuse',
        reason: 'sin A ki value nikalne ke liye.',
      },
    },
    {
      stepNumber: 4,
      expression: 'cos A = adjacent / hypotenuse = 4/5',
      explanation: 'cos ka formula hai adjacent / hypotenuse, to cos A = 4/5 hoga.',
      identityUsed: {
        name: 'Cosine ratio',
        formula: 'cos A = adjacent / hypotenuse',
        reason: 'cos A ki value nikalne ke liye.',
      },
    },
    {
      stepNumber: 5,
      expression: 'sin A + cos A = 3/5 + 4/5 = 7/5',
      explanation: 'Dono values ko jod do. Denominator same hai, isliye seedha numerator jud jayega.',
    },
  ],
  identitiesUsed: [
    { name: 'Pythagoras theorem', formula: 'hypotenuse² = opposite² + adjacent²', reason: 'Right triangle ki missing side ke liye.' },
    { name: 'Sine ratio', formula: 'sin A = opposite / hypotenuse', reason: 'sin A nikalne ke liye.' },
    { name: 'Cosine ratio', formula: 'cos A = adjacent / hypotenuse', reason: 'cos A nikalne ke liye.' },
  ],
  finalAnswer: '7/5',
  examTip: 'Triangle bana kar sides 3, 4, 5 likho, phir sin aur cos ke formula line-by-line likho.',
  practiceQuestion: 'If tan A = 5/12 ho, to sin A − cos A ka maan nikalo.',
}
