import * as THREE from 'three'
import { CONFIG } from '../config'
const CONFIG_PRICE = CONFIG.price

export const SANS = '"Inter Variable", Inter, system-ui, sans-serif'
export const SERIF = 'Caladea, Georgia, serif'

export const PAL = {
  black: '#080808',
  charcoal: '#171717',
  graphite: '#292929',
  silver: '#BFC0C2',
  ivory: '#F3F0E9',
  ink: '#1c1b19',
  inkSoft: '#6f6b63',
}

function canvas(w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')]
}

function tex(c, srgb = true, repeat = false) {
  const t = new THREE.CanvasTexture(c)
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 16
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.needsUpdate = true
  return t
}

/* deterministic value noise for procedural materials */
function makeNoise(seed = 1) {
  const p = new Uint8Array(512)
  let s = seed
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  const perm = [...Array(256).keys()].sort(() => r() - 0.5)
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255]
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10)
  const grad = (h, x, y) => ((h & 1 ? -x : x) + (h & 2 ? -y : y))
  return (x, y) => {
    const X = Math.floor(x) & 255
    const Y = Math.floor(y) & 255
    x -= Math.floor(x)
    y -= Math.floor(y)
    const u = fade(x)
    const v = fade(y)
    const a = p[X] + Y
    const b = p[X + 1] + Y
    const l1 = grad(p[a], x, y) * (1 - u) + grad(p[b], x - 1, y) * u
    const l2 = grad(p[a + 1], x, y - 1) * (1 - u) + grad(p[b + 1], x - 1, y - 1) * u
    return l1 * (1 - v) + l2 * v
  }
}

