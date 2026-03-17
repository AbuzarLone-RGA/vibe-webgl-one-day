'use client'

import AudioParticleField from './AudioParticleField'

interface Props {
  dataRef:     React.RefObject<Uint8Array>
  analyserRef: React.RefObject<AnalyserNode | null>
}

export default function DanceScene({ dataRef, analyserRef }: Props) {
  return (
    <>
      <color attach="background" args={['#000000']} />
      <fog attach="fog" args={['#000000', 20, 55]} />
      <AudioParticleField dataRef={dataRef} analyserRef={analyserRef} />
    </>
  )
}
