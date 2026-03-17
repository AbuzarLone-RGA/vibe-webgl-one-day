'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

export function useAudioAnalyzer(src: string) {
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef    = useRef<HTMLAudioElement | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const ctxRef      = useRef<AudioContext | null>(null)
  const dataRef     = useRef<Uint8Array>(new Uint8Array(256))

  useEffect(() => {
    const audio = new Audio(src)
    audio.loop = true
    audioRef.current = audio

    // AudioContext created lazily on first toggle to satisfy browser autoplay policy
    return () => {
      audio.pause()
      ctxRef.current?.close()
    }
  }, [src])

  const toggle = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    if (!ctxRef.current) {
      // First play — wire up the Web Audio graph
      const ctx      = new AudioContext()
      const source   = ctx.createMediaElementSource(audio)
      const analyser = ctx.createAnalyser()
      analyser.fftSize               = 512   // 256 frequency bins
      analyser.smoothingTimeConstant = 0.8

      source.connect(analyser)
      analyser.connect(ctx.destination)

      ctxRef.current      = ctx
      analyserRef.current = analyser
      dataRef.current     = new Uint8Array(analyser.frequencyBinCount)
    }

    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
    } else {
      ctxRef.current!.resume().then(() => {
        audio.play()
        setIsPlaying(true)
      })
    }
  }, [isPlaying])

  return { dataRef, analyserRef, isPlaying, toggle }
}
