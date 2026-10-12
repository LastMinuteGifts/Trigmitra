import { useEffect, useRef, useState } from 'react'
import { Check, Contrast, RotateCw, X } from 'lucide-react'

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

type DragMode = 'move' | 'nw' | 'ne' | 'sw' | 'se'

const MIN_SIZE = 0.08
const DEFAULT_BOX: Box = { x: 0.08, y: 0.08, w: 0.84, h: 0.84 }
const ENHANCE_FILTER = 'grayscale(1) contrast(1.35) brightness(1.05)'

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

/** Do corners (x1,y1)-(x2,y2) se normalized box banao. */
function normalizeBox(x1: number, y1: number, x2: number, y2: number): Box {
  let x = Math.min(x1, x2)
  let y = Math.min(y1, y2)
  let w = Math.abs(x2 - x1)
  let h = Math.abs(y2 - y1)
  w = Math.max(w, MIN_SIZE)
  h = Math.max(h, MIN_SIZE)
  if (x + w > 1) x = 1 - w
  if (y + h > 1) y = 1 - h
  x = Math.max(0, x)
  y = Math.max(0, y)
  return { x, y, w: Math.min(w, 1 - x), h: Math.min(h, 1 - y) }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Image load failed'))
    img.src = url
  })
}

export default function CropEditor({ imageUrl, fileName, onCancel, onApply }: CropEditorProps) {
  const imgRef = useRef<HTMLImageElement>(null)
  const dragRef = useRef<{ mode: DragMode; startX: number; startY: number; orig: Box } | null>(null)
  const ownedUrls = useRef<string[]>([])
  const [imgUrl, setImgUrl] = useState(imageUrl)
  const [box, setBox] = useState<Box>(DEFAULT_BOX)
  const [enhance, setEnhance] = useState(false)
  const [isWorking, setIsWorking] = useState(false)

  // Apni banayi rotate URLs unmount par saaf karo (parent ki original ko haath mat lagao).
  useEffect(() => {
    const owned = ownedUrls.current
    return () => {
      owned.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [])

  const onPointerDown = (mode: DragMode) => (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { mode, startX: event.clientX, startY: event.clientY, orig: box }
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const rect = imgRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0 || rect.height === 0) return
    const dx = (event.clientX - drag.startX) / rect.width
    const dy = (event.clientY - drag.startY) / rect.height
    const o = drag.orig
    if (drag.mode === 'move') {
      setBox(clampBox({ ...o, x: o.x + dx, y: o.y + dy }))
      return
    }
    const x2 = o.x + o.w
    const y2 = o.y + o.h
    if (drag.mode === 'se') setBox(normalizeBox(o.x, o.y, x2 + dx, y2 + dy))
    else if (drag.mode === 'nw') setBox(normalizeBox(o.x + dx, o.y + dy, x2, y2))
    else if (drag.mode === 'ne') setBox(normalizeBox(o.x, o.y + dy, x2 + dx, y2))
    else setBox(normalizeBox(o.x + dx, o.y, x2, y2 + dy))
  }

  const onPointerUp = () => {
    dragRef.current = null
  }

  const useFullPhoto = () => {
    setBox({ x: 0, y: 0, w: 1, h: 1 })
  }

  const resetBox = () => {
    setBox(DEFAULT_BOX)
  }

  /** Photo tedhi aayi ho to 90° ghumao. */
  const rotateImage = async () => {
    if (isWorking) return
    setIsWorking(true)
    try {
      const img = await loadImage(imgUrl)
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalHeight
      canvas.height = img.naturalWidth
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas not supported')
      ctx.translate(canvas.width / 2, canvas.height / 2)
      ctx.rotate(Math.PI / 2)
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2)
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
      if (!blob) throw new Error('Rotate failed')
      const url = URL.createObjectURL(blob)
      ownedUrls.current.push(url)
      setImgUrl(url)
      setBox(DEFAULT_BOX)
    } catch {
      // Rotate fail ho to kuch mat karo — original photo waisi hi rahegi.
    } finally {
      setIsWorking(false)
    }
  }

  const applyCrop = async () => {
    setIsWorking(true)
    try {
      const img = await loadImage(imgUrl)
      const sx = Math.round(box.x * img.naturalWidth)
      const sy = Math.round(box.y * img.naturalHeight)
      const sw = Math.round(box.w * img.naturalWidth)
      const sh = Math.round(box.h * img.naturalHeight)
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, sw)
      canvas.height = Math.max(1, sh)
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas not supported')
      if (enhance) ctx.filter = ENHANCE_FILTER
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
      if (!blob) throw new Error('Crop failed')
      const base = fileName.replace(/\.[a-zA-Z0-9]+$/, '') || 'question'
      onApply(new File([blob], `cropped-${base}.jpg`, { type: 'image/jpeg' }))
    } catch {
      onCancel()
    } finally {
      setIsWorking(false)
    }
  }

  return (
    <div className="crop-stage">
      <p className="crop-hint">Box ko drag karke <b>sirf question</b> select karo — kone pakadkar size badlo.</p>
      <div
        className="crop-wrap"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <img
          ref={imgRef}
          src={imgUrl}
          alt="Crop your question"
          draggable={false}
          style={enhance ? { filter: ENHANCE_FILTER } : undefined}
        />
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
          {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => (
            <div key={corner} className={`crop-handle ${corner}`} onPointerDown={onPointerDown(corner)} />
          ))}
        </div>
      </div>
      <div className="crop-tools">
        <button className="tool-btn" type="button" onClick={rotateImage} disabled={isWorking}>
          <RotateCw size={15} /> Rotate
        </button>
        <button
          className={enhance ? 'tool-btn active' : 'tool-btn'}
          type="button"
          onClick={() => setEnhance((v) => !v)}
          disabled={isWorking}
        >
          <Contrast size={15} /> Enhance {enhance ? 'on' : 'off'}
        </button>
        <button className="tool-btn" type="button" onClick={resetBox} disabled={isWorking}>
          Reset box
        </button>
        <button className="tool-btn" type="button" onClick={useFullPhoto} disabled={isWorking}>
          Full photo
        </button>
      </div>
      <div className="crop-actions">
        <button className="outline-button" type="button" onClick={onCancel} disabled={isWorking}>
          <X size={15} /> Wapas
        </button>
        <button className="analyze-button crop-apply" type="button" onClick={applyCrop} disabled={isWorking}>
          {isWorking ? 'Taiyaar ho raha...' : <><Check size={16} /> Crop & continue</>}
        </button>
      </div>
    </div>
  )
}
