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

  // narration clips (master seconds) — screen text is cued from the words themselves
  const segStart = (id) => plan.byId?.[id]?.start
  const segEnd = (id) => (plan.byId?.[id] ? plan.byId[id].start + plan.byId[id].dur : undefined)

  // editorial lines: rise out of a mask, settle their tracking, then fade
  root.querySelectorAll('[data-line]').forEach((el) => {
    const s = el.dataset.seg && segStart(el.dataset.seg)
    const tin = s != null ? Math.max(0.2, s - 0.15) : M(parseFloat(el.dataset.in))
    const e = el.dataset.seg && segEnd(el.dataset.seg)
    const tout = Math.max(M(parseFloat(el.dataset.out)), e != null ? e + 0.9 : 0)
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

  // 06 · what's inside / why this book — every item lands on the word that names it
  root.querySelectorAll('[data-panel]').forEach((panel) => {
    const a = (segStart(panel.dataset.from) ?? M(51.5)) - 0.7
    const b = (segStart(panel.dataset.to) ?? M(63)) - 0.6
    tl.fromTo(panel, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6, ease: 'power2.out', immediateRender: false }, a)
    tl.fromTo(panel.querySelector('.panel-title'), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.8, ease: 'expo.out', immediateRender: false }, a + 0.05)
    panel.querySelectorAll('li[data-seg]').forEach((li) => {
      const at = (segStart(li.dataset.seg) ?? a + 1) - 0.12
      tl.fromTo(li, { opacity: 0, x: 26 }, { opacity: 1, x: 0, duration: 0.9, ease: 'expo.out', immediateRender: false }, at)
      const rule = li.querySelector('.rule')
      if (rule) tl.fromTo(rule, { scaleX: 0 }, { scaleX: 1, duration: 1.1, ease: 'expo.out', immediateRender: false }, at + 0.1)
      const n = parseInt(li.dataset.count, 10)
      const big = li.querySelector('.big')
      if (big && n) {
        const o = { v: 0 }
        tl.fromTo(o, { v: 0 }, { v: n, duration: 1.0, ease: 'power3.out', immediateRender: false, onUpdate: () => { big.textContent = String(Math.round(o.v)) } }, at)
      } else if (big) {
        tl.fromTo(big, { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.7, ease: 'back.out(2)', immediateRender: false }, at + 0.05)
      }
      const check = li.querySelector('svg path')
      if (check) tl.fromTo(check, { strokeDashoffset: 18 }, { strokeDashoffset: 0, duration: 0.7, ease: 'power2.out', immediateRender: false }, at + 0.2)
      // keep earlier items visible but let the current one lead
      tl.to(li, { opacity: 0.55, duration: 0.6 }, at + 1.6)
    })
    const moment = panel.querySelector('.moment')
    if (moment) {
      const at = (segStart(moment.dataset.seg) ?? b - 3) - 0.1
      tl.fromTo(moment, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 1.2, ease: 'expo.out', immediateRender: false }, at)
      tl.fromTo(moment.querySelector('em'), { opacity: 0 }, { opacity: 1, duration: 0.8, ease: 'power2.out', immediateRender: false }, (segEnd(moment.dataset.seg) ?? at + 3) - 1.0)
    }
    tl.to(panel, { autoAlpha: 0, duration: 0.6, ease: 'power2.in' }, b)
  })

  const cta = root.querySelector('[data-cta]')
  if (cta) {
    const parts = cta.querySelectorAll('[data-cta-part]')
    const at = (segStart('08-future') ?? M(63.6)) - 0.3
    tl.fromTo(cta, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, immediateRender: false }, at)
    tl.fromTo(parts, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 1.4, stagger: 0.28, ease: 'expo.out', immediateRender: false }, at + 0.1)
    const price = cta.querySelector('.cta-price')
    const ps = segStart('11-price')
    if (price && ps != null) tl.fromTo(price, { scale: 1 }, { scale: 1.12, duration: 0.45, yoyo: true, repeat: 1, ease: 'power2.out', immediateRender: false }, ps + 1.6)
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
