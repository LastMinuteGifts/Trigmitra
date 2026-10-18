import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Atom, BookOpen, Camera, Check, ChevronRight, CircleHelp, FileText, FlaskConical, History, Home, Lightbulb, Moon, NotebookText, Pencil, Sigma, Sparkles, Sun, Upload, X } from 'lucide-react'
import type { DiagramReference, DiagramSpec, StructuredSolution } from './types/solution'
import { drawDiagram } from './utils/diagramDraw'
import UploadModal from './components/UploadModal'
import FigureView from './components/FigureView'
import QuizPage from './components/QuizModal'
import DoubtBox from './components/DoubtBox'
import SolutionActions from './components/SolutionActions'
import NotesModal from './components/NotesModal'
import AuthModal from './components/AuthModal'
import HistoryModal from './components/HistoryModal'
import AdminPanel from './components/AdminPanel'
import { supabase } from './lib/supabase'
import { demoSolution } from './data/demoSolution'
import { getFormulaExample } from './data/formulaExamples'
import { sanitizeSvg } from './utils/sanitizeSvg'
import './App.css'
import './mobile.css'
import './lens.css'

import { featuredFormulas, formulaCategories, tones } from './data/formulas'

const steps = [
  { number: '01', icon: Camera, title: 'Photo upload karo', copy: 'Question ki clear photo lo ya gallery se select karo.' },
  { number: '02', icon: Sparkles, title: 'AI samjhega', copy: 'Hum question, topic aur given values ko carefully read karenge.' },
  { number: '03', icon: Lightbulb, title: 'Solution seekho', copy: 'Har step ka why samjho, phir similar question practice karo.' },
]

// Header pill menu: icon + label wale 4 items (How it works ko menu me nahi rakha).
const navItems = [
  { id: 'top', label: 'Home', icon: Home },
  { id: 'identities', label: 'Formula', icon: Sigma },
  { id: 'notes', label: 'Notes', icon: NotebookText },
  { id: 'practice', label: 'Practice', icon: Pencil },
] as const

// Hero headline me ghumta shabd: Maths / Physics / Chemistry.
const sciWords = ['Maths', 'Physics', 'Chemistry']

// Hero badge me har class ka topic rotate hota hai.
const classTopics = [
  'CLASS 1 · NUMBERS',
  'CLASS 2 · ADDITION',
  'CLASS 3 · TABLES',
  'CLASS 4 · FRACTIONS',
  'CLASS 5 · DECIMALS',
  'CLASS 6 · BODMAS',
  'CLASS 7 · ALGEBRA',
  'CLASS 8 · EQUATIONS',
  'CLASS 9 · GEOMETRY',
  'CLASS 10 · TRIGONOMETRY',
  'CLASS 8 · FORCE',
  'CLASS 9 · MOTION',
  'CLASS 10 · LIGHT',
  'CLASS 10 · ELECTRICITY',
]

// Figure renderer: JSXGraph (exact geometry) pehle, purana SVG engine fallback baad me.
function Figure({ diagram, spec, small, label }: { diagram?: DiagramReference; spec?: DiagramSpec; small?: boolean; label?: string }) {
  const [jxgFailed, setJxgFailed] = useState(false)
  const caption = spec?.caption ?? diagram?.caption
  const specKey = spec ? JSON.stringify(spec) : ''
  if (!spec && !diagram) return null
  return (
    <div className={small ? 'diagram-card step-diagram' : 'diagram-card'}>
      {label && <span className="section-kicker">{label}</span>}
      {spec && !jxgFailed ? (
        <FigureView key={specKey} spec={spec} onError={() => setJxgFailed(true)} />
      ) : (
        (() => {
          const svg = (spec && drawDiagram(spec)) || (diagram ? sanitizeSvg(diagram.svg) : '')
          if (!svg) return null
          return <div className="diagram-svg" dangerouslySetInnerHTML={{ __html: svg }} />
        })()
      )}
      {caption && <small>{caption}</small>}
    </div>
  )
}

// Bina login trial: sirf 1 free solve, uske baad login lazmi.
const FREE_LIMIT = 1
const FREE_KEY = 'anknawab_free_solves'

function getFreeUsed(): number {
  try {
    const n = Number(localStorage.getItem(FREE_KEY) ?? 0)
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
  } catch {
    return 0
  }
}

