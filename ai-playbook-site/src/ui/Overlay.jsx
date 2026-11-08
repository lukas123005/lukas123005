import { forwardRef } from 'react'
import { CONFIG } from '../config'
import { PurchaseButton } from './PurchaseButton'

/**
 * All on-screen typography. Each [data-line] is animated by the director's master timeline
 * (data-in / data-out in seconds, data-fx = depth | center | scramble).
 */
const LINES = [
  // Scene 1 — The Void
  { pos: 'center', size: 'xl', in: 1.7, out: 3.75, fx: 'center', parts: [['THE FUTURE IS ', ''], ['NOT COMING.', 'dim']] },
  { pos: 'center', size: 'xl', in: 3.85, out: 5.35, fx: 'scramble', parts: [['IT IS ALREADY HERE.', 'blue']] },
  // Scene 2 — AI Awakening
  { pos: 'lower', size: 'lg', in: 7.0, out: 11.35, fx: 'depth', parts: [['ARTIFICIAL INTELLIGENCE', '']] },
  { pos: 'lower2', size: 'lg', in: 7.4, out: 11.5, fx: 'depth', parts: [['IS CHANGING ', 'dim'], ['EVERYTHING.', 'blue']] },
  // Scene 3 — Digital Revolution
  { pos: 'center', size: 'xxl', in: 12.9, out: 14.75, fx: 'center', parts: [['THINK ', ''], ['DIFFERENTLY.', 'outline']] },
  { pos: 'center', size: 'xxl', in: 14.9, out: 16.75, fx: 'center', parts: [['CREATE ', ''], ['DIFFERENTLY.', 'outline']] },
  { pos: 'center', size: 'xxl', in: 16.9, out: 18.85, fx: 'center', parts: [['BUILD ', ''], ['DIFFERENTLY.', 'outline-gold']] },
  // Scene 4 — Reveal
  { pos: 'top', size: 'kicker', in: 23.6, out: 28.7, fx: 'scramble', track: '0.42em', parts: [['CREATOR LAB PRESENTS', '']] },
  { pos: 'bottom', size: 'serif', in: 24.6, out: 28.8, fx: 'depth', parts: [[CONFIG.book.subtitle, 'serif-it']] },
  // Scene 5 — Knowledge
  { pos: 'top', size: 'kicker', in: 30.2, out: 38.8, fx: 'scramble', track: '0.42em', parts: [['INSIDE THE PLAYBOOK', '']] },
  { pos: 'bottom', size: 'kicker', in: 31.0, out: 38.8, fx: 'depth', track: '0.32em', parts: [[CONFIG.book.facts, 'gold']] },
  // Scene 6 — Final impact
  { pos: 'final1', size: 'title', in: 42.2, out: 47.9, fx: 'center', track: '0.02em', parts: [[CONFIG.book.title, 'serif']] },
  { pos: 'final2', size: 'kicker', in: 42.9, out: 47.9, fx: 'scramble', track: '0.5em', parts: [[CONFIG.book.author, '']] },
  { pos: 'final3', size: 'kicker-sm', in: 43.2, out: 47.9, fx: 'scramble', track: '0.6em', parts: [[CONFIG.book.brand, 'gold']] },
  { pos: 'final4', size: 'md', in: 44.1, out: 47.9, fx: 'depth', track: '0.08em', parts: [['YOUR FIRST STEP INTO THE ', ''], ['AI ECONOMY.', 'blue']] },
]

function Chars({ parts }) {
  let k = 0
  return parts.map(([text, cls], pi) => (
    <span key={pi} className={`part ${cls}`}>
      {[...text].map((ch) => (
        <span key={k++} className="ch">{ch === ' ' ? ' ' : ch}</span>
      ))}
    </span>
  ))
}

export const Overlay = forwardRef(function Overlay(_, ref) {
  return (
    <div ref={ref} className="overlay">
      {LINES.map((l, i) => (
        <div
          key={i}
          className={`line pos-${l.pos} size-${l.size}`}
          data-line
          data-in={l.in}
          data-out={l.out}
          data-fx={l.fx}
          data-track={l.track}
          aria-hidden="true"
        >
          <Chars parts={l.parts} />
        </div>
      ))}
      <div className="flash" data-flash="5.45,12,19,22.6,41.6" />
      <div className="scroll-hint" data-hint>
        <span>SCROLL</span>
        <i />
      </div>
      <section className="cta" data-cta aria-label="Purchase">
        <p className="cta-kicker" data-cta-part>{CONFIG.book.title}</p>
        <h2 data-cta-part>
          GET YOUR <span>COPY TODAY</span>
        </h2>
        <p className="cta-price" data-cta-part>
          <small>ONLY</small> <strong>{CONFIG.price}</strong>
        </p>
        <div data-cta-part>
          <PurchaseButton />
        </div>
        <p className="cta-meta" data-cta-part>
          {CONFIG.book.author} · {CONFIG.book.brand} · Libër dixhital (PDF)
        </p>
      </section>
      {/* accessible text for screen readers / SEO */}
      <h1 className="sr-only">
        {CONFIG.book.title} — {CONFIG.book.subtitle}. {CONFIG.book.author}, {CONFIG.book.brand}.
      </h1>
    </div>
  )
})
