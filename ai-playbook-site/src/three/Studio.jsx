import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MeshReflectorMaterial, RoundedBox } from '@react-three/drei'
import { STAGE, store } from '../core/timeline'
import { stoneMaps } from './textures'

/**
 * The photographic studio: a honed black-stone plinth, charcoal cyclorama,
 * large softboxes, silver strip rims and one shadow-casting key.
 */
export function Studio({ quality }) {
  const g = useRef()
  const stone = useMemo(() => {
    const m = stoneMaps(quality === 'low' ? 512 : 1024)
    m.map.repeat.set(2.2, 1.3)
    m.rough.repeat.set(2.2, 1.3)
    return m
  }, [quality])
  const B = STAGE.book


  useFrame(() => {
    const t = store.time
    g.current.visible = t < 7.2 || t > 18.8
  })

  const reflect = quality !== 'low'
  return (
    <group ref={g}>
      {/* plinth */}
      <RoundedBox args={[10, 1.4, 6]} radius={0.025} smoothness={4} position={[B.x, B.y - 0.7, B.z]} receiveShadow castShadow>
        <meshPhysicalMaterial map={stone.map} roughnessMap={stone.rough} roughness={1} clearcoat={0.25} clearcoatRoughness={0.4} envMapIntensity={0.5} />
      </RoundedBox>
      {/* honed top with soft reflections */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[B.x, B.y + 0.0015, B.z]} receiveShadow>
        <planeGeometry args={[9.96, 5.96]} />
        {reflect ? (
          <MeshReflectorMaterial
            map={stone.map}
            roughnessMap={stone.rough}
            blur={[420, 140]}
            resolution={quality === 'high' ? 1024 : 512}
            mixBlur={1}
            mixStrength={0.9}
            mixContrast={1}
            roughness={0.85}
            depthScale={0.8}
            minDepthThreshold={0.25}
            maxDepthThreshold={1.2}
            color="#2a2a2a"
            metalness={0.2}
          />
        ) : (
          <meshPhysicalMaterial map={stone.map} roughnessMap={stone.rough} roughness={1} clearcoat={0.4} clearcoatRoughness={0.3} />
        )}
      </mesh>
      {/* floor + cyclorama */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[B.x, B.y - 1.4, B.z]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#0c0c0c" roughness={0.95} />
      </mesh>
      <mesh position={[B.x, B.y + 6, B.z - 7.5]} receiveShadow>
        <planeGeometry args={[80, 20]} />
        <meshStandardMaterial color="#1a1a1a" roughness={1} />
      </mesh>

    </group>
  )
}
