import { useState } from 'react'
import { Eye, EyeOff, GraduationCap, LogIn, UserPlus, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { CLASS_LEVELS, classFromUser, parseClassLevel } from '../utils/studentClass'

interface AuthModalProps {
  onClose: () => void
  /** Class save hone par App ko turant batao (metadata listener ka wait na karo). */
  onClassSaved?: (level: number) => void
  /** Koi feature login maang raha hai — ye wajah modal ke top par dikhao. */
  reason?: string | null
}

export default function AuthModal({ onClose, onClassSaved, reason }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  // Login/signup ke baad class confirm karne ka step.
  const [step, setStep] = useState<'form' | 'class'>('form')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [classLevel, setClassLevel] = useState('')
  /** Pehle se saved class (purane user) — isse "update" wala message dikhta hai. */
  const [savedClass, setSavedClass] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const resendLink = async () => {
    if (!supabase) return
    if (!email.trim()) {
      setError('Pehle email likho.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim() })
      if (error) throw error
      setNotice('Naya link bhej diya! Email check karo (spam folder bhi dekho).')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kuch gadbad hui. Phir try karo.')
    } finally {
      setBusy(false)
    }
  }

  const submit = async () => {
    if (!supabase) {
      setError('Login abhi setup nahi hai.')
      return
    }
    if (!email.trim() || password.length < 6) {
      setError('Email likho aur kam se kam 6 letters ka password rakho.')
      return
    }
    if (mode === 'signup' && name.trim().length < 2) {
      setError('Apna naam likho (kam se kam 2 letters).')
      return
    }
    const level = parseClassLevel(classLevel)
    if (mode === 'signup' && !level) {
      setError('Apni class chuno (1 se 10).')
      return
    }
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      if (mode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
        // Login ho gaya — ab class confirm/update karo. Purane user ki class
        // pehle se ho to wahi select ho jati hai.
        const existing = classFromUser(data.user)
        setSavedClass(existing)
        setClassLevel(existing ? String(existing) : '')
        setStep('class')
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: name.trim(), class_level: level } },
        })
        if (error) throw error
        if (data.session) {
          if (level) onClassSaved?.(level)
          onClose()
        } else {
          setNotice('Account ban gaya! Email me aaya link kholo, phir login karo. Class bhi save ho gayi hai.')
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kuch gadbad hui. Phir try karo.')
    } finally {
      setBusy(false)
    }
  }

  const saveClass = async () => {
    if (!supabase) {
      setError('Login abhi setup nahi hai.')
      return
    }
    const level = parseClassLevel(classLevel)
    if (!level) {
      setError('Apni class chuno (1 se 10).')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const { error } = await supabase.auth.updateUser({ data: { class_level: level } })
      if (error) throw error
      onClassSaved?.(level)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Class save nahi hui. Phir try karo.')
    } finally {
      setBusy(false)
    }
  }

  const heading =
    step === 'class' ? 'Apni class batao' : mode === 'login' ? 'Wapas aao!' : 'Naya account'

  return (
    <div className="example-overlay" role="dialog" aria-modal="true" aria-label="Login" onClick={onClose}>
      <div className="example-box auth-box" onClick={(event) => event.stopPropagation()}>
        <div className="example-head">
          <div>
            <span className="section-kicker">ANKNAWAB ACCOUNT</span>
            <h3>{heading}</h3>
          </div>
          <button className="close-upload" aria-label="Close login" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {step === 'class' ? (
          <>
            <div className="auth-class-hero">
              <GraduationCap size={22} />
              <div>
                <b>{savedClass ? 'Class update karo' : 'Ek chhoti si baat'}</b>
                <p>
                  {savedClass
                    ? `Tumhari saved class ${savedClass} hai. Agli class me chale gaye ho to yahan badal do — quiz aur sawaal usi hisaab se milenge.`
                    : 'Class bata do, taaki quiz, notes aur sawaal tumhari class ke hisaab se dikhein.'}
                </p>
              </div>
            </div>
            <label className="auth-field">
              Tumhari class
              <select
                value={classLevel}
                onChange={(event) => {
                  setClassLevel(event.target.value)
                  setError(null)
                }}
                aria-label="Select your class"
              >
                <option value="">Class chuno</option>
                {CLASS_LEVELS.map((n) => (
                  <option key={n} value={String(n)}>
                    Class {n}
                  </option>
                ))}
              </select>
            </label>
            {error && <div className="upload-error">{error}</div>}
            <button className="analyze-button auth-submit" onClick={saveClass} disabled={busy || !classLevel}>
              {busy ? 'Ruko...' : (<><GraduationCap size={16} /> {savedClass ? 'Class update karo' : 'Save karo'}</>)}
            </button>
            <button className="text-button resend-link" type="button" onClick={onClose} disabled={busy}>
              {savedClass ? 'Abhi nahi, baad me' : 'Skip — baad me bataunga'}
            </button>
          </>
        ) : (
          <>
            <p className={reason ? 'example-label auth-reason' : 'example-label'}>{reason ?? 'Login karoge to tumhare solved questions save rahenge — har device par.'}</p>
            <div className="auth-tab-row">
              <div className="auth-tabs" role="tablist">
                <button
                  role="tab"
                  aria-selected={mode === 'login'}
                  className={mode === 'login' ? 'cat-chip active' : 'cat-chip'}
                  onClick={() => setMode('login')}
                >
                  Login
                </button>
                <button
                  role="tab"
                  aria-selected={mode === 'signup'}
                  className={mode === 'signup' ? 'cat-chip active' : 'cat-chip'}
                  onClick={() => setMode('signup')}
                >
                  Signup
                </button>
              </div>
              <button
                type="button"
                className="cat-chip auth-teacher-chip"
                onClick={() => {
                  onClose()
                  window.location.hash = '#/teacher'
                }}
              >
                <GraduationCap size={14} /> Teacher login
              </button>
            </div>
            <label className="auth-field">
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="tum@example.com"
                autoComplete="email"
              />
            </label>
            {mode === 'signup' && (
              <>
                <label className="auth-field">
                  Tumhara naam
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Jaise: Asad"
                    autoComplete="given-name"
                  />
                </label>
                <label className="auth-field">
                  Tumhari class
                  <select
                    value={classLevel}
                    onChange={(event) => setClassLevel(event.target.value)}
                    aria-label="Select your class"
                  >
                    <option value="">Class chuno</option>
                    {CLASS_LEVELS.map((n) => (
                      <option key={n} value={String(n)}>
                        Class {n}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            <label className="auth-field">
              Password
              <div className="password-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Kam se kam 6 letters"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>
            {mode === 'login' && (
              <p className="example-label auth-class-hint">Login ke baad class confirm karne ka option milega.</p>
            )}
            {error && <div className="upload-error">{error}</div>}
            {notice && <div className="auth-notice">{notice}</div>}
            <button className="analyze-button auth-submit" onClick={submit} disabled={busy}>
              {busy ? 'Ruko...' : mode === 'login' ? (<><LogIn size={16} /> Login karo</>) : (<><UserPlus size={16} /> Account banao</>)}
            </button>
            <button className="text-button resend-link" type="button" onClick={resendLink} disabled={busy}>
              Link nahi aaya ya expire ho gaya? Dobara bhejo
            </button>
          </>
        )}
      </div>
    </div>
  )
}
