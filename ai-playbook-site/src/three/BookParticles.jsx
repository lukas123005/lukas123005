import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { CONFIG } from '../config'
import { BH, BT, BW, bookLive } from '../core/bookPose'
import { pulseAt, seg, STAGE, store } from '../core/timeline'
import { NOISE, POINT_FRAG } from './shaders'

const VERT = /* glsl */ `
${NOISE}
uniform float uTime, uBurst, uGather, uOpacity, uPR, uPulse;
uniform mat4 uBook;
uniform vec3 uCenter;
attribute vec3 aDir;
attribute vec4 aRand;
attribute float aGold;
varying float vAlpha; varying vec3 vColor;
void main(){
  // 1. energy explosion from the centre
  float R = uBurst * (2.5 + aRand.x * 11.0);
  vec3 burst = uCenter + aDir * R + curl(aDir * 2.0 + uTime * 0.15) * uBurst * 1.6;
  // 2. gather into the exact surface of the book (staggered)
  vec3 target = (uBook * vec4(position, 1.0)).xyz;
  float g = clamp(uGather * 1.6 - aRand.y * 0.6, 0.0, 1.0);
  g = g * g * (3.0 - 2.0 * g);
  vec3 swirl = curl(target * 1.3 + uTime * 0.4) * (1.0 - g) * 0.6;
  vec3 p = mix(burst, target, g) + swirl;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float d = -mv.z;
  gl_PointSize = (1.0 + aRand.z * 1.6) * (1.0 + (1.0 - g) * 1.5) * uPR * (16.0 / max(d, 0.5));
  vAlpha = uOpacity * (0.55 + 0.45 * aRand.w) * (1.0 + uPulse);
  vec3 blue = vec3(0.12, 0.45, 1.0);
  vec3 gold = vec3(1.0, 0.76, 0.38);
  vColor = mix(blue, mix(blue, gold, aGold), g) * (1.2 + uPulse * 1.5);
  gl_Position = projectionMatrix * mv;
}
`

export function BookParticles({ count = 24000 }) {
  const pts = useRef()
  const cover = useTexture(CONFIG.book.cover)
  const { gl } = useThree()

  const { geo, mat } = useMemo(() => {
    // brightness of the real cover biases particle density (title + emblem emerge)
    const img = cover.image
    const cw = 256
    const ch = Math.round((img.height / img.width) * cw)
    const c = document.createElement('canvas')
    c.width = cw
    c.height = ch
    const ctx = c.getContext('2d')
    ctx.drawImage(img, 0, 0, cw, ch)
    const data = ctx.getImageData(0, 0, cw, ch).data
    const lum = (u, v) => {
      const i = (Math.floor(v * (ch - 1)) * cw + Math.floor(u * (cw - 1))) * 4
      return [(data[i] + data[i + 1] + data[i + 2]) / 765, data[i] - data[i + 2] > 30 ? 1 : 0]
    }
    const pos = new Float32Array(count * 3)
    const dir = new Float32Array(count * 3)
    const rnd = new Float32Array(count * 4)
    const gold = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const r = Math.random()
      let x, y, z
      let gd = 0
      if (r < 0.62) {
        // front cover, importance-sampled by brightness
        let u, v, L
        let tries = 0
        do {
          u = Math.random()
          v = Math.random()
          L = lum(u, v)
          tries++
        } while (Math.random() > 0.12 + 0.88 * L[0] && tries < 30)
        gd = L[1] || (L[0] > 0.6 ? 0.35 : 0)
        x = (u - 0.5) * BW
        y = (0.5 - v) * BH
        z = BT / 2 + 0.003
      } else if (r < 0.74) {
        x = (Math.random() - 0.5) * BW
        y = (Math.random() - 0.5) * BH
        z = -BT / 2
      } else if (r < 0.86) {
        const a = Math.PI + Math.random() * Math.PI
        x = -BW / 2 + Math.sin(a) * (BT / 2)
        z = Math.cos(a) * (BT / 2)
        y = (Math.random() - 0.5) * BH
      } else if (r < 0.95) {
        x = BW / 2 - 0.01
        y = (Math.random() - 0.5) * BH
        z = (Math.random() - 0.5) * BT
      } else {
        x = (Math.random() - 0.5) * BW
        y = (Math.random() > 0.5 ? 0.5 : -0.5) * BH
        z = (Math.random() - 0.5) * BT
      }
      pos.set([x, y, z], i * 3)
      const u = Math.random() * 2 - 1
      const th = Math.random() * Math.PI * 2
      const s = Math.sqrt(1 - u * u)
      dir.set([Math.cos(th) * s, u, Math.sin(th) * s], i * 3)
      rnd.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4)
      gold[i] = gd
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aDir', new THREE.BufferAttribute(dir, 3))
    geo.setAttribute('aRand', new THREE.BufferAttribute(rnd, 4))
    geo.setAttribute('aGold', new THREE.BufferAttribute(gold, 1))
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uBurst: { value: 0 }, uGather: { value: 0 }, uOpacity: { value: 0 },
        uPR: { value: 1 }, uPulse: { value: 0 }, uBook: { value: new THREE.Matrix4() },
        uCenter: { value: STAGE.book.clone() },
      },
      vertexShader: VERT,
      fragmentShader: POINT_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    return { geo, mat }
  }, [count, cover])

  useFrame((state) => {
    const t = store.time
    const vis = t > 18.9 && t < 24.2
    pts.current.visible = vis
    if (!vis) return
    const u = mat.uniforms
    u.uTime.value = state.clock.elapsedTime
    u.uBurst.value = 1 - Math.pow(1 - seg(t, 19.0, 20.3), 3)
    u.uGather.value = seg(t, 19.9, 22.5)
    u.uOpacity.value = Math.min(1, seg(t, 18.95, 19.15) * 1.2) * (1 - seg(t, 22.6, 24.0))
    u.uPulse.value = pulseAt(t, [19.0, 22.6], 4)
    u.uPR.value = gl.getPixelRatio()
    u.uBook.value.copy(bookLive.matrix)
  })

  return <points ref={pts} geometry={geo} material={mat} frustumCulled={false} />
}
