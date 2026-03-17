'use client'

import { useMemo, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ParticleData } from '@/lib/generateParticles'

const SPRING_STRENGTH    = 0.018  // weaker spring → particles wander further
const DAMPING            = 0.88   // higher damping → coast longer before stopping
const BEAT_STRENGTH      = 0.45   // much stronger impulse on each beat

const vertexShader = /* glsl */ `
  attribute float size;
  attribute float intensity;

  varying float vIntensity;
  uniform float uTime;
  uniform float uBass;
  uniform float uMid;
  uniform float uHigh;

  vec3 hash3(vec3 p) {
    p = fract(p * vec3(443.897, 441.423, 437.195));
    p += dot(p.zxy, p.yxz + 19.19);
    return fract(vec3(p.x * p.y, p.y * p.z, p.z * p.x));
  }

  void main() {
    vec3 h  = hash3(position);
    vec3 h2 = hash3(position + 7.31);

    // Mids speed up shimmer
    float shimmerSpeed = (0.5 + h.y * 2.0) * (1.0 + uMid * 2.0);
    float shimmerPhase = h.z * 6.2832;
    float shimmer = 0.60
                  + 0.28 * sin(uTime * shimmerSpeed       + shimmerPhase)
                  + 0.12 * sin(uTime * shimmerSpeed * 2.7 + shimmerPhase + 0.9);

    float blinkA = sin(uTime * (0.25 + h.x  * 0.55) + h2.x * 6.2832);
    float blinkB = sin(uTime * (0.17 + h2.z * 0.40) + h.x  * 6.2832);
    float onOff  = smoothstep(-0.95, -0.55, blinkA * blinkB);

    // Highs lower the flash threshold — more frequent sparks
    float flashClock = fract(h2.y * 17.3 + uTime * (0.15 + h.x * 0.25));
    float flashThresh = 0.97 - uHigh * 0.08;
    float flash = smoothstep(flashThresh, 1.0, flashClock) * smoothstep(1.0, flashThresh, flashClock);

    float finalIntensity = intensity * shimmer * onOff;
    finalIntensity = mix(finalIntensity, 1.0, flash);
    vIntensity = clamp(finalIntensity, 0.0, 1.0);

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    // Bass pumps point size
    gl_PointSize = size * (280.0 / -mvPosition.z) * (1.0 + uBass * 1.5);
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
    float rim  = smoothstep(0.60, 0.78, dist) * smoothstep(1.0, 0.78, dist) * 0.45;
    float core = (1.0 - smoothstep(0.0, 0.35, dist)) * 0.5;

    float alpha = clamp(body + rim + core, 0.0, 1.0);
    gl_FragColor = vec4(1.0, 1.0, 1.0, alpha * vIntensity);
  }
`

interface Props {
  data:       ParticleData
  dataRef:    React.RefObject<Uint8Array>
  analyserRef: React.RefObject<AnalyserNode | null>
}

export default function AudioParticleSystem({ data, dataRef, analyserRef }: Props) {
  const basePositions = useRef(data.positions.slice())
  const velocities    = useRef(new Float32Array(data.count * 3))
  const prevBass      = useRef(0)

  // Per-particle random wander angles — each particle gets its own unique direction
  const wanderAngles = useMemo(() => {
    const angles = new Float32Array(data.count)
    for (let i = 0; i < data.count; i++) angles[i] = Math.random() * Math.PI * 2
    return angles
  }, [data.count])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uBass: { value: 0 },
          uMid:  { value: 0 },
          uHigh: { value: 0 },
        },
        transparent: true,
        depthWrite:  false,
        blending:    THREE.AdditiveBlending,
      }),
    []
  )

  const { geometry, posAttr } = useMemo(() => {
    const attr = new THREE.BufferAttribute(data.positions, 3)
    attr.setUsage(THREE.DynamicDrawUsage)

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position',  attr)
    geo.setAttribute('size',      new THREE.BufferAttribute(data.sizes,       1))
    geo.setAttribute('intensity', new THREE.BufferAttribute(data.intensities, 1))

    return { geometry: geo, posAttr: attr }
  }, [data])

  useEffect(() => {
    return () => { geometry.dispose(); material.dispose() }
  }, [geometry, material])

  useFrame((_, delta) => {
    material.uniforms.uTime.value += delta

    // Read frequency data from analyser if available
    let bass = 0, mid = 0, high = 0
    const analyser = analyserRef.current
    if (analyser && dataRef.current) {
      analyser.getByteFrequencyData(dataRef.current)
      const freq = dataRef.current

      let bassSum = 0, midSum = 0, highSum = 0
      for (let b = 0;  b < 6;   b++) bassSum += freq[b]
      for (let b = 6;  b < 41;  b++) midSum  += freq[b]
      for (let b = 41; b < 101; b++) highSum += freq[b]

      bass = (bassSum / 6)   / 255
      mid  = (midSum  / 35)  / 255
      high = (highSum / 60)  / 255
    }

    material.uniforms.uBass.value = bass
    material.uniforms.uMid.value  = mid
    material.uniforms.uHigh.value = high

    // Beat detection — radial impulse on bass spike
    const beatFired = bass - prevBass.current > 0.06
    prevBass.current = bass

    const pos  = posAttr.array as Float32Array
    const vel  = velocities.current
    const base = basePositions.current
    const n    = data.count

    for (let i = 0; i < n; i++) {
      const i3 = i * 3

      const px = pos[i3]
      const py = pos[i3 + 1]

      // Beat impulse — strong radial kick from origin on each beat
      if (beatFired) {
        const bd = Math.sqrt(px * px + py * py) || 1
        vel[i3]     += (px / bd) * BEAT_STRENGTH
        vel[i3 + 1] += (py / bd) * BEAT_STRENGTH
      }

      // Each particle pushed in its own random direction, scaled by overall audio energy
      const audioEnergy = bass * 0.6 + mid * 0.3 + high * 0.1
      const angle = wanderAngles[i]
      vel[i3]     += Math.cos(angle) * audioEnergy * 0.09
      vel[i3 + 1] += Math.sin(angle) * audioEnergy * 0.09

      // Slowly rotate each particle's wander angle so directions keep shifting
      wanderAngles[i] += (0.3 + (i % 7) * 0.05) * delta

      // Spring back to rest
      vel[i3]     += (base[i3]     - px) * SPRING_STRENGTH
      vel[i3 + 1] += (base[i3 + 1] - py) * SPRING_STRENGTH

      vel[i3]     *= DAMPING
      vel[i3 + 1] *= DAMPING

      pos[i3]     += vel[i3]
      pos[i3 + 1] += vel[i3 + 1]
    }

    posAttr.needsUpdate = true
  })

  return <points geometry={geometry} material={material} />
}
