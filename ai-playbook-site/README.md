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

## The film — quiet-luxury edition (57 s of animation, ~72 s narrated)

| Scene | Picture | On screen |
|---|---|---|
| 01 Introduction | Dark studio; a soft light grazes a honed black-stone plinth | THE WAY WE CREATE IS CHANGING. |
| 02 The Idea | Workspace: aluminium laptop (live writing tool, then a product page built around the real cover), notebook, pen, ceramic cup | INTELLIGENCE IS A TOOL. / KNOWLEDGE IS YOUR ADVANTAGE. |
| 03 The Playbook | The book emerges from darkness; slow orbit from fore-edge to cover, macro on the embossed title, round to the spine | — |
| 04 Inside | The book opens on the stone; four leaves turn through editorial spreads for the seven themes (real chapter titles and page numbers) | Contents index |
| 05 The Product | Closed book lying on stone, a narrow light travels across the cover, gentle push-in | Title · Luka Shehu · Creator Lab · BUILD YOUR KNOWLEDGE. CREATE YOUR OPPORTUNITY. |
| 06 Your Copy | Product shot with a soft stone reflection | YOUR NEXT CHAPTER STARTS HERE. · $20 · GET YOUR COPY |

Look: palette #080808 / #171717 / #292929 / #BFC0C2 / #F3F0E9; Caladea serif (the cover's typeface) for statements, Inter for
technical labels. Physically based materials (cloth-bump boards, metallic/embossed cover maps derived from the real cover,
paper fore-edge), RectAreaLight softboxes + one soft shadow key, reflective honed stone, depth of field, MSAA,
subtle bloom and vignette. One constant light rig is moved between sets, so shaders compile once.

## Interaction

- Scroll (or swipe) scrubs the film forwards/backwards; the ▶ button / "Enter" autoplays it; any scroll takes control back.
- Chapter markers in the progress bar jump to scenes; **Replay** restarts.
- Subtle mouse parallax; drag horizontally to inspect the upright book.
- Sound is procedural (Web Audio): ambient felt piano, soft pad, low air, paper turns, hardcover movement, soft keyboard, one restrained reveal impact. Sound on/off top right.

## Narration & sound design

A male narrator speaks throughout (8 clips in `public/voiceover/`, script in `public/voiceover/manifest.json`).

- **The film retimes itself to the voice.** At load, every clip is decoded and its real length measured; each narrated
  window of the animation is stretched to fit (with lead-in, natural pauses and a tail), while transitions and impacts
  between windows stay real-time. The 57 s animation becomes a ~72 s narrated film. Replace any MP3 with your own
  recording (same file name) — no code changes needed.
- **Mix:** separate voice / music / effects buses. Music sits at ~38 % in pauses and is ducked to ~13 % while the
  narrator speaks (look-ahead, ~0.7 s fades). Loud effects (impacts, risers, whooshes, mechanics) are skipped if they
  would land on spoken words; particle and activation sounds stay underneath at low level. Soft sub-led bass impact on
  the book reveal, gentle fade-out at the end, master limiter.
- **Muted visitors** get the narration as subtitles.

### Regenerate the voice

- **ElevenLabs** (recommended for the final production):
  `ELEVENLABS_API_KEY=… ELEVENLABS_VOICE_ID=… node scripts/voiceover_elevenlabs.mjs`
  Choose a warm, deep, calm male narrator from the ElevenLabs voice library.
- **Local fallback (included clips):** Kokoro TTS —
  `python3 scripts/voiceover_kokoro.py /path/to/kokoro-model-dir`
- Or record a human narrator and drop the files in `public/voiceover/`.

If a clip fails to load, the film keeps its timing (from `duration` in the manifest) and simply runs without that line.

## Performance

- Automatic quality tiers (`src/core/quality.js`): particle / building / node counts and post-processing scale for phones.
- `PerformanceMonitor` lowers the pixel ratio if the frame rate drops.
- No WebGL → a CSS-3D fallback page with the same story and CTA.
- Respects `prefers-reduced-motion` (no autoplay).

## Debug helpers

- `?t=24` — freeze the film at 24 s (no loader)
- `?q=low|medium|high` — force a quality tier
- `?noloader` — skip the entry screen
