'use client'

import { useMemo, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ParticleData } from '@/lib/generateParticles'

const SPRING_STRENGTH = 0.022  // pull back to rest position
const DAMPING         = 0.88   // velocity decay per frame
const LIFT_STRENGTH   = 0.14   // upward kick proportional to frequency amplitude
const BEAT_STRENGTH   = 0.30   // all-particles upward burst on beat
const X_MIN           = -18    // particle cloud X range (from generateParticles)
const X_MAX           =  18

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
    const analyser = analyserRef.current
    if (analyser && dataRef.current) {
      analyser.getByteFrequencyData(dataRef.current)
    }

    const freq = dataRef.current

    // Compute band averages for shader uniforms
    let bass = 0, mid = 0, high = 0
    let bassSum = 0, midSum = 0, highSum = 0
    for (let b = 0;  b < 6;   b++) bassSum += freq[b]
    for (let b = 6;  b < 41;  b++) midSum  += freq[b]
    for (let b = 41; b < 101; b++) highSum += freq[b]
    bass = (bassSum / 6)   / 255
    mid  = (midSum  / 35)  / 255
    high = (highSum / 60)  / 255

    material.uniforms.uBass.value = bass
    material.uniforms.uMid.value  = mid
    material.uniforms.uHigh.value = high

    // Beat detection — bass spike
    const beatFired = bass - prevBass.current > 0.06
    prevBass.current = bass

    const pos  = posAttr.array as Float32Array
    const vel  = velocities.current
    const base = basePositions.current
    const n    = data.count

    for (let i = 0; i < n; i++) {
      const i3 = i * 3

      // Map this particle's base X position into the musically active spectrum.
      // Bins above ~70 (>6kHz) are almost always silent in music, so spreading
      // across all 256 bins leaves most particles unresponsive. Cap at 70 bins.
      const t = Math.min(1, Math.max(0, (base[i3] - X_MIN) / (X_MAX - X_MIN)))
      const binIndex = Math.floor(t * 70)
      const columnAmp = freq[binIndex] / 255
      // Every particle also gets a bass floor so nothing is ever completely silent
      const freqAmp = columnAmp * 0.5 + bass * 0.5

      // Particles far from camera appear smaller on screen — compensate so all
      // particles have roughly equal apparent movement regardless of depth.
      // Camera is at Z=5; cloud center is at Z≈-8 (distance 13).
      const zDist = Math.max(1, 5 - base[i3 + 2])
      const perspScale = zDist / 13

      // Upward impulse proportional to how loud that frequency is
      vel[i3 + 1] += freqAmp * LIFT_STRENGTH * perspScale

      // Beat: everyone gets a sharp upward burst
      if (beatFired) {
        vel[i3 + 1] += BEAT_STRENGTH * perspScale
      }

      // Spring back to rest position — unscaled so deep particles travel further in
      // world space, which compensates for perspective making them appear smaller
      vel[i3]     += (base[i3]     - pos[i3])     * SPRING_STRENGTH
      vel[i3 + 1] += (base[i3 + 1] - pos[i3 + 1]) * SPRING_STRENGTH

      vel[i3]     *= DAMPING
      vel[i3 + 1] *= DAMPING

      pos[i3]     += vel[i3]
      pos[i3 + 1] += vel[i3 + 1]
    }

    posAttr.needsUpdate = true
  })

  return <points geometry={geometry} material={material} />
}
