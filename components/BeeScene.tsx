'use client'

import BeeParticles from './BeeParticles'

export default function BeeScene() {
  return (
    <>
      <color attach="background" args={['#000000']} />
      <BeeParticles />
    </>
  )
}
