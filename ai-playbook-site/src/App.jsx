import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import * as THREE from 'three'
import { createDirector } from './core/director'
import { detectQuality, hasWebGL, prefersReducedMotion, QUALITY } from './core/quality'
import { store } from './core/timeline'
import { loadNarration, plan, toMaster } from './core/narration'
import { sound } from './core/audio'
import { Experience } from './three/Experience'
import { Overlay } from './ui/Overlay'
import { Loader } from './ui/Loader'
import { HUD } from './ui/HUD'
import { Fallback } from './ui/Fallback'
import { Captions } from './ui/Captions'

const params = new URLSearchParams(window.location.search)
const DEBUG_T = params.has('t') ? parseFloat(params.get('t')) : null
const SKIP_LOADER = params.has('noloader')

export default function App() {
  const webgl = useMemo(hasWebGL, [])
  const [quality] = useState(detectQuality)
  const [dpr, setDpr] = useState(QUALITY[quality].dpr[1])
  const [fontsReady, setFontsReady] = useState(false)
  const [entered, setEntered] = useState(false)
  const [muted, setMuted] = useState(true)
  const [playing, setPlaying] = useState(false)
  const [voiceReady, setVoiceReady] = useState(false)
  const overlay = useRef()
  const director = useRef()

  store.quality = quality
  if (params.has('debug')) Object.assign(window, { __sound: sound, __plan: plan, __store: store })

  // fonts must be ready before canvas textures are painted
  useEffect(() => {
    Promise.all([
      document.fonts.load('700 64px "Inter Variable"'),
      document.fonts.load('400 64px "Inter Variable"'),
      document.fonts.load('400 64px Caladea'),
      document.fonts.load('italic 400 64px Caladea'),
    ]).finally(() => setFontsReady(true))
  }, [])

  // narration first: its real clip lengths define the film's timing
  useEffect(() => {
    loadNarration().finally(() => setVoiceReady(true))
  }, [])

  // master timeline
  useEffect(() => {
    if (!voiceReady || !overlay.current) return
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
    window.scrollTo(0, 0)
    director.current = createDirector(overlay.current, { onPlayingChange: setPlaying })
    if (DEBUG_T != null) {
      store.frozen = DEBUG_T
      store.time = DEBUG_T
      requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight
        window.scrollTo(0, (toMaster(DEBUG_T) / plan.total) * max)
      })
    }
    return () => director.current?.destroy()
  }, [voiceReady])

  // lock scrolling until the visitor enters
  useEffect(() => {
    document.documentElement.classList.toggle('locked', webgl && !entered && DEBUG_T == null && !SKIP_LOADER)
  }, [entered, webgl])

  // pointer → interactive particles, parallax, drag-to-rotate the book
  useEffect(() => {
    const move = (e) => {
      store.mouse.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1)
      store.pointerActive = e.pointerType === 'mouse' || store.drag.down
      const d = store.drag
      if (d.down) {
        const dx = e.clientX - d.lastX
        d.lastX = e.clientX
        d.yaw += dx * 0.008
        d.vel = dx * 0.5
      }
    }
    const down = (e) => {
      if (e.target.closest('button, a')) return
      store.drag.down = true
      store.drag.lastX = e.clientX
    }
    const up = () => (store.drag.down = false)
    const leave = () => (store.pointerActive = false)
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerdown', down, { passive: true })
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    document.addEventListener('pointerleave', leave)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      document.removeEventListener('pointerleave', leave)
    }
  }, [])

  const enter = useCallback(async (withSound) => {
    setEntered(true)
    if (withSound) {
      await sound.setMuted(false)
      setMuted(false)
    }
    if (DEBUG_T == null && !prefersReducedMotion()) setTimeout(() => director.current?.play(), 900)
  }, [])

  useEffect(() => {
    if (SKIP_LOADER && voiceReady) enter(false)
  }, [enter, voiceReady])

  const toggleMute = async () => {
    const m = !muted
    await sound.setMuted(m)
    setMuted(m)
  }

  return (
    <>
      {webgl ? (
        <div className="stage" aria-hidden="true">
          {fontsReady && (
            <Canvas
              dpr={dpr}
              shadows={QUALITY[quality].post === 'full'}
              gl={{ antialias: false, powerPreference: 'high-performance', toneMapping: THREE.NoToneMapping, preserveDrawingBuffer: params.has('shot') }}
              camera={{ fov: 55, near: 0.1, far: 1200, position: [0, 0, 30] }}
              onCreated={(st) => { if (params.has('debug')) window.__three = st }}
            >
              <PerformanceMonitor
                bounds={() => [40, 58]}
                onDecline={() => setDpr((d) => Math.max(QUALITY[quality].dpr[0], d - 0.25))}
                onIncline={() => setDpr((d) => Math.min(QUALITY[quality].dpr[1], d + 0.15))}
              />
              <Suspense fallback={null}>
                <Experience quality={quality} />
              </Suspense>
            </Canvas>
          )}
        </div>
      ) : (
        <Fallback />
      )}

      {webgl && (
        <>
          {voiceReady && <Overlay ref={overlay} />}
          <div id="scroll-track" style={{ height: `${Math.round(plan.total * 12)}vh` }} />
          <Captions visible={entered && muted} />
          <HUD
            visible={entered}
            muted={muted}
            onMute={toggleMute}
            playing={playing}
            onPlay={() => (playing ? director.current?.pause() : director.current?.play())}
            onReplay={() => director.current?.replay()}
            onSeek={(t) => director.current?.seek(t)}
          />
          <Loader visible={!entered && DEBUG_T == null && !SKIP_LOADER} ready={voiceReady} onEnter={enter} />
        </>
      )}
    </>
  )
}
