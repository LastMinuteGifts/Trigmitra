import type JXG from 'jsxgraph'
import type { FigureModel } from './figureModel'

export interface DrawColors {
  ink: string
  coral: string
}

export function drawModel(board: JXG.Board, model: FigureModel, colors: DrawColors): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pts = new Map<string, any>()
  for (const p of model.points) {
    const el = board.create('point', [p.x, p.y], {
      name: '',
      fixed: true,
      visible: true,
      size: 2.5,
      color: colors.ink,
      fillColor: colors.ink,
      strokeColor: colors.ink,
      withLabel: false,
      showInfobox: false,
    })
    pts.set(p.id, el)
    if (p.name) {
      board.create('text', [p.x + (p.nameDx ?? 0.2), p.y + (p.nameDy ?? 0.2), p.name], {
        fontSize: 14,
        color: colors.ink,
        anchorX: 'middle',
        anchorY: 'middle',
        fixed: true,
      })
    }
  }
  const at = (id: string) => {
    const p = pts.get(id)
    if (!p) throw new Error(`missing point ${id}`)
    return p
  }
  for (const poly of model.polygons) {
    board.create('polygon', poly.map(at), {
      fillColor: 'none',
      fillOpacity: 0,
      borders: { strokeColor: colors.ink, strokeWidth: 2.5 },
      vertices: { visible: false },
      fixed: true,
    })
  }
  for (const chain of model.polylines) {
    const pts = chain.map(at)
    for (let i = 0; i + 1 < pts.length; i++) {
      board.create('segment', [pts[i], pts[i + 1]], {
        strokeColor: colors.ink,
        strokeWidth: 2.5,
        fixed: true,
      })
    }
  }
  for (const s of model.segments) {
    const el = board.create('segment', [at(s.a), at(s.b)], {
      strokeColor: colors.ink,
      strokeWidth: 2.5,
      fixed: true,
      dash: s.dashed ? 3 : 0,
    })
    if (s.label) {
      const pa = model.points.find((p) => p.id === s.a)
      const pb = model.points.find((p) => p.id === s.b)
      if (pa && pb) {
        board.create('text', [
          (pa.x + pb.x) / 2 + (s.labelDx ?? 0),
          (pa.y + pb.y) / 2 + (s.labelDy ?? 0),
          s.label,
        ], {
          fontSize: s.hot ? 17 : 13,
          color: s.hot ? colors.coral : colors.ink,
          fontWeight: s.hot ? 'bold' : 'normal',
          anchorX: 'middle',
          anchorY: 'middle',
          fixed: true,
        })
      }
    }
    void el
  }
  for (const c of model.circles) {
    board.create('circle', [[c.cx, c.cy], Math.max(c.r, 0.01)], {
      strokeColor: colors.ink,
      strokeWidth: 2.5,
      fillColor: 'none',
      fillOpacity: 0,
      fixed: true,
    })
  }
  for (const a of model.angles) {
    board.create('angle', [at(a.a), at(a.vertex), at(a.c)], {
      radius: 0.32,
      name: a.label ?? '',
      withLabel: !!a.label,
      strokeColor: colors.ink,
      fillColor: 'none',
      fillOpacity: 0,
      label: { color: a.hot ? colors.coral : colors.ink, fontSize: a.hot ? 17 : 13 },
      fixed: true,
    })
  }
  for (const t of model.texts) {
    board.create('text', [t.x, t.y, t.text], {
      fontSize: t.size ?? 13,
      color: t.hot ? colors.coral : colors.ink,
      fontWeight: t.hot ? 'bold' : 'normal',
      anchorX: 'middle',
      anchorY: 'middle',
      fixed: true,
    })
  }
}

