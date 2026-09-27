import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, BookOpen, Camera, Check, ChevronRight, CircleHelp, Clipboard, Crop, FileText, History, ImagePlus, Lightbulb, Menu, Sparkles, Upload, X } from 'lucide-react'
import type { StructuredSolution } from './types/solution'
import { demoSolution } from './data/demoSolution'
import CropEditor from './components/CropEditor'
import './App.css'
import './mobile.css'
import './lens.css'

const primaryIdentities = [
  { formula: 'sin² A + cos² A = 1', label: 'Fundamental identity', tone: 'coral' },
  { formula: '1 + tan² A = sec² A', label: 'Pythagorean identity', tone: 'blue' },
  { formula: '1 + cot² A = cosec² A', label: 'Pythagorean form', tone: 'yellow' },
  { formula: 'tan A = sin A / cos A', label: 'Quotient identity', tone: 'coral' },
]

const allIdentities = [
  { formula: 'sin² A + cos² A = 1', label: 'Fundamental identity', tone: 'coral' },
  { formula: '1 + tan² A = sec² A', label: 'Pythagorean identity', tone: 'blue' },
  { formula: '1 + cot² A = cosec² A', label: 'Pythagorean form', tone: 'yellow' },
  { formula: 'tan A = sin A / cos A', label: 'Quotient identity', tone: 'coral' },
  { formula: 'cot A = cos A / sin A', label: 'Reciprocal quotient', tone: 'blue' },
  { formula: 'sec A = 1 / cos A', label: 'Reciprocal identity', tone: 'yellow' },
  { formula: 'cosec A = 1 / sin A', label: 'Reciprocal identity', tone: 'coral' },
  { formula: 'sin(90°−A) = cos A', label: 'Cofunction identity', tone: 'blue' },
  { formula: 'cos(90°−A) = sin A', label: 'Cofunction identity', tone: 'yellow' },
  { formula: 'sin 2A = 2 sin A cos A', label: 'Double angle identity', tone: 'coral' },
  { formula: 'cos 2A = cos²A − sin²A', label: 'Double angle identity', tone: 'blue' },
  { formula: 'tan 2A = 2 tan A / (1 − tan²A)', label: 'Double angle identity', tone: 'yellow' },
]

const steps = [
  { number: '01', icon: Camera, title: 'Photo upload karo', copy: 'Question ki clear photo lo ya gallery se select karo.' },
  { number: '02', icon: Sparkles, title: 'AI samjhega', copy: 'Hum question, topic aur given values ko carefully read karenge.' },
  { number: '03', icon: Lightbulb, title: 'Solution seekho', copy: 'Har step ka why samjho, phir similar question practice karo.' },
]

