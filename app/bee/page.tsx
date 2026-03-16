'use client'

import { Canvas } from '@react-three/fiber'
import BeeScene from '@/components/BeeScene'

export default function BeePage() {
  return (
    <main style={{ position: 'relative', width: '100vw', height: '100vh', background: '#000' }}>
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0, 5], fov: 75, near: 0.1, far: 200 }}
        gl={{ antialias: true }}
        style={{ width: '100%', height: '100%' }}
      >
        <BeeScene />
      </Canvas>
      <div style={{
        position: 'absolute',
        top: '16px',
        left: '16px',
        color: '#ffffff',
        fontFamily: 'monospace',
        fontSize: '11px',
        letterSpacing: '0.15em',
        pointerEvents: 'none',
        userSelect: 'none',
      }}>
        ONE:DAY
      </div>
    </main>
  )
}
