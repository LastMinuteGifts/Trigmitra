import { useState } from 'react'
import { GraduationCap, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { CLASS_LEVELS, parseClassLevel } from '../utils/studentClass'

interface ClassPromptProps {
  /** Jis account ke liye poochh rahe hain (sirf message me dikhane ke liye). */
  userEmail: string
  /** Pehle se saved class (normally null — prompt tabhi khulta hai jab class na ho). */
  savedClass: number | null
  onSaved: (level: number) => void
  onClose: () => void
}

/**
 * Site khulte hi purane logged-in user se class poochhne wala popup.
 * Login form sirf tab dikhta hai jab dobara login karo — isliye jo pehle se
 * logged-in hain unke liye ye alag prompt chahiye.
 */
export default function ClassPrompt({ userEmail, savedClass, onSaved, onClose }: ClassPromptProps) {
  const [classLevel, setClassLevel] = useState(savedClass ? String(savedClass) : '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
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
      const { error: saveError } = await supabase.auth.updateUser({ data: { class_level: level } })
      if (saveError) throw saveError
      onSaved(level)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Class save nahi hui. Phir try karo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="example-overlay" role="dialog" aria-modal="true" aria-label="Apni class batao" onClick={onClose}>
      <div className="example-box auth-box" onClick={(event) => event.stopPropagation()}>
        <div className="example-head">
          <div>
            <span className="section-kicker">ANKNAWAB ACCOUNT</span>
            <h3>Apni class batao</h3>
          </div>
          <button className="close-upload" aria-label="Close class prompt" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="auth-class-hero">
          <GraduationCap size={22} />
          <div>
            <b>Ek chhoti si baat</b>
            <p>
              Tum pehle se logged in ho. Bas class bata do, taaki quiz, notes aur sawaal tumhari class
              ke hisaab se dikhein aur leaderboard me sahi class me naam aaye.
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

        <button className="analyze-button auth-submit" onClick={save} disabled={busy || !classLevel}>
          {busy ? 'Ruko...' : (<><GraduationCap size={16} /> Save karo</>)}
        </button>
        <button className="text-button resend-link" type="button" onClick={onClose} disabled={busy}>
          Abhi nahi, baad me
        </button>
        <p className="example-label auth-class-hint">Login: {userEmail}</p>
      </div>
    </div>
  )
}
