export interface ParticleData {
  positions: Float32Array
  sizes: Float32Array
  intensities: Float32Array
  count: number
}

export function generateParticles(count: number = 25000): ParticleData {
  const positions = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const intensities = new Float32Array(count)

  for (let i = 0; i < count; i++) {
    const i3 = i * 3

    // Spherical distribution — creates the oval cloud silhouette
    // Sample unit sphere with gaussian radial falloff for denser center
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    // Radial distance: exponential falloff so center is much denser
    const r = Math.pow(Math.random(), 0.5) * 18

    positions[i3]     = Math.sin(phi) * Math.cos(theta) * r       // x
    positions[i3 + 1] = Math.sin(phi) * Math.sin(theta) * r * 0.7 // y (slightly flattened)
    // Z: cluster center at -8, spread front-to-back
    positions[i3 + 2] = Math.cos(phi) * r * 0.9 - 8               // z: roughly -26 to 10

    // Sizes: relatively uniform range for the consistent bokeh-disc look
    // Small power bias so slightly more small particles
    const rawSize = Math.pow(Math.random(), 1.4)
    sizes[i] = 0.06 + rawSize * 0.28

    // Intensity: most particles are dim, a few are bright white
    const roll = Math.random()
    if (roll > 0.97) {
      intensities[i] = 0.85 + Math.random() * 0.15 // bright white highlight
    } else if (roll > 0.85) {
      intensities[i] = 0.45 + Math.random() * 0.3  // medium
    } else {
      intensities[i] = 0.1 + Math.random() * 0.3   // dim — overlapping creates the glow
    }
  }

  return { positions, sizes, intensities, count }
}
