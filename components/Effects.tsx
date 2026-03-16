'use client'

import { EffectComposer, DepthOfField, SelectiveBloom } from '@react-three/postprocessing'
import { KernelSize } from 'postprocessing'

export default function Effects() {
  return (
    <EffectComposer>
      <DepthOfField
        focusDistance={0.04}
        focalLength={0.022}
        bokehScale={6}
        height={700}
      />
      {/*
        SelectiveBloom on the text layer only.
        SMALL kernel + low smoothing keeps the glow tight to each particle
        so it traces the letter shapes rather than spilling into the black surround.
      */}
      <SelectiveBloom
        intensity={1.0}
        luminanceThreshold={0.15}
        luminanceSmoothing={0.4}
        kernelSize={KernelSize.SMALL}
        mipmapBlur={false}
      />
    </EffectComposer>
  )
}
