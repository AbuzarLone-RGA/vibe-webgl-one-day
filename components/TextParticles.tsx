'use client'

import { useMemo, useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const TEXT_PARTICLE_COUNT = 1500
const REPULSION_RADIUS    = 1.5
const REPULSION_STRENGTH  = 0.15
const SPRING_STRENGTH     = 0.06
const DAMPING             = 0.65  // overdamped — snaps back without bouncing

const TRANSITION_START    = 9.5   // reveal done at ~4.5s + 5s hold
const TRANSITION_DURATION = 1.5

function sampleTextToPositions(text: string, count: number): Float32Array {
  const W = 1024, H = 256
  const canvas = document.createElement('canvas')
  canvas.width  = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = 'black'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = 'white'
  ctx.font = '300 148px Arial, Helvetica, sans-serif'
  ctx.textAlign    = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, W / 2, H / 2)

  const { data } = ctx.getImageData(0, 0, W, H)
  const textPixels: [number, number][] = []
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * 4] > 128) textPixels.push([x, y])
    }
  }

  const worldW = 11.0
  const worldH = worldW * (H / W)
  const positions = new Float32Array(count * 3)

  for (let i = 0; i < count; i++) {
    const [px, py] = textPixels.length > 0
      ? textPixels[Math.floor(Math.random() * textPixels.length)]
      : [W / 2, H / 2]
    positions[i * 3 + 0] =  (px / W - 0.5) * worldW
    positions[i * 3 + 1] = -(py / H - 0.5) * worldH
    positions[i * 3 + 2] = 0.5
  }

  return positions
}

function sampleTextPositions(count: number) {
  const positions = sampleTextToPositions('ONE DAY', count)
  const phases = new Float32Array(count)
  const rates  = new Float32Array(count)

  for (let i = 0; i < count; i++) {
    phases[i] = Math.random() * Math.PI * 2
    rates[i]  = 0.05 + Math.random() * 0.25
  }

  return { positions, phases, rates }
}

export default function TextParticles() {
  const pointsRef = useRef<THREE.Points>(null)
  const mouseNDC  = useRef({ x: -9999, y: -9999 })
  const { camera } = useThree()
  const raycaster  = useMemo(() => new THREE.Raycaster(), [])

  const {
    geometry,
    material,
    originalPositions,
    startPositions,
    targetPositions,
    velocities,
  } = useMemo(() => {
    const { positions, phases, rates } = sampleTextPositions(TEXT_PARTICLE_COUNT)
    const datePositions = sampleTextToPositions('03.13.26', TEXT_PARTICLE_COUNT)

    const sizes = new Float32Array(TEXT_PARTICLE_COUNT)
    for (let i = 0; i < TEXT_PARTICLE_COUNT; i++) {
      sizes[i] = 0.035 + Math.random() * 0.025
    }

    const attr = new THREE.BufferAttribute(positions, 3)
    attr.setUsage(THREE.DynamicDrawUsage)

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', attr)
    geo.setAttribute('size',     new THREE.BufferAttribute(sizes,  1))
    geo.setAttribute('phase',    new THREE.BufferAttribute(phases, 1))
    geo.setAttribute('rate',     new THREE.BufferAttribute(rates,  1))

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime:   { value: 0 },
        uReveal: { value: 0 },
        uColor:  { value: new THREE.Color(1, 1, 1) },
      },
      vertexShader: /* glsl */ `
        attribute float size;
        attribute float phase;
        attribute float rate;
        uniform float uTime;
        uniform float uReveal;
        varying float vOn;

        void main() {
          float revealThreshold = phase / (2.0 * 3.14159265);
          float revealed = step(revealThreshold, uReveal);

          float cycle = sin(uTime * rate + phase);
          vOn = revealed * step(-0.6, cycle);

          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (400.0 / -mvPosition.z);
          gl_Position  = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vOn;
        uniform vec3 uColor;

        void main() {
          vec2  uv = gl_PointCoord - 0.5;
          float d  = length(uv);
          if (d > 0.5) discard;

          float alpha = vOn * 4.0;
          gl_FragColor = vec4(uColor * alpha, alpha);
        }
      `,
      transparent: true,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
    })

    return {
      geometry:          geo,
      material:          mat,
      originalPositions: new Float32Array(positions),
      startPositions:    new Float32Array(positions),
      targetPositions:   datePositions,
      velocities:        new Float32Array(TEXT_PARTICLE_COUNT * 3),
    }
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseNDC.current.x =  (e.clientX / window.innerWidth)  * 2 - 1
      mouseNDC.current.y = -(e.clientY / window.innerHeight) * 2 + 1
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  useEffect(() => {
    return () => { geometry.dispose(); material.dispose() }
  }, [geometry, material])

  useFrame((_, delta) => {
    if (!pointsRef.current) return

    raycaster.setFromCamera(mouseNDC.current as THREE.Vector2, camera)
    const rayOrigin = raycaster.ray.origin
    const rayDir    = raycaster.ray.direction
    const refDepth  = Math.abs(0 - rayOrigin.z)

    const positions = geometry.attributes.position.array as Float32Array

    for (let i = 0; i < TEXT_PARTICLE_COUNT; i++) {
      const i3 = i * 3

      const localX = positions[i3]
      const localY = positions[i3 + 1]
      const localZ = originalPositions[i3 + 2]

      const rayT  = (localZ - rayOrigin.z) / rayDir.z
      const mxAtZ = rayOrigin.x + rayDir.x * rayT
      const myAtZ = rayOrigin.y + rayDir.y * rayT

      const depthFactor  = Math.abs(localZ - rayOrigin.z) / refDepth
      const scaledRadius = REPULSION_RADIUS * depthFactor

      const dx     = localX - mxAtZ
      const dy     = localY - myAtZ
      const distSq = dx * dx + dy * dy

      if (distSq < scaledRadius * scaledRadius && distSq > 0) {
        const dist  = Math.sqrt(distSq)
        const force = (1 - dist / scaledRadius) * REPULSION_STRENGTH
        velocities[i3]     += (dx / dist) * force
        velocities[i3 + 1] += (dy / dist) * force
      }

      velocities[i3]     += (originalPositions[i3]     - localX) * SPRING_STRENGTH
      velocities[i3 + 1] += (originalPositions[i3 + 1] - localY) * SPRING_STRENGTH

      velocities[i3]     *= DAMPING
      velocities[i3 + 1] *= DAMPING

      positions[i3]     += velocities[i3]
      positions[i3 + 1] += velocities[i3 + 1]
    }

    geometry.attributes.position.needsUpdate = true

    const elapsed = (material.uniforms.uTime.value as number) + delta
    material.uniforms.uTime.value = elapsed

    const REVEAL_START    = 3.0
    const REVEAL_DURATION = 1.5
    material.uniforms.uReveal.value =
      Math.min(1, Math.max(0, (elapsed - REVEAL_START) / REVEAL_DURATION))

    const tp    = Math.min(1, Math.max(0, (elapsed - TRANSITION_START) / TRANSITION_DURATION))
    const eased = tp * tp * (3 - 2 * tp)
    if (eased > 0) {
      for (let j = 0; j < TEXT_PARTICLE_COUNT * 3; j++) {
        originalPositions[j] =
          startPositions[j] + (targetPositions[j] - startPositions[j]) * eased
      }
    }
  })

  return <points ref={pointsRef} geometry={geometry} material={material} />
}