/** Honed black stone (Nero Marquina-like): albedo + roughness map with faint veining. */
export function stoneMaps(size = 1024) {
  const n = makeNoise(7)
  const [c, ctx] = canvas(size, size)
  const [cr, rctx] = canvas(size, size)
  const img = ctx.createImageData(size, size)
  const rim = rctx.createImageData(size, size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size
      const v = y / size
      let f = 0
      let amp = 1
      let fr = 3
      for (let o = 0; o < 5; o++) {
        f += n(u * fr, v * fr) * amp
        amp *= 0.5
        fr *= 2
      }
      const vein = Math.pow(1 - Math.abs(Math.sin((u * 3 + v * 1.4 + f * 1.8) * Math.PI)), 28)
      const base = 15 + f * 7
      const val = base + vein * 26
      const i = (y * size + x) * 4
      img.data[i] = val
      img.data[i + 1] = val
      img.data[i + 2] = val * 1.02
      img.data[i + 3] = 255
      const rough = 120 + f * 40 - vein * 50
      rim.data[i] = rim.data[i + 1] = rim.data[i + 2] = Math.max(40, Math.min(220, rough))
      rim.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  rctx.putImageData(rim, 0, 0)
  return { map: tex(c, true, true), rough: tex(cr, false, true) }
}

/** Dark smoked oak for the desk. */
export function woodMaps() {
  const n = makeNoise(3)
  const W = 1024
  const H = 512
  const [c, ctx] = canvas(W, H)
  const img = ctx.createImageData(W, H)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W
      const v = y / H
      const g = Math.sin((v * 34 + n(u * 2, v * 6) * 3.5) * Math.PI) * 0.5 + 0.5
      const fine = n(u * 80, v * 4) * 0.5 + 0.5
      const val = 26 + g * 9 + fine * 7
      const i = (y * W + x) * 4
      img.data[i] = val * 1.08
      img.data[i + 1] = val * 1.0
      img.data[i + 2] = val * 0.93
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return tex(c, true, true)
}

/** Book-cloth weave used as a subtle bump on the boards. */
export function clothBump() {
  const [c, ctx] = canvas(256, 256)
  const img = ctx.createImageData(256, 256)
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const w = (Math.sin(x * 1.6) * 0.5 + 0.5) * (Math.sin(y * 1.6 + 1.3) * 0.5 + 0.5)
      const v = 110 + w * 90 + (Math.random() - 0.5) * 30
      const i = (y * 256 + x) * 4
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const t = tex(c, false, true)
  t.repeat.set(10, 14)
  return t
}

/** Plain black cloth spine with two fine silver rules (no invented text). */
export function spineTex() {
  const [c, ctx] = canvas(128, 1024)
  ctx.fillStyle = '#0d0d0d'
  ctx.fillRect(0, 0, 128, 1024)
  ctx.strokeStyle = 'rgba(191,192,194,0.55)'
  ctx.lineWidth = 2
  ;[44, 52, 972, 980].forEach((y) => {
    ctx.beginPath()
    ctx.moveTo(14, y)
    ctx.lineTo(114, y)
    ctx.stroke()
  })
  return tex(c)
}

/** Fore-edge / head of the text block: fine ivory paper stack. */
export function pageEdgeTex(vertical = true) {
  const L = 2048
  const S = 256
  const [c, ctx] = canvas(vertical ? S : L, vertical ? L : S)
  ctx.fillStyle = '#ece6da'
  ctx.fillRect(0, 0, c.width, c.height)
  // individual leaves: hairline gaps of varying strength
  for (let k = 0; k < S; k += 2.6) {
    const a = 0.05 + Math.random() * 0.16
    ctx.fillStyle = `rgba(96,86,72,${a})`
    if (vertical) ctx.fillRect(k, 0, 0.9, c.height)
    else ctx.fillRect(0, k, c.width, 0.9)
  }
  // soft occlusion where the boards overhang the text block
  const g = vertical ? ctx.createLinearGradient(0, 0, S, 0) : ctx.createLinearGradient(0, 0, 0, S)
  g.addColorStop(0, 'rgba(40,34,26,0.45)')
  g.addColorStop(0.12, 'rgba(40,34,26,0)')
  g.addColorStop(0.88, 'rgba(40,34,26,0)')
  g.addColorStop(1, 'rgba(40,34,26,0.45)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, c.width, c.height)
  return tex(c)
}

/** Endpaper: charcoal with a fine silver frame. */
export function endpaperTex() {
  const [c, ctx] = canvas(512, 724)
  ctx.fillStyle = '#151515'
  ctx.fillRect(0, 0, 512, 724)
  ctx.strokeStyle = 'rgba(191,192,194,0.35)'
  ctx.lineWidth = 1.5
  ctx.strokeRect(30, 30, 452, 664)
  return tex(c)
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function wrap(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ')
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y)
      line = w
      y += lh
    } else line = test
  }
  ctx.fillText(line, x, y)
  return y
}

function tracked(ctx, text, x, y, spacing, align = 'left') {
  const chars = [...text]
  const widths = chars.map((ch) => ctx.measureText(ch).width)
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1)
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x
  const prev = ctx.textAlign
  ctx.textAlign = 'left'
  chars.forEach((ch, i) => {
    ctx.fillText(ch, cx, y)
    cx += widths[i] + spacing
  })
  ctx.textAlign = prev
}

/**
 * Laptop screen (2048 × 1280). mode 'prompt': a vivid AI writing workspace where the request is typed
 * and the plan streams in. mode 'product': a store page built around the real cover.
 */