// Logged-in user ka access abhi valid hai? Expiry har baar check hoti hai — automatic cut.
async function hasActiveAccess(): Promise<boolean> {
  if (!supabase) return true
  try {
    const { data } = await supabase.auth.getUser()
    if (!data.user) return false
    const res = await supabase.from('access_grants').select('expires_at').eq('user_id', data.user.id).maybeSingle()
    const row = res.data as { expires_at: string } | null
    return !!row && new Date(row.expires_at).getTime() > Date.now()
  } catch {
    return false
  }
}

// Login hote hi backend se trial claim karo (1 month + 10/day). Idempotent.
async function claimTrialAccess(): Promise<void> {
  if (!supabase) return
  try {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return
    const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'
    await fetch(`${apiUrl}/access/claim`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    // Trial claim fail ho to bhi app chalti rahe.
  }
}

async function getAccessExpiry(): Promise<string | null> {
  if (!supabase) return null
  try {
    const { data } = await supabase.auth.getUser()
    if (!data.user) return null
    const res = await supabase.from('access_grants').select('expires_at').eq('user_id', data.user.id).maybeSingle()
    const row = res.data as { expires_at: string } | null
    if (!row || new Date(row.expires_at).getTime() <= Date.now()) return null
    return row.expires_at
  } catch {
    return null
  }
}

function App() {
  const fileInput = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [selectedUpload, setSelectedUpload] = useState<File | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isReading, setIsReading] = useState(false)
  const [topicIdx, setTopicIdx] = useState(0)
  // Hero badge: har 2.5 sec me agle class ka topic.
  useEffect(() => {
    const id = window.setInterval(() => {
      setTopicIdx((i) => (i + 1) % classTopics.length)
    }, 2500)
    return () => window.clearInterval(id)
  }, [])
  const [solution, setSolution] = useState<StructuredSolution | null>(null)
  const [isDemoSolution, setIsDemoSolution] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [quizPage, setQuizPage] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [activeNav, setActiveNav] = useState('top')
  // Admin alag link se: #/admin khule to panel kholo + admin manifest lagao
  // taaki "Install app" karne par alag Admin app install ho.
  useEffect(() => {
    const sync = () => {
      const isAdmin = window.location.hash === '#/admin'
      setAdminOpen(isAdmin)
      const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
      if (manifest) manifest.href = isAdmin ? './admin.webmanifest' : './manifest.webmanifest'
      document.title = isAdmin ? 'AnkNawab Admin' : 'ANKNAWAB | Jawabo Ka Nawab'
    }
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])
  const closeAdmin = () => {
    setAdminOpen(false)
    if (window.location.hash === '#/admin') {
      history.replaceState(null, '', window.location.pathname + window.location.search)
    }
  }
  const [freeUsed, setFreeUsed] = useState(() => getFreeUsed())
  const [accessExpiry, setAccessExpiry] = useState<string | null>(null)
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('anknawab_theme') === 'dark' ? 'dark' : 'light'
    } catch {
      return 'light'
    }
  })
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('anknawab_theme', theme)
    } catch {
      // ignore
    }
  }, [theme])
  const [showAllIdentities, setShowAllIdentities] = useState(false)
  const [activeCategory, setActiveCategory] = useState('All')
  const [exampleOpen, setExampleOpen] = useState<{ cat: string; formula: string; label: string } | null>(null)
  const openExample = (formula: string, label: string) => {
    const cat = formulaCategories.find((c) => c.formulas.some((f) => f.formula === formula))?.name ?? 'Formula'
    setExampleOpen({ cat, formula, label })
  }
  const cameraInput = useRef<HTMLInputElement>(null)
  const [cropImage, setCropImage] = useState<{ url: string; name: string } | null>(null)
  const [originalUpload, setOriginalUpload] = useState<File | null>(null)
  const [studentClass, setStudentClass] = useState('')
  const [inputMode, setInputMode] = useState<'photo' | 'text'>('photo')
  const [questionText, setQuestionText] = useState('')
  const [photoNote, setPhotoNote] = useState('')
  const solutionRef = useRef<HTMLElement | null>(null)
  // Boot preloader: app paint hone ke baad smooth fade-out.
  useEffect(() => {
    const el = document.getElementById('boot-screen')
    if (!el) return
    const t = window.setTimeout(() => {
      el.classList.add('done')
      window.setTimeout(() => el.remove(), 650)
    }, 1150)
    return () => window.clearTimeout(t)
  }, [])
  // Login session track karo.
  useEffect(() => {
    if (!supabase) return
    const applySession = (email: string | null, name: string | null) => {
      setUserEmail(email)
      setUserName(name && name.trim() ? name.trim() : null)
    }
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user
      applySession(u?.email ?? null, (u?.user_metadata?.display_name as string | undefined) ?? null)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user
      applySession(u?.email ?? null, (u?.user_metadata?.display_name as string | undefined) ?? null)
    })
    return () => listener.subscription.unsubscribe()
  }, [])
  // Login badalte hi access expiry lao.
  useEffect(() => {
    if (!userEmail) {
      setAccessExpiry(null)
      return
    }
    // Pehle trial claim (naye user ko 1 month + 10/day), phir expiry padho.
    claimTrialAccess().then(() => getAccessExpiry().then(setAccessExpiry))
  }, [userEmail])
  // Solved solution history me save karo (login ho tabhi).
  const saveSolution = async (sol: StructuredSolution, status?: string) => {
    if (!supabase) return
    try {
      const { data } = await supabase.auth.getUser()
      const user = data.user
      if (!user) return
      await supabase.from('solutions').insert({
        user_id: user.id,
        question: sol.question,
        topic: sol.topic,
        question_type: sol.questionType,
        difficulty: sol.difficulty,
        final_answer: sol.finalAnswer,
        is_demo: status === 'demo',
        solution: sol,
      })
    } catch {
      // History optional hai — fail ho to chupchaap ignore.
    }
  }
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
    setOriginalUpload(file)
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
    setOriginalUpload(null)
    setPreviewUrl(null)
    setUploadError(null)
    clearCrop()
    if (fileInput.current) fileInput.current.value = ''
    if (cameraInput.current) cameraInput.current.value = ''
  }
  const adjustCrop = () => {
    // Hamesha ORIGINAL photo se dobara crop karo — cropped wali se nahi.
    const src = originalUpload ?? selectedUpload
    if (!src) return
    if (cropImage) URL.revokeObjectURL(cropImage.url)
    setCropImage({ url: URL.createObjectURL(src), name: src.name })
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
    // Guest trial khatm → pehle login.
    if (!userEmail && getFreeUsed() >= FREE_LIMIT) {
      setUploadError('Tumhara 1 free solve khatm ho gaya! Aage solve karne ke liye login karo.')
      setAuthOpen(true)
      return
    }
    // Logged-in user ka access valid hai? Expiry automatic cut karti hai.
    if (userEmail) {
      const allowed = await hasActiveAccess()
      if (!allowed) {
        setAccessExpiry(null)
        setUploadError('Your access has expired. Please contact the admin for access.')
        return
      }
    }
    const isTextMode = inputMode === 'text'
    if (isTextMode && !questionText.trim()) {
      setUploadError('Pehle apna question likho.')
      return
    }
    if (!isTextMode && !selectedUpload) return
    setIsReading(true)
    setUploadError(null)
    const formData = new FormData()
    if (isTextMode) {
      formData.append('questionText', questionText.trim())
    } else {
      if (selectedUpload) formData.append('questionImage', selectedUpload)
      if (photoNote.trim()) formData.append('description', photoNote.trim())
    }
    if (studentClass) formData.append('studentClass', studentClass)
    // Logged-in user ka token bhejo taaki server access + daily limit check kare.
    let authHeaders: Record<string, string> = {}
    if (supabase && userEmail) {
      try {
        const { data } = await supabase.auth.getSession()
        const token = data.session?.access_token
        if (token) authHeaders = { Authorization: `Bearer ${token}` }
      } catch {
        // ignore — bina token request jayegi
      }
    }
    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'
      const response = await fetch(`${apiUrl}/solve`, { method: 'POST', headers: authHeaders, body: formData })
      const payload = await response.json() as { status?: string; solution?: StructuredSolution; message?: string; code?: string }
      if (!response.ok || !payload.solution) {
        throw new Error(payload.message ?? 'Question analyze nahi ho paya. Please try again.')
      }
      setSolution(payload.solution)
      setIsDemoSolution(payload.status === 'demo')
      setUploadOpen(false)
      saveSolution(payload.solution, payload.status)
      if (!userEmail) {
        const used = getFreeUsed() + 1
        try {
          localStorage.setItem(FREE_KEY, String(used))
        } catch {
          // ignore
        }
        setFreeUsed(used)
      }
    } catch (error) {
      // Static hosting par backend reachable nahi hota (Failed to fetch /
      // TypeError) → browser me hi offline demo solution dikhao taaki
      // Solve kabhi atak na jaye.
      if (error instanceof TypeError) {
        setSolution(demoSolution)
        setIsDemoSolution(true)
        setUploadOpen(false)
        setUploadError(null)
        saveSolution(demoSolution, 'demo')
        if (!userEmail) {
          const used = getFreeUsed() + 1
          try {
            localStorage.setItem(FREE_KEY, String(used))
          } catch {
            // ignore
          }
          setFreeUsed(used)
        }
        return
      }
      setUploadError(error instanceof Error ? error.message : 'Something went wrong. Please try again.')
    } finally {
      setIsReading(false)
    }
  }

  // Quiz dedicated page: #/quiz khule to full page, warna homepage.
  useEffect(() => {
    const sync = () => setQuizPage(window.location.hash === '#/quiz')
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])
  const closeQuizPage = () => {
    setQuizPage(false)
    if (window.location.hash === '#/quiz') {
      history.replaceState(null, '', window.location.pathname + window.location.search)
    }
  }
  const openQuizPage = () => {
    window.location.hash = '#/quiz'
  }
  // Admin alag full page par: public site bilkul nahi dikhegi.
  if (adminOpen) {
    return <AdminPanel onClose={closeAdmin} />
  }
  if (quizPage) {
    return <QuizPage onExit={closeQuizPage} />
  }

  return <div className="app-shell">
    <header className="site-header">
      <a className="brand" href="#top" aria-label="AnkNawab home"><span className="brand-mark"><img src="./logo-icon.svg?v=2" alt="AnkNawab logo" /></span><span>ANKNAWAB<small>jawabo ka nawab</small></span></a>
      <div className="header-actions"><button className="icon-button theme-toggle" aria-label={theme === 'dark' ? 'Light mode' : 'Dark mode'} onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button><button className="history-button" onClick={() => setHistoryOpen(true)}><History size={16} /> Track progress</button>{userEmail ? <button className="user-chip" title={userName ?? userEmail} onClick={() => setHistoryOpen(true)}>{(userName?.[0] ?? userEmail[0]).toUpperCase()}</button> : <button className="user-chip login-chip" onClick={() => setAuthOpen(true)}>Login</button>}</div>
    </header>
    <nav className="main-nav" aria-label="Main navigation">{navItems.map((item) => { const Icon = item.icon; return <a key={item.id} className={activeNav === item.id ? 'active' : undefined} href={`#${item.id}`} onClick={() => setActiveNav(item.id)}><Icon size={20} aria-hidden="true" /><span>{item.label}</span></a> })}</nav>
    <main id="top">
      <section className="hero-section"><div className="hero-copy"><motion.div className="eyebrow" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}><span className="eyebrow-dot" /><AnimatePresence mode="wait"><motion.span key={topicIdx} className="eyebrow-text" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.35 }}>{classTopics[topicIdx]}</motion.span></AnimatePresence></motion.div><motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>Photo upload karo.<br /><em><AnimatePresence mode="wait"><motion.span key={topicIdx % sciWords.length} className="sci-word" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.35 }}>{sciWords[topicIdx % sciWords.length]} samjho.</motion.span></AnimatePresence></em><br />Confident bano.</motion.h1><motion.p className="hero-intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>Maths, Physics ya Chemistry — difficult question ka sirf answer nahi, <strong>har step ka why</strong> samjho, simple Hinglish mein.</motion.p><motion.div className="hero-actions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.28 }}><input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={onFileSelected} /><input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={onFileSelected} /><button className="primary-button" onClick={openUploader}><Upload size={18} /> {selectedFile ? 'Photo selected' : 'Solve my question'} <ArrowRight size={17} /></button><a className="text-button" href="#identities"><Sigma size={17} /> Explore formulas</a></motion.div><div className="trust-line"><span className="avatar-stack"><i>R</i><i>S</i><i>K</i></span><span>Made for curious Class 1–10 minds</span><span className="trust-star">✦</span></div></div>
        <motion.div className="hero-visual" initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: .12 }}><div className="visual-grid" /><div className="doodle doodle-left">sin² θ<br /><span>+ cos² θ</span></div><div className="doodle doodle-right">∠</div><div className="question-paper"><div className="paper-top"><span className="paper-tag">QUESTION 04</span><span className="paper-dots">•••</span></div><p className="paper-question">If <b>tan A = 3/4</b>,<br />find the value of<br /><b>sin A + cos A.</b></p><div className="triangle"><span className="tri-height">3</span><span className="tri-base">4</span><span className="tri-hyp">5</span></div><div className="paper-rule" /><div className="paper-answer"><span>hint</span><b>Right triangle ratios</b></div></div><div className="ai-badge"><span className="ai-spark">✦</span><span><b>AI tutor</b><small>ready to explain</small></span><Check size={17} /></div><div className="science-chip"><Atom size={14} /><span>F = ma · Class 9</span></div><div className="floating-note"><Lightbulb size={15} /><span>Why this step?</span></div></motion.div>
      </section>
      <section className="marquee-strip" aria-label="AnkNawab features"><div className="marquee-track"><div className="marquee-group"><span>LEARN THE WHY</span><i>✦</i><span>MATHS + SCIENCE</span><i>✦</i><span>NOT JUST THE ANSWER</span><i>✦</i><span>EXAM READY, ALWAYS</span><i>✦</i></div><div className="marquee-group" aria-hidden="true"><span>LEARN THE WHY</span><i>✦</i><span>MATHS + SCIENCE</span><i>✦</i><span>NOT JUST THE ANSWER</span><i>✦</i><span>EXAM READY, ALWAYS</span><i>✦</i></div></div></section>
      <section className="section-block how-section" id="how-it-works"><div className="section-heading"><div><span className="section-kicker">THE ANKNAWAB METHOD</span><h2>From stuck to<br /><em>sorted.</em></h2></div><p>Three simple steps between you<br />and that “ohhh, samajh gaya!” moment.</p></div><div className="steps-grid">{steps.map((step, index) => { const Icon = step.icon; return <motion.article className="step-card" key={step.number} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * .08 }}><div className="step-top"><span className="step-number">{step.number}</span><div className="step-icon"><Icon size={20} /></div></div><h3>{step.title}</h3><p>{step.copy}</p><ChevronRight className="step-arrow" size={18} /></motion.article> })}</div></section>
      <section className="section-block subjects-section" id="subjects"><div className="section-heading"><div><span className="section-kicker">MATHS + SCIENCE</span><h2>Three subjects.<br /><em>One Nawab.</em></h2></div><p>Photo bhejo — solve pao.<br />Teeno me expert.</p></div><div className="steps-grid"><motion.article className="step-card" initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}><div className="step-top"><span className="step-number">M</span><div className="step-icon"><BookOpen size={20} /></div></div><h3>Mathematics · Class 1–10</h3><p>Arithmetic, Algebra, Geometry, Trig — 160+ formulas ke saath step-by-step.</p><div className="subject-tags"><span>Algebra</span><span>Geometry</span><span>Trig</span></div></motion.article><motion.article className="step-card" initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.08 }}><div className="step-top"><span className="step-number">P</span><div className="step-icon"><Atom size={20} /></div></div><h3>Physics · Class 6–10</h3><p>Motion, Force, Light, Electricity ke numericals — kahani samjho, phir solve.</p><div className="subject-tags"><span>Motion</span><span>Light</span><span>Current</span></div></motion.article><motion.article className="step-card" initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.16 }}><div className="step-top"><span className="step-number">C</span><div className="step-icon"><FlaskConical size={20} /></div></div><h3>Chemistry · Class 6–10</h3><p>Mole concept, gas laws, acids-bases aur reactions — numericals aur balancing.</p><div className="subject-tags"><span>Mole</span><span>Gas Laws</span><span>Reactions</span></div></motion.article></div></section>
      <section className="section-block identities-section" id="identities"><div className="section-heading"><div><span className="section-kicker">QUICK REFERENCE</span><h2>Formulas worth<br /><em>knowing.</em></h2></div><button className="outline-button" type="button" onClick={() => setShowAllIdentities((value) => !value)}>{showAllIdentities ? 'Hide formulas' : 'View all formulas'} <ArrowRight size={16} /></button></div><div className="cat-chips" role="tablist" aria-label="Formula categories">{['All', ...formulaCategories.map((c) => c.name)].map((name) => <button key={name} role="tab" aria-selected={activeCategory === name} className={activeCategory === name ? 'cat-chip active' : 'cat-chip'} onClick={() => setActiveCategory(name)}>{name}</button>)}</div>{activeCategory === 'All' && !showAllIdentities ? <div className="identity-grid">{featuredFormulas.map((identity) => <article className={`identity-card ${identity.tone}`} key={identity.formula} onClick={() => openExample(identity.formula, identity.label)}><div className="identity-icon"><FileText size={18} /></div><span>{identity.label}</span><h3>{identity.formula}</h3><p>Keep handy while solving.</p><button aria-label={`Learn about ${identity.label}`}><CircleHelp size={16} /></button></article>)}</div> : <div className="all-identities-panel">{(activeCategory === 'All' ? formulaCategories : formulaCategories.filter((c) => c.name === activeCategory)).map((cat, gi) => <div key={cat.name}><div className="all-identities-header"><span className="section-kicker">{cat.name.toUpperCase()}</span><h3>{cat.name} formulas</h3></div><div className="identity-grid full-grid">{cat.formulas.map((entry, fi) => { const tone = tones[(gi + fi) % tones.length]; return <article className={`identity-card ${tone}`} key={`${cat.name}-${entry.formula}`} onClick={() => openExample(entry.formula, entry.label)}><div className="identity-icon"><FileText size={18} /></div><span>{entry.label}</span><h3>{entry.formula}</h3><p>Keep handy while solving.</p><button aria-label={`Learn about ${entry.label}`}><CircleHelp size={16} /></button></article> })}</div></div>)}</div>}</section>
      <section className="notes-band" id="notes"><div><span className="section-kicker">REVISE SMARTER</span><h2>Chapter notes,<br /><em>ek nazar me.</em></h2></div><div className="practice-cta"><p>Class 6–10 ke chapters ka quick summary, key points aur formulas — revision se pehle do minute ka look.</p><button className="quiz-button" type="button" onClick={() => setNotesOpen(true)}><BookOpen size={17} /> Revise chapter</button></div></section>
      <section className="quiz-band" id="quiz"><div><span className="section-kicker">TEST YOURSELF</span><h2>Quiz khelo,<br /><em>topper bano.</em></h2></div><div className="practice-cta"><p>Class, topics (max 3) aur questions (10–50) chuno. Har MCQ ke saath galat hote hi turant explanation.</p><button className="quiz-button" onClick={openQuizPage}>Take a Quiz <ArrowRight size={17} /></button></div></section>
      <section className="practice-band" id="practice"><div><span className="section-kicker">READY WHEN YOU ARE</span><h2>One question can<br /><em>change everything.</em></h2></div><div className="practice-cta"><p>Bring your toughest maths, physics or chemistry problem, Class 1 to 10. We’ll bring the patience.</p><button className="quiz-button" onClick={openUploader}>Start solving <ArrowRight size={17} /></button></div></section>
    </main>
    {solution && <section ref={solutionRef} className="solution-panel" aria-labelledby="solution-title"><div className="solution-heading"><div><span className="section-kicker">YOUR ANKNAWAB SOLUTION</span><h2 id="solution-title">Question samjho.<br /><em>Phir solve karo.</em></h2></div><div className="solution-heading-actions"><SolutionActions solution={solution} /><button className="close-solution" onClick={() => { setSolution(null); setIsDemoSolution(false) }}><X size={18} /> Close</button></div></div>{isDemoSolution && <div style={{ background: '#fff7e6', border: '1px solid #f0c36d', borderRadius: 12, padding: '10px 14px', marginBottom: 16 }}>⚠️ <b>Demo mode:</b> AI busy hai ya key configure nahi hai, isliye sample solution dikh raha hai. <button type="button" onClick={analyzeSolution} style={{ marginLeft: 8, padding: '6px 12px', borderRadius: 8, border: '1px solid #f0c36d', background: '#fff', fontWeight: 700, cursor: 'pointer' }}>Dobara try karo</button></div>}<div className="solution-meta"><div><span>TOPIC</span><b>{solution.topic}</b></div><div><span>TYPE</span><b>{solution.questionType}</b></div><div><span>DIFFICULTY</span><b>{solution.difficulty}</b></div></div><div className="detected-question"><span className="section-kicker">QUESTION DETECTED</span><p>{solution.question}</p><small>Need: {solution.required}</small></div>{solution.wordProblemMeaning && <div className="meaning-card"><span className="section-kicker">PEHLE YE SAMJHO</span><p>{solution.wordProblemMeaning}</p></div>}{(solution.diagram || solution.diagramSpec) && <Figure diagram={solution.diagram} spec={solution.diagramSpec} label="DIAGRAM" />}<div className="solution-steps">{solution.steps.map((step) => <article className="solution-step" key={step.stepNumber}><div className="step-badge">{String(step.stepNumber).padStart(2, '0')}</div><div><span className="section-kicker">STEP {step.stepNumber}</span><h3>{step.expression}</h3><p>{step.explanation}</p>{step.identityUsed && <div className="used-identity"><strong>{step.identityUsed.name}</strong><span>{step.identityUsed.formula}</span><small>{step.identityUsed.reason}</small></div>}{(step.diagram || step.diagramSpec) && <Figure diagram={step.diagram} spec={step.diagramSpec} small />}</div></article>)}</div><div className="final-answer"><span className="section-kicker">FINAL ANSWER</span><h3>{solution.finalAnswer}</h3><p>Exam tip: {solution.examTip ?? 'Steps ko clearly line-by-line likho.'}</p></div><DoubtBox key={solution.question} solution={solution} /></section>}
    {exampleOpen && <div className="example-overlay" role="dialog" aria-modal="true" aria-label="Formula example" onClick={() => setExampleOpen(null)}><div className="example-box" onClick={(event) => event.stopPropagation()}><div className="example-head"><div><span className="section-kicker">{exampleOpen.cat.toUpperCase()}</span><h3>{exampleOpen.formula}</h3></div><button className="close-upload" aria-label="Close example" onClick={() => setExampleOpen(null)}><X size={20} /></button></div><p className="example-label">{exampleOpen.label}</p>{(() => { const ex = getFormulaExample(exampleOpen.formula); if (!ex) return <p className="example-label">Is formula ka example jald aa raha hai.</p>; return <><div className="example-q"><span className="section-kicker">EXAMPLE</span><p>{ex.q}</p></div><ol className="example-steps">{ex.steps.map((s, i) => <li key={i}>{s}</li>)}</ol></> })()}</div></div>}
    {uploadOpen && <UploadModal
        closeUploader={closeUploader}
        isReading={isReading}
        cropImage={cropImage}
        clearCrop={clearCrop}
        handleFile={handleFile}
        inputMode={inputMode}
        setInputMode={setInputMode}
        questionText={questionText}
        setQuestionText={setQuestionText}
        isDragging={isDragging}
        setIsDragging={setIsDragging}
        startCrop={startCrop}
        previewUrl={previewUrl}
        adjustCrop={adjustCrop}
        removeFile={removeFile}
        chooseFile={chooseFile}
        chooseCamera={chooseCamera}
        pasteFromClipboard={pasteFromClipboard}
        uploadError={uploadError}
        studentClass={studentClass}
        setStudentClass={setStudentClass}
        photoNote={photoNote}
        setPhotoNote={setPhotoNote}
        analyzeSolution={analyzeSolution}
        freeLeft={userEmail ? null : Math.max(0, FREE_LIMIT - freeUsed)}
      />}
    {notesOpen && <NotesModal onClose={() => setNotesOpen(false)} />}
    {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    {historyOpen && <HistoryModal
      userEmail={userEmail}
      accessExpiry={accessExpiry}
      onClose={() => setHistoryOpen(false)}
      onLogin={() => { setHistoryOpen(false); setAuthOpen(true) }}
      onLogout={async () => { await supabase?.auth.signOut(); setUserEmail(null) }}
      onView={(sol, demo) => { setSolution(sol); setIsDemoSolution(demo); setHistoryOpen(false) }}
    />}
    <footer>
      <div className="footer-meta">
        <span className="developer-credit">by ASAD • student of Millat Academy</span>
      </div>
      <span>© 2026 AnkNawab</span>
    </footer>
  </div>
}

export default App
