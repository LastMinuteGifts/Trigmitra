/**
 * Perfect geometry engine — AI sirf shape + measurements bhejta hai,
 * figure yahan pixel-perfect calculate karke banti hai.
 * Galat/invalid values par '' return hota hai (phir raw SVG fallback chalta hai).
 */

export type DiagramShape = 'rightTriangle' | 'triangle' | 'circle' | 'rectangle' | 'angle'

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

/** "5 cm" -> 5, "√3/2" -> null (aise values par figure skip) */
function num(s: string): number | null {
  const m = /-?\d+(\.\d+)?/.exec(s)
  if (!m) return null
  const v = parseFloat(m[0])
  return Number.isFinite(v) && v > 0 ? v : null
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
  const n1 = num(values[0] ?? '')
  const n2 = num(values[1] ?? '')
  if (n1 === null || n2 === null) return ''
  const s = Math.min((W - 2 * PAD) / n2, (H - 2 * PAD) / n1)
  const ax = PAD
  const ay = H - PAD
  const bx = PAD
  const by = ay - s * n1
  const cx = ax + s * n2
  const cy = ay
  const q = 13
  let out = poly([[ax, ay], [bx, by], [cx, cy]])
  out += `<rect x="${round1(ax)}" y="${round1(ay - q)}" width="${q}" height="${q}" fill="none" stroke="${INK}" stroke-width="2"/>`
  out += text((ax + bx) / 2 - 13, (ay + by) / 2, values[0])
  out += text((ax + cx) / 2, ay + 17, values[1])
  if (values[2]) {
    const mx = (bx + cx) / 2
    const my = (by + cy) / 2
    const gx = (ax + bx + cx) / 3
    const gy = (ay + by + cy) / 3
    const dx = mx - gx
    const dy = my - gy
    const len = Math.hypot(dx, dy) || 1
    out += text(mx + (dx / len) * 15, my + (dy / len) * 15 + 4, values[2])
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
  if (r === null) return ''
  const R = Math.min((W - 2 * PAD) / 2, (H - 2 * PAD) / 2)
  const cx = W / 2
  const cy = H / 2
  let out = `<circle cx="${cx}" cy="${cy}" r="${round1(R)}" fill="none" stroke="${INK}" stroke-width="2.5"/>`
  out += line(cx, cy, cx + R, cy, 2)
  out += `<circle cx="${cx}" cy="${cy}" r="2.5" fill="${INK}"/>`
  out += text(cx + R / 2, cy - 8, values[0])
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

function angle(values: string[]): string {
  const deg = num(values[0] ?? '')
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
      default: return ''
    }
  } catch {
    return ''
  }
  if (!inner) return ''
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`
}
