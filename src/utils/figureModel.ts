/**
 * Pure geometry model (koi DOM nahi) — JSXGraph renderer isko draw karta hai.
 * Saare coordinates math system me (y upar). Engine wali values yahin parse hoti hain.
 */
import type { DiagramSpec } from '../types/solution'

export interface ModelPoint {
  id: string
  x: number
  y: number
  name?: string
  nameDx?: number
  nameDy?: number
}

export interface ModelSegment {
  a: string
  b: string
  label?: string
  labelDx?: number
  labelDy?: number
  hot?: boolean
  dashed?: boolean
}

export interface ModelCircle {
  cx: number
  cy: number
  r: number
  centerName?: string
}

export interface ModelAngle {
  a: string
  vertex: string
  c: string
  label?: string
  hot?: boolean
}

export interface ModelText {
  x: number
  y: number
  text: string
  size?: number
  hot?: boolean
}

export interface FigureModel {
  points: ModelPoint[]
  segments: ModelSegment[]
  polygons: string[][]
  polylines: string[][]
  circles: ModelCircle[]
  angles: ModelAngle[]
  texts: ModelText[]
  bbox: [number, number, number, number]
}

/** "5 cm" -> 5, "?" -> null */
export function num(s: string | undefined): number | null {
  if (!s) return null
  const m = /-?\d+(\.\d+)?/.exec(s)
  if (!m) return null
  const v = parseFloat(m[0])
  return Number.isFinite(v) && v > 0 ? v : null
}

export const isUnknown = (s: string | undefined): boolean => !s || num(s) === null

function bboxOf(xs: number[], ys: number[]): [number, number, number, number] {
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const px = Math.max((maxX - minX) * 0.18, 0.5)
  const py = Math.max((maxY - minY) * 0.18, 0.5)
  return [minX - px, maxY + py, maxX + px, minY - py]
}

function collect(points: ModelPoint[]): [number, number, number, number] {
  return bboxOf(
    points.map((p) => p.x),
    points.map((p) => p.y),
  )
}

function rightTriangle(values: string[]): FigureModel | null {
  const l1 = num(values[0])
  const l2 = num(values[1])
  const h = num(values[2])
  const unknowns = [isUnknown(values[0]), isUnknown(values[1]), values[2] !== undefined && isUnknown(values[2])].filter(Boolean).length
  if (unknowns > 1) return null
  let a = l1
  let b = l2
  let c = h
  if (a === null || b === null) {
    if (c === null) return null
    if (a === null && b !== null) a = Math.sqrt(c * c - b * b)
    else if (b === null && a !== null) b = Math.sqrt(c * c - a * a)
    else return null
    if (!(a > 0 && b > 0)) return null
  } else if (c === null && values[2] !== undefined) {
    c = Math.sqrt(a * a + b * b)
  }
  const A = { id: 'A', x: 0, y: 0, name: 'A', nameDx: -0.62, nameDy: -0.5 }
  const B = { id: 'B', x: 0, y: a, name: 'B', nameDx: -0.55, nameDy: 0.38 }
  const C = { id: 'C', x: b, y: 0, name: 'C', nameDx: 0.45, nameDy: -0.45 }
  // Right-angle square at A.
  const q = Math.min(a, b) * 0.16
  const points = [
    A,
    B,
    C,
    { id: 'Q1', x: q, y: 0 },
    { id: 'Q2', x: q, y: q },
    { id: 'Q3', x: 0, y: q },
  ]
  return {
    points,
    polygons: [['A', 'B', 'C'], ['Q1', 'Q2', 'Q3']],
    polylines: [],
    segments: [
      { a: 'A', b: 'B', label: isUnknown(values[0]) ? '?' : values[0], hot: isUnknown(values[0]), labelDx: -0.45, labelDy: 0 },
      { a: 'A', b: 'C', label: isUnknown(values[1]) ? '?' : values[1], hot: isUnknown(values[1]), labelDy: -0.45 },
      ...(values[2] !== undefined
        ? [{ a: 'B', b: 'C', label: isUnknown(values[2]) ? '?' : values[2], hot: isUnknown(values[2]), labelDx: 0.3, labelDy: 0.3 }]
        : [{ a: 'B', b: 'C' }]),
    ],
    circles: [],
    angles: [],
    texts: [],
    bbox: collect(points),
  }
}

