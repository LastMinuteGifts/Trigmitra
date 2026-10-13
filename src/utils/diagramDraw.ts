/**
 * Perfect geometry engine — AI sirf shape + measurements bhejta hai,
 * figure yahan pixel-perfect calculate karke banti hai.
 * Galat/invalid values par '' return hota hai (phir raw SVG fallback chalta hai).
 */

export type DiagramShape = 'rightTriangle' | 'triangle' | 'circle' | 'rectangle' | 'angle' | 'bpt' | 'graph'

export interface DiagramSpec {
  shape: DiagramShape
  values: string[]
  caption?: string
}

const INK = '#1f2d3f'
const W = 240
const H = 180
const PAD = 30

const round1 = (n: number) => Math.round(n * 10) / 10

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** "5 cm" -> 5, "?" -> null (unknown/asked value). */
function num(s: string): number | null {
  const m = /-?\d+(\.\d+)?/.exec(s)
  if (!m) return null
  const v = parseFloat(m[0])
  return Number.isFinite(v) && v > 0 ? v : null
}

const isUnknown = (s: string | undefined): boolean => !s || num(s) === null

function fmt(n: number): string {
  return String(Math.round(n * 100) / 100)
}

function text(x: number, y: number, s: string, size = 13): string {
  return `<text x="${round1(x)}" y="${round1(y)}" font-size="${size}" text-anchor="middle" fill="${INK}">${esc(s)}</text>`
}

function poly(points: [number, number][], width = 2.5): string {
  const p = points.map(([x, y]) => `${round1(x)},${round1(y)}`).join(' ')
  return `<polygon points="${p}" fill="none" stroke="${INK}" stroke-width="${width}"/>`
}

function line(x1: number, y1: number, x2: number, y2: number, width = 2.5): string {
  return `<line x1="${round1(x1)}" y1="${round1(y1)}" x2="${round1(x2)}" y2="${round1(y2)}" stroke="${INK}" stroke-width="${width}"/>`
}

function rightTriangle(values: string[]): string {
  // values = [leg1, leg2, hyp]; "?" wali side compute karke "?" dikhao.
  let n1 = num(values[0] ?? '')
  let n2 = num(values[1] ?? '')
  let nh = num(values[2] ?? '')
  const unknowns = [isUnknown(values[0]), isUnknown(values[1]), values[2] !== undefined && isUnknown(values[2])].filter(Boolean).length
  if (unknowns > 1) return ''
  if (n1 === null || n2 === null) {
    // Ek leg missing: hyp se nikalo.
    if (nh === null) return ''
    if (n1 === null && n2 !== null) n1 = Math.sqrt(nh * nh - n2 * n2)
    else if (n2 === null && n1 !== null) n2 = Math.sqrt(nh * nh - n1 * n1)
    else return ''
    if (!(n1 > 0 && n2 > 0)) return ''
  } else if (nh === null && values[2] !== undefined) {
    nh = Math.sqrt(n1 * n1 + n2 * n2)
  }
  const s = Math.min((W - 2 * PAD) / n2, (H - 2 * PAD) / n1)
  const ax = PAD
  const ay = H - PAD
  const bx = PAD
  const by = ay - s * n1
  const cx = ax + s * n2
  const cy = ay
  const q = 13
  const label = (i: number, fallback: string) => (isUnknown(values[i]) ? '?' : (values[i] ?? fallback))
  let out = poly([[ax, ay], [bx, by], [cx, cy]])
  out += `<rect x="${round1(ax)}" y="${round1(ay - q)}" width="${q}" height="${q}" fill="none" stroke="${INK}" stroke-width="2"/>`
  out += text((ax + bx) / 2 - 13, (ay + by) / 2, label(0, ''))
  out += text((ax + cx) / 2, ay + 17, label(1, ''))
  if (values[2] !== undefined) {
    const mx = (bx + cx) / 2
    const my = (by + cy) / 2
    const gx = (ax + bx + cx) / 3
    const gy = (ay + by + cy) / 3
    const dx = mx - gx
    const dy = my - gy
    const len = Math.hypot(dx, dy) || 1
    out += text(mx + (dx / len) * 15, my + (dy / len) * 15 + 4, label(2, ''))
  }
  out += text(ax - 9, ay + 15, 'A')
  out += text(bx - 9, by + 4, 'B')
  out += text(cx + 10, cy + 5, 'C')
  return out
}

