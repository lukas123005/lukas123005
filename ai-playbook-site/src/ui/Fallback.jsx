import { motion } from 'framer-motion'
import { CONFIG } from '../config'
import { PurchaseButton } from './PurchaseButton'

/** Shown when WebGL is unavailable: CSS-3D product presentation with the same story beats. */
export function Fallback() {
  const fade = (d = 0) => ({ initial: { opacity: 0, y: 30, filter: 'blur(12px)' }, whileInView: { opacity: 1, y: 0, filter: 'blur(0px)' }, viewport: { once: true }, transition: { duration: 1.1, delay: d, ease: [0.16, 1, 0.3, 1] } })
  return (
    <main className="fallback">
      <section>
        <motion.h2 {...fade()}>THE FUTURE IS NOT COMING.</motion.h2>
        <motion.h2 {...fade(0.4)} className="blue">IT IS ALREADY HERE.</motion.h2>
      </section>
      <section>
        <div className="css-book">
          <img src={CONFIG.book.cover} alt={`${CONFIG.book.title} — ${CONFIG.book.subtitle}`} />
          <i className="css-book-pages" />
        </div>
      </section>
      <section>
        <ul className="topics">
          {CONFIG.topics.map((t, i) => (
            <motion.li key={t.label} {...fade(i * 0.06)}>
              <span>{String(i + 1).padStart(2, '0')}</span>
              {t.label}
              <small>{t.sq}</small>
            </motion.li>
          ))}
        </ul>
      </section>
      <section className="fallback-cta">
        <motion.h2 {...fade()}>GET YOUR COPY TODAY</motion.h2>
        <motion.p {...fade(0.2)} className="cta-price">
          <small>ONLY</small> <strong>{CONFIG.price}</strong>
        </motion.p>
        <PurchaseButton />
      </section>
    </main>
  )
}
