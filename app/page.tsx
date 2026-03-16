'use client'

import { Canvas } from '@react-three/fiber'
import Scene from '@/components/Scene'

export default function Home() {
  return (
    <main style={{ width: '100vw', height: '100vh', background: '#000' }}>
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0, 5], fov: 75, near: 0.1, far: 200 }}
        gl={{ antialias: true }}
        style={{ width: '100%', height: '100%' }}
      >
        <Scene />
      </Canvas>
    </main>
  )
}
