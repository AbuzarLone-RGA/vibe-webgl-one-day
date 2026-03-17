'use client'

import { Canvas } from '@react-three/fiber'
import StadiumScene from '@/components/StadiumScene'

export default function StadiumPage() {
  return (
    <main style={{ width: '100vw', height: '100vh', background: '#000' }}>
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 18, 12], fov: 45, near: 0.1, far: 2000 }}
        gl={{ antialias: true }}
        style={{ width: '100%', height: '100%' }}
      >
        <StadiumScene />
      </Canvas>
    </main>
  )
}
