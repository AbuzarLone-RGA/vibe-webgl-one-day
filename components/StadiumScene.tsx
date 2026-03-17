'use client'

import { useGLTF } from '@react-three/drei'
import { OrbitControls } from '@react-three/drei'

function Stadium() {
  const { scene } = useGLTF('/OD_R1_RnD_Stadium.gltf')
  return <primitive object={scene} position={[0, -3, 0]} />
}

export default function StadiumScene() {
  return (
    <>
      <color attach="background" args={['#000000']} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 20, 10]} intensity={1.2} />
      <Stadium />
      <OrbitControls />
    </>
  )
}
