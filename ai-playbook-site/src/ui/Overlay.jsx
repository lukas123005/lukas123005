import { forwardRef } from 'react'
import { CONFIG } from '../config'
import { CUTS } from '../core/timeline'
import { PurchaseButton } from './PurchaseButton'

/**
 * Editorial typography. Every [data-line] is revealed by the director's master timeline
 * (data-in / data-out in film seconds). Lines rise out of a mask — no blur, no distortion.
 */
const LINES = [
  { pos: 'statement', cls: 'serif-xl', in: 2.4, out: 6.6, text: 'THE WAY WE WORK IS CHANGING.' },
  { pos: 'statement', cls: 'serif-xl', in: 8.3, out: 12.45, text: 'ARTIFICIAL INTELLIGENCE IS CREATING NEW POSSIBILITIES.' },
  { pos: 'statement', cls: 'serif-xl', in: 13.7, out: 18.6, text: 'KNOWING WHICH TOOLS TO USE MAKES ALL THE DIFFERENCE.' },
  // 05 · product
  { pos: 'p1', cls: 'serif-lg', in: 44.3, out: 50.6, text: CONFIG.book.title },
  { pos: 'p2', cls: 'label', in: 44.9, out: 50.6, text: `BY ${CONFIG.book.author}` },
  { pos: 'p3', cls: 'label dim', in: 45.2, out: 50.6, text: CONFIG.book.brand },
]

// which topics are on the open spread, and when (film seconds)
const INDEX_ON = [35.4, 35.4, 37.6, 37.6, 39.8, 39.8, 42.0]

export const Overlay = forwardRef(function Overlay(_, ref) {
  return (
    <div ref={ref} className="overlay">
      {LINES.map((l, i) => (
        <div key={i} className={`line pos-${l.pos} ${l.cls}`} data-line data-in={l.in} data-out={l.out} aria-hidden="true">
          <span className="mask">
            <span className="in">{l.text}</span>
          </span>
        </div>
      ))}

      <aside className="index" data-index data-in="32.4" data-out="42.9" aria-hidden="true">
        <p className="index-title">INSIDE THE PLAYBOOK</p>
        <ol>
          {CONFIG.topics.map((t, i) => (
            <li key={t.label} data-on={INDEX_ON[i]}>
              <span className="num">{String(i + 1).padStart(2, '0')}</span>
              <span className="name">{t.label}</span>
            </li>
          ))}
        </ol>
      </aside>

      <div className="cut" data-cuts={CUTS.join(',')} />

      <section className="cta" data-cta aria-label="Purchase">
        <p className="cta-kicker" data-cta-part>{CONFIG.book.title}</p>
        <h2 data-cta-part>
          A smarter way to start building your future.
        </h2>
        <div className="cta-row" data-cta-part>
          <span className="cta-price">{CONFIG.price}</span>
          <PurchaseButton label="GET YOUR COPY" />
        </div>
        <p className="cta-meta" data-cta-part>
          Digital guide · PDF · {CONFIG.book.author} · {CONFIG.book.brand}
        </p>
      </section>

      <h1 className="sr-only">
        {CONFIG.book.title} — {CONFIG.book.subtitle}. {CONFIG.book.author}, {CONFIG.book.brand}.
      </h1>
    </div>
  )
})
