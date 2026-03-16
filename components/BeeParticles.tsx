'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

const WORLD_SIZE = 7.2   // world units across the full image extent
const STRIDE     = 20    // pixels between samples — roughly one per dot
const THRESHOLD  = 90    // brightness 0-255 to include a sample

const vertexShader = /* glsl */ `
  attribute float size;
  attribute float intensity;
  varying float vIntensity;

  void main() {
    vIntensity = intensity;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (280.0 / -mvPosition.z);
    gl_Position  = projectionMatrix * mvPosition;
  }
`

const fragmentShader = /* glsl */ `
  varying float vIntensity;

  void main() {
    vec2  uv   = gl_PointCoord * 2.0 - 1.0;
    float dist = length(uv);
    if (dist > 1.0) discard;

    float body = 1.0 - smoothstep(0.72, 1.0, dist);
    float rim  = smoothstep(0.50, 0.85, dist) * smoothstep(1.0, 0.85, dist) * 0.9;
    float core = (1.0 - smoothstep(0.0, 0.35, dist)) * 0.8;

    float alpha = clamp(body + rim + core, 0.0, 1.0);
    gl_FragColor = vec4(1.0, 1.0, 1.0, alpha * vIntensity);
  }
`

interface ParticleBuffers {
  positions:   Float32Array
  sizes:       Float32Array
  intensities: Float32Array
  count:       number
}

function sampleImage(img: HTMLImageElement): ParticleBuffers {
  const w = img.naturalWidth
  const h = img.naturalHeight

  const canvas = document.createElement('canvas')
  canvas.width  = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  const data = ctx.getImageData(0, 0, w, h).data

  const posArr: number[] = []
  const sizeArr: number[] = []
  const intArr: number[] = []

  for (let py = 0; py < h; py += STRIDE) {
    for (let px = 0; px < w; px += STRIDE) {
      const idx  = (py * w + px) * 4
      const r    = data[idx]
      const g    = data[idx + 1]
      const b    = data[idx + 2]
      const brightness = (r + g + b) / 3

      if (brightness < THRESHOLD) continue

      const t = brightness / 255
      const wx =  (px / w - 0.5) * WORLD_SIZE
      const wy =  (0.5 - py / h) * WORLD_SIZE

      posArr.push(wx, wy, 0)
      sizeArr.push(0.18 + t * 0.18)   // range 0.18 – 0.36
      intArr.push(t)
    }
  }

  const count = posArr.length / 3
  return {
    positions:   new Float32Array(posArr),
    sizes:       new Float32Array(sizeArr),
    intensities: new Float32Array(intArr),
    count,
  }
}

export default function BeeParticles() {
  const [buffers, setBuffers] = useState<ParticleBuffers | null>(null)

  useEffect(() => {
    const img = new Image()
    img.src = '/reference.png'
    img.onload  = () => setBuffers(sampleImage(img))
    img.onerror = () => console.error('[BeeParticles] Failed to load /reference.png')
  }, [])

  const materialRef = useRef<THREE.ShaderMaterial | null>(null)
  const geometryRef = useRef<THREE.BufferGeometry | null>(null)

  useEffect(() => {
    return () => {
      materialRef.current?.dispose()
      geometryRef.current?.dispose()
    }
  }, [])

  if (!buffers) return null

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position',  new THREE.BufferAttribute(buffers.positions,   3))
  geometry.setAttribute('size',      new THREE.BufferAttribute(buffers.sizes,       1))
  geometry.setAttribute('intensity', new THREE.BufferAttribute(buffers.intensities, 1))
  geometryRef.current = geometry

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite:  false,
    blending:    THREE.AdditiveBlending,
  })
  materialRef.current = material

  return <points geometry={geometry} material={material} />
}
