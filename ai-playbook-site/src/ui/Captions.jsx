import { useEffect, useRef } from 'react'
import { voiceAt } from '../core/narration'
import { store } from '../core/timeline'

/**
 * Narration subtitles for muted visitors — only for sentences that are not already
 * written on screen (elements tied to a clip via data-seg), so nothing is shown twice.
 */
export function Captions({ visible }) {
  const el = useRef()
  const last = useRef(null)
  useEffect(() => {
    const onScreen = new Set([...document.querySelectorAll('[data-seg]')].map((n) => n.dataset.seg))
    let raf
    const loop = () => {
      let s = visible ? voiceAt(store.master, 0.15, 0.4) : null
      if (s && onScreen.has(s.id)) s = null
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
