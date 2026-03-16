'use client'

import { useMemo, useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { ParticleData } from '@/lib/generateParticles'

// Reference depth for radius scaling — centre of the particle cloud
const MOUSE_PLANE_Z      = -6
const REPULSION_RADIUS   = 2.5   // void radius at reference depth
const REPULSION_STRENGTH = 0.12
const SPRING_STRENGTH    = 0.05
const DAMPING            = 0.68  // overdamped — no post-repulsion oscillation

const vertexShader = /* glsl */ `
  attribute float size;
  attribute float intensity;

  varying float vIntensity;
  uniform float uTime;

  vec3 hash3(vec3 p) {
    p = fract(p * vec3(443.897, 441.423, 437.195));
    p += dot(p.zxy, p.yxz + 19.19);
    return fract(vec3(p.x * p.y, p.y * p.z, p.z * p.x));
  }

  void main() {
    vec3 h  = hash3(position);
    vec3 h2 = hash3(position + 7.31);

    float shimmerSpeed = 0.5 + h.y * 2.0;
    float shimmerPhase = h.z * 6.2832;
    float shimmer = 0.60
                  + 0.28 * sin(uTime * shimmerSpeed       + shimmerPhase)
                  + 0.12 * sin(uTime * shimmerSpeed * 2.7 + shimmerPhase + 0.9);

    float blinkA = sin(uTime * (0.25 + h.x  * 0.55) + h2.x * 6.2832);
    float blinkB = sin(uTime * (0.17 + h2.z * 0.40) + h.x  * 6.2832);
    float onOff  = smoothstep(-0.95, -0.55, blinkA * blinkB);

    float flashClock = fract(h2.y * 17.3 + uTime * (0.15 + h.x * 0.25));
    float flash = smoothstep(0.97, 1.0, flashClock) * smoothstep(1.0, 0.97, flashClock);

    float finalIntensity = intensity * shimmer * onOff;
    finalIntensity = mix(finalIntensity, 1.0, flash);
    vIntensity = clamp(finalIntensity, 0.0, 1.0);

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
    float rim  = smoothstep(0.60, 0.78, dist) * smoothstep(1.0, 0.78, dist) * 0.45;
    float core = (1.0 - smoothstep(0.0, 0.35, dist)) * 0.5;

    float alpha = clamp(body + rim + core, 0.0, 1.0);
    gl_FragColor = vec4(1.0, 1.0, 1.0, alpha * vIntensity);
  }
`

interface Props {
  data: ParticleData
}

export default function ParticleSystem({ data }: Props) {
  const { camera } = useThree()

  // Mouse NDC updated from native event — avoids R3F pointer latency
  const mouseNDC = useRef({ x: -9999, y: -9999 })

  // Original rest positions — particles spring back to these
  const basePositions = useRef(data.positions.slice())

  // XY velocities per particle (Z is static)
  const velocities = useRef(new Float32Array(data.count * 3))

  const raycaster = useMemo(() => new THREE.Raycaster(), [])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: { uTime: { value: 0 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    []
  )

  const { geometry, posAttr } = useMemo(() => {
    const attr = new THREE.BufferAttribute(data.positions, 3)
    attr.setUsage(THREE.DynamicDrawUsage)

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position',  attr)
    geo.setAttribute('size',      new THREE.BufferAttribute(data.sizes,        1))
    geo.setAttribute('intensity', new THREE.BufferAttribute(data.intensities,  1))

    return { geometry: geo, posAttr: attr }
  }, [data])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouseNDC.current.x =  (e.clientX / window.innerWidth)  * 2 - 1
      mouseNDC.current.y = -(e.clientY / window.innerHeight) * 2 + 1
    }
    const onLeave = () => { mouseNDC.current.x = -9999; mouseNDC.current.y = -9999 }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseleave', onLeave)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  useEffect(() => {
    return () => { geometry.dispose(); material.dispose() }
  }, [geometry, material])

  useFrame((_, delta) => {
    material.uniforms.uTime.value += delta

    // Cast ray from mouse NDC — gives us origin + direction in world space
    raycaster.setFromCamera(mouseNDC.current as THREE.Vector2, camera)
    const { origin, direction } = raycaster.ray

    // Reference depth: distance from camera to the cloud centre plane.
    // scaledRadius = REPULSION_RADIUS at this depth, larger/smaller at other depths
    // so the void appears the same angular size across all depth layers.
    const refDepth = Math.abs(MOUSE_PLANE_Z - origin.z)

    const pos  = posAttr.array as Float32Array
    const vel  = velocities.current
    const base = basePositions.current
    const n    = data.count

    for (let i = 0; i < n; i++) {
      const i3 = i * 3

      const px = pos[i3]
      const py = pos[i3 + 1]
      const pz = base[i3 + 2] // use rest Z for stable depth calculation

      // Find the mouse world position at this particle's Z depth
      const rayT  = (pz - origin.z) / direction.z
      const mxAtZ = origin.x + direction.x * rayT
      const myAtZ = origin.y + direction.y * rayT

      // Scale the repulsion radius by depth so it stays a consistent screen-circle
      const depthFactor  = Math.abs(pz - origin.z) / refDepth
      const scaledRadius = REPULSION_RADIUS * depthFactor

      const dx     = px - mxAtZ
      const dy     = py - myAtZ
      const distSq = dx * dx + dy * dy

      if (distSq < scaledRadius * scaledRadius && distSq > 0) {
        const dist  = Math.sqrt(distSq)
        const force = (1 - dist / scaledRadius) * REPULSION_STRENGTH
        vel[i3]     += (dx / dist) * force
        vel[i3 + 1] += (dy / dist) * force
      }

      // Spring: pull back toward rest position
      vel[i3]     += (base[i3]     - px) * SPRING_STRENGTH
      vel[i3 + 1] += (base[i3 + 1] - py) * SPRING_STRENGTH

      // Dampen and integrate
      vel[i3]     *= DAMPING
      vel[i3 + 1] *= DAMPING

      pos[i3]     += vel[i3]
      pos[i3 + 1] += vel[i3 + 1]
    }

    posAttr.needsUpdate = true
  })

  return <points geometry={geometry} material={material} />
}