function triangle(values: string[]): FigureModel | null {
  // [AB, BC, CA]
  const c = num(values[0])
  const a = num(values[1])
  const b = num(values[2])
  if (c === null || a === null || b === null) return null
  if (a + b <= c || a + c <= b || b + c <= a) return null
  const x = (c * c + b * b - a * a) / (2 * c)
  const y2 = b * b - x * x
  if (!(y2 > 0)) return null
  const y = Math.sqrt(y2)
  const points = [
    { id: 'A', x: 0, y: 0, name: 'A', nameDx: -0.3, nameDy: -0.3 },
    { id: 'B', x: c, y: 0, name: 'B', nameDx: 0.3, nameDy: -0.3 },
    { id: 'C', x, y, name: 'C', nameDx: 0, nameDy: 0.35 },
  ]
  return {
    points,
    polygons: [['A', 'B', 'C']],
    polylines: [],
    segments: [
      { a: 'A', b: 'B', label: values[0], labelDy: -0.45 },
      { a: 'B', b: 'C', label: values[1], labelDx: 0.4, labelDy: 0.1 },
      { a: 'C', b: 'A', label: values[2], labelDx: -0.4, labelDy: 0.1 },
    ],
    circles: [],
    angles: [],
    texts: [],
    bbox: collect(points),
  }
}

function circle(values: string[]): FigureModel | null {
  const r = num(values[0])
  const unknown = isUnknown(values[0])
  if (r === null && !unknown) return null
  void r
  return {
    points: [
      { id: 'O', x: 0, y: 0, name: 'O', nameDx: -0.12, nameDy: -0.32 },
      { id: 'R', x: 1, y: 0 },
    ],
    segments: [{ a: 'O', b: 'R', label: unknown ? '?' : (values[0] ?? ''), hot: unknown, labelDy: 0.3 }],
    polygons: [],
    polylines: [],
    circles: [{ cx: 0, cy: 0, r: 1, centerName: 'O' }],
    angles: [],
    texts: [],
    bbox: [-1.5, 1.5, 1.5, -1.5],
  }
}

function rectangle(values: string[]): FigureModel | null {
  const l = num(values[0])
  const w = num(values[1])
  if (l === null || w === null) return null
  const hw = l / 2
  const hh = w / 2
  const points = [
    { id: 'A', x: -hw, y: -hh },
    { id: 'B', x: hw, y: -hh },
    { id: 'C', x: hw, y: hh },
    { id: 'D', x: -hw, y: hh },
  ]
  return {
    points,
    polygons: [['A', 'B', 'C', 'D']],
    polylines: [],
    segments: [
      { a: 'A', b: 'B', label: values[0], labelDy: -0.4 },
      { a: 'B', b: 'C', label: values[1], labelDx: 0.45 },
    ],
    circles: [],
    angles: [],
    texts: [],
    bbox: collect(points),
  }
}

function angle(values: string[]): FigureModel | null {
  const m = /-?\d+(\.\d+)?/.exec(values[0] ?? '')
  const deg = m ? parseFloat(m[0]) : NaN
  if (!Number.isFinite(deg) || deg <= 0 || deg >= 180) return null
  const rad = (deg * Math.PI) / 180
  const points = [
    { id: 'V', x: 0, y: 0 },
    { id: 'P', x: 2, y: 0 },
    { id: 'Q', x: 2 * Math.cos(rad), y: 2 * Math.sin(rad) },
  ]
  return {
    points,
    segments: [
      { a: 'V', b: 'P' },
      { a: 'V', b: 'Q' },
    ],
    polygons: [],
    polylines: [],
    circles: [],
    angles: [{ a: 'P', vertex: 'V', c: 'Q', label: values[0].includes('°') ? values[0] : `${values[0]}°` }],
    texts: [],
    bbox: collect([...points, { id: 'e', x: 2.4, y: 0 }, { id: 'f', x: 0, y: 0.9 }]),
  }
}

