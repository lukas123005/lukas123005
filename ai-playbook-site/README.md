# THE AI MONEY PLAYBOOK — Cinematic 3D Product Experience

An interactive, scroll-driven WebGL launch film for **The AI Money Playbook** by **Luka Shehu · Creator Lab**.

Built with React, Three.js, React Three Fiber, drei, @react-three/postprocessing, GSAP + ScrollTrigger and Framer Motion.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
npm run preview    # serve the production build
```

`dist/` is a static site (relative paths) and can be deployed to Vercel, Netlify, Cloudflare Pages, GitHub Pages or any static host.

## Add your Whop checkout link

Either edit `src/config.js` → `checkoutUrl`, or create a `.env` file:

```
VITE_CHECKOUT_URL=https://whop.com/checkout/your-product-id
```

Price, title, subtitle, author, brand and the 9 chapter holograms are also configured in `src/config.js`.

## The film (53 s, scroll-scrubbed or autoplay)

| Time | Scene | What happens |
|---|---|---|
| 0–5 s | The Void | A blue spark → 70k-particle energy sphere (GPU shader, curl noise, bass pulses, energy waves, depth-of-field, mouse-reactive) |
| 5–12 s | AI Awakening | Camera dives into the sphere and flies through an endless AI universe: neural networks, data structures, circuits, holographic UIs |
| 12–19 s | Digital Revolution | Explosive cut into a procedural glowing city (instanced shader skyscrapers), orbiting holograms, light trails |
| 19–29 s | The Reveal | Blue energy explosion; particles gather into the exact surface of the book (density sampled from the real cover) and the hardcover materialises with a dissolve shader; energy rings, gold orbit particles, lightning, light rays, camera shake |
| 29–39 s | Knowledge | The book opens; real interior pages turn with paper bend; 9 chapter holograms emerge and form an ecosystem |
| 39–48 s | Final Impact | Holograms are pulled into the book, it closes, blue-gold shockwave, golden title light |
| 48–53 s | Purchase | 3D product mockup + "GET YOUR COPY TODAY · ONLY €9" + metallic CTA |

The book is a real 3D object: boards with thickness, rounded spine, page block, hinged cover, turning leaves. The front cover uses the **original cover image** (`public/textures/cover.jpg`, exported from the PDF); metalness/roughness and emboss maps are derived from it at runtime so the gold rules and title read as metallic. Interior pages (`public/textures/page-*.jpg`) are real pages from the PDF.

## Interaction

- Scroll (or swipe) scrubs the film forwards/backwards; the ▶ button / "Enter" autoplays it; any scroll takes control back.
- Chapter markers in the progress bar jump to scenes; **Replay** restarts.
- Mouse moves particles and adds parallax; drag horizontally to spin the book.
- Sound is fully procedural (Web Audio): deep bass, ambience, activation blips, mechanical clicks, page turns, impacts. Mute/unmute top right.

## Performance

- Automatic quality tiers (`src/core/quality.js`): particle / building / node counts and post-processing scale for phones.
- `PerformanceMonitor` lowers the pixel ratio if the frame rate drops.
- No WebGL → a CSS-3D fallback page with the same story and CTA.
- Respects `prefers-reduced-motion` (no autoplay).

## Debug helpers

- `?t=24` — freeze the film at 24 s (no loader)
- `?q=low|medium|high` — force a quality tier
- `?noloader` — skip the entry screen