export function drawScreen(ctx, W, H, mode, typed, coverImg, reveal = 1) {
  const S = W / 2048
  ctx.save()
  ctx.scale(S, S)
  const w = 2048
  const h = 1280
  if (mode === 'prompt') {
    const bg = ctx.createLinearGradient(0, 0, w, h)
    bg.addColorStop(0, '#121318')
    bg.addColorStop(1, '#0d0e12')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)
    // window chrome
    ctx.fillStyle = '#1a1b21'
    ctx.fillRect(0, 0, w, 72)
    ;['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => {
      ctx.fillStyle = c
      ctx.beginPath()
      ctx.arc(40 + i * 34, 36, 11, 0, Math.PI * 2)
      ctx.fill()
    })
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.font = `500 26px ${SANS}`
    ctx.textAlign = 'center'
    ctx.fillText('AI Workspace — Launch plan', w / 2, 46)
    ctx.textAlign = 'left'
    // sidebar
    ctx.fillStyle = '#16171c'
    ctx.fillRect(0, 72, 420, h - 72)
    const av = ctx.createLinearGradient(40, 110, 110, 180)
    av.addColorStop(0, '#5b8cff')
    av.addColorStop(1, '#a970ff')
    ctx.fillStyle = av
    ctx.beginPath()
    ctx.arc(80, 150, 34, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = `600 30px ${SANS}`
    ctx.fillText('Creator Lab', 132, 145)
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.font = `400 22px ${SANS}`
    ctx.fillText('Workspace', 132, 176)
    const items = ['Launch plan', 'Product outline', 'Store page', 'Content ideas', 'Prompt library']
    items.forEach((it, i) => {
      const y = 260 + i * 70
      if (i === 0) {
        ctx.fillStyle = 'rgba(91,140,255,0.18)'
        roundRect(ctx, 24, y - 40, 372, 58, 14)
        ctx.fill()
      }
      ctx.fillStyle = i === 0 ? '#9fbcff' : 'rgba(255,255,255,0.62)'
      ctx.font = `${i === 0 ? 600 : 400} 26px ${SANS}`
      ctx.fillText(it, 64, y)
    })
    // conversation
    const x0 = 500
    ctx.fillStyle = '#ffffff'
    ctx.font = `700 54px ${SERIF}`
    ctx.fillText('Launch plan', x0, 170)
    ctx.fillStyle = 'rgba(255,255,255,0.45)'
    ctx.font = `400 24px ${SANS}`
    ctx.fillText('Draft · edited just now', x0 + 2, 212)
    // user prompt bubble
    const full = 'Outline a 30-day plan to launch my first digital product.'
    const s = full.slice(0, Math.floor(full.length * typed))
    const bw = 1080
    const bx = w - 80 - bw
    const grad = ctx.createLinearGradient(bx, 260, bx + bw, 380)
    grad.addColorStop(0, '#4c7dff')
    grad.addColorStop(1, '#8a5cff')
    ctx.fillStyle = grad
    roundRect(ctx, bx, 262, bw, 122, 30)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.font = `500 34px ${SANS}`
    ctx.fillText(s, bx + 40, 336)
    if (typed < 1) ctx.fillRect(bx + 44 + ctx.measureText(s).width, 306, 3, 40)
    // AI answer streaming in, with real content
    const lines = [
      ['Here is a 30-day plan for your first digital product:', 'lead'],
      ['Week 1', 'Choose your niche and validate the idea'],
      ['Week 2', 'Create the product with AI tools'],
      ['Week 3', 'Build your store page on Whop'],
      ['Week 4', 'Launch, share your story, collect feedback'],
    ]
    const ai = ctx.createLinearGradient(x0, 430, x0 + 64, 494)
    ai.addColorStop(0, '#ffb347')
    ai.addColorStop(1, '#ff7a59')
    if (reveal > 0) {
      ctx.fillStyle = ai
      ctx.beginPath()
      ctx.arc(x0 + 32, 462, 30, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.font = `700 26px ${SANS}`
      ctx.textAlign = 'center'
      ctx.fillText('AI', x0 + 32, 471)
      ctx.textAlign = 'left'
    }
    lines.forEach(([a, b], i) => {
      const k = Math.max(0, Math.min(1, reveal * 5.5 - i))
      if (k <= 0) return
      const y = 470 + i * 120
      ctx.globalAlpha = k
      if (b === 'lead') {
        ctx.fillStyle = '#ffffff'
        ctx.font = `500 34px ${SANS}`
        ctx.fillText(a, x0 + 96, y + 10)
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.06)'
        roundRect(ctx, x0 + 96, y - 44, 1300, 96, 20)
        ctx.fill()
        const pill = ['#5b8cff', '#a970ff', '#ff9f5a', '#3fd29b'][i - 1]
        ctx.fillStyle = pill
        roundRect(ctx, x0 + 124, y - 20, 132, 48, 24)
        ctx.fill()
        ctx.fillStyle = '#0e0f13'
        ctx.font = `700 24px ${SANS}`
        ctx.textAlign = 'center'
        ctx.fillText(a, x0 + 190, y + 12)
        ctx.textAlign = 'left'
        ctx.fillStyle = '#f2f3f7'
        ctx.font = `500 32px ${SANS}`
        ctx.fillText(b, x0 + 290, y + 14)
      }
      ctx.globalAlpha = 1
    })
    // composer
    ctx.fillStyle = '#1b1c22'
    roundRect(ctx, x0, h - 130, w - x0 - 80, 84, 42)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.font = `400 28px ${SANS}`
    ctx.fillText('Ask anything…', x0 + 44, h - 78)
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(w - 132, h - 88, 28, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    return
  }
  // product page
  const bg = ctx.createLinearGradient(0, 0, 0, h)
  bg.addColorStop(0, '#f6f2ea')
  bg.addColorStop(1, '#ebe4d6')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#1c1b19'
  ctx.font = `700 26px ${SANS}`
  tracked(ctx, 'CREATOR LAB', 90, 92, 7)
  ctx.fillStyle = '#6f6b63'
  ctx.font = `500 26px ${SANS}`
  ctx.fillText('Library', w - 330, 92)
  ctx.fillText('About', w - 180, 92)
  ctx.fillStyle = 'rgba(28,27,25,0.12)'
  ctx.fillRect(90, 132, w - 180, 2)
  // warm halo behind the book
  const halo = ctx.createRadialGradient(470, 640, 40, 470, 640, 520)
  halo.addColorStop(0, 'rgba(255,190,110,0.35)')
  halo.addColorStop(1, 'rgba(255,190,110,0)')
  ctx.fillStyle = halo
  ctx.fillRect(0, 140, 1000, 1100)
  if (coverImg) {
    const ch = 860
    const cw = (ch * coverImg.width) / coverImg.height
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.35)'
    ctx.shadowBlur = 60
    ctx.shadowOffsetY = 34
    ctx.drawImage(coverImg, 470 - cw / 2, 220, cw, ch)
    ctx.restore()
  }
  const x = 1020
  ctx.fillStyle = '#b5651d'
  ctx.font = `700 24px ${SANS}`
  tracked(ctx, 'NEW · DIGITAL GUIDE', x, 300, 5)
  ctx.fillStyle = '#1c1b19'
  ctx.font = `700 96px ${SERIF}`
  ctx.fillText('The AI Money', x, 420)
  ctx.fillText('Playbook', x, 520)
  ctx.font = `italic 400 38px ${SERIF}`
  ctx.fillStyle = '#3d3a35'
  ctx.fillText('Nga fillestar në sipërmarrës me AI', x, 590)
  ctx.font = `500 30px ${SANS}`
  ctx.fillStyle = '#6f6b63'
  ctx.fillText('Luka Shehu  ·  97 pages  ·  PDF', x, 650)
  const pts = ['100 ready-to-use prompts', '10 business models', '30-day action plan']
  pts.forEach((p, i) => {
    ctx.fillStyle = '#2f7d4f'
    ctx.font = `700 30px ${SANS}`
    ctx.fillText('✓', x, 730 + i * 54)
    ctx.fillStyle = '#2b2925'
    ctx.font = `500 30px ${SANS}`
    ctx.fillText(p, x + 46, 730 + i * 54)
  })
  ctx.fillStyle = '#1c1b19'
  ctx.font = `700 92px ${SERIF}`
  ctx.fillText(CONFIG_PRICE, x, 1000)
  ctx.fillStyle = '#1c1b19'
  roundRect(ctx, x + 300, 930, 480, 96, 48)
  ctx.fill()
  ctx.fillStyle = '#f6f2ea'
  ctx.font = `700 26px ${SANS}`
  tracked(ctx, 'GET YOUR COPY', x + 540, 988, 5, 'center')
  ctx.restore()
}

