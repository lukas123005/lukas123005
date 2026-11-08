import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ScrollToPlugin } from 'gsap/ScrollToPlugin'
import { store } from './timeline'
import { plan, toFilm, toMaster as M } from './narration'

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin)

/**
 * One master timeline drives everything. It runs in master (narrated, wall-clock) seconds;
 * visuals read film time through the narration map. ScrollTrigger scrubs it from the scroll
 * position, and autoplay simply scrolls the page at real-time speed.
 */
export function createDirector(root, { onPlayingChange } = {}) {
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

  // editorial lines: rise out of a mask, settle their tracking, then fade
  root.querySelectorAll('[data-line]').forEach((el) => {
    const tin = M(parseFloat(el.dataset.in))
    const tout = M(parseFloat(el.dataset.out))
    const inner = el.querySelector('.in')
    const track = getComputedStyle(el).letterSpacing
    tl.set(el, { autoAlpha: 1 }, tin - 0.01)
    tl.fromTo(inner, { yPercent: 108 }, { yPercent: 0, duration: 1.5, ease: 'expo.out', immediateRender: false }, tin)
    tl.fromTo(el, { letterSpacing: '0.2em' }, { letterSpacing: track && track !== 'normal' ? track : '0.06em', duration: 3, ease: 'power3.out', immediateRender: false }, tin)
    tl.to(el, { autoAlpha: 0, duration: 0.9, ease: 'power2.inOut' }, Math.max(tin + 1.6, tout - 0.9))
  })

  // contents index beside the open book
  const index = root.querySelector('[data-index]')
  if (index) {
    const a = M(parseFloat(index.dataset.in))
    const b = M(parseFloat(index.dataset.out))
    const items = index.querySelectorAll('li')
    tl.fromTo(index, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.2, ease: 'power2.out', immediateRender: false }, a)
    tl.fromTo(items, { opacity: 0, y: 10 }, { opacity: 0.32, y: 0, duration: 0.9, stagger: 0.09, ease: 'power3.out', immediateRender: false }, a + 0.2)
    items.forEach((li) => {
      const on = M(parseFloat(li.dataset.on))
      tl.to(li, { opacity: 1, duration: 0.8, ease: 'power2.out' }, on)
    })
    tl.to(index, { autoAlpha: 0, duration: 0.6 }, b - 0.6)
  }

  // dips to black at every editorial cut (and a slow fade up from black at the start)
  const cut = root.querySelector('[data-cuts]')
  if (cut) {
    tl.fromTo(cut, { opacity: 1 }, { opacity: 0, duration: 1.8, ease: 'power2.inOut' }, 0.1)
    String(cut.dataset.cuts).split(',').map(Number).forEach((c) => {
      const m = M(c)
      tl.fromTo(cut, { opacity: 0 }, { opacity: 1, duration: 0.38, ease: 'power2.in', immediateRender: false }, m - 0.4)
      tl.to(cut, { opacity: 0, duration: 0.7, ease: 'power2.out' }, m + 0.06)
    })
  }

  const cta = root.querySelector('[data-cta]')
  if (cta) {
    const parts = cta.querySelectorAll('[data-cta-part]')
    tl.fromTo(cta, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, immediateRender: false }, M(51.6))
    tl.fromTo(parts, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 1.4, stagger: 0.28, ease: 'expo.out', immediateRender: false }, M(51.7))
  }

  const st = ScrollTrigger.create({
    trigger: '#scroll-track',
    start: 'top top',
    end: 'bottom bottom',
    scrub: 1.0,
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
  const seek = (t) => {
    auto?.kill()
    setPlaying(false)
    const max = ScrollTrigger.maxScroll(window)
    gsap.to(window, { scrollTo: { y: (M(t) / TOTAL) * max }, duration: 1.4, ease: 'power2.inOut' })
  }
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
