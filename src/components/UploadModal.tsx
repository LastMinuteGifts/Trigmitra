import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Camera, Check, CircleHelp, Clipboard, Crop, ImagePlus, PenLine, Sparkles, X } from 'lucide-react'
import CropEditor from './CropEditor'
import MathKeyboard from './MathKeyboard'

const readingMessages = [
  'Photo backend ko bhej di...',
  'AI question padh raha hai...',
  'Steps aur identities ban rahe hain...',
  'Bas thoda aur, final answer aa raha hai...',
]

interface UploadModalProps {
  closeUploader: () => void
  isReading: boolean
  cropImage: { url: string; name: string } | null
  clearCrop: () => void
  handleFile: (file: File) => void
  inputMode: 'photo' | 'text'
  setInputMode: (mode: 'photo' | 'text') => void
  questionText: string
  setQuestionText: (value: string) => void
  isDragging: boolean
  setIsDragging: (value: boolean) => void
  startCrop: (file: File) => void
  previewUrl: string | null
  adjustCrop: () => void
  removeFile: () => void
  chooseFile: () => void
  chooseCamera: () => void
  pasteFromClipboard: () => void
  uploadError: string | null
  studentClass: string
  setStudentClass: (value: string) => void
  photoNote: string
  setPhotoNote: (value: string) => void
  analyzeSolution: () => void
}

