import { CONFIG } from '../config'

/** Refined text link with a hairline rule — set your Whop checkout URL in src/config.js. */
export function PurchaseButton({ label = 'GET YOUR COPY' }) {
  const configured = !!CONFIG.checkoutUrl
  return (
    <a
      className="buy"
      href={configured ? CONFIG.checkoutUrl : '#'}
      target={configured ? '_blank' : undefined}
      rel="noopener noreferrer"
      onClick={(e) => {
        if (!configured) {
          e.preventDefault()
          console.warn('Set your Whop checkout URL in src/config.js (checkoutUrl) or VITE_CHECKOUT_URL.')
        }
      }}
    >
      {label}
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 12h15M14 7l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  )
}
