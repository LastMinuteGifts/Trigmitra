import { Mic, MicOff } from 'lucide-react'
import { useSpeechInput } from '../utils/speech'

interface VoiceButtonProps {
  onText: (text: string) => void
  className?: string
}

/** Mic button — bol kar likho (Hinglish). Unsupported browser me kuch render nahi karta. */
export default function VoiceButton({ onText, className }: VoiceButtonProps) {
  const { supported, listening, interim, start, stop } = useSpeechInput()

  if (!supported) return null

  return (
    <span className={className ? `voice-input ${className}` : 'voice-input'}>
      <button
        type="button"
        className={listening ? 'voice-button is-listening' : 'voice-button'}
        aria-label={listening ? 'Stop voice input' : 'Bol kar likho'}
        title={listening ? 'Sun raha hun — rokne ke liye tap karo' : 'Bol kar likho (Hinglish)'}
        onClick={() => (listening ? stop() : start(onText))}
      >
        {listening ? <MicOff size={16} /> : <Mic size={16} />}
        <span className="voice-label">{listening ? 'Sun raha hun…' : 'Bol ke likho'}</span>
      </button>
      {listening && interim && <span className="voice-interim">{interim}</span>}
    </span>
  )
}