export default function UploadModal(props: UploadModalProps) {
  const {
    closeUploader, isReading, cropImage, clearCrop, handleFile,
    inputMode, setInputMode, questionText, setQuestionText,
    isDragging, setIsDragging, startCrop, previewUrl, adjustCrop, removeFile,
    chooseFile, chooseCamera, pasteFromClipboard,
    uploadError, studentClass, setStudentClass, photoNote, setPhotoNote,
    analyzeSolution,
  } = props

  const [readingIdx, setReadingIdx] = useState(0)
  const typeAreaRef = useRef<HTMLTextAreaElement>(null)
  // Virtual maths keyboard: cursor position par symbol insert karo.
  const insertSymbol = (symbol: string) => {
    const el = typeAreaRef.current
    if (!el) {
      setQuestionText(questionText + symbol)
      return
    }
    const start = el.selectionStart ?? questionText.length
    const end = el.selectionEnd ?? questionText.length
    setQuestionText(questionText.slice(0, start) + symbol + questionText.slice(end))
    window.requestAnimationFrame(() => {
      el.focus()
      const pos = start + symbol.length
      el.setSelectionRange(pos, pos)
    })
  }
  const keyboardBackspace = () => {
    const el = typeAreaRef.current
    if (!el) {
      setQuestionText(questionText.slice(0, -1))
      return
    }
    const start = el.selectionStart ?? questionText.length
    const end = el.selectionEnd ?? questionText.length
    const next = start === end
      ? questionText.slice(0, Math.max(0, start - 1)) + questionText.slice(end)
      : questionText.slice(0, start) + questionText.slice(end)
    const pos = start === end ? Math.max(0, start - 1) : start
    setQuestionText(next)
    window.requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(pos, pos)
    })
  }
  // Reading ke dauran progress messages badlo taaki wait chhota lage.
  useEffect(() => {
    if (!isReading) {
      setReadingIdx(0)
      return
    }
    const id = window.setInterval(() => {
      setReadingIdx((i) => (i + 1) % readingMessages.length)
    }, 4000)
    return () => window.clearInterval(id)
  }, [isReading])

  return (
    <div className="upload-overlay" role="dialog" aria-modal="true" aria-labelledby="upload-title">
      <div className="upload-workspace">
        <div className="upload-header">
          <div>
            <span className="section-kicker">SOLVER · STEP 01</span>
            <h2 id="upload-title">Question upload karo.</h2>
          </div>
          <button className="close-upload" aria-label="Close upload" onClick={closeUploader}>
            <X size={20} />
          </button>
        </div>
        {isReading ? (
          <div className="reading-state">
            <div className="reading-orbit">
              <Sparkles size={25} />
            </div>
            <h3>Question read kar rahe hain...</h3>
            <p>{readingMessages[readingIdx]}</p>
            <div className="loading-line">
              <span />
            </div>
          </div>
        ) : cropImage ? (
          <CropEditor imageUrl={cropImage.url} fileName={cropImage.name} onCancel={clearCrop} onApply={handleFile} />
        ) : (
          <>
            {inputMode === 'text' ? (
              <div className="type-stage">
                <label className="type-label">
                  Apna question yahan likho
                  <textarea
                    ref={typeAreaRef}
                    value={questionText}
                    onChange={(event) => setQuestionText(event.target.value)}
                    rows={5}
                    placeholder="Jaise: If tan A = 3/4, find sin A + cos A"
                  />
                </label>
                <MathKeyboard
                  onInsert={insertSymbol}
                  onBackspace={keyboardBackspace}
                  onClear={() => setQuestionText('')}
                />
                <button className="text-button" type="button" onClick={() => setInputMode('photo')}>
                  ← Photo se bhejna hai?
                </button>
              </div>
            ) : (
              <>
                <div
                  className={isDragging ? 'drop-zone is-dragging' : 'drop-zone'}
                  onDragOver={(event) => {
                    event.preventDefault()
                    setIsDragging(true)
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(event) => {
                    event.preventDefault()
                    setIsDragging(false)
                    const file = event.dataTransfer.files[0]
                    if (file) startCrop(file)
                  }}
                >
                  {previewUrl ? (
                    <div className="preview-wrap">
                      <img src={previewUrl} alt="Selected maths question" />
                      <button className="remove-preview" onClick={adjustCrop}>
                        <Crop size={16} /> Adjust crop
                      </button>
                      <button className="remove-preview" onClick={removeFile}>
                        <X size={16} /> Remove photo
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="upload-icon">
                        <ImagePlus size={27} />
                      </div>
                      <h3>Photo yahan drop karo</h3>
                      <p>ya apne device se ek clear question photo choose karo</p>
                      <button className="choose-button" onClick={chooseFile}>
                        Choose photo <ArrowRight size={16} />
                      </button>
                      <span className="upload-hint">JPG, PNG, WEBP · max 10 MB</span>
                    </>
                  )}
                </div>
                {!previewUrl && (
                  <>
                    <div className="source-row">
                      <button className="source-btn" onClick={() => { setInputMode('photo'); chooseFile() }}>
                        <ImagePlus size={16} /> Gallery
                      </button>
                      <button className="source-btn" onClick={() => { setInputMode('photo'); chooseCamera() }}>
                        <Camera size={16} /> Camera
                      </button>
                      <button className="source-btn" onClick={pasteFromClipboard}>
                        <Clipboard size={16} /> Paste
                      </button>
                      <button
                        className="source-btn"
                        onClick={() => setInputMode('text')}
                      >
                        <PenLine size={16} /> Type
                      </button>
                    </div>
                    <p className="paste-hint">
                      Lens ki tarah: photo lo, crop karo — ya screenshot copy karke <kbd>Ctrl</kbd>+<kbd>V</kbd> dabao
                    </p>
                  </>
                )}
              </>
            )}
            {uploadError && (
              <div className="upload-error">
                <CircleHelp size={16} /> {uploadError}
              </div>
            )}
            {inputMode === 'photo' && (
              <div className="upload-tips">
                <div>
                  <Check size={15} /> Good lighting rakho
                </div>
                <div>
                  <Check size={15} /> Full question visible ho
                </div>
                <div>
                  <Check size={15} /> Image blur na ho
                </div>
              </div>
            )}
            <label className="class-pick">
              Class{' '}
              <select value={studentClass} onChange={(event) => setStudentClass(event.target.value)} aria-label="Select class">
                <option value="">Auto (AI pehchane)</option>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <option key={n} value={String(n)}>
                    Class {n}
                  </option>
                ))}
              </select>
            </label>
            {previewUrl && (
              <label className="note-field">
                Photo ke saath note (optional)
                <textarea
                  value={photoNote}
                  onChange={(event) => setPhotoNote(event.target.value)}
                  rows={2}
                  placeholder="Jaise: second part bhi solve karo"
                />
              </label>
            )}
            {(previewUrl || inputMode === 'text') && (
              <button className="analyze-button" onClick={analyzeSolution}>
                Understand my question <Sparkles size={17} />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