function bpt(values: string[]): FigureModel | null {
  let ad = num(values[0])
  let db = num(values[1])
  let ae = num(values[2])
  const ecGiven = values.length > 3
  let ec = ecGiven ? num(values[3] ?? '') : null
  const missing = [ad === null, db === null, ae === null, ecGiven && ec === null].filter(Boolean).length
  if (missing > 1) return null
  if (!ecGiven) {
    if (ad === null || db === null || ae === null) return null
    ec = (db * ae) / ad
  } else if (ad === null || db === null || ae === null || ec === null) {
    if (ad !== null && db !== null && ae !== null && ec === null) ec = (db * ae) / ad
    else if (ec !== null && ec > 0) {
      if (ad === null && db !== null && ae !== null) ad = (ae * db) / ec
      else if (db === null && ad !== null && ae !== null) db = (ad * ec) / ae
      else if (ae === null && ad !== null && db !== null) ae = (ad * ec) / db
      else return null
    } else return null
  }
  if (!(ad! > 0 && db! > 0 && ae! > 0 && ec! > 0)) return null
  const t = ad! / (ad! + db!)
  if (!(t > 0 && t < 1)) return null
  // A apex top, base BC horizontal.
  const Ax = 0
  const Ay = 1
  const Bx = -0.7
  const By = 0
  const Cx = 0.7
  const Cy = 0
  const Dx = Ax + t * (Bx - Ax)
  const Dy = Ay + t * (By - Ay)
  const Ex = Ax + t * (Cx - Ax)
  const Ey = Ay + t * (Cy - Ay)
  const lab = (i: number, fallback: string) =>
    i < values.length && !isUnknown(values[i]) ? values[i]! : i === 3 ? fallback : '?'
  const ecLabel = ecGiven ? (isUnknown(values[3]) ? '?' : values[3]!) : `${Math.round(ec! * 100) / 100}`
  // Side labels: centroid se bahar ki taraf (line par kabhi nahi).
  const Gx = (Ax + Bx + Cx) / 3
  const Gy = (Ay + By + Cy) / 3
  const push = (mx: number, my: number, d = 0.32): [number, number] => {
    const dx = mx - Gx
    const dy = my - Gy
    const len = Math.hypot(dx, dy) || 1
    return [(dx / len) * d, (dy / len) * d]
  }
  const [adx, ady] = push((Ax + Dx) / 2, (Ay + Dy) / 2)
  const [ddx, ddy] = push((Dx + Bx) / 2, (Dy + By) / 2)
  const [aex, aey] = push((Ax + Ex) / 2, (Ay + Ey) / 2)
  const [eex, eey] = push((Ex + Cx) / 2, (Ey + Cy) / 2)
  const points = [
    { id: 'A', x: Ax, y: Ay, name: 'A', nameDx: 0, nameDy: 0.16 },
    { id: 'B', x: Bx, y: By, name: 'B', nameDx: -0.16, nameDy: -0.08 },
    { id: 'C', x: Cx, y: Cy, name: 'C', nameDx: 0.16, nameDy: -0.08 },
    { id: 'D', x: Dx, y: Dy, name: 'D', nameDx: -0.17, nameDy: 0.05 },
    { id: 'E', x: Ex, y: Ey, name: 'E', nameDx: 0.17, nameDy: 0.05 },
  ]
  return {
    points,
    polygons: [['A', 'B', 'C']],
    polylines: [],
    segments: [
      { a: 'D', b: 'E' },
      { a: 'A', b: 'D', label: lab(0, ''), hot: isUnknown(values[0]), labelDx: adx, labelDy: ady },
      { a: 'D', b: 'B', label: lab(1, ''), hot: isUnknown(values[1]), labelDx: ddx, labelDy: ddy },
      { a: 'A', b: 'E', label: lab(2, ''), hot: isUnknown(values[2]), labelDx: aex, labelDy: aey },
      { a: 'E', b: 'C', label: ecLabel, hot: ecGiven && isUnknown(values[3]), labelDx: eex, labelDy: eey },
    ],
    circles: [],
    angles: [],
    texts: [],
    bbox: collect(points),
  }
}

function graph(values: string[]): FigureModel | null {
  const pts: [number, number][] = []
  for (const v of values.slice(0, 8)) {
    const parts = v.split(',')
    if (parts.length !== 2) continue
    const nums = parts.map((p) => {
      const m = /-?\d+(\.\d+)?/.exec(p)
      return m ? parseFloat(m[0]) : NaN
    })
    if (nums.every((n) => Number.isFinite(n))) pts.push(nums as [number, number])
  }
  if (pts.length < 2) return null
  const gids = pts.map((_, i) => `P${i}`)
  return {
    points: pts.map(([x, y], i) => ({ id: `P${i}`, x, y, name: `(${x},${y})`, nameDx: 0.12, nameDy: 0.18 })),
    segments: [],
    polygons: [],
    polylines: [gids],
    circles: [],
    angles: [],
    texts: [],
    bbox: collect(pts.map(([x, y], i) => ({ id: `P${i}`, x, y }))),
  }
}