function triangle(values: string[]): string {
  const c = num(values[0] ?? '')
  const a = num(values[1] ?? '')
  const b = num(values[2] ?? '')
  // values = [AB, BC, CA]; A=(0,0), B=(c,0)
  if (c === null || a === null || b === null) return ''
  if (a + b <= c || a + c <= b || b + c <= a) return ''
  const x = (c * c + b * b - a * a) / (2 * c)
  const y2 = b * b - x * x
  if (!(y2 > 0)) return ''
  const y = Math.sqrt(y2)
  const s = Math.min((W - 2 * PAD) / c, (H - 2 * PAD) / y)
  const ox = (W - s * c) / 2
  const oy = H - PAD
  const A: [number, number] = [ox, oy]
  const B: [number, number] = [ox + s * c, oy]
  const C: [number, number] = [ox + s * x, oy - s * y]
  const off = (mx: number, my: number, gx: number, gy: number, d: number) => {
    const dx = mx - gx
    const dy = my - gy
    const len = Math.hypot(dx, dy) || 1
    return [mx + (dx / len) * d, my + (dy / len) * d] as [number, number]
  }
  const gx = (A[0] + B[0] + C[0]) / 3
  const gy = (A[1] + B[1] + C[1]) / 3
  let out = poly([A, B, C])
  const [abx, aby] = off((A[0] + B[0]) / 2, (A[1] + B[1]) / 2, gx, gy, 15)
  const [bcx, bcy] = off((B[0] + C[0]) / 2, (B[1] + C[1]) / 2, gx, gy, 15)
  const [cax, cay] = off((C[0] + A[0]) / 2, (C[1] + A[1]) / 2, gx, gy, 15)
  out += text(abx, aby + 4, values[0])
  out += text(bcx, bcy + 4, values[1])
  out += text(cax, cay + 4, values[2])
  out += text(A[0] - 10, A[1] + 5, 'A')
  out += text(B[0] + 10, B[1] + 5, 'B')
  out += text(C[0], C[1] - 9, 'C')
  return out
}

function circle(values: string[]): string {
  const r = num(values[0] ?? '')
  // Radius poochha gaya ho ("?") to default size ka circle + "?" label.
  if (r === null && !isUnknown(values[0])) return ''
  const R = Math.min((W - 2 * PAD) / 2, (H - 2 * PAD) / 2)
  const cx = W / 2
  const cy = H / 2
  let out = `<circle cx="${cx}" cy="${cy}" r="${round1(R)}" fill="none" stroke="${INK}" stroke-width="2.5"/>`
  out += line(cx, cy, cx + R, cy, 2)
  out += `<circle cx="${cx}" cy="${cy}" r="2.5" fill="${INK}"/>`
  out += text(cx + R / 2, cy - 8, isUnknown(values[0]) ? '?' : (values[0] ?? ''))
  out += text(cx, cy + R + 16, 'O')
  return out
}

function rectangle(values: string[]): string {
  const l = num(values[0] ?? '')
  const w = num(values[1] ?? '')
  if (l === null || w === null) return ''
  const s = Math.min((W - 2 * PAD) / l, (H - 2 * PAD) / w)
  const rw = s * l
  const rh = s * w
  const x = (W - rw) / 2
  const y = (H - rh) / 2
  let out = `<rect x="${round1(x)}" y="${round1(y)}" width="${round1(rw)}" height="${round1(rh)}" fill="none" stroke="${INK}" stroke-width="2.5"/>`
  out += text(x + rw / 2, y - 9, values[0])
  out += text(x + rw + 14, y + rh / 2 + 4, values[1])
  return out
}

/**
 * BPT figure: triangle ABC, DE ∥ BC, D on AB, E on AC.
 * values = [AD, DB, AE, EC?] — jiski value poochhi gayi ho wahan "?" bhejo.
 * Engine BPT se nikal kar figure sahi banata hai, poochhi jagah "?" dikhata hai.
 */
