'use client'

import { Canvas } from '@react-three/fiber'
import DanceScene from '@/components/DanceScene'
import { useAudioAnalyzer } from '@/lib/useAudioAnalyzer'

export default function DancePage() {
  const { dataRef, analyserRef, isPlaying, toggle } = useAudioAnalyzer('/track.mp3')

  return (
    <main style={{ width: '100vw', height: '100vh', background: '#000' }}>
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0, 5], fov: 75, near: 0.1, far: 200 }}
        gl={{ antialias: true }}
        style={{ width: '100%', height: '100%' }}
      >
        <DanceScene dataRef={dataRef} analyserRef={analyserRef} />
      </Canvas>

      <button
        onClick={toggle}
        style={{
          position:        'fixed',
          bottom:          32,
          left:            '50%',
          transform:       'translateX(-50%)',
          background:      'rgba(255,255,255,0.08)',
          border:          '1px solid rgba(255,255,255,0.18)',
          borderRadius:    '50%',
          width:           52,
          height:          52,
          cursor:          'pointer',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          fontSize:        20,
          color:           '#fff',
          backdropFilter:  'blur(8px)',
          transition:      'background 0.2s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.18)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>
    </main>
  )
}
