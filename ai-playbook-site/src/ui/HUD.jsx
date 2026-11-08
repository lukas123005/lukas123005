import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { SCENES, sceneAt, store } from '../core/timeline'
import { plan, toMaster } from '../core/narration'

/** Minimal chrome: wordmark, play / sound / replay as text, and a hairline timeline. */
export function HUD({ visible, muted, onMute, playing, onPlay, onReplay, onSeek }) {
  const bar = useRef()
  const [scene, setScene] = useState(0)

  useEffect(() => {
    let raf
    const loop = () => {
      if (bar.current) bar.current.style.transform = `scaleX(${store.master / plan.total})`
      const s = sceneAt(store.time)
      setScene((p) => (p === s ? p : s))
      raf = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <motion.div className="hud" initial={{ opacity: 0 }} animate={{ opacity: visible ? 1 : 0 }} transition={{ duration: 1.6, delay: 0.6 }}>
      <header className="hud-top">
        <div className="brand">CREATOR LAB</div>
        <div className="hud-actions">
          <button className="text-btn" onClick={onPlay}>{playing ? 'PAUSE' : 'PLAY'}</button>
          <button className="text-btn" onClick={onMute} aria-pressed={!muted}>{muted ? 'SOUND OFF' : 'SOUND ON'}</button>
          <button className="text-btn" onClick={onReplay}>REPLAY</button>
        </div>
      </header>
      <footer className="hud-bottom">
        <div className="scene-label">
          <span>{String(scene + 1).padStart(2, '0')}</span>
          {SCENES[scene].label}
        </div>
        <div className="progress">
          <div className="progress-fill" ref={bar} />
          {SCENES.map((s, i) => (
            <button
              key={s.id}
              className={`marker ${i <= scene ? 'on' : ''}`}
              style={{ left: `${(toMaster(s.start) / plan.total) * 100}%` }}
              onClick={() => onSeek(s.start + 0.05)}
              aria-label={`Go to ${s.label}`}
              title={s.label}
            />
          ))}
        </div>
        <span />
      </footer>
    </motion.div>
  )
}
