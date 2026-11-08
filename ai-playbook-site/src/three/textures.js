import * as THREE from 'three'

export const SANS = '"Inter Variable", Inter, system-ui, sans-serif'
export const SERIF = 'Caladea, Georgia, serif'
const BLUE = '#176BFF'
const ICE = '#a9d1ff'
const GOLD = '#d6b06e'

function canvas(w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')]
}

function tex(c, srgb = true) {
  const t = new THREE.CanvasTexture(c)
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  t.needsUpdate = true
  return t
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Glass holographic frame with corner brackets. */
function glass(ctx, w, h, accent = BLUE, alpha = 0.42) {
  const g = ctx.createLinearGradient(0, 0, w, h)
  g.addColorStop(0, `rgba(30,70,150,${alpha})`)
  g.addColorStop(1, `rgba(6,14,34,${alpha * 0.8})`)
  rr(ctx, 6, 6, w - 12, h - 12, h * 0.06)
  ctx.fillStyle = g
  ctx.fill()
  ctx.lineWidth = 3
  ctx.strokeStyle = accent
  ctx.globalAlpha = 0.85
  ctx.stroke()
  ctx.globalAlpha = 1
  // scan lines
  ctx.fillStyle = 'rgba(160,200,255,0.035)'
  for (let y = 0; y < h; y += 6) ctx.fillRect(0, y, w, 2)
  // corner brackets
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 4
  const L = h * 0.09
  ;[[22, 22, 1, 1], [w - 22, 22, -1, 1], [22, h - 22, 1, -1], [w - 22, h - 22, -1, -1]].forEach(([x, y, sx, sy]) => {
    ctx.beginPath()
    ctx.moveTo(x, y + sy * L)
    ctx.lineTo(x, y)
    ctx.lineTo(x + sx * L, y)
    ctx.stroke()
  })
}

/** Simple vector icons drawn in a box centred at (cx, cy) with size s. */
export function drawIcon(ctx, kind, cx, cy, s, color = ICE) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = s * 0.06
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const r = s / 2
  const line = (pts) => {
    ctx.beginPath()
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * r, y * r) : ctx.moveTo(x * r, y * r)))
    ctx.stroke()
  }
  switch (kind) {
    case 'tools':
      for (let i = 0; i < 4; i++) {
        const x = (i % 2) * 1.0 - 0.95
        const y = Math.floor(i / 2) * 1.0 - 0.95
        rr(ctx, x * r, y * r, r * 0.85, r * 0.85, r * 0.2)
        i === 3 ? ctx.fill() : ctx.stroke()
      }
      break
    case 'chat':
      rr(ctx, -r, -r * 0.8, r * 2, r * 1.3, r * 0.3)
      ctx.stroke()
      line([[-0.4, 0.5], [-0.6, 0.95], [0.0, 0.5]])
      ;[-0.45, 0, 0.45].forEach((x) => {
        ctx.beginPath()
        ctx.arc(x * r, -0.15 * r, r * 0.11, 0, Math.PI * 2)
        ctx.fill()
      })
      break
    case 'prompt':
      line([[-0.9, -0.5], [-0.35, 0], [-0.9, 0.5]])
      line([[-0.1, 0.55], [0.9, 0.55]])
      break
    case 'fifty':
      ctx.font = `700 ${s * 0.62}px ${SANS}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('50', 0, r * 0.05)
      ctx.beginPath()
      ctx.arc(0, 0, r * 0.98, 0, Math.PI * 2)
      ctx.stroke()
      break
    case 'models':
      ;[[0, -0.75], [-0.75, 0.55], [0.75, 0.55]].forEach(([x, y]) => {
        ctx.beginPath()
        ctx.arc(x * r, y * r, r * 0.26, 0, Math.PI * 2)
        ctx.stroke()
      })
      line([[0, -0.49], [-0.55, 0.35]])
      line([[0, -0.49], [0.55, 0.35]])
      line([[-0.49, 0.55], [0.49, 0.55]])
      break
    case 'product':
      rr(ctx, -r * 0.7, -r, r * 1.4, r * 2, r * 0.1)
      ctx.stroke()
      line([[-0.4, -0.5], [0.4, -0.5]])
      line([[-0.4, -0.15], [0.25, -0.15]])
      line([[-0.4, 0.2], [0.4, 0.2]])
      break
    case 'store':
      line([[-1, -0.35], [-0.8, -0.9], [0.8, -0.9], [1, -0.35], [-1, -0.35]])
      rr(ctx, -r * 0.85, -r * 0.35, r * 1.7, r * 1.25, r * 0.08)
      ctx.stroke()
      rr(ctx, -r * 0.22, r * 0.25, r * 0.44, r * 0.65, r * 0.05)
      ctx.stroke()
      break
    case 'brand':
      ctx.beginPath()
      ctx.arc(0, -r * 0.3, r * 0.42, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(0, r * 1.05, r * 0.9, Math.PI * 1.15, Math.PI * 1.85)
      ctx.stroke()
      break
    case 'plan':
      rr(ctx, -r, -r * 0.8, r * 2, r * 1.8, r * 0.15)
      ctx.stroke()
      line([[-1, -0.35], [1, -0.35]])
      line([[-0.45, 0.25], [-0.1, 0.6], [0.55, -0.05]])
      break
    case 'spark':
      line([[0, -1], [0.18, -0.18], [1, 0], [0.18, 0.18], [0, 1], [-0.18, 0.18], [-1, 0], [-0.18, -0.18], [0, -1]])
      break
    case 'play':
      ctx.beginPath()
      ctx.moveTo(-r * 0.45, -r * 0.7)
      ctx.lineTo(r * 0.75, 0)
      ctx.lineTo(-r * 0.45, r * 0.7)
      ctx.closePath()
      ctx.fill()
      ctx.beginPath()
      ctx.arc(0, 0, r, 0, Math.PI * 2)
      ctx.stroke()
      break
    default:
  }
  ctx.restore()
}

/** Scene 5 hologram card for a book chapter. */
export function holoCard(topic, i) {
  const [c, ctx] = canvas(1024, 600)
  glass(ctx, 1024, 600, i % 3 === 1 ? GOLD : BLUE)
  ctx.fillStyle = 'rgba(23,107,255,0.22)'
  rr(ctx, 56, 150, 230, 230, 40)
  ctx.fill()
  drawIcon(ctx, topic.icon, 171, 265, 130, '#e8f2ff')
  ctx.fillStyle = BLUE
  ctx.font = `600 34px ${SANS}`
  ctx.fillText(String(i + 1).padStart(2, '0'), 64, 104)
  ctx.fillStyle = ICE
  ctx.font = `500 30px ${SANS}`
  ctx.fillText(topic.chapter.toUpperCase(), 140, 104)
  ctx.fillStyle = '#ffffff'
  let size = 64
  ctx.font = `700 ${size}px ${SANS}`
  while (ctx.measureText(topic.label).width > 650 && size > 36) {
    size -= 2
    ctx.font = `700 ${size}px ${SANS}`
  }
  ctx.fillText(topic.label, 320, 250)
  ctx.fillStyle = 'rgba(214,224,240,0.85)'
  ctx.font = `400 34px ${SANS}`
  wrap(ctx, topic.sq, 320, 316, 640, 44)
  ctx.fillStyle = BLUE
  rr(ctx, 320, 450, 640 * (0.45 + 0.06 * i), 10, 5)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  rr(ctx, 320, 450, 640, 10, 5)
  ctx.fill()
  return tex(c)
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
}

/** Scene 2 interface panels — functional-looking AI UIs. */
export function uiPanel(kind) {
  const [c, ctx] = canvas(1024, 640)
  glass(ctx, 1024, 640)
  ctx.fillStyle = ICE
  ctx.font = `600 30px ${SANS}`
  const titles = { chat: 'AI ASSISTANT', neural: 'NEURAL NETWORK', vision: 'VISION MODEL', voice: 'VOICE SYNTHESIS', code: 'CODE GENERATION', flow: 'AUTOMATION FLOW' }
  ctx.fillText(titles[kind], 60, 86)
  ctx.fillStyle = BLUE
  ctx.beginPath()
  ctx.arc(960, 76, 10, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = ICE
  ctx.fillStyle = ICE
  if (kind === 'chat') {
    ctx.fillStyle = 'rgba(23,107,255,0.75)'
    rr(ctx, 380, 140, 580, 90, 30)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = `500 30px ${SANS}`
    ctx.fillText('Write a launch plan for my product', 410, 196)
    for (let k = 0; k < 4; k++) {
      ctx.fillStyle = 'rgba(169,209,255,0.35)'
      rr(ctx, 60, 270 + k * 70, 760 - k * 110, 26, 13)
      ctx.fill()
    }
  } else if (kind === 'neural') {
    const layers = [4, 6, 6, 3]
    const pos = layers.map((n, li) => Array.from({ length: n }, (_, k) => [140 + li * 250, 170 + (k + 0.5) * (400 / n)]))
    ctx.lineWidth = 1.5
    ctx.strokeStyle = 'rgba(120,170,255,0.35)'
    for (let li = 0; li < 3; li++) for (const a of pos[li]) for (const b of pos[li + 1]) {
      ctx.beginPath()
      ctx.moveTo(...a)
      ctx.lineTo(...b)
      ctx.stroke()
    }
    for (const L of pos) for (const [x, y] of L) {
      ctx.fillStyle = '#9fd0ff'
      ctx.beginPath()
      ctx.arc(x, y, 14, 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (kind === 'vision') {
    ctx.lineWidth = 4
    ctx.strokeRect(80, 140, 400, 420)
    ctx.strokeStyle = '#d6b06e'
    ctx.strokeRect(170, 220, 200, 230)
    ctx.fillStyle = '#d6b06e'
    ctx.font = `600 26px ${SANS}`
    ctx.fillText('OBJECT 0.98', 170, 210)
    for (let k = 0; k < 5; k++) {
      ctx.fillStyle = 'rgba(169,209,255,0.4)'
      rr(ctx, 540, 160 + k * 80, 400 - k * 50, 24, 12)
      ctx.fill()
    }
  } else if (kind === 'voice') {
    ctx.lineWidth = 6
    ctx.beginPath()
    for (let x = 0; x < 880; x += 4) {
      const y = 380 + Math.sin(x * 0.05) * Math.sin(x * 0.011) * 150 * Math.exp(-Math.pow((x - 440) / 330, 2))
      x ? ctx.lineTo(70 + x, y) : ctx.moveTo(70, y)
    }
    ctx.stroke()
  } else if (kind === 'code') {
    ctx.font = `500 30px "JetBrains Mono", monospace`
    const lines = ['const plan = await ai.generate({', '  goal: "first digital product",', '  weeks: 4,', '})', 'export(plan, "pdf")']
    lines.forEach((l, k) => {
      ctx.fillStyle = k === 0 || k === 4 ? '#9fd0ff' : '#e6eefc'
      ctx.fillText(l, 70, 180 + k * 64)
    })
  } else {
    const nodes = ['Idea', 'Prompt', 'Create', 'Publish']
    nodes.forEach((n, k) => {
      const x = 70 + k * 230
      const y = 260 + (k % 2) * 140
      ctx.fillStyle = 'rgba(23,107,255,0.3)'
      rr(ctx, x, y, 190, 90, 45)
      ctx.fill()
      ctx.lineWidth = 3
      ctx.strokeStyle = BLUE
      ctx.stroke()
      ctx.fillStyle = '#fff'
      ctx.font = `600 32px ${SANS}`
      ctx.textAlign = 'center'
      ctx.fillText(n, x + 95, y + 56)
      ctx.textAlign = 'left'
      if (k < 3) {
        ctx.strokeStyle = ICE
        ctx.beginPath()
        ctx.moveTo(x + 190, y + 45)
        ctx.lineTo(x + 230, 260 + ((k + 1) % 2) * 140 + 45)
        ctx.stroke()
      }
    })
  }
  return tex(c)
}

/** Scene 3 city holograms. */
export function cityHolo(kind) {
  const [c, ctx] = canvas(768, 768)
  glass(ctx, 768, 768, kind === 'product' ? GOLD : BLUE, 0.35)
  const map = {
    assistant: ['chat', 'AI ASSISTANTS'],
    creation: ['spark', 'DIGITAL CREATION'],
    business: ['store', 'ONLINE BUSINESS'],
    production: ['play', 'CREATIVE PRODUCTION'],
    product: ['product', 'DIGITAL PRODUCTS'],
  }
  const [icon, label] = map[kind]
  drawIcon(ctx, icon, 384, 330, 300, '#eaf3ff')
  ctx.fillStyle = '#fff'
  ctx.font = `700 50px ${SANS}`
  ctx.textAlign = 'center'
  ctx.fillText(label, 384, 640)
  return tex(c)
}

/** Circuit-board traces (alpha texture for additive planes). */
export function circuit(seed = 1) {
  const [c, ctx] = canvas(1024, 1024)
  let s = seed
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  ctx.strokeStyle = '#2a7bff'
  ctx.fillStyle = '#9fd0ff'
  ctx.lineWidth = 3
  for (let k = 0; k < 90; k++) {
    let x = Math.floor(rnd() * 32) * 32
    let y = Math.floor(rnd() * 32) * 32
    ctx.beginPath()
    ctx.moveTo(x, y)
    for (let j = 0; j < 6; j++) {
      const dir = Math.floor(rnd() * 4)
      const len = 32 * (1 + Math.floor(rnd() * 4))
      if (dir === 0) x += len
      else if (dir === 1) x -= len
      else if (dir === 2) y += len
      else {
        x += len
        y += len
      }
      ctx.lineTo(x, y)
    }
    ctx.globalAlpha = 0.4 + rnd() * 0.6
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(x, y, 6, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  const t = tex(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

/** Book spine: black cloth with gold rules and the real title. */
export function spineTex() {
  const [c, ctx] = canvas(256, 2048)
  ctx.fillStyle = '#0c0c0e'
  ctx.fillRect(0, 0, 256, 2048)
  const img = ctx.getImageData(0, 0, 256, 2048)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 10
    img.data[i] += n
    img.data[i + 1] += n
    img.data[i + 2] += n
  }
  ctx.putImageData(img, 0, 0)
  ctx.strokeStyle = GOLD
  ctx.lineWidth = 3
  ;[90, 104, 1944, 1958].forEach((y) => {
    ctx.beginPath()
    ctx.moveTo(30, y)
    ctx.lineTo(226, y)
    ctx.stroke()
  })
  ctx.save()
  ctx.translate(128, 1024)
  ctx.rotate(Math.PI / 2)
  ctx.fillStyle = '#f2f2f2'
  ctx.font = `400 92px ${SERIF}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('THE AI MONEY PLAYBOOK', -60, 0)
  ctx.fillStyle = GOLD
  ctx.font = `600 40px ${SANS}`
  ctx.fillText('LUKA SHEHU', 780, 0)
  ctx.restore()
  return tex(c)
}

