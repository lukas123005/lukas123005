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
    // Real interior pages exported from the PDF (used for the page-turn sequence)
    pages: [
      'textures/page-05.jpg',
      'textures/page-06.jpg',
      'textures/page-07.jpg',
      'textures/page-08.jpg',
      'textures/page-09.jpg',
      'textures/page-10.jpg',
      'textures/page-11.jpg',
      'textures/page-12.jpg',
    ],
    facts: '15 KAPITUJ · 6 BONUSE · 97 FAQE',
  },

  // The nine holograms map 1:1 to real chapters of the book
  topics: [
    { label: 'AI TOOLS', chapter: 'Kapitulli 3', sq: 'Mjetet më të dobishme të AI-së', icon: 'tools' },
    { label: 'PROFESSIONAL CHATGPT', chapter: 'Kapitulli 4', sq: 'Përdorimi profesional i ChatGPT', icon: 'chat' },
    { label: 'PROMPT ENGINEERING', chapter: 'Kapitulli 5', sq: 'Arti i shkrimit të prompteve', icon: 'prompt' },
    { label: '50 READY-TO-USE PROMPTS', chapter: 'Kapitulli 6', sq: '50 prompte gati për përdorim', icon: 'fifty' },
    { label: '10 AI BUSINESS MODELS', chapter: 'Kapitulli 7', sq: '10 modele realiste biznesi me AI', icon: 'models' },
    { label: 'DIGITAL PRODUCTS', chapter: 'Kapitulli 8', sq: 'Krijimi i produkteve dixhitale me AI', icon: 'product' },
    { label: 'SELLING ON WHOP', chapter: 'Kapitulli 9', sq: 'Shitja e produkteve dixhitale në Whop', icon: 'store' },
    { label: 'PERSONAL BRANDING', chapter: 'Kapitulli 11', sq: 'Ndërtimi i markës personale me AI', icon: 'brand' },
    { label: '30-DAY ACTION PLAN', chapter: 'Kapitulli 14', sq: 'Plani juaj i veprimit 30-ditor', icon: 'plan' },
  ],
}