function bpt(values: string[]): string {
  let ad = num(values[0] ?? '')
  let db = num(values[1] ?? '')
  let ae = num(values[2] ?? '')
  const ecGiven = values.length > 3
  let ec = ecGiven ? num(values[3] ?? '') : null
  // BPT: ad*ec = db*ae — exactly ek unknown ho to solve karo.
  // Note: 4th value absent = purana behavior (EC compute karke dikhao).
  const missing = [ad === null, db === null, ae === null, ecGiven && ec === null].filter(Boolean).length
  if (missing > 1) return ''
  if (!ecGiven) {
    // Purana behavior: EC compute karke dikhao.
    if (ad === null || db === null || ae === null) return ''
    ec = (db * ae) / ad
  } else if (ad === null || db === null || ae === null || ec === null) {
    // Solo unknown ko BPT relation se nikalo.
    if (ad !== null && db !== null && ae !== null && ec === null) ec = (db * ae) / ad
    else if (ec !== null && ec > 0) {
      if (ad === null && db !== null && ae !== null) ad = (ae * db) / ec
      else if (db === null && ad !== null && ae !== null) db = (ad * ec) / ae
      else if (ae === null && ad !== null && db !== null) ae = (ad * ec) / db
      else return ''
    } else return ''
  }
  if (!(ad! > 0 && db! > 0 && ae! > 0 && ec! > 0)) return ''
  const showQ = (i: number): boolean => i < values.length && isUnknown(values[i])
  const unitMatch = /[a-zA-Z%°]+/.exec([values[2], values[0], values[1], values[3]].find((v) => v && !isUnknown(v)) ?? '')
  const unit = unitMatch ? ` ${unitMatch[0]}` : ''
  const ecLabel = showQ(3) ? '?' : ecGiven ? values[3]! : `${fmt(ec!)}${unit}`
  const t = ad! / (ad! + db!)
  if (!(t > 0 && t < 1)) return ''
  const A: [number, number] = [120, 22]
  const B: [number, number] = [38, 160]
  const C: [number, number] = [202, 160]
  const D: [number, number] = [A[0] + t * (B[0] - A[0]), A[1] + t * (B[1] - A[1])]
  const E: [number, number] = [A[0] + t * (C[0] - A[0]), A[1] + t * (C[1] - A[1])]
  let out = poly([A, B, C])
  out += line(D[0], D[1], E[0], E[1])
  out += text((A[0] + D[0]) / 2 - 15, (A[1] + D[1]) / 2, showQ(0) ? '?' : values[0], 12)
  out += text((D[0] + B[0]) / 2 - 15, (D[1] + B[1]) / 2, showQ(1) ? '?' : values[1], 12)
  out += text((A[0] + E[0]) / 2 + 15, (A[1] + E[1]) / 2, showQ(2) ? '?' : values[2], 12)
  out += text((E[0] + C[0]) / 2 + 15, (E[1] + C[1]) / 2, ecLabel, 12)
  out += text(A[0], A[1] - 10, 'A')
  out += text(B[0] - 11, B[1] + 5, 'B')
  out += text(C[0] + 11, C[1] + 5, 'C')
  out += text(D[0] - 11, D[1] + 4, 'D')
  out += text(E[0] + 11, E[1] + 4, 'E')
  return out
}

/** Coordinate graph: values = ["x1,y1", "x2,y2", ...] points of line/curve. */
function parseCoord(s: string): [number, number] | null {
  const parts = s.split(',')
  if (parts.length !== 2) return null
  const vals = parts.map((p) => {
    const m = /-?\d+(\.\d+)?/.exec(p)
    return m ? parseFloat(m[0]) : NaN
  })
  if (vals.some((v) => !Number.isFinite(v))) return null
  return vals as [number, number]
}

function niceStep(raw: number): number {
  const pow = Math.pow(10, Math.floor(Math.log10(raw)))
  const n = raw / pow
  if (n <= 1) return pow
  if (n <= 2) return 2 * pow
  if (n <= 2.5) return 2.5 * pow
  if (n <= 5) return 5 * pow
  return 10 * pow
}

function tickLabel(v: number): string {
  return String(Math.round(v * 100) / 100)
}

