import { CONFIG } from '../config'
import { PurchaseButton } from './PurchaseButton'

/** Shown when WebGL is unavailable: the same story as a calm editorial page. */
export function Fallback() {
  return (
    <main className="fallback">
      <h2>THE WAY WE CREATE IS CHANGING.</h2>
      <div className="book">
        <img src={CONFIG.book.cover} alt={`${CONFIG.book.title} — ${CONFIG.book.subtitle}, ${CONFIG.book.author}`} />
      </div>
      <ol>
        {CONFIG.topics.map((t, i) => (
          <li key={t.label}>
            <span>{String(i + 1).padStart(2, '0')}</span>
            {t.label}
          </li>
        ))}
      </ol>
      <section>
        <h2>YOUR NEXT CHAPTER STARTS HERE.</h2>
        <div className="cta-row">
          <span className="cta-price">{CONFIG.price}</span>
          <PurchaseButton />
        </div>
      </section>
    </main>
  )
}
