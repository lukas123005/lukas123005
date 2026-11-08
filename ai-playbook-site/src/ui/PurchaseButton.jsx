import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { CONFIG } from '../config'

/** Metallic CTA with blue glow and a small interactive particle field. */
export function PurchaseButton({ label = 'GET THE PLAYBOOK' }) {
  const wrap = useRef()
  const cvs = useRef()
  const parts = useRef([])
  const hover = useRef(false)
  const mouse = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const c = cvs.current
    const ctx = c.getContext('2d')
    let raf
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const resize = () => {
      const r = c.getBoundingClientRect()
      c.width = r.width * dpr
      c.height = r.height * dpr
    }
    resize()
    window.addEventListener('resize', resize)
    const loop = () => {
      const w = c.width
      const h = c.height
      ctx.clearRect(0, 0, w, h)
      // ambient sparks + bursts that follow the pointer while hovering
      if (Math.random() < (hover.current ? 0.9 : 0.25)) {
        const fromMouse = hover.current
        parts.current.push({
          x: fromMouse ? mouse.current.x * dpr : w * (0.2 + Math.random() * 0.6),
          y: fromMouse ? mouse.current.y * dpr : h * (0.35 + Math.random() * 0.3),
          vx: (Math.random() - 0.5) * (fromMouse ? 2.4 : 0.6) * dpr,
          vy: (-0.3 - Math.random() * (fromMouse ? 1.6 : 0.6)) * dpr,
          life: 1,
          gold: Math.random() < 0.3,
        })
      }
      parts.current = parts.current.filter((p) => p.life > 0)
      for (const p of parts.current) {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.01 * dpr
        p.life -= 0.016
        ctx.beginPath()
        ctx.fillStyle = p.gold ? `rgba(240,200,120,${p.life})` : `rgba(120,180,255,${p.life})`
        ctx.arc(p.x, p.y, 1.4 * dpr, 0, Math.PI * 2)
        ctx.fill()
      }
      raf = requestAnimationFrame(loop)
    }
    loop()
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  const href = CONFIG.checkoutUrl || '#'
  return (
    <div className="buy-wrap" ref={wrap}>
      <canvas ref={cvs} className="buy-sparks" aria-hidden="true" />
      <motion.a
        href={href}
        target={CONFIG.checkoutUrl ? '_blank' : undefined}
        rel="noopener noreferrer"
        className="buy"
        whileHover={{ scale: 1.045 }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 380, damping: 22 }}
        onPointerEnter={() => (hover.current = true)}
        onPointerLeave={() => (hover.current = false)}
        onPointerMove={(e) => {
          const r = cvs.current.getBoundingClientRect()
          mouse.current = { x: e.clientX - r.left, y: e.clientY - r.top }
          const b = e.currentTarget.getBoundingClientRect()
          e.currentTarget.style.setProperty('--mx', `${((e.clientX - b.left) / b.width) * 100}%`)
        }}
        onClick={(e) => {
          if (!CONFIG.checkoutUrl) {
            e.preventDefault()
            console.warn('Set your Whop checkout URL in src/config.js (checkoutUrl) or VITE_CHECKOUT_URL.')
          }
        }}
      >
        <span className="buy-border" aria-hidden="true" />
        <span className="buy-label">{label}</span>
        <svg className="buy-arrow" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </motion.a>
    </div>
  )
}
