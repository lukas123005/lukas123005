import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ScrollToPlugin } from 'gsap/ScrollToPlugin'
import { store } from './timeline'
import { plan, toFilm, toMaster as M } from './narration'

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin)

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=/<>'

/**
 * One master timeline (0 → DURATION seconds) drives everything:
 *  - store.time (read by Three.js every frame)
 *  - all DOM typography / flashes / CTA
 * ScrollTrigger scrubs it from the scroll position; autoplay simply scrolls the page.
 */
export function createDirector(root, { onPlayingChange } = {}) {
  // timeline runs in master (narration) seconds; visuals read film time through the map
  const TOTAL = plan.total
  const proxy = { t: 0 }
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } })
  tl.to(proxy, {
    t: TOTAL,
    duration: TOTAL,
    ease: 'none',
    onUpdate: () => {
      store.master = proxy.t
      if (store.frozen == null) store.time = toFilm(proxy.t)
    },
  }, 0)

  root.querySelectorAll('[data-line]').forEach((el) => addLine(tl, el))
  root.querySelectorAll('[data-flash]').forEach((el) => {
    String(el.dataset.flash).split(',').map(Number).forEach((at) => {
      tl.fromTo(el, { opacity: 0 }, { opacity: 0.85, duration: 0.06, immediateRender: false }, M(at) - 0.06)
      tl.to(el, { opacity: 0, duration: 0.9, ease: 'power2.out' }, M(at))
    })
  })
  const cta = root.querySelector('[data-cta]')
  if (cta) {
    const parts = cta.querySelectorAll('[data-cta-part]')
    tl.fromTo(cta, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4, immediateRender: false }, M(48.4))
    tl.fromTo(parts, { opacity: 0, y: 40, filter: 'blur(14px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.1, stagger: 0.22, ease: 'expo.out', immediateRender: false }, M(48.6))
  }
  const hint = root.querySelector('[data-hint]')
  if (hint) tl.to(hint, { autoAlpha: 0, duration: 0.6 }, 1.0)

  const st = ScrollTrigger.create({
    trigger: '#scroll-track',
    start: 'top top',
    end: 'bottom bottom',
    scrub: 0.85,
    animation: tl,
  })

  let auto = null
  const setPlaying = (v) => {
    store.playing = v
    onPlayingChange?.(v)
  }
  const play = () => {
    const max = ScrollTrigger.maxScroll(window)
    if (window.scrollY >= max - 2) window.scrollTo(0, 0)
    const remaining = (1 - window.scrollY / max) * TOTAL
    auto?.kill()
    setPlaying(true)
    auto = gsap.to(window, {
      scrollTo: { y: 'max', autoKill: true, onAutoKill: () => setPlaying(false) },
      duration: Math.max(0.5, remaining),
      ease: 'none',
      onComplete: () => setPlaying(false),
    })
  }
  const pause = () => {
    auto?.kill()
    setPlaying(false)
  }
  const replay = () => {
    auto?.kill()
    window.scrollTo(0, 0)
    tl.progress(0)
    proxy.t = 0
    store.time = 0
    store.master = 0
    ScrollTrigger.update()
    gsap.delayedCall(0.35, play)
  }
  const seek = (t) => { // t in film seconds
    auto?.kill()
    setPlaying(false)
    const max = ScrollTrigger.maxScroll(window)
    gsap.to(window, { scrollTo: { y: (M(t) / TOTAL) * max }, duration: 1.2, ease: 'power2.inOut' })
  }
  // user interaction stops autoplay
  const stop = () => auto && auto.isActive() && pause()
  window.addEventListener('wheel', stop, { passive: true })
  window.addEventListener('touchstart', stop, { passive: true })
  window.addEventListener('keydown', stop)

  return {
    tl, st, play, pause, replay, seek, total: TOTAL,
    destroy() {
      window.removeEventListener('wheel', stop)
      window.removeEventListener('touchstart', stop)
      window.removeEventListener('keydown', stop)
      auto?.kill()
      st.kill()
      tl.kill()
    },
  }
}

/** Morphing typography: chars fly in from depth with blur, tracking collapses; exit dissolves upward. */
function addLine(tl, el) {
  const tin = M(parseFloat(el.dataset.in))
  const tout = M(parseFloat(el.dataset.out))
  const fx = el.dataset.fx || 'depth'
  const chars = el.querySelectorAll('.ch')
  tl.set(el, { autoAlpha: 1 }, tin - 0.01)
  tl.set(el, { autoAlpha: 0 }, tout + 0.01)
  if (fx === 'scramble') {
    const finals = [...chars].map((c) => c.textContent)
    const o = { p: 0 }
    tl.fromTo(chars, { opacity: 0 }, { opacity: 1, duration: 0.25, stagger: 0.012, immediateRender: false }, tin)
    tl.fromTo(o, { p: 0 }, {
      p: 1,
      duration: 1.0,
      immediateRender: false,
      onUpdate: () => {
        const n = finals.length
        const tick = Math.floor(o.p * 24)
        chars.forEach((c, i) => {
          if (finals[i] === ' ') return
          const settled = o.p >= 0.999 || o.p * 1.25 * (n + 6) - i > 6
          c.textContent = settled ? finals[i] : GLYPHS[(i * 7 + tick * 13) % GLYPHS.length]
        })
      },
    }, tin)
    tl.fromTo(el, { letterSpacing: '0.5em' }, { letterSpacing: el.dataset.track || '0.02em', duration: 1.1, ease: 'expo.out', immediateRender: false }, tin)
  } else {
    tl.fromTo(
      chars,
      { opacity: 0, yPercent: 120, z: -400, rotateX: -95, filter: 'blur(16px)' },
      { opacity: 1, yPercent: 0, z: 0, rotateX: 0, filter: 'blur(0px)', duration: 1.0, ease: 'expo.out', stagger: { each: 0.028, from: fx === 'center' ? 'center' : 'start' }, immediateRender: false },
      tin
    )
    tl.fromTo(el, { letterSpacing: '0.35em' }, { letterSpacing: el.dataset.track || '0.0em', duration: 1.4, ease: 'expo.out', immediateRender: false }, tin)
  }
  const ex = Math.max(tin + 1.2, tout - 0.55)
  tl.to(chars, { opacity: 0, yPercent: -60, scale: 1.25, filter: 'blur(12px)', duration: 0.5, ease: 'power2.in', stagger: { each: 0.012, from: 'center' } }, ex)
}
