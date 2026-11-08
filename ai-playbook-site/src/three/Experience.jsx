import { Suspense, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import { Bloom, DepthOfField, EffectComposer, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import { QUALITY } from '../core/quality'
import { store } from '../core/timeline'
import { sound } from '../core/audio'
import { Book } from './Book'
import { CameraRig, focus } from './CameraRig'
import { Studio } from './Studio'
import { Workspace } from './Workspace'
import { LightRig } from './LightRig'

const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()
const FORCE_LDR = params.has('ldr')
const NO_FX = params.has('nofx')

/** Neutral studio reflections: large ivory softboxes and silver strips (rendered locally, no HDR download). */
function Reflections() {
  return (
    <Environment resolution={512} frames={1}>
      <color attach="background" args={['#0b0b0b']} />
      <Lightformer form="rect" intensity={2.2} color="#f6f2ea" position={[0, 5, 2]} rotation-x={Math.PI / 2} scale={[10, 4, 1]} />
      <Lightformer form="rect" intensity={1.4} color="#e9edf3" position={[-6, 1.5, 0]} rotation-y={Math.PI / 2} scale={[1.2, 6, 1]} />
      <Lightformer form="rect" intensity={1.1} color="#f3efe6" position={[6, 1.5, 0]} rotation-y={-Math.PI / 2} scale={[1.2, 6, 1]} />
      <Lightformer form="rect" intensity={0.6} color="#ffffff" position={[0, 1, 6]} scale={[6, 2, 1]} />
    </Environment>
  )
}

function FX({ quality }) {
  const dof = useRef()
  const gl = useThree((s) => s.gl)
  const lite = quality === 'low'
  const fbType = useMemo(() => {
    const ctx = gl.getContext()
    const ok = gl.capabilities.isWebGL2 ? ctx.getExtension('EXT_color_buffer_float') || ctx.getExtension('EXT_color_buffer_half_float') : ctx.getExtension('EXT_color_buffer_half_float')
    const dbg = ctx.getExtension('WEBGL_debug_renderer_info')
    const renderer = dbg ? String(ctx.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : ''
    return ok && !/swiftshader|llvmpipe|software/i.test(renderer) && !FORCE_LDR ? THREE.HalfFloatType : THREE.UnsignedByteType
  }, [gl])
  const camera = useThree((s) => s.camera)
  useFrame(() => {
    const e = dof.current
    if (!e) return
    if (!e.target) e.target = new THREE.Vector3()
    e.target.copy(focus.point)
    e.bokehScale += (focus.bokeh - e.bokehScale) * 0.08
    // depth of field expressed in world units (normalised to the camera range)
    e.cocMaterial.focusRange = focus.range / (camera.far - camera.near)
  })
  return (
    <EffectComposer multisampling={lite ? 0 : 4} disableNormalPass frameBufferType={fbType}>
      {!lite && <DepthOfField ref={dof} target={focus.point} focusRange={0.02} bokehScale={2} resolutionScale={0.75} />}
      <Bloom mipmapBlur intensity={0.22} luminanceThreshold={0.86} luminanceSmoothing={0.12} radius={0.6} />
      <Vignette eskil={false} offset={0.32} darkness={0.55} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      {lite && <SMAA />}
    </EffectComposer>
  )
}


export function Experience({ quality }) {
  const Q = QUALITY[quality]
  const shadows = Q.post === 'full'
  return (
    <>
      <color attach="background" args={['#080808']} />
      <CameraRig />
      <ambientLight intensity={0.02} />
      <LightRig shadows={shadows} />
      <Suspense fallback={null}>
        <Reflections />
        <Studio quality={quality} />
        <Workspace quality={quality} />
        <Book shadows={shadows} />
      </Suspense>
      {!NO_FX && <FX quality={quality} />}
    </>
  )
}