/** Speaker grille: fine perforation for the laptop deck. */
export function grilleTex() {
  const [c, ctx] = canvas(64, 1024)
  ctx.fillStyle = '#b8b9bc'
  ctx.fillRect(0, 0, 64, 1024)
  ctx.fillStyle = '#2a2a2c'
  for (let y = 6; y < 1024; y += 12) for (let x = 8; x < 64; x += 12) {
    ctx.beginPath()
    ctx.arc(x + ((y / 12) % 2) * 6, y, 2.2, 0, Math.PI * 2)
    ctx.fill()
  }
  return tex(c)
}

/* ───────── Editorial pages inside the book ───────── */

export const TOPICS = [
  { n: '01', title: 'AI Tools', ref: 'Kapitulli 3', sq: 'Mjetet më të dobishme të AI-së', page: 17,
    text: 'The most useful AI tools for writing, images, video, voice and research, and when to use each one.', motif: 'grid' },
  { n: '02', title: 'Professional Prompting', ref: 'Kapitujt 4–6', sq: 'ChatGPT profesional, arti i prompteve, 50 prompte', page: 22,
    text: 'Use ChatGPT professionally, structure clear prompts, and start from fifty prompts that are ready to use.', motif: 'quote' },
  { n: '03', title: 'Digital Products', ref: 'Kapitulli 8', sq: 'Krijimi i produkteve dixhitale me AI', page: 46,
    text: 'Plan, write and package guides, templates and e-books with AI, from the first idea to the finished file.', motif: 'stack' },
  { n: '04', title: 'Online Business Models', ref: 'Kapitulli 7', sq: '10 modele realiste biznesi me AI', page: 40,
    text: 'Ten realistic ways to build an online business with AI skills, with the costs, the risks and the first steps.', motif: 'dots' },
  { n: '05', title: 'Whop', ref: 'Kapitulli 9', sq: 'Shitja e produkteve dixhitale në Whop', page: 52,
    text: 'Set up your store, present and price your product, and prepare a clean launch on Whop.', motif: 'card' },
  { n: '06', title: 'Personal Branding', ref: 'Kapitulli 11', sq: 'Ndërtimi i markës personale me AI', page: 62,
    text: 'Define your position, publish consistently and build trust, with AI as an assistant rather than a voice.', motif: 'monogram' },
  { n: '07', title: '30-Day Action Plan', ref: 'Kapitulli 14', sq: 'Plani juaj i veprimit 30-ditor', page: 74,
    text: 'A day-by-day plan for your first thirty days: small, concrete steps from learning to launch.', motif: 'calendar' },
]

