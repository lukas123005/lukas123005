import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { SCENES, sceneAt, store } from '../core/timeline'
import { plan, toMaster } from '../core/narration'

/** Top bar (brand, sound, play) + bottom cinematic progress / chapter navigation + replay. */
export function HUD({ visible, muted, onMute, playing, onPlay, onReplay, onSeek }) {
  const bar = useRef()
  const [scene, setScene] = useState(0)

  useEffect(() => {
    let raf
    const loop = () => {
      const t = store.time
      if (bar.current) bar.current.style.transform = `scaleX(${store.master / plan.total})`
      const s = sceneAt(t)
      setScene((p) => (p === s ? p : s))
      raf = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <motion.div className="hud" initial={{ opacity: 0 }} animate={{ opacity: visible ? 1 : 0 }} transition={{ duration: 1.2, delay: 0.4 }}>
      <header className="hud-top">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          CREATOR LAB
        </div>
        <div className="hud-actions">
          <motion.button className="icon-btn" whileTap={{ scale: 0.9 }} onClick={onPlay} aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? (
              <svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14" /></svg>
            ) : (
              <svg viewBox="0 0 24 24"><path d="M7 5l12 7-12 7z" /></svg>
            )}
          </motion.button>
          <motion.button className={`icon-btn sound ${muted ? 'is-muted' : ''}`} whileTap={{ scale: 0.9 }} onClick={onMute} aria-label={muted ? 'Unmute' : 'Mute'}>
            <span className="eq" aria-hidden="true">
              <i /><i /><i /><i />
            </span>
          </motion.button>
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
        <motion.button className="replay" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={onReplay}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5" /></svg>
          REPLAY
        </motion.button>
      </footer>
    </motion.div>
  )
}
