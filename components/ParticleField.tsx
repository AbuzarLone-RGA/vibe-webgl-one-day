'use client'

import { useMemo } from 'react'
import { generateParticles } from '@/lib/generateParticles'
import ParticleSystem from './ParticleSystem'

export default function ParticleField() {
  // 25k particles for the dense overlapping disc cloud
  const particleData = useMemo(() => generateParticles(25000), [])

  return <ParticleSystem data={particleData} />
}