function graph(values: string[]): string {
  const pts: [number, number][] = []
  for (const v of values.slice(0, 8)) {
    const p = parseCoord(v)
    if (p) pts.push(p)
  }
  if (pts.length < 2) return ''
  let minX = Math.min(...pts.map((p) => p[0]))
  let maxX = Math.max(...pts.map((p) => p[0]))
  let minY = Math.min(...pts.map((p) => p[1]))
  let maxY = Math.max(...pts.map((p) => p[1]))
  if (minX === maxX) { minX -= 1; maxX += 1 }
  if (minY === maxY) { minY -= 1; maxY += 1 }
  const padX = (maxX - minX) * 0.12
  const padY = (maxY - minY) * 0.12
  minX -= padX; maxX += padX; minY -= padY; maxY += padY

  const L = 42
  const R = 230
  const T = 12
  const B = 148
  const X = (x: number) => L + ((x - minX) / (maxX - minX)) * (R - L)
  const Y = (y: number) => B - ((y - minY) / (maxY - minY)) * (B - T)

  let out = ''
  const stepX = niceStep((maxX - minX) / 4)
  const stepY = niceStep((maxY - minY) / 4)
  for (let gx = Math.ceil(minX / stepX) * stepX; gx <= maxX; gx += stepX) {
    const px = X(gx)
    out += `<line x1="${round1(px)}" y1="${T}" x2="${round1(px)}" y2="${B}" stroke="#dbe1e8" stroke-width="1"/>`
    out += `<text x="${round1(px)}" y="${B + 12}" font-size="8" text-anchor="middle" fill="#7b8794">${tickLabel(gx)}</text>`
  }
  for (let gy = Math.ceil(minY / stepY) * stepY; gy <= maxY; gy += stepY) {
    const py = Y(gy)
    out += `<line x1="${L}" y1="${round1(py)}" x2="${R}" y2="${round1(py)}" stroke="#dbe1e8" stroke-width="1"/>`
    out += `<text x="${L - 5}" y="${round1(py + 3)}" font-size="8" text-anchor="end" fill="#7b8794">${tickLabel(gy)}</text>`
  }
  // Axes (0 line agar range me ho, warna edge par)
  const xAxisY = minY <= 0 && 0 <= maxY ? Y(0) : B
  const yAxisX = minX <= 0 && 0 <= maxX ? X(0) : L
  out += `<line x1="${L}" y1="${round1(xAxisY)}" x2="${R}" y2="${round1(xAxisY)}" stroke="${INK}" stroke-width="1.5"/>`
  out += `<line x1="${round1(yAxisX)}" y1="${T}" x2="${round1(yAxisX)}" y2="${B}" stroke="${INK}" stroke-width="1.5"/>`
  out += `<text x="${R - 2}" y="${round1(xAxisY - 5)}" font-size="10" text-anchor="end" fill="${INK}">x</text>`
  out += `<text x="${round1(yAxisX + 7)}" y="${T + 8}" font-size="10" text-anchor="start" fill="${INK}">y</text>`
  // Line + dots + labels
  out += `<polyline points="${pts.map(([x, y]) => `${round1(X(x))},${round1(Y(y))}`).join(' ')}" fill="none" stroke="${INK}" stroke-width="2.5"/>`
  for (const [x, y] of pts) {
    out += `<circle cx="${round1(X(x))}" cy="${round1(Y(y))}" r="3" fill="#f05b45"/>`
    out += `<text x="${round1(X(x) + 7)}" y="${round1(Y(y) - 7)}" font-size="8.5" text-anchor="start" fill="#39465d">(${tickLabel(x)},${tickLabel(y)})</text>`
  }
  return out
}

function angle(values: string[]): string {  const deg = num(values[0] ?? '')
  if (deg === null || deg <= 0 || deg >= 180) return ''
  const vx = 60
  const vy = 140
  const len = 150
  const rad = (deg * Math.PI) / 180
  const ex = vx + len
  const ey = vy
  const fx = vx + len * Math.cos(rad)
  const fy = vy - len * Math.sin(rad)
  const r = 32
  const sx = vx + r
  const sy = vy
  const tx = vx + r * Math.cos(rad)
  const ty = vy - r * Math.sin(rad)
  let out = line(vx, vy, ex, ey)
  out += line(vx, vy, fx, fy)
  out += `<path d="M ${round1(sx)} ${round1(sy)} A ${r} ${r} 0 0 0 ${round1(tx)} ${round1(ty)}" fill="none" stroke="${INK}" stroke-width="2"/>`
  const mid = rad / 2
  out += text(vx + 56 * Math.cos(mid), vy - 56 * Math.sin(mid) + 4, values[0].includes('°') ? values[0] : `${values[0]}°`)
  return out
}

export function drawDiagram(spec: DiagramSpec): string {
  let inner = ''
  try {
    switch (spec.shape) {
      case 'rightTriangle': inner = rightTriangle(spec.values); break
      case 'triangle': inner = triangle(spec.values); break
      case 'circle': inner = circle(spec.values); break
      case 'rectangle': inner = rectangle(spec.values); break
      case 'angle': inner = angle(spec.values); break
      case 'bpt': inner = bpt(spec.values); break
      case 'graph': inner = graph(spec.values); break
      default: return ''
    }
  } catch {
    return ''
  }
  if (!inner) return ''
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`
}
