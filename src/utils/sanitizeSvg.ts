/**
 * AI se aaye SVG ko render se pehle saaf karo.
 * Sirf safe drawing tags/attributes rehte hain — script,
 * event handlers aur javascript: links sab nikal jate hain.
 */
const ALLOWED_TAGS = new Set([
  'svg', 'g', 'line', 'rect', 'circle', 'ellipse',
  'polygon', 'polyline', 'path', 'text', 'tspan',
  'title', 'desc', 'defs', 'marker',
])

const ALLOWED_ATTRS = new Set([
  'viewbox', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry',
  'points', 'd', 'fill', 'stroke', 'stroke-width', 'stroke-dasharray',
  'stroke-linecap', 'stroke-linejoin', 'font-size', 'font-family',
  'text-anchor', 'transform', 'dx', 'dy', 'opacity', 'id',
])

function cleanElement(el: Element): void {
  if (!ALLOWED_TAGS.has(el.tagName.toLowerCase())) {
    el.remove()
    return
  }
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase()
    if (!ALLOWED_ATTRS.has(name) || name.startsWith('on') || name.includes('href')) {
      el.removeAttribute(attr.name)
      continue
    }
    if (/^\s*javascript:/i.test(attr.value)) {
      el.removeAttribute(attr.name)
    }
  }
  for (const child of Array.from(el.children)) {
    cleanElement(child)
  }
  for (const node of Array.from(el.childNodes)) {
    // Comments hatao; text nodes (labels) rehne do.
    if (node.nodeType === Node.COMMENT_NODE) node.remove()
  }
}

export function sanitizeSvg(input: string): string {
  try {
    const doc = new DOMParser().parseFromString(input, 'image/svg+xml')
    const root = doc.documentElement
    if (!root || root.tagName.toLowerCase() !== 'svg') return ''
    cleanElement(root)
    return new XMLSerializer().serializeToString(root)
  } catch {
    return ''
  }
}
