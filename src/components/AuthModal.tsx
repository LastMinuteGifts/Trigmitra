import { useState } from 'react'
import { Eye, EyeOff, LogIn, UserPlus, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface AuthModalProps {
  onClose: () => void
}

export default function AuthModal({ onClose }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
        onClose()
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: name.trim() } },
        })
        if (error) throw error
        if (data.session) {
          onClose()
        } else {
          setNotice('Account ban gaya! Email me aaya link kholo, phir login karo.')
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kuch gadbad hui. Phir try karo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="example-overlay" role="dialog" aria-modal="true" aria-label="Login" onClick={onClose}>
      <div className="example-box auth-box" onClick={(event) => event.stopPropagation()}>
        <div className="example-head">
          <div>
            <span className="section-kicker">ANKNAWAB ACCOUNT</span>
            <h3>{mode === 'login' ? 'Wapas aao!' : 'Naya account'}</h3>
          </div>
          <button className="close-upload" aria-label="Close login" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <p className="example-label">Login karoge to tumhare solved questions save rahenge — har device par.</p>
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
        {error && <div className="upload-error">{error}</div>}
        {notice && <div className="auth-notice">{notice}</div>}
        <button className="analyze-button auth-submit" onClick={submit} disabled={busy}>
          {busy ? 'Ruko...' : mode === 'login' ? (<><LogIn size={16} /> Login karo</>) : (<><UserPlus size={16} /> Account banao</>)}
        </button>
        <button className="text-button resend-link" type="button" onClick={resendLink} disabled={busy}>
          Link nahi aaya ya expire ho gaya? Dobara bhejo
        </button>
      </div>
    </div>
  )
}
