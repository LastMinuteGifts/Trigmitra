// Chapter revision notes. Har chapter apne category se ek summary + key points leta hai
// (src/data/formulas.ts ke formulaCategories se match), aur kuch chapters ke liye
// hand-written notes upar se add kiye gaye hain.

import { formulaCategories, type FormulaEntry } from './formulas'
import { ncertChapters, type NcertChapter } from './ncertChapters'

export interface CategoryNote {
  summary: string
  points: string[]
}

/** Har formula-category ka concept summary — jo bhi chapter us category me aata hai. */
export const categoryNotes: Record<string, CategoryNote> = {
  Trigonometry: {
    summary:
      'Triangles ke sides aur angles ke beech ka rishta. Sab se pehle teen Pythagorean identities yaad karo — baaki sab unse hi nikalta hai.',
    points: [
      'sin²θ + cos²θ = 1 sab identities ki jadd hai.',
      'tanθ = sinθ / cosθ aur secθ = 1 / cosθ — quotient/reciprocal forms.',
      '30°, 45°, 60° ke standard values table me yaad rakho.',
      'Given ratio se unknown side nikaalne ke liye right triangle bana lo.',
    ],
  },
  Algebra: {
    summary:
      'Letters ke roop me numbers — equations ko simplify karke unknown ki value nikaalna. Identities aur factorisation yahan ke main tools hain.',
    points: [
      '(a+b)² = a² + 2ab + b² jaise identities ratta nahi, expand karke samjho.',
      'Quadratic ax² + bx + c = 0 ke roots: x = (−b ± √(b²−4ac)) / 2a.',
      'Discriminant D = b² − 4ac batata hai roots real hain ya nahi.',
      'Do equation ho to substitution ya elimination se solve karo.',
    ],
  },
  Mensuration: {
    summary:
      '2D figures ka area/perimeter aur 3D solids ka volume/surface area. Formula pehchano, units sahi rakho.',
    points: [
      'Circle: area = πr², circumference = 2πr.',
      'Triangle: area = ½ × base × height (Heron se jab sides di ho).',
      'Cylinder: volume = πr²h, CSA = 2πrh.',
      'Units: area square me, volume cube me — answer me likhna mat bhoolo.',
    ],
  },
  Arithmetic: {
    summary:
      'Number crunching — percentage, ratio, profit-loss, simple/compound interest aur time-speed-work.',
    points: [
      'Percentage change = (new − old) / old × 100.',
      'SI = PRT/100, CI = P(1 + R/100)ⁿ − P.',
      'Speed = distance / time — units ek jaise karo (km/h vs m/s).',
      'Ratio a:b ko a/b ki tarah treat karke cross-multiply karo.',
    ],
  },
  Geometry: {
    summary:
      'Shapes ke angles, sides aur proofs. Theorems yaad rakho aur figure bana kar reason likho.',
    points: [
      'Triangle ke teeno angles ka sum = 180°.',
      'BPT: parallel line triangle ki do sides ko same ratio me divide karti hai.',
      'Circle: tangent radius ke perpendicular hota hai.',
      'Proof me har step ke saath reason (theorem/axiom) likho — marks wahi dete hain.',
    ],
  },
  Statistics: {
    summary:
      'Data ko organise karke usse ek summary nikaalna — mean, median, mode aur graph.',
    points: [
      'Mean = (sum of observations) / (number of observations).',
      'Median = middle value (data pehle sort karo).',
      'Mode = sab se zyada baar aane wali value.',
      'Grouped data me class-mark method use karo.',
    ],
  },
  'Number System': {
    summary:
      'Numbers ki duniya — rational, irrational, integers aur unke operations (HCF, LCM, powers).',
    points: [
      'HCF × LCM = dono numbers ka product.',
      'Rational = p/q form (q ≠ 0); irrational ko p/q me nahi likh sakte.',
      'aᵐ × aⁿ = aᵐ⁺ⁿ, aur a⁻ⁿ = 1/aⁿ.',
      'Divisibility rules se fast factors nikaal sakte ho.',
    ],
  },
  Motion: {
    summary:
      'Cheez kitni tez aur kaise chalti hai — distance, speed, velocity aur acceleration.',
    points: [
      'v = u + at, s = ut + ½at², v² = u² + 2as.',
      'Speed scalar hai, velocity vector — direction matter karta hai.',
      'Uniform motion = equal time me equal distance.',
      'Graph: slope = speed/acceleration, area = distance/displacement.',
    ],
  },
  'Force & Energy': {
    summary:
      'Kuchh karne ke liye force, aur usse paida hone wali energy/work. Newton ke laws yahan base hain.',
    points: [
      'F = ma (Newton ka doosra law).',
      'Work = force × displacement (same direction me).',
      'KE = ½mv², PE = mgh — energy conserve hoti hai.',
      'Momentum p = mv, impulse = F × t = change in momentum.',
    ],
  },
  Light: {
    summary:
      'Reflection aur refraction — mirror aur lens se image kaise banti hai.',
    points: [
      'Mirror formula: 1/v + 1/u = 1/f.',
      'Lens formula: 1/v − 1/u = 1/f.',
      'Magnification m = v/u (lens) ya −v/u (mirror).',
      'Sign convention: distances pole/optical centre se naapo.',
    ],
  },
  Electricity: {
    summary:
      'Current, voltage aur resistance ka rishta — Ohm ka law aur circuits.',
    points: [
      'V = IR (Ohm ka law).',
      'Series: R = R₁ + R₂; Parallel: 1/R = 1/R₁ + 1/R₂.',
      'Power P = VI = I²R = V²/R.',
      'Energy E = P × t (kWh = unit).',
    ],
  },
  'Mole Concept': {
    summary:
      'Chemistry ka "dozen" — mole se atoms/molecules count karte hain aur calculations karte hain.',
    points: [
      '1 mole = 6.022 × 10²³ particles (Avogadro number).',
      'Moles = mass / molar mass.',
      'Molar mass = formula ke saare atoms ke mass ka sum.',
      'Balanced equation ke coefficients mole ratio dete hain.',
    ],
  },
  Solutions: {
    summary:
      'Do ya zyada cheezon ka mix — concentration nikaalna aur solubility samajhna.',
    points: [
      'Mass % = (solute / solution) × 100.',
      'Molarity M = moles of solute / volume (L).',
      'Dilution: M₁V₁ = M₂V₂.',
      'Saturated = aur na ghule; unsaturated = aur ghal sakta hai.',
    ],
  },
  'Gas Laws': {
    summary:
      'Gases ke pressure, volume aur temperature ke beech ke relationships.',
    points: [
      'Boyle: PV = constant (T fixed).',
      'Charles: V/T = constant (P fixed).',
      'Ideal gas: PV = nRT.',
      'Temperature hamesha Kelvin me lo (K = °C + 273).',
    ],
  },
  'Atomic Structure': {
    summary:
      'Atom ke andar — electron, proton, neutron ka arrangement aur unki energy levels.',
    points: [
      'Proton number = atomic number (element ki pehchaan).',
      'Mass number = protons + neutrons.',
      'Electrons shells (K, L, M…) me 2n² rule se bharte hain.',
      'Valence electrons hi bonds aur reactions banate hain.',
    ],
  },
  'Chemical Reactions': {
    summary:
      'Reactions likhna aur balance karna — mass conserve hota hai, atoms count karo.',
    points: [
      'Reaction me har element ke atoms dono side barabar hone chahiye.',
      'Combination, decomposition, displacement, double-displacement main types hain.',
      'State symbols (s, l, g, aq) likhna achhi practice hai.',
      'Exothermic = heat nikalta hai, endothermic = heat leta hai.',
    ],
  },
}

