import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useProgress } from '@react-three/drei'
import { CONFIG } from '../config'

/** Futuristic loading screen with real asset progress and an entry gate (unlocks audio). */
export function Loader({ visible, onEnter, ready: voiceReady = true, minTime = 1600 }) {
  const { progress, active } = useProgress()
  const [shown, setShown] = useState(0)
  const [elapsed, setElapsed] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => setElapsed(true), minTime)
    return () => clearTimeout(id)
  }, [minTime])

  useEffect(() => {
    let raf
    const tick = () => {
      setShown((s) => {
        const target = elapsed ? progress : Math.min(progress, 92)
        return s + (target - s) * 0.08
      })
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [progress, elapsed])

  const ready = voiceReady && elapsed && !active && progress >= 100 && shown > 99
  const pct = Math.min(100, Math.round(shown))
  const R = 92
  const C = 2 * Math.PI * R

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="loader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, filter: 'blur(20px)', scale: 1.08 }}
          transition={{ duration: 1.1, ease: [0.7, 0, 0.2, 1] }}
        >
          <div className="loader-grid" aria-hidden="true" />
          <div className="loader-core">
            <svg viewBox="0 0 220 220" className="loader-ring" aria-hidden="true">
              <circle cx="110" cy="110" r={R} className="track" />
              <circle cx="110" cy="110" r={R} className="bar" strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} />
              <circle cx="110" cy="110" r="104" className="ticks" />
            </svg>
            <div className="loader-pct">
              <span>{String(pct).padStart(3, '0')}</span>
              <small>%</small>
            </div>
          </div>
          <p className="loader-status">{ready ? 'SYSTEM READY' : 'INITIALISING NEURAL ENGINE'}</p>
          <p className="loader-title">{CONFIG.book.title}</p>
          <AnimatePresence>
            {ready && (
              <motion.div
                className="loader-actions"
                initial={{ opacity: 0, y: 24, filter: 'blur(10px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              >
                <motion.button className="enter" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} onClick={() => onEnter(true)}>
                  ENTER THE EXPERIENCE
                  <em>with narration &amp; sound</em>
                </motion.button>
                <button className="enter-muted" onClick={() => onEnter(false)}>
                  enter muted
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