function App() {
  const fileInput = useRef<HTMLInputElement>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [selectedUpload, setSelectedUpload] = useState<File | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isReading, setIsReading] = useState(false)
  const [solution, setSolution] = useState<StructuredSolution | null>(null)
  const [isDemoSolution, setIsDemoSolution] = useState(false)
  const [showAllIdentities, setShowAllIdentities] = useState(false)
  const cameraInput = useRef<HTMLInputElement>(null)
  const [cropImage, setCropImage] = useState<{ url: string; name: string } | null>(null)
  const solutionRef = useRef<HTMLElement | null>(null)
  // Answer milte hi answer section me auto-scroll karo.
  useEffect(() => {
    if (solution) {
      // Modal close + paint hone ke baad scroll karo.
      const timer = window.setTimeout(() => {
        solutionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 80)
      return () => window.clearTimeout(timer)
    }
  }, [solution])
  const chooseFile = () => fileInput.current?.click()
  const chooseCamera = () => cameraInput.current?.click()
  const clearCrop = () => {
    if (cropImage) URL.revokeObjectURL(cropImage.url)
    setCropImage(null)
  }
  // Lens-style: koi bhi image pehle crop/adjust stage me jayegi.
  const startCrop = (file: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setUploadError('Sirf JPG, PNG ya WEBP image upload karo.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Image 10 MB se chhoti honi chahiye.')
      return
    }
    setUploadError(null)
    if (cropImage) URL.revokeObjectURL(cropImage.url)
    setCropImage({ url: URL.createObjectURL(file), name: file.name })
  }
  const pasteFromClipboard = async () => {
    try {
      const items = await navigator.clipboard.read()
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith('image/'))
        if (type) {
          const blob = await item.getType(type)
          startCrop(new File([blob], 'pasted-image.png', { type: blob.type || 'image/png' }))
          return
        }
      }
      setUploadError('Clipboard me koi image nahi mili. Screenshot copy karke Ctrl+V dabao.')
    } catch {
      setUploadError('Clipboard read nahi ho paya. Image copy karke modal me Ctrl+V dabao.')
    }
  }
  const openUploader = () => {
    setUploadOpen(true)
    setUploadError(null)
  }
  const handleFile = (file: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setUploadError('Sirf JPG, PNG ya WEBP image upload karo.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Image 10 MB se chhoti honi chahiye.')
      return
    }
    setUploadError(null)
    setSelectedFile(file.name)
    setSelectedUpload(file)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(file))
    clearCrop()
  }
  const onFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) startCrop(file)
  }
  const closeUploader = () => {
    setUploadOpen(false)
    setIsReading(false)
    clearCrop()
  }
  const removeFile = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setSelectedFile(null)
    setSelectedUpload(null)
    setPreviewUrl(null)
    setUploadError(null)
    clearCrop()
    if (fileInput.current) fileInput.current.value = ''
    if (cameraInput.current) cameraInput.current.value = ''
  }
  const adjustCrop = () => {
    if (!selectedUpload) return
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    if (cropImage) URL.revokeObjectURL(cropImage.url)
    setCropImage({ url: URL.createObjectURL(selectedUpload), name: selectedUpload.name })
  }
  // Lens-style: modal khula ho to Ctrl+V / paste se image lo.
  useEffect(() => {
    if (!uploadOpen) return
    const onPaste = (event: ClipboardEvent) => {
      const item = Array.from(event.clipboardData?.items ?? []).find((i) => i.type.startsWith('image/'))
      const file = item?.getAsFile()
      if (file) {
        event.preventDefault()
        startCrop(file)
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [uploadOpen])
  const analyzeSolution = async () => {
    if (!selectedUpload) return
    setIsReading(true)
    setUploadError(null)
    const formData = new FormData()
    formData.append('questionImage', selectedUpload)
    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'
      const response = await fetch(`${apiUrl}/solve`, { method: 'POST', body: formData })
      const payload = await response.json() as { status?: string; solution?: StructuredSolution; message?: string; code?: string }
      if (!response.ok || !payload.solution) {
        throw new Error(payload.message ?? 'Question analyze nahi ho paya. Please try again.')
      }
      setSolution(payload.solution)
      setIsDemoSolution(payload.status === 'demo')
      setUploadOpen(false)
    } catch (error) {
      // Static hosting par backend reachable nahi hota (Failed to fetch /
      // TypeError) → browser me hi offline demo solution dikhao taaki
      // Solve kabhi atak na jaye.
      if (error instanceof TypeError) {
        setSolution(demoSolution)
        setIsDemoSolution(true)
        setUploadOpen(false)
        setUploadError(null)
        return
      }
      setUploadError(error instanceof Error ? error.message : 'Something went wrong. Please try again.')
    } finally {
      setIsReading(false)
    }
  }

  return <div className="app-shell">
    <header className="site-header">
      <a className="brand" href="#top" aria-label="Trigmitra home"><span className="brand-mark"><span>∿</span></span><span>TRIGMITRA<small>trigonometry, made clear</small></span></a>
      <nav className={mobileMenuOpen ? 'main-nav is-open' : 'main-nav'} aria-label="Main navigation"><a className="active" href="#top">Home</a><a href="#how-it-works">How it works</a><a href="#identities">Identities</a><a href="#practice">Practice</a></nav>
      <div className="header-actions"><button className="icon-button mobile-menu" aria-label="Open menu" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>{mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}</button><button className="history-button"><History size={16} /> Track progress</button></div>
    </header>
    <main id="top">
      <section className="hero-section"><div className="hero-copy"><motion.div className="eyebrow" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}><span className="eyebrow-dot" /> CLASS 10 · TRIGONOMETRY</motion.div><motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>Photo upload karo.<br /><em>Trig samjho.</em><br />Confident bano.</motion.h1><motion.p className="hero-intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>Difficult question ka sirf answer nahi — <strong>har step ka why</strong> samjho, simple Hinglish mein.</motion.p><motion.div className="hero-actions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.28 }}><input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={onFileSelected} /><input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={onFileSelected} /><button className="primary-button" onClick={openUploader}><Upload size={18} /> {selectedFile ? 'Photo selected' : 'Solve my question'} <ArrowRight size={17} /></button><a className="text-button" href="#identities"><BookOpen size={17} /> Explore identities</a></motion.div><div className="trust-line"><span className="avatar-stack"><i>R</i><i>S</i><i>K</i></span><span>Made for curious Class 10 minds</span><span className="trust-star">✦</span></div></div>
        <motion.div className="hero-visual" initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: .12 }}><div className="visual-grid" /><div className="doodle doodle-left">sin² θ<br /><span>+ cos² θ</span></div><div className="doodle doodle-right">∠</div><div className="question-paper"><div className="paper-top"><span className="paper-tag">QUESTION 04</span><span className="paper-dots">•••</span></div><p className="paper-question">If <b>tan A = 3/4</b>,<br />find the value of<br /><b>sin A + cos A.</b></p><div className="triangle"><span className="tri-height">3</span><span className="tri-base">4</span><span className="tri-hyp">5</span></div><div className="paper-rule" /><div className="paper-answer"><span>hint</span><b>Right triangle ratios</b></div></div><div className="ai-badge"><span className="ai-spark">✦</span><span><b>AI tutor</b><small>ready to explain</small></span><Check size={17} /></div><div className="floating-note"><Lightbulb size={15} /><span>Why this step?</span></div></motion.div>
      </section>
      <section className="marquee-strip" aria-label="Trigmitra features"><span>LEARN THE WHY</span><i>✦</i><span>NOT JUST THE ANSWER</span><i>✦</i><span>EXAM READY, ALWAYS</span><i>✦</i><span>LEARN THE WHY</span></section>
      <section className="section-block how-section" id="how-it-works"><div className="section-heading"><div><span className="section-kicker">THE TRIGMITRA METHOD</span><h2>From stuck to<br /><em>sorted.</em></h2></div><p>Three simple steps between you<br />and that “ohhh, samajh gaya!” moment.</p></div><div className="steps-grid">{steps.map((step, index) => { const Icon = step.icon; return <motion.article className="step-card" key={step.number} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * .08 }}><div className="step-top"><span className="step-number">{step.number}</span><div className="step-icon"><Icon size={20} /></div></div><h3>{step.title}</h3><p>{step.copy}</p><ChevronRight className="step-arrow" size={18} /></motion.article> })}</div></section>
      <section className="section-block identities-section" id="identities"><div className="section-heading"><div><span className="section-kicker">QUICK REFERENCE</span><h2>Identities worth<br /><em>knowing.</em></h2></div><button className="outline-button" type="button" onClick={() => setShowAllIdentities((value) => !value)}>{showAllIdentities ? 'Hide identities' : 'View all identities'} <ArrowRight size={16} /></button></div>{!showAllIdentities ? <div className="identity-grid">{primaryIdentities.map((identity) => <article className={`identity-card ${identity.tone}`} key={identity.formula}><div className="identity-icon"><FileText size={18} /></div><span>{identity.label}</span><h3>{identity.formula}</h3><p>Use when simplifying or connecting ratios.</p><button aria-label={`Learn about ${identity.label}`}><CircleHelp size={16} /></button></article>)}</div> : <div className="all-identities-panel"><div className="all-identities-header"><span className="section-kicker">ALL IDENTITIES</span><h3>Complete trigonometry toolkit</h3></div><div className="identity-grid full-grid">{allIdentities.map((identity) => <article className={`identity-card ${identity.tone}`} key={`${identity.label}-${identity.formula}`}><div className="identity-icon"><FileText size={18} /></div><span>{identity.label}</span><h3>{identity.formula}</h3><p>Use when simplifying or connecting ratios.</p><button aria-label={`Learn about ${identity.label}`}><CircleHelp size={16} /></button></article>)}</div></div>}</section>
      <section className="practice-band" id="practice"><div><span className="section-kicker">READY WHEN YOU ARE</span><h2>One question can<br /><em>change everything.</em></h2></div><div className="practice-cta"><p>Bring your toughest trigonometry problem. We’ll bring the patience.</p><button className="dark-button" onClick={openUploader}>Start solving <ArrowRight size={17} /></button></div></section>
    </main>
    {solution && <section ref={solutionRef} className="solution-panel" aria-labelledby="solution-title"><div className="solution-heading"><div><span className="section-kicker">YOUR TRIGMITRA SOLUTION</span><h2 id="solution-title">Question samjho.<br /><em>Phir solve karo.</em></h2></div><button className="close-solution" onClick={() => { setSolution(null); setIsDemoSolution(false) }}><X size={18} /> Close</button></div>{isDemoSolution && <div style={{ background: '#fff7e6', border: '1px solid #f0c36d', borderRadius: 12, padding: '10px 14px', marginBottom: 16 }}>⚠️ <b>Demo mode:</b> AI key configure nahi hai, isliye sample solution dikh raha hai. Real photo reading ke liye server me <code>AI_API_KEY</code> set karo.</div>}<div className="solution-meta"><div><span>TOPIC</span><b>{solution.topic}</b></div><div><span>TYPE</span><b>{solution.questionType}</b></div><div><span>DIFFICULTY</span><b>{solution.difficulty}</b></div></div><div className="detected-question"><span className="section-kicker">QUESTION DETECTED</span><p>{solution.question}</p><small>Need: {solution.required}</small></div><div className="solution-steps">{solution.steps.map((step) => <article className="solution-step" key={step.stepNumber}><div className="step-badge">{String(step.stepNumber).padStart(2, '0')}</div><div><span className="section-kicker">STEP {step.stepNumber}</span><h3>{step.expression}</h3><p>{step.explanation}</p>{step.identityUsed && <div className="used-identity"><strong>{step.identityUsed.name}</strong><span>{step.identityUsed.formula}</span><small>{step.identityUsed.reason}</small></div>}</div></article>)}</div><div className="final-answer"><span className="section-kicker">FINAL ANSWER</span><h3>{solution.finalAnswer}</h3><p>Exam tip: {solution.examTip ?? 'Steps ko clearly line-by-line likho.'}</p></div></section>}
    {uploadOpen && <div className="upload-overlay" role="dialog" aria-modal="true" aria-labelledby="upload-title"><div className="upload-workspace"><div className="upload-header"><div><span className="section-kicker">SOLVER · STEP 01</span><h2 id="upload-title">Question upload karo.</h2></div><button className="close-upload" aria-label="Close upload" onClick={closeUploader}><X size={20} /></button></div>{isReading ? <div className="reading-state"><div className="reading-orbit"><Sparkles size={25} /></div><h3>Question read kar rahe hain...</h3><p>Photo ko secure backend par bhej kar solution prepare kar rahe hain.</p><div className="loading-line"><span /></div></div> : cropImage ? <CropEditor imageUrl={cropImage.url} fileName={cropImage.name} onCancel={clearCrop} onApply={handleFile} /> : <><div className={isDragging ? 'drop-zone is-dragging' : 'drop-zone'} onDragOver={(event) => { event.preventDefault(); setIsDragging(true) }} onDragLeave={() => setIsDragging(false)} onDrop={(event) => { event.preventDefault(); setIsDragging(false); const file = event.dataTransfer.files[0]; if (file) startCrop(file) }}>{previewUrl ? <div className="preview-wrap"><img src={previewUrl} alt="Selected maths question" /><button className="remove-preview" onClick={adjustCrop}><Crop size={16} /> Adjust crop</button><button className="remove-preview" onClick={removeFile}><X size={16} /> Remove photo</button></div> : <><div className="upload-icon"><ImagePlus size={27} /></div><h3>Photo yahan drop karo</h3><p>ya apne device se ek clear question photo choose karo</p><button className="choose-button" onClick={chooseFile}>Choose photo <ArrowRight size={16} /></button><span className="upload-hint">JPG, PNG, WEBP · max 10 MB</span></>}</div>{!previewUrl && !cropImage && <><div className="source-row"><button className="source-btn" onClick={chooseFile}><ImagePlus size={16} /> Gallery</button><button className="source-btn" onClick={chooseCamera}><Camera size={16} /> Camera</button><button className="source-btn" onClick={pasteFromClipboard}><Clipboard size={16} /> Paste</button></div><p className="paste-hint">Lens ki tarah: photo lo, crop karo — ya screenshot copy karke <kbd>Ctrl</kbd>+<kbd>V</kbd> dabao</p></>}{uploadError && <div className="upload-error"><CircleHelp size={16} /> {uploadError}</div>}<div className="upload-tips"><div><Check size={15} /> Good lighting rakho</div><div><Check size={15} /> Full question visible ho</div><div><Check size={15} /> Image blur na ho</div></div>{previewUrl && <button className="analyze-button" onClick={analyzeSolution}>Understand my question <Sparkles size={17} /></button>}</>}</div></div>}
    <footer>
      <div className="brand"><span className="brand-mark"><span>∿</span></span><span>TRIGMITRA<small>trigonometry, made clear</small></span></div>
      <div className="footer-meta">
        <p>Built to make the “why” click.</p>
        <span className="developer-credit">by ASAD • student of Millat Academy</span>
      </div>
      <span>© 2026 Trigmitra</span>
    </footer>
  </div>
}

export default App
