import { useRef, useState } from 'react'
import { Check, X } from 'lucide-react'

interface CropEditorProps {
  imageUrl: string
  fileName: string
  onCancel: () => void
  onApply: (file: File) => void
}

interface Box {
  x: number
  y: number
  w: number
  h: number
}

const MIN_SIZE = 0.08

const clampBox = (box: Box): Box => {
  const w = Math.min(1, Math.max(MIN_SIZE, box.w))
  const h = Math.min(1, Math.max(MIN_SIZE, box.h))
  return {
    w,
    h,
    x: Math.min(1 - w, Math.max(0, box.x)),
    y: Math.min(1 - h, Math.max(0, box.y)),
  }
}

export default function CropEditor({ imageUrl, fileName, onCancel, onApply }: CropEditorProps) {
  const imgRef = useRef<HTMLImageElement>(null)
  const dragRef = useRef<{ mode: 'move' | 'resize'; startX: number; startY: number; orig: Box } | null>(null)
  const [box, setBox] = useState<Box>({ x: 0.08, y: 0.08, w: 0.84, h: 0.84 })
  const [isWorking, setIsWorking] = useState(false)

  const onPointerDown = (mode: 'move' | 'resize') => (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { mode, startX: event.clientX, startY: event.clientY, orig: box }
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const rect = imgRef.current?.getBoundingClientRect()
    if (!rect) return
    const dx = (event.clientX - drag.startX) / rect.width
    const dy = (event.clientY - drag.startY) / rect.height
    if (drag.mode === 'move') {
      setBox((prev) => clampBox({ ...prev, x: drag.orig.x + dx, y: drag.orig.y + dy }))
    } else {
      setBox((prev) => clampBox({ ...prev, w: drag.orig.w + dx, h: drag.orig.h + dy }))
    }
  }

  const onPointerUp = () => {
    dragRef.current = null
  }

  const useFullPhoto = () => {
    setBox({ x: 0, y: 0, w: 1, h: 1 })
  }

  const applyCrop = () => {
    setIsWorking(true)
    const img = new Image()
    img.onload = () => {
      try {
        const sx = Math.round(box.x * img.naturalWidth)
        const sy = Math.round(box.y * img.naturalHeight)
        const sw = Math.round(box.w * img.naturalWidth)
        const sh = Math.round(box.h * img.naturalHeight)
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, sw)
        canvas.height = Math.max(1, sh)
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Canvas not supported')
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
        canvas.toBlob(
          (blob) => {
            setIsWorking(false)
            if (!blob) {
              onCancel()
              return
            }
            const base = fileName.replace(/\.[a-zA-Z0-9]+$/, '') || 'question'
            onApply(new File([blob], `cropped-${base}.jpg`, { type: 'image/jpeg' }))
          },
          'image/jpeg',
          0.92,
        )
      } catch {
        setIsWorking(false)
        onCancel()
      }
    }
    img.onerror = () => {
      setIsWorking(false)
      onCancel()
    }
    img.src = imageUrl
  }

  return (
    <div className="crop-stage">
      <p className="crop-hint">Box ko drag karke <b>sirf question</b> select karo — Lens ki tarah.</p>
      <div
        className="crop-wrap"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <img ref={imgRef} src={imageUrl} alt="Crop your question" draggable={false} />
        <div
          className="crop-box"
          style={{
            left: `${box.x * 100}%`,
            top: `${box.y * 100}%`,
            width: `${box.w * 100}%`,
            height: `${box.h * 100}%`,
          }}
          onPointerDown={onPointerDown('move')}
        >
          <div className="crop-handle" onPointerDown={onPointerDown('resize')} />
        </div>
      </div>
      <div className="crop-actions">
        <button className="outline-button" type="button" onClick={onCancel} disabled={isWorking}>
          <X size={15} /> Wapas
        </button>
        <button className="text-button" type="button" onClick={useFullPhoto} disabled={isWorking}>
          Full photo use karo
        </button>
        <button className="analyze-button crop-apply" type="button" onClick={applyCrop} disabled={isWorking}>
          {isWorking ? 'Crop ho raha...' : <><Check size={16} /> Crop & continue</>}
        </button>
      </div>
    </div>
  )
}
