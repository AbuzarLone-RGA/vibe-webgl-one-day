'use client'

import { Selection, Select } from '@react-three/postprocessing'
import ParticleField from './ParticleField'
import TextParticles from './TextParticles'
import Effects from './Effects'

export default function Scene() {
  return (
    <>
      <color attach="background" args={['#000000']} />
      <fog attach="fog" args={['#000000', 20, 55]} />

      <Selection>
        {/* Crowd particles — no bloom, purely atmospheric */}
        <ParticleField />

        {/* Text particles — bloom source, glow stays on the letters */}
        <Select enabled>
          <TextParticles />
        </Select>

        <Effects />
      </Selection>
    </>
  )
}
