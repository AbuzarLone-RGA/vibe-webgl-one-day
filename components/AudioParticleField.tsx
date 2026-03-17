'use client'

import { useMemo } from 'react'
import { generateParticles } from '@/lib/generateParticles'
import AudioParticleSystem from './AudioParticleSystem'

interface Props {
  dataRef:     React.RefObject<Uint8Array>
  analyserRef: React.RefObject<AnalyserNode | null>
}

export default function AudioParticleField({ dataRef, analyserRef }: Props) {
  const particleData = useMemo(() => generateParticles(25000), [])
  return <AudioParticleSystem data={particleData} dataRef={dataRef} analyserRef={analyserRef} />
}
