import { Suspense, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer } from '@react-three/drei'
import { Bloom, ChromaticAberration, EffectComposer, Noise, ToneMapping, Vignette } from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import { QUALITY } from '../core/quality'
import { bookLive } from '../core/bookPose'
import { IMPACTS, pulseAt, STAGE, store, win } from '../core/timeline'
import { sound } from '../core/audio'
import { Book } from './Book'
import { BookParticles } from './BookParticles'
import { CameraRig } from './CameraRig'
import { DataUniverse } from './DataUniverse'
import { DigitalCity } from './DigitalCity'
import { EnergySphere } from './EnergySphere'
import { Holograms } from './Holograms'
import { RevealFX } from './RevealFX'

/** Lights, fog and reflections for the product stage. */
function StageLights({ shadows }) {
  const key = useRef()
  const spot = useRef()
  const rimB = useRef()
  const rimG = useRef()
  const { scene } = useThree()
  useFrame(() => {
    const t = store.time
    const b = STAGE.book
    const stage = t > 18.5
    const lit = win(t, 21.8, 60, 1.6, 0.1)
    key.current.intensity = 2.4 * lit
    rimB.current.intensity = 60 * lit * (1 + pulseAt(t, IMPACTS) * 2)
    rimG.current.intensity = 26 * lit
    // golden spotlight dedicated to the title in the final shot
    spot.current.intensity = 70 * (0.25 * lit + win(t, 41.4, 60, 1.6, 0.1))
    spot.current.position.set(bookLive.position.x + 0.5, bookLive.position.y + 6, bookLive.position.z + 4)
    spot.current.target.position.copy(bookLive.position)
    spot.current.target.updateMatrixWorld()
    key.current.position.set(bookLive.position.x + 4, bookLive.position.y + 6, bookLive.position.z + 8)
    key.current.target.position.copy(bookLive.position)
    key.current.target.updateMatrixWorld()
    // fog per world
    if (scene.fog) {
      scene.fog.density = t < 5.6 ? 0.004 : t < 12.05 ? 0.018 : t < 19.0 ? 0.0045 : 0.0
    }
    key.current.visible = rimB.current.visible = rimG.current.visible = spot.current.visible = stage
  })
  const b = STAGE.book
  return (
    <>
      <ambientLight intensity={0.08} />
      <directionalLight
        ref={key}
        position={[b.x + 4, b.y + 6, b.z + 8]}
        color="#fff4e6"
        castShadow={shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
      />
      <pointLight ref={rimB} position={[b.x - 5, b.y + 1.5, b.z - 2]} color="#176BFF" distance={18} decay={2} />
      <pointLight ref={rimG} position={[b.x + 5, b.y - 0.5, b.z - 1.5]} color="#e2b56a" distance={18} decay={2} />
      <spotLight ref={spot} color="#ffd79a" angle={0.38} penumbra={0.8} distance={20} decay={2} />
    </>
  )
}

function Reflections() {
  // Studio reflections rendered locally (no external HDR download)
  return (
    <Environment resolution={256} frames={1}>
      <color attach="background" args={['#020203']} />
      <Lightformer form="rect" intensity={3} color="#4a8dff" position={[-6, 1, 2]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} />
      <Lightformer form="rect" intensity={2.6} color="#f2c27a" position={[6, 0, 2]} rotation-y={-Math.PI / 2} scale={[8, 3, 1]} />
      <Lightformer form="rect" intensity={2} color="#ffffff" position={[0, 6, 2]} rotation-x={Math.PI / 2} scale={[10, 2, 1]} />
      <Lightformer form="ring" intensity={1.4} color="#9fc6ff" position={[0, 0, 8]} scale={4} />
    </Environment>
  )
}

function FX({ lite }) {
  const bloom = useRef()
  const ca = useRef()
  const gl = useThree((s) => s.gl)
  // half-float buffers give smooth bloom; fall back to 8-bit where unsupported
  const fbType = useMemo(() => {
    const ctx = gl.getContext()
    const ok = gl.capabilities.isWebGL2 ? ctx.getExtension('EXT_color_buffer_float') || ctx.getExtension('EXT_color_buffer_half_float') : ctx.getExtension('EXT_color_buffer_half_float')
    const dbg = ctx.getExtension('WEBGL_debug_renderer_info')
    const renderer = dbg ? String(ctx.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : ''
    const software = /swiftshader|llvmpipe|software/i.test(renderer)
    return ok && !software && !FORCE_LDR ? THREE.HalfFloatType : THREE.UnsignedByteType
  }, [gl])
  useFrame(() => {
    const t = store.time
    const imp = pulseAt(t, IMPACTS, 3)
    if (bloom.current) bloom.current.intensity = 1.05 + 0.9 * pulseAt(t) + 1.6 * imp + 0.4 * win(t, 22, 29, 1, 1)
    if (ca.current) ca.current.offset.set(0.0004 + 0.006 * imp, 0.0003 + 0.004 * imp)
  })
  if (lite) {
    return (
      <EffectComposer multisampling={0} disableNormalPass frameBufferType={fbType}>
        <Bloom ref={bloom} mipmapBlur intensity={1.1} luminanceThreshold={0.42} luminanceSmoothing={0.3} radius={0.7} />
        <Vignette eskil={false} offset={0.25} darkness={0.8} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    )
  }
  return (
    <EffectComposer multisampling={0} disableNormalPass frameBufferType={fbType}>
      <Bloom ref={bloom} mipmapBlur intensity={1.1} luminanceThreshold={0.42} luminanceSmoothing={0.3} radius={0.78} />
      <ChromaticAberration ref={ca} offset={new THREE.Vector2(0.0005, 0.0003)} radialModulation modulationOffset={0.3} />
      <Vignette eskil={false} offset={0.22} darkness={0.85} />
      <Noise premultiply blendFunction={BlendFunction.SCREEN} opacity={0.18} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  )
}

function Shadows() {
  const ref = useRef()
  useFrame(() => {
    const t = store.time
    ref.current.visible = t > 22.5
    ref.current.position.set(bookLive.position.x, bookLive.position.y - 2.15, bookLive.position.z)
  })
  return <ContactShadows ref={ref} opacity={0.75} scale={9} blur={2.6} far={4} resolution={512} color="#000000" frames={Infinity} />
}

function SoundSync() {
  useFrame(() => sound.update(store.time))
  return null
}

const FORCE_LDR = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('ldr')
const NO_FX = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('nofx')

export function Experience({ quality }) {
  const Q = QUALITY[quality]
  const lite = Q.post === 'lite'
  return (
    <>
      <color attach="background" args={['#030305']} />
      <fogExp2 attach="fog" args={['#030305', 0.004]} />
      <CameraRig />
      <StageLights shadows={!lite} />
      <Suspense fallback={null}>
        <Reflections />
        <EnergySphere count={Q.sphere} />
        <DataUniverse nodes={Q.nodes} />
        <DigitalCity count={Q.buildings} />
        <Book />
        <BookParticles count={Q.bookParticles} />
        <RevealFX gold={Q.gold} />
        <Holograms />
        {!lite && <Shadows />}
      </Suspense>
      <SoundSync />
      {!NO_FX && <FX lite={lite} />}
    </>
  )
}
