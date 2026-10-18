import { useCallback, useEffect, useRef, useState } from 'react'

type RecognitionResult = {
  isFinal: boolean
  0: { transcript: string }
}

type RecognitionEvent = {
  resultIndex: number
  results: { length: number } & Record<number, RecognitionResult>
}

type RecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: RecognitionEvent) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
}

type SpeechWindow = Window & {
  SpeechRecognition?: new () => RecognitionLike
  webkitSpeechRecognition?: new () => RecognitionLike
}

function createRecognition(): RecognitionLike | null {
  if (typeof window === 'undefined') return null
  const win = window as SpeechWindow
  const Ctor = win.SpeechRecognition ?? win.webkitSpeechRecognition
  if (!Ctor) return null
  return new Ctor()
}

/**
 * Web Speech API wrapper — Hinglish bol ke question likhne ke liye.
 * Browser support na ho to `supported` false rehta hai.
 */
export function useSpeechInput(lang = 'en-IN') {
  const [supported] = useState(() => createRecognition() !== null)
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const recRef = useRef<RecognitionLike | null>(null)
  const onFinalRef = useRef<(text: string) => void>(() => {})

  const stop = useCallback(() => {
    recRef.current?.stop()
  }, [])

  const start = useCallback(
    (onFinal: (text: string) => void) => {
      const rec = createRecognition()
      if (!rec) return
      onFinalRef.current = onFinal
      try {
        recRef.current?.abort()
      } catch {
        recRef.current = null
      }
      rec.lang = lang
      rec.continuous = false
      rec.interimResults = true
      rec.onresult = (event) => {
        let finalText = ''
        let interimText = ''
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i]
          if (result.isFinal) finalText += result[0].transcript
          else interimText += result[0].transcript
        }
        setInterim(interimText)
        if (finalText) {
          setInterim('')
          onFinalRef.current(finalText.trim())
        }
      }
      rec.onerror = () => {
        setListening(false)
        setInterim('')
      }
      rec.onend = () => {
        setListening(false)
        setInterim('')
      }
      recRef.current = rec
      try {
        rec.start()
        setListening(true)
      } catch {
        setListening(false)
      }
    },
    [lang],
  )

  useEffect(
    () => () => {
      try {
        recRef.current?.abort()
      } catch {
        recRef.current = null
      }
    },
    [],
  )

  return { supported, listening, interim, start, stop }
}