export interface ChapterNote {
  summary?: string
  points?: string[]
}

/** Kuch important chapters ke liye extra, chapter-specific notes. */
export const chapterNotes: Record<string, ChapterNote> = {
  'Real Numbers': {
    summary: 'Rational aur irrational numbers, HCF/LCM aur Euclid ka division lemma.',
    points: [
      'Euclid lemma: a = bq + r, jahan 0 ≤ r < b — HCF nikaalne ke liye.',
      'HCF × LCM = a × b (do numbers ke liye).',
      'Irrational numbers ka decimal non-terminating, non-repeating hota hai.',
    ],
  },
  'Quadratic Equations': {
    summary: 'ax² + bx + c = 0 ko factorise ya formula se solve karna.',
    points: [
      'D = b² − 4ac: D > 0 do roots, D = 0 same roots, D < 0 koi real root nahi.',
      'Roots ka sum = −b/a, product = c/a.',
      'Factorise ke liye middle term ko tod ke split karo.',
    ],
  },
  'Pair of Linear Equations in Two Variables': {
    summary: 'Do variables wale do equations — graphically ya algebraically solve karo.',
    points: [
      'a₁/a₂ ≠ b₁/b₂ → ek unique solution (lines cross).',
      'a₁/a₂ = b₁/b₂ = c₁/c₂ → infinite solutions (same line).',
      'a₁/a₂ = b₁/b₂ ≠ c₁/c₂ → koi solution nahi (parallel lines).',
    ],
  },
  'Some Applications of Trigonometry': {
    summary: 'Height aur distance ke sawal — angle of elevation/depression se.',
    points: [
      'Figure bana kar right triangle mark karo.',
      'tanθ se height/height ratio sabse kaam aata hai.',
      '30°, 45°, 60° values fast yaad rakho.',
    ],
  },
  Circles: {
    summary: 'Tangent ke properties aur circle ke theorems.',
    points: [
      'Tangent point pe radius ke perpendicular hota hai.',
      'Bahari point se do tangents ki length barabar hoti hai.',
      'Proof ke liye radius draw karo — tangent theorem lag jata hai.',
    ],
  },
  'Surface Areas and Volumes': {
    summary: 'Solids ka surface area aur volume, aur combination of solids.',
    points: [
      'Cone: V = ⅓πr²h, CSA = πrl (l = √(r²+h²)).',
      'Sphere: V = 4/3 πr³, surface = 4πr².',
      'Combined object me har part alag nikaal ke jodo.',
    ],
  },
  'Life Processes': {
    summary: 'Nutrition, respiration, transport aur excretion — living beings kaise chalti hain.',
    points: [
      'Photosynthesis se plants khana banate hain (CO₂ + H₂O → glucose + O₂).',
      'Autotrophic = khud khana banate, heterotrophic = dusron pe depend.',
      'Human transport: heart → arteries → capillaries → veins.',
    ],
  },
  Light: {
    summary: 'Reflection aur refraction, mirror aur lens ke rules.',
    points: [
      'Real image inverted hoti hai, virtual image erect.',
      'Concave mirror converging, convex diverging hota hai.',
      'Power of lens P = 1/f (metre me), dioptre (D) me.',
    ],
  },
  Electricity: {
    summary: 'Ohm ka law, resistance aur circuits ke numericals.',
    points: [
      'Ammeter series me, voltmeter parallel me lagta hai.',
      'Heating effect: H = I²Rt — Joule ka law.',
      'Wire ka resistance area ghatne pe badhta hai.',
    ],
  },
  'Chemical Reactions and Equations': {
    summary: 'Reactions likhna, balance karna aur types pehchanna.',
    points: [
      'Balancing = dono taraf har element ke atoms barabar karna.',
      'Pb + CuCl₂ → PbCl₂ + Cu displacement ka example hai.',
      'Reaction ke saath heat/light/collapse ka mention kar do.',
    ],
  },
}

export interface ResolvedNote extends CategoryNote {
  custom: boolean
}

/**
 * Ek chapter ke liye notes resolve karo.
 * Pehle chapter-specific note, warna category ka summary, warna generic fallback.
 */
export function resolveChapterNote(chapter: NcertChapter): ResolvedNote {
  const custom = chapterNotes[chapter.name]
  const category = categoryNotes[chapter.cat]
  const summary =
    custom?.summary ??
    category?.summary ??
    `${chapter.name} — is chapter ka quick revision: concepts samjho, formula yaad karo, phir practice questions lagao.`
  const points = custom?.points ?? category?.points ?? []
  return { summary, points, custom: Boolean(custom) }
}

/** Chapter ki category ke formulas (formula bank se). */
export function formulasForChapter(cat: string): FormulaEntry[] {
  return formulaCategories.find((category) => category.name === cat)?.formulas ?? []
}

/** Sab chapters, class aur subject ke hisaab se. */
export function chaptersForClass(classNum: number): NcertChapter[] {
  return ncertChapters[classNum] ?? []
}
