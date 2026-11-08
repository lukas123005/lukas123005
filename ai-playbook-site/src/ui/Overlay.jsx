import { forwardRef } from 'react'
import { CONFIG } from '../config'
import { CUTS } from '../core/timeline'
import { PurchaseButton } from './PurchaseButton'

/**
 * Editorial typography. Lines are revealed by the director's master timeline.
 * data-in / data-out are film seconds; data-seg ties an element to the narration clip that says it,
 * so screen and voice always carry the same words at the same moment.
 */
const LINES = [
  { pos: 'statement', cls: 'serif-xl', in: 2.4, out: 6.6, seg: '01-changing', text: 'THE WAY WE WORK IS CHANGING.' },
  { pos: 'statement', cls: 'serif-xl', in: 8.3, out: 12.45, seg: '02-possibilities', text: 'ARTIFICIAL INTELLIGENCE IS CREATING NEW POSSIBILITIES.' },
  { pos: 'statement', cls: 'serif-xl', in: 13.7, out: 18.6, seg: '03-difference', text: 'KNOWING WHICH TOOLS TO USE MAKES ALL THE DIFFERENCE.' },
  { pos: 'statement', cls: 'serif-xl', in: 22.4, out: 30.4, seg: '04-together', text: 'THE AI MONEY PLAYBOOK BRINGS EVERYTHING TOGETHER, IN ONE PRACTICAL GUIDE.' },
  { pos: 'p1', cls: 'serif-lg', in: 44.3, out: 50.6, seg: '07-signature', text: CONFIG.book.title },
  { pos: 'p2', cls: 'label', in: 44.9, out: 50.6, text: `BY ${CONFIG.book.author}` },
  { pos: 'p3', cls: 'label dim', in: 45.2, out: 50.6, text: CONFIG.book.brand },
]

// which topics are on the open spread, and when (film seconds)
const INDEX_ON = [35.4, 35.4, 37.6, 37.6, 39.8, 39.8, 42.0]

// 06 · what's inside — exactly as the narrator says it (book contents verified in the PDF)
const INSIDE = [
  { seg: '09a-prompts', n: 100, label: 'Ready-to-use prompts', note: 'Kapitulli 6 + Bonus' },
  { seg: '09b-models', n: 10, label: 'Business models', note: 'Kapitulli 7' },
  { seg: '09c-ideas', n: 10, label: 'Digital product ideas', note: 'Bonus' },
  { seg: '09d-templates', n: 5, label: 'Product templates', note: 'Bonus' },
  { seg: '09e-whop', n: null, label: 'Launch checklist for Whop', note: 'Bonus' },
]
const WHY = [
  { seg: '10a-beginners', text: 'Written for complete beginners.' },
  { seg: '10b-steps', text: 'Step by step, from your first AI tool to your first digital product.' },
  { seg: '10c-examples', text: 'With practical examples you can use today.' },
]

export const Overlay = forwardRef(function Overlay(_, ref) {
  return (
    <div ref={ref} className="overlay">
      <div className="scrim" aria-hidden="true" />

      {LINES.map((l, i) => (
        <div key={i} className={`line pos-${l.pos} ${l.cls}`} data-line data-in={l.in} data-out={l.out} data-seg={l.seg} aria-hidden="true">
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

      <section className="panel inside" data-panel="inside" data-from="09a-prompts" data-to="10a-beginners" aria-label="What's inside">
        <p className="panel-title">WHAT&rsquo;S INSIDE</p>
        <ul>
          {INSIDE.map((r) => (
            <li key={r.seg} data-seg={r.seg} data-count={r.n ?? ''}>
              <span className="big">{r.n == null ? '✓' : '0'}</span>
              <span className="txt">
                <strong>{r.label}</strong>
                <small>{r.note}</small>
              </span>
              <i className="rule" />
            </li>
          ))}
        </ul>
      </section>

      <section className="panel why" data-panel="why" data-from="10a-beginners" data-to="08-future" aria-label="Why this book">
        <p className="panel-title">WHY THIS BOOK</p>
        <ul>
          {WHY.map((r) => (
            <li key={r.seg} data-seg={r.seg}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="10.5" />
                <path d="M7 12.5l3.2 3.2L17 9" />
              </svg>
              <span>{r.text}</span>
            </li>
          ))}
        </ul>
        <p className="moment" data-seg="10d-moment">
          If you&rsquo;ve been waiting for the right moment to start, <em>this is it.</em>
        </p>
      </section>

      <div className="cut" data-cuts={CUTS.join(',')} />

      <section className="cta" data-cta aria-label="Purchase">
        <p className="cta-kicker" data-cta-part>{CONFIG.book.title}</p>
        <h2 data-cta-part>A smarter way to start building your future.</h2>
        <div className="cta-row" data-cta-part data-seg="11-price">
          <span className="cta-price">{CONFIG.price}</span>
          <PurchaseButton label="GET YOUR COPY TODAY" />
        </div>
        <p className="cta-meta" data-cta-part>
          Digital guide · PDF · 97 pages · {CONFIG.book.author} · {CONFIG.book.brand}
        </p>
      </section>

      <h1 className="sr-only">
        {CONFIG.book.title} — {CONFIG.book.subtitle}. {CONFIG.book.author}, {CONFIG.book.brand}.
      </h1>
    </div>
  )
})
