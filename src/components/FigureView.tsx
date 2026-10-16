import { useEffect, useRef } from 'react'
import type JXG from 'jsxgraph'
import { buildFigureModel } from '../utils/figureModel'
import { drawModel, type DrawColors } from '../utils/drawBoard'
import type { DiagramSpec } from '../types/solution'

let boardCounter = 0

interface FigureViewProps {
  spec: DiagramSpec
  onError: () => void
}

export default function FigureView({ spec, onError }: FigureViewProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const specKey = JSON.stringify(spec)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const holder: {
      board: JXG.Board | null
      lib: {
        JSXGraph: {
          initBoard: (id: string, opts: Record<string, unknown>) => JXG.Board
          freeBoard: (b: JXG.Board) => void
        }
      } | null
    } = { board: null, lib: null }
    let cancelled = false
    ;(async () => {
      try {
        const model = buildFigureModel(JSON.parse(specKey) as DiagramSpec)
        if (!model || cancelled) throw new Error('bad spec')
        // Library sirf tab load hogi jab diagram banana ho (bundle halka rahe).
        const mod = (await import('jsxgraph')) as unknown as {
          default: {
            JSXGraph: {
              initBoard: (id: string, opts: Record<string, unknown>) => JXG.Board
              freeBoard: (b: JXG.Board) => void
            }
          }
        }
        holder.lib = mod.default
        if (cancelled) return
        const [x0, y1, x1, y0] = model.bbox
        let bw = Math.max(x1 - x0, 0.01)
        const bh = Math.max(y1 - y0, 0.01)
        // Bahut lamba figure ho to x-range phailao taaki crop na ho.
        let nx0 = x0
        let nx1 = x1
        if (bh / bw > 1.25) {
          const need = (bh / 1.25 - bw) / 2
          nx0 -= need
          nx1 += need
          bw = nx1 - nx0
        }
        el.style.width = '100%'
        el.style.aspectRatio = `${bw} / ${bh}`
        const dark = document.documentElement.dataset.theme === 'dark'
        const colors: DrawColors = {
          ink: dark ? '#dbe4ee' : '#1f2d3f',
          coral: '#f05b45',
        }
        const isGraph = (JSON.parse(specKey) as DiagramSpec).shape === 'graph'
        const id = `jxg-board-${++boardCounter}`
        el.id = id
        holder.board = holder.lib.JSXGraph.initBoard(id, {
          boundingbox: [nx0, y1, nx1, y0],
          axis: isGraph,
          showNavigation: false,
          showCopyright: false,
          showInfobox: false,
          pan: { enabled: false },
          zoom: false,
          keepAspectRatio: true,
        })
        drawModel(holder.board, model, colors)
      } catch {
        if (!cancelled) onError()
      }
    })()
    return () => {
      cancelled = true
      if (holder.board && holder.lib) {
        try {
          holder.lib.JSXGraph.freeBoard(holder.board)
        } catch {
          // ignore cleanup errors
        }
        holder.board = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specKey])

  return <div ref={wrapRef} className="jxg-holder" />
}
