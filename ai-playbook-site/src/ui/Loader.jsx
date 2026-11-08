import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useProgress } from '@react-three/drei'
import { CONFIG } from '../config'

/** Quiet entry screen: title, a hairline progress bar, and the entry choice (which unlocks audio). */
export function Loader({ visible, onEnter, ready: voiceReady = true, minTime = 1400 }) {
  const { progress, active, total } = useProgress()
  const [shown, setShown] = useState(0)
  const [elapsed, setElapsed] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => setElapsed(true), minTime)
    return () => clearTimeout(id)
  }, [minTime])

  useEffect(() => {
    let raf
    const tick = () => {
      setShown((s) => s + ((elapsed ? (total === 0 ? 100 : progress) : Math.min(total === 0 ? 100 : progress, 90)) - s) * 0.07)
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [progress, elapsed, total])

  const ready = voiceReady && elapsed && !active && (progress >= 100 || total === 0) && shown > 99
  const pct = Math.min(100, Math.round(shown))

  return (
    <AnimatePresence>
      {visible && (
        <motion.div className="loader" initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.4, ease: [0.65, 0, 0.35, 1] }}>
          <p className="loader-title">{CONFIG.book.title}</p>
          <p className="loader-sub">{CONFIG.book.author} · {CONFIG.book.brand}</p>
          <div className="loader-bar" aria-hidden="true">
            <i style={{ transform: `scaleX(${pct / 100})` }} />
          </div>
          <p className="loader-pct">{String(pct).padStart(3, '0')}</p>
          <AnimatePresence>
            {ready && (
              <motion.div className="loader-actions" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}>
                <button className="enter" onClick={() => onEnter(true)}>
                  BEGIN WITH SOUND
                </button>
                <button className="enter-muted" onClick={() => onEnter(false)}>
                  WITHOUT SOUND
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
