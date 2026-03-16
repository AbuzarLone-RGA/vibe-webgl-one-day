'use client'

import { EffectComposer, SelectiveBloom } from '@react-three/postprocessing'
import { KernelSize } from 'postprocessing'

export default function BeeEffects() {
  return (
    <EffectComposer>
      <SelectiveBloom
        intensity={3.5}
        luminanceThreshold={0.05}
        luminanceSmoothing={0.5}
        kernelSize={KernelSize.LARGE}
        mipmapBlur={false}
      />
    </EffectComposer>
  )
}