const PW = 1024
const PH = Math.round((1169 / 827) * PW)

function paper(ctx) {
  ctx.fillStyle = '#F3F0E9'
  ctx.fillRect(0, 0, PW, PH)
  const img = ctx.getImageData(0, 0, PW, PH)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 6
    img.data[i] += n
    img.data[i + 1] += n
    img.data[i + 2] += n
  }
  ctx.putImageData(img, 0, 0)
}

function runningHead(ctx, folio, left) {
  ctx.fillStyle = '#8a857b'
  ctx.font = `600 15px ${SANS}`
  if (left) {
    tracked(ctx, String(folio), 96, 92, 2)
    tracked(ctx, 'THE AI MONEY PLAYBOOK', PW - 96, 92, 4, 'right')
  } else {
    tracked(ctx, 'THE AI MONEY PLAYBOOK', 96, 92, 4)
    tracked(ctx, String(folio), PW - 96, 92, 2, 'right')
  }
}

function motif(ctx, kind, x, y, w) {
  ctx.strokeStyle = '#1c1b19'
  ctx.fillStyle = '#1c1b19'
  ctx.lineWidth = 1.6
  switch (kind) {
    case 'grid':
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        const s = w / 3 - 18
        ctx.strokeRect(x + c * (s + 18), y + r * (s + 18), s, s)
        if (r === 1 && c === 1) ctx.fillRect(x + c * (s + 18), y + r * (s + 18), s, s)
      }
      break
    case 'quote':
      ctx.font = `italic 400 40px ${SERIF}`
      wrap(ctx, '“Act as an editor. Rewrite this paragraph for clarity, keep my voice, and list what you changed.”', x, y + 40, w, 56)
      break
    case 'stack':
      ;[0, 1, 2].forEach((k) => {
        ctx.strokeRect(x + k * 36, y + 120 - k * 50, w * 0.55, w * 0.42)
      })
      ctx.fillRect(x + 72, y + 20, w * 0.55, w * 0.42)
      break
    case 'dots':
      for (let k = 0; k < 10; k++) {
        ctx.beginPath()
        ctx.arc(x + 30 + (k % 5) * (w / 5), y + 40 + Math.floor(k / 5) * 110, 22, 0, Math.PI * 2)
        k < 3 ? ctx.fill() : ctx.stroke()
      }
      break
    case 'card':
      ctx.strokeRect(x, y, w * 0.8, w * 0.56)
      ctx.fillRect(x + 36, y + 36, w * 0.22, w * 0.3)
      ctx.font = `400 22px ${SANS}`
      ctx.fillText('Your product', x + 36 + w * 0.28, y + 70)
      ctx.fillRect(x + 36 + w * 0.28, y + 100, w * 0.3, 2)
      ctx.fillRect(x + 36 + w * 0.28, y + 130, w * 0.2, 2)
      break
    case 'monogram':
      ctx.beginPath()
      ctx.arc(x + w * 0.22, y + w * 0.22, w * 0.22, 0, Math.PI * 2)
      ctx.stroke()
      ctx.font = `400 92px ${SERIF}`
      ctx.textAlign = 'center'
      ctx.fillText('LS', x + w * 0.22, y + w * 0.22 + 32)
      ctx.textAlign = 'left'
      break
    case 'calendar':
      for (let k = 0; k < 30; k++) {
        const cw = w / 6 - 10
        const cx = x + (k % 6) * (cw + 10)
        const cy = y + Math.floor(k / 6) * (cw * 0.62 + 10)
        ctx.strokeRect(cx, cy, cw, cw * 0.62)
        if (k < 6) ctx.fillRect(cx, cy, cw, cw * 0.62)
      }
      break
    default:
  }
}

