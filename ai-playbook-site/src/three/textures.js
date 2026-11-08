import * as THREE from 'three'

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
  const S = 128
  const [c, ctx] = canvas(vertical ? S : L, vertical ? L : S)
  ctx.fillStyle = '#e9e4d8'
  ctx.fillRect(0, 0, c.width, c.height)
  for (let k = 0; k < S; k++) {
    const a = 0.04 + Math.random() * 0.1
    ctx.fillStyle = `rgba(110,98,82,${a})`
    if (vertical) ctx.fillRect(k, 0, 1, c.height)
    else ctx.fillRect(0, k, c.width, 1)
  }
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

/** Laptop keyboard deck (graphite keys on silver aluminium). */
export function keyboardTex() {
  const W = 1536
  const H = 1056
  const [c, ctx] = canvas(W, H)
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#c4c5c7')
  g.addColorStop(1, '#a9aaad')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  const kx0 = 150
  const kw = (W - 300) / 14
  ctx.fillStyle = '#1b1b1c'
  for (let r = 0; r < 6; r++) {
    for (let k = 0; k < 14; k++) {
      const x = kx0 + k * kw
      const y = 70 + r * 78
      const h = r === 0 ? 40 : 66
      roundRect(ctx, x + 5, y + (r === 0 ? 20 : 4), kw - 10, h, 9)
      ctx.fill()
    }
  }
  ctx.fillStyle = '#b3b4b7'
  roundRect(ctx, W / 2 - 330, 600, 660, 400, 26)
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.12)'
  ctx.lineWidth = 2
  ctx.stroke()
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
 * Laptop screen. mode 'prompt': typing a request in a clean writing tool.
 * mode 'product': a digital-product page built around the real cover.
 */
export function drawScreen(ctx, W, H, mode, typed, coverImg, reveal = 1) {
  if (mode === 'prompt') {
    ctx.fillStyle = '#161616'
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#1d1d1d'
    ctx.fillRect(0, 0, 300, H)
    ctx.fillStyle = 'rgba(243,240,233,0.45)'
    ctx.font = `500 22px ${SANS}`
    tracked(ctx, 'DRAFTS', 48, 92, 4)
    ;['Launch plan', 'Product outline', 'Notes'].forEach((s, i) => {
      ctx.fillStyle = i === 0 ? '#F3F0E9' : 'rgba(243,240,233,0.5)'
      ctx.font = `400 26px ${SANS}`
      ctx.fillText(s, 48, 150 + i * 52)
    })
    ctx.fillStyle = '#F3F0E9'
    ctx.font = `400 58px ${SERIF}`
    ctx.fillText('Launch plan', 380, 150)
    ctx.fillStyle = 'rgba(191,192,194,0.6)'
    ctx.font = `400 22px ${SANS}`
    ctx.fillText('Draft · Today', 382, 192)
    ctx.strokeStyle = 'rgba(191,192,194,0.35)'
    ctx.lineWidth = 1.5
    roundRect(ctx, 380, 240, W - 460, 150, 18)
    ctx.stroke()
    ctx.fillStyle = '#F3F0E9'
    ctx.font = `400 30px ${SANS}`
    const full = 'Outline a 30-day plan to launch my first digital product.'
    const s = full.slice(0, Math.floor(full.length * typed))
    const cut = s.length > 40 ? s.lastIndexOf(' ', 40) : -1
    if (cut > 0) {
      ctx.fillText(s.slice(0, cut), 412, 300)
      ctx.fillText(s.slice(cut + 1), 412, 344)
    } else ctx.fillText(s, 412, 300)
    if (typed < 1) {
      const last = cut > 0 ? s.slice(cut + 1) : s
      const cx = 412 + ctx.measureText(last).width + 4
      ctx.fillRect(cx, cut > 0 ? 318 : 274, 2, 34)
    }
    // the answer arrives as quiet lines of text
    const rows = [0.92, 0.84, 0.88, 0.6, 0.9, 0.76, 0.5]
    rows.forEach((w, i) => {
      const a = Math.max(0, Math.min(1, reveal * 7 - i))
      ctx.fillStyle = `rgba(243,240,233,${0.18 * a})`
      roundRect(ctx, 380, 440 + i * 44, (W - 460) * w * a, 14, 7)
      ctx.fill()
    })
    return
  }
  // product page (ivory)
  ctx.fillStyle = '#F3F0E9'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#1c1b19'
  ctx.font = `600 20px ${SANS}`
  tracked(ctx, 'CREATOR LAB', 64, 72, 5)
  ctx.fillStyle = '#6f6b63'
  ctx.font = `400 20px ${SANS}`
  ctx.fillText('Library', W - 230, 72)
  ctx.fillText('About', W - 130, 72)
  ctx.fillStyle = 'rgba(28,27,25,0.12)'
  ctx.fillRect(64, 104, W - 128, 1)
  if (coverImg) {
    const ch = 640
    const cw = (ch * coverImg.width) / coverImg.height
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.28)'
    ctx.shadowBlur = 40
    ctx.shadowOffsetY = 22
    ctx.drawImage(coverImg, 120, 190, cw, ch)
    ctx.restore()
  }
  const x = 760
  ctx.fillStyle = '#6f6b63'
  ctx.font = `500 20px ${SANS}`
  tracked(ctx, 'DIGITAL GUIDE · PDF', x, 250, 4)
  ctx.fillStyle = '#1c1b19'
  ctx.font = `400 74px ${SERIF}`
  ctx.fillText('The AI Money', x, 350)
  ctx.fillText('Playbook', x, 432)
  ctx.font = `italic 400 30px ${SERIF}`
  ctx.fillStyle = '#3d3a35'
  ctx.fillText('Nga fillestar në sipërmarrës me AI', x, 492)
  ctx.font = `400 24px ${SANS}`
  ctx.fillStyle = '#6f6b63'
  ctx.fillText('Luka Shehu', x, 548)
  ctx.fillStyle = 'rgba(28,27,25,0.12)'
  ctx.fillRect(x, 590, 640, 1)
  ctx.fillStyle = '#1c1b19'
  ctx.font = `400 64px ${SERIF}`
  ctx.fillText('€9', x, 682)
  ctx.strokeStyle = '#1c1b19'
  ctx.lineWidth = 1.5
  roundRect(ctx, x, 724, 300, 66, 33)
  ctx.stroke()
  ctx.font = `600 18px ${SANS}`
  tracked(ctx, 'GET YOUR COPY', x + 150, 765, 3.5, 'center')
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
    const r = src.data[i] / 255
    const g = src.data[i + 1] / 255
    const b = src.data[i + 2] / 255
    const lum = (r + g + b) / 3
    const gold = Math.min(1, Math.max(0, (r - b - 0.08) * 5)) * Math.min(1, Math.max(0, (lum - 0.15) * 4))
    const white = Math.min(1, Math.max(0, (lum - 0.55) * 3))
    const metal = Math.min(1, gold + white * 0.6)
    orm.data[i] = 255
    orm.data[i + 1] = Math.round(255 * (0.72 - 0.42 * metal)) // roughness (G)
    orm.data[i + 2] = Math.round(255 * metal * 0.85) // metalness (B)
    orm.data[i + 3] = 255
    const v = Math.round(255 * Math.min(1, Math.max(gold, white)))
    bump.data[i] = bump.data[i + 1] = bump.data[i + 2] = v
    bump.data[i + 3] = 255
  }
  cx.putImageData(orm, 0, 0)
  cbx.putImageData(bump, 0, 0)
  return { orm: tex(cr, false), bump: tex(cb, false) }
}