function circleFigure(values: string[], details?: DiagramSpec['details']): FigureModel | null {
  if (!details || details.points.length < 2) return null
  const R = 1
  const cx = 0
  const cy = 0
  const names = details.points.slice(0, 6)
  const pos = new Map<string, [number, number]>()
  pos.set('O', [cx, cy])
  const dia = details.diameter && names.includes(details.diameter[0]) && names.includes(details.diameter[1])
    ? details.diameter
    : null
  const others = names.filter((n) => n !== 'O' && (!dia || (n !== dia[0] && n !== dia[1])))
  if (dia) {
    // Pehla endpoint left (180°), doosra right (0°).
    pos.set(dia[0], [cx - R, cy])
    pos.set(dia[1], [cx + R, cy])
  } else if (names[0] !== 'O' && names[1] && names[1] !== 'O') {
    pos.set(names[0], [cx - R, cy])
    pos.set(names[1], [cx + R, cy])
  }
  others.forEach((n, i) => {
    if (pos.has(n)) return
    const deg = 155 - i * (110 / Math.max(others.length, 1))
    const rad = (deg * Math.PI) / 180
    pos.set(n, [cx + R * Math.cos(rad), cy + R * Math.sin(rad)])
  })
  const at = (n: string): [number, number] | null => pos.get(n) ?? null
  const points: ModelPoint[] = []
  for (const n of names) {
    const P = at(n)
    if (!P || n === 'O') continue
    const dx = P[0] - cx
    const dy = P[1] - cy
    const len = Math.hypot(dx, dy) || 1
    points.push({ id: n, x: P[0], y: P[1], name: n, nameDx: (dx / len) * 0.28, nameDy: (dy / len) * 0.28 })
  }
  points.push({ id: 'O', x: cx, y: cy, name: 'O', nameDx: -0.1, nameDy: -0.3 })

  const segments: ModelSegment[] = []
  if (dia) {
    segments.push({ a: dia[0], b: dia[1] })
  }
  for (const [a, b] of details.chords ?? []) {
    if (at(a) && at(b)) segments.push({ a, b })
  }
  // Tangents: contact point se perpendicular segment.
  for (const t of [...new Set(details.tangents ?? [])]) {
    const P = at(t)
    if (!P) continue
    const dx = P[0] - cx
    const dy = P[1] - cy
    const len = Math.hypot(dx, dy) || 1
    const tx = -dy / len
    const ty = dx / len
    const L = R * 0.55
    const idA = `__t1_${t}`
    const idB = `__t2_${t}`
    points.push({ id: idA, x: P[0] - tx * L, y: P[1] - ty * L })
    points.push({ id: idB, x: P[0] + tx * L, y: P[1] + ty * L })
    segments.push({ a: idA, b: idB })
  }
  const angles: ModelAngle[] = []
  const angleTexts: ModelText[] = []
  // Angle arc ke liye vertex se nikalne wali 2 lines chahiye (chords/diameter se).
  const neighbours = (v: string): string[] => {
    const out: string[] = []
    const pairs: Array<[string, string]> = [...(details.chords ?? [])]
    if (dia) pairs.push(dia)
    for (const [a, b] of pairs) {
      if (a === v && at(b)) out.push(b)
      else if (b === v && at(a)) out.push(a)
      if (out.length >= 2) break
    }
    return out
  }
  for (const a of details.angles ?? []) {
    const P = at(a.at)
    if (!P) continue
    const nb = neighbours(a.at)
    if (nb.length < 2) {
      // Arc nahi ban sakta — kam se kam label to dikhao (center ki taraf).
      const dx = cx - P[0]
      const dy = cy - P[1]
      const len = Math.hypot(dx, dy) || 1
      angleTexts.push({
        x: P[0] + (dx / len) * 0.35,
        y: P[1] + (dy / len) * 0.35,
        text: a.label,
        hot: a.label === '?',
      })
      continue
    }
    angles.push({ a: nb[0], vertex: a.at, c: nb[1], label: a.label, hot: a.label === '?' })
  }

  // Radius label (number/? ho to).
  const texts: ModelText[] = [...angleTexts]
  const rv = values[0]
  if (rv !== undefined && rv !== '') {
    texts.push({ x: R / 2, y: 0.18, text: isUnknown(rv) ? '?' : rv, hot: isUnknown(rv) })
  }

  return {
    points,
    segments,
    polygons: [],
    polylines: [],
    circles: [{ cx, cy, r: R, centerName: 'O' }],
    angles: angles.filter((a) => at(a.vertex) !== null),
    texts,
    bbox: [-1.55, 1.55, 1.55, -1.55],
  }
}

export function buildFigureModel(spec: DiagramSpec): FigureModel | null {
  try {
    switch (spec.shape) {
      case 'rightTriangle': return rightTriangle(spec.values)
      case 'triangle': return triangle(spec.values)
      case 'circle': return circle(spec.values)
      case 'rectangle': return rectangle(spec.values)
      case 'angle': return angle(spec.values)
      case 'bpt': return bpt(spec.values)
      case 'graph': return graph(spec.values)
      case 'circleFigure': return circleFigure(spec.values, spec.details)
      default: return null
    }
  } catch {
    return null
  }
}