function topicPage(t, left) {
  const [c, ctx] = canvas(PW, PH)
  paper(ctx)
  runningHead(ctx, t.page, left)
  ctx.fillStyle = '#b7b2a8'
  ctx.font = `300 220px ${SERIF}`
  ctx.fillText(t.n, 88, 380)
  ctx.fillStyle = '#1c1b19'
  ctx.font = `400 76px ${SERIF}`
  const yEnd = wrap(ctx, t.title, 96, 500, PW - 192, 84)
  ctx.fillStyle = 'rgba(28,27,25,0.85)'
  ctx.fillRect(96, yEnd + 44, 90, 2)
  ctx.fillStyle = '#6f6b63'
  ctx.font = `600 16px ${SANS}`
  tracked(ctx, t.ref.toUpperCase(), 96, yEnd + 98, 4)
  ctx.font = `italic 400 30px ${SERIF}`
  wrap(ctx, t.sq, 96, yEnd + 146, PW - 192, 40)
  ctx.fillStyle = '#2b2925'
  ctx.font = `400 29px ${SANS}`
  wrap(ctx, t.text, 96, yEnd + 236, PW - 230, 44)
  motif(ctx, t.motif, 96, PH - 470, PW - 192)
  return tex(c)
}

function contentsPage() {
  const [c, ctx] = canvas(PW, PH)
  paper(ctx)
  runningHead(ctx, 5, false)
  ctx.fillStyle = '#1c1b19'
  ctx.font = `400 92px ${SERIF}`
  ctx.fillText('Inside', 96, 300)
  ctx.fillStyle = '#6f6b63'
  ctx.font = `italic 400 32px ${SERIF}`
  ctx.fillText('Seven foundations of the playbook', 98, 356)
  TOPICS.forEach((t, i) => {
    const y = 500 + i * 118
    ctx.fillStyle = 'rgba(28,27,25,0.14)'
    ctx.fillRect(96, y - 58, PW - 192, 1)
    ctx.fillStyle = '#8a857b'
    ctx.font = `600 18px ${SANS}`
    tracked(ctx, t.n, 96, y, 2)
    ctx.fillStyle = '#1c1b19'
    ctx.font = `400 40px ${SERIF}`
    ctx.fillText(t.title, 170, y + 4)
    ctx.fillStyle = '#8a857b'
    ctx.font = `400 22px ${SANS}`
    ctx.textAlign = 'right'
    ctx.fillText(String(t.page), PW - 96, y)
    ctx.textAlign = 'left'
  })
  return tex(c)
}

