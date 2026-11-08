/**
 * ─────────────────────────────────────────────────────────────
 *  EXPERIENCE CONFIGURATION
 *  Edit this file (or set VITE_CHECKOUT_URL in a .env file).
 * ─────────────────────────────────────────────────────────────
 */
export const CONFIG = {
  // Paste your Whop checkout link here, e.g. 'https://whop.com/checkout/xxxxxxxx'
  checkoutUrl: import.meta.env.VITE_CHECKOUT_URL || '',
  price: '€9',

  book: {
    title: 'THE AI MONEY PLAYBOOK',
    subtitle: 'Nga fillestar në sipërmarrës me AI',
    author: 'LUKA SHEHU',
    brand: 'CREATOR LAB',
    cover: 'textures/cover.jpg',
    facts: '15 KAPITUJ · 6 BONUSE · 97 FAQE',
  },

  // The seven themes shown inside the book (each maps to real chapters)
  topics: [
    { label: 'AI Tools', chapter: 'Kapitulli 3' },
    { label: 'Professional Prompting', chapter: 'Kapitujt 4–6' },
    { label: 'Digital Products', chapter: 'Kapitulli 8' },
    { label: 'Online Business Models', chapter: 'Kapitulli 7' },
    { label: 'Whop', chapter: 'Kapitulli 9' },
    { label: 'Personal Branding', chapter: 'Kapitulli 11' },
    { label: '30-Day Action Plan', chapter: 'Kapitulli 14' },
  ],
}
