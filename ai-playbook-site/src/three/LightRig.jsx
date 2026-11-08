import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
import { bookLive } from '../core/bookPose'
import { lerp, REVEAL_AT, seg, smooth, STAGE, store } from '../core/timeline'

RectAreaLightUniformsLib.init()

/**
 * One physical light rig, re-rigged between sets (like a real crew would).
 * A constant number of lights keeps shaders compiled once — important on phones.
 *   key   large overhead softbox          rimL / rimR   silver strip softboxes
 *   sun   shadow-casting key (spot)       sweep         narrow light that travels across the cover
 */
export function LightRig({ shadows }) {
  const key = useRef()
  const rimL = useRef()
  const rimR = useRef()
  const sun = useRef()
  const sweep = useRef()
  const lamp = useRef()

  useFrame(() => {
    const t = store.time
    const desk = t >= 7.0 && t < 19.0
    const O = desk ? STAGE.desk : STAGE.book
    const aim = (l, p, q) => {
      l.position.set(O.x + p[0], O.y + p[1], O.z + p[2])
      l.lookAt(O.x + q[0], O.y + q[1], O.z + q[2])
    }
    let k = 0
    let rl = 0
    let rr = 0
    let s = 0
    let sw = 0
    let lp = 0
    if (desk) {
      // window-like softbox from the left, a soft top fill, and the screen's own glow
      aim(key.current, [-7, 4.2, 2.2], [0, 0.4, 0])
      aim(rimL.current, [1, 5, 2.5], [0, 0, 0])
      aim(rimR.current, [0, 0.85, -0.7], [0, 0.6, 3])
      key.current.width = 6
      key.current.height = 4
      const lift = smooth(seg(t, 7.0, 8.4))
      k = 3.6 * lift
      rl = 1.2 * lift
      rr = (t < 12.8 ? 0.8 : 1.4) * lift
      s = 16 * lift
      lp = 7 * lift
      lamp.current.position.set(O.x - 2.6, O.y + 1.55, O.z - 0.5)
      sun.current.position.set(O.x - 5, O.y + 6, O.z + 3)
      sun.current.target.position.set(O.x, O.y, O.z)
    } else {
      aim(key.current, [0, 6.5, 3.2], [0, 0.6, 0])
      aim(rimL.current, [-5.2, 2.6, -1.8], [0, 1.2, 0])
      aim(rimR.current, [5.2, 2.6, -1.8], [0, 1.2, 0])
      key.current.width = 6
      key.current.height = 3
      const intro = t < 7 ? smooth(seg(t, 0.4, 4.8)) : 0
      const reveal = t >= 19 && t < 31 ? smooth(seg(t, 19.3, REVEAL_AT + 1.2)) : 0
      const inside = t >= 31 && t < 43 ? 1 : 0
      const product = t >= 43 && t < 51 ? 1 : 0
      const cta = t >= 51 ? smooth(seg(t, 51, 52.2)) : 0
      k = 5.5 * (0.8 * intro + reveal + 0.42 * inside + 0.5 * product + 1.25 * cta)
      rl = 9 * (0.6 * intro + reveal + 0.45 * inside + 0.35 * product + 1.2 * cta)
      rr = 7 * (0.35 * intro + reveal + 0.45 * inside + 0.6 * product + cta)
      s = 40 * (0.35 * intro + reveal + 0.32 * inside + 0.35 * product + 1.15 * cta)
      sun.current.position.set(O.x + 2.6, O.y + 7.5, O.z + 4.2)
      sun.current.target.position.copy(bookLive.position)
      // 05 · a narrow light travels slowly across the cover
      const u = seg(t, 43.4, 50.6)
      sw = product * 60 * Math.sin(Math.PI * Math.min(1, u * 1.1))
      sweep.current.position.set(O.x + lerp(-2.4, 2.2, smooth(u)), O.y + 4.2, O.z + lerp(-1.2, 1.4, smooth(u)))
      sweep.current.target.position.copy(bookLive.position)
    }
    key.current.intensity = k
    rimL.current.intensity = rl
    rimR.current.intensity = rr
    sun.current.intensity = s
    sweep.current.intensity = sw
    lamp.current.intensity = lp
    sun.current.target.updateMatrixWorld()
    sweep.current.target.updateMatrixWorld()
  })

  return (
    <>
      <rectAreaLight ref={key} width={6} height={3} color="#fff8ee" intensity={0} />
      <rectAreaLight ref={rimL} width={0.6} height={5} color="#e9edf3" intensity={0} />
      <rectAreaLight ref={rimR} width={0.6} height={5} color="#f3efe6" intensity={0} />
      <spotLight
        ref={sun}
        angle={0.45}
        penumbra={1}
        distance={30}
        decay={2}
        color="#fffaf2"
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      <pointLight ref={lamp} color="#ffc98c" distance={9} decay={2} intensity={0} />
      <spotLight ref={sweep} angle={0.16} penumbra={0.9} distance={20} decay={2} color="#fffdf8" intensity={0} />
    </>
  )
}
