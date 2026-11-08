import { useEffect, useRef } from 'react'
import { voiceAt } from '../core/narration'
import { store } from '../core/timeline'

/** Narration subtitles — shown when sound is off, so the story still reads on muted phones. */
export function Captions({ visible }) {
  const el = useRef()
  const last = useRef(null)
  useEffect(() => {
    let raf
    const loop = () => {
      const s = visible ? voiceAt(store.master, 0.15, 0.4) : null
      if (el.current && s !== last.current) {
        last.current = s
        el.current.classList.toggle('on', !!s)
        if (s) el.current.textContent = s.text
      }
      raf = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [visible])
  return <p className="captions" ref={el} aria-live="polite" />
}
