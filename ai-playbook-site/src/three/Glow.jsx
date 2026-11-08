import { forwardRef, useMemo } from 'react'
import { Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { GLOW_FRAG, GLOW_VERT } from './shaders'

/** Additive camera-facing glow / light-ray sprite. Control via ref.material.uniforms. */
export const Glow = forwardRef(function Glow({ color = '#176BFF', size = 4, power = 2.2, rays = 0, opacity = 1, ...props }, ref) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color(color) },
          uOpacity: { value: opacity },
          uPower: { value: power },
          uRays: { value: rays },
          uTime: { value: 0 },
        },
        vertexShader: GLOW_VERT,
        fragmentShader: GLOW_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [] // eslint-disable-line
  )
  return (
    <Billboard {...props}>
      <mesh ref={ref} material={mat} scale={size} frustumCulled={false} renderOrder={5}>
        <planeGeometry args={[1, 1]} />
      </mesh>
    </Billboard>
  )
})