function closingPage() {
  const [c, ctx] = canvas(PW, PH)
  paper(ctx)
  ctx.fillStyle = '#1c1b19'
  ctx.font = `400 58px ${SERIF}`
  ctx.textAlign = 'center'
  ctx.fillText('Your next chapter', PW / 2, PH / 2 - 20)
  ctx.fillText('starts here.', PW / 2, PH / 2 + 56)
  ctx.fillStyle = '#8a857b'
  ctx.font = `600 16px ${SANS}`
  tracked(ctx, 'LUKA SHEHU · CREATOR LAB', PW / 2, PH / 2 + 150, 5, 'center')
  ctx.textAlign = 'left'
  return tex(c)
}

/** Textures for the four turning leaves (front/back) and the last page. */
export function editorialPages() {
  return {
    leaves: [
      [contentsPage(), topicPage(TOPICS[0], true)],
      [topicPage(TOPICS[1], false), topicPage(TOPICS[2], true)],
      [topicPage(TOPICS[3], false), topicPage(TOPICS[4], true)],
      [topicPage(TOPICS[5], false), topicPage(TOPICS[6], true)],
    ],
    last: closingPage(),
  }
}

/** Physically-based maps from the real cover: gold rules + title become subtly metallic and embossed. */
export function coverMaps(image) {
  const w = 1024
  const h = Math.round((image.height / image.width) * w)
  const [c, ctx] = canvas(w, h)
  ctx.drawImage(image, 0, 0, w, h)
  const src = ctx.getImageData(0, 0, w, h)
  const [cr, cx] = canvas(w, h)
  const [cb, cbx] = canvas(w, h)
  const orm = cx.createImageData(w, h)
  const bump = cbx.createImageData(w, h)
  for (let i = 0; i < src.data.length; i += 4) {
    const px = (i / 4) % w
    const py = Math.floor(i / 4 / w)
    const u = px / w
    const vv = py / h
    // distance to the board edge (for subtle wear) and the hinge groove beside the spine
    const edge = Math.min(u, 1 - u, vv * (h / w), (1 - vv) * (h / w))
    const groove = Math.exp(-Math.pow((u - 0.042) / 0.006, 2))
    const r = src.data[i] / 255
    const g = src.data[i + 1] / 255
    const b = src.data[i + 2] / 255
    const lum = (r + g + b) / 3
    const gold = Math.min(1, Math.max(0, (r - b - 0.08) * 5)) * Math.min(1, Math.max(0, (lum - 0.15) * 4))
    const white = Math.min(1, Math.max(0, (lum - 0.55) * 3))
    const metal = Math.min(1, gold + white * 0.6)
    orm.data[i] = 255
    const wear = Math.max(0, 1 - edge / 0.012) * 0.18
    const grain = (Math.random() - 0.5) * 0.06
    orm.data[i + 1] = Math.round(255 * Math.min(1, Math.max(0.05, 0.7 - 0.42 * metal + wear + grain))) // roughness (G)
    orm.data[i + 2] = Math.round(255 * metal * 0.85) // metalness (B)
    orm.data[i + 3] = 255
    // emboss + paper grain + the pressed hinge groove of a real case binding
    const v = Math.round(255 * Math.min(1, Math.max(0, 0.35 + 0.6 * Math.max(gold, white) + (Math.random() - 0.5) * 0.05 - 0.3 * groove)))
    bump.data[i] = bump.data[i + 1] = bump.data[i + 2] = v
    bump.data[i + 3] = 255
  }
  cx.putImageData(orm, 0, 0)
  cbx.putImageData(bump, 0, 0)
  return { orm: tex(cr, false), bump: tex(cb, false) }
}
