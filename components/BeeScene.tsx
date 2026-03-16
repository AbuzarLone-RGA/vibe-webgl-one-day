'use client'

import { Selection, Select } from '@react-three/postprocessing'
import BeeParticles from './BeeParticles'
import BeeEffects from './BeeEffects'

export default function BeeScene() {
  return (
    <>
      <color attach="background" args={['#000000']} />

      <Selection>
        <Select enabled>
          <BeeParticles />
        </Select>

        <BeeEffects />
      </Selection>
    </>
  )
}