/** Page-edge stripes (fore-edge of the text block). */
export function pageEdgeTex(vertical = true) {
  const [c, ctx] = canvas(vertical ? 64 : 1024, vertical ? 1024 : 64)
  ctx.fillStyle = '#ece6d8'
  ctx.fillRect(0, 0, c.width, c.height)
  for (let k = 0; k < (vertical ? 64 : 64); k++) {
    ctx.fillStyle = `rgba(120,100,80,${0.05 + Math.random() * 0.12})`
    if (vertical) ctx.fillRect(k, 0, 1, c.height)
    else ctx.fillRect(0, k, c.width, 1)
  }
  return tex(c)
}

/** Inside of the cover (endpaper): deep navy with a fine gold rule. */
export function endpaperTex() {
  const [c, ctx] = canvas(512, 724)
  const g = ctx.createLinearGradient(0, 0, 512, 724)
  g.addColorStop(0, '#0d1220')
  g.addColorStop(1, '#06080e')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 512, 724)
  ctx.strokeStyle = 'rgba(214,176,110,0.55)'
  ctx.lineWidth = 2
  ctx.strokeRect(28, 28, 456, 668)
  return tex(c)
}

/** Derive physically-based maps from the real cover: gold lines & white title become metallic + embossed. */
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
    const metal = Math.min(1, gold + white)
    orm.data[i] = 255
    orm.data[i + 1] = Math.round(255 * (0.62 - 0.45 * metal)) // roughness (G)
    orm.data[i + 2] = Math.round(255 * metal) // metalness (B)
    orm.data[i + 3] = 255
    const v = Math.round(255 * Math.min(1, metal * 1.2))
    bump.data[i] = bump.data[i + 1] = bump.data[i + 2] = v
    bump.data[i + 3] = 255
  }
  cx.putImageData(orm, 0, 0)
  cbx.putImageData(bump, 0, 0)
  const ormT = tex(cr, false)
  const bumpT = tex(cb, false)
  return { orm: ormT, bump: bumpT }
}
