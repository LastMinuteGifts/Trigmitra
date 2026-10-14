import { useState } from 'react'
import { LogIn, UserPlus, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface AuthModalProps {
  onClose: () => void
}

export default function AuthModal({ onClose }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const submit = async () => {
    if (!supabase) {
      setError('Login abhi setup nahi hai.')
      return
    }
    if (!email.trim() || password.length < 6) {
      setError('Email likho aur kam se kam 6 letters ka password rakho.')
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
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password })
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
        <label className="auth-field">
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Kam se kam 6 letters"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </label>
        {error && <div className="upload-error">{error}</div>}
        {notice && <div className="auth-notice">{notice}</div>}
        <button className="analyze-button auth-submit" onClick={submit} disabled={busy}>
          {busy ? 'Ruko...' : mode === 'login' ? (<><LogIn size={16} /> Login karo</>) : (<><UserPlus size={16} /> Account banao</>)}
        </button>
      </div>
    </div>
  )
}
