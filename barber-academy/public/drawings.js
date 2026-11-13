'use strict';
/* Vizatimet me vija (SVG) — koka nga anash, prapa, përpara dhe nga sipër,
   fade-t dhe hapat e prerjeve për flokët e gjata. */
(() => {
  let uid = 0;
  const INK = '#111', HAIR = '#c4c4c4', LONG = '#ececec', SHADE = '#e2e2e2', THIN = '#555';
  const p = (d, a) => `<path d="${d}" ${a}/>`;
  const line = (d, w = 1.6) => p(d, `fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`);
  const dash = (d, w = 1.3) => p(d, `fill="none" stroke="${INK}" stroke-width="${w}" stroke-dasharray="4 3" stroke-linecap="round"`);
  const filled = (d, f, w = 1.6) => p(d, `fill="${f}" stroke="${INK}" stroke-width="${w}" stroke-linejoin="round"`);
  const thin = (d, c = THIN, w = 0.9) => p(d, `fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round"`);
  const r1 = (n) => Math.round(n * 10) / 10;

  // ───────────── Pamjet bazë (koordinata 280 × 260) ─────────────
  const V = {
    side: {
      skull: 'M116 122 C116 76 154 50 196 54 C236 58 260 92 256 130 C254 156 242 170 230 180 C222 190 224 210 238 232',
      face: 'M116 122 C112 134 108 144 102 156 C98 162 100 168 108 170 L108 176 C106 180 108 184 112 186 C110 190 112 196 116 198 C116 206 120 214 128 218 C140 222 156 220 170 214 C182 208 190 196 194 182',
      neck: 'M152 220 C162 228 164 240 168 252',
      ear: 'M204 146 C204 132 222 128 224 144 C226 158 218 164 216 172 C214 178 208 178 206 174 C204 166 204 156 204 146 Z',
      earIn: 'M210 146 C210 140 218 138 218 146',
      brow: 'M120 142 C126 138 134 138 140 140',
      hair: 'M122 102 L152 98 C162 98 164 106 164 114 C164 122 172 124 180 128 C188 134 190 144 190 156 L201 156 C202 136 222 126 227 142 C228 160 222 178 230 196 C240 186 254 160 256 130 C260 92 236 58 196 54 C154 50 124 70 122 102 Z',
      hairline: ['M122 102 L152 98 C162 98 164 106 164 114 C164 122 172 124 180 128 C188 134 190 144 190 156 L201 156', 'M227 142 C228 160 222 178 230 196'],
      long: 'M118 104 C120 66 156 46 198 50 C244 56 266 100 262 150 C260 190 266 222 272 254 L212 254 C210 228 206 206 206 186 C200 178 196 166 194 154 C190 138 182 124 168 116 C158 110 150 104 140 100 Z',
      strands: ['M196 58 C236 80 250 160 252 250', 'M178 62 C220 92 232 170 236 250', 'M160 76 C196 110 212 180 222 250', 'M150 92 C180 120 196 180 210 236'],
      lines: { low: 148, mid: 126, high: 104, skin: 126 },
    },
    back: {
      skull: 'M92 178 C84 150 82 120 84 100 C88 62 112 40 140 40 C168 40 192 62 196 100 C198 120 196 150 188 178',
      neck: 'M106 184 C108 204 108 224 106 252 M174 184 C172 204 172 224 174 252',
      shoulders: 'M106 238 C90 246 66 251 42 254 M174 238 C190 246 214 251 238 254',
      ears: ['M86 132 C76 126 72 138 76 154 C78 164 82 170 90 172 C92 158 90 144 86 132 Z', 'M194 132 C204 126 208 138 204 154 C202 164 198 170 190 172 C188 158 190 144 194 132 Z'],
      hair: 'M90 134 C94 156 100 174 108 186 L172 186 C180 174 186 156 190 134 C196 118 198 108 196 100 C192 62 168 40 140 40 C112 40 88 62 84 100 C82 114 84 126 90 134 Z',
      hairline: ['M90 134 C94 156 100 174 108 186 L172 186 C180 174 186 156 190 134'],
      long: 'M84 100 C88 62 112 40 140 40 C168 40 192 62 196 100 C200 140 204 200 210 252 L70 252 C76 200 80 140 84 100 Z',
      strands: ['M112 50 C100 110 96 180 92 250', 'M126 44 C118 110 116 180 116 250', 'M140 42 L140 250', 'M154 44 C162 110 164 180 164 250', 'M168 50 C180 110 184 180 188 250'],
      lines: { low: 160, mid: 136, high: 110, skin: 136 },
    },
    front: {
      face: 'M88 122 C82 72 106 42 140 42 C174 42 198 72 192 122 C192 150 188 168 182 178 C172 196 156 206 140 206 C124 206 108 196 98 178 C92 168 88 150 88 122 Z',
      ears: ['M89 120 C78 114 74 126 78 142 C80 152 84 158 91 158', 'M191 120 C202 114 206 126 202 142 C200 152 196 158 189 158'],
      details: 'M106 126 C112 122 122 122 128 126 M152 126 C158 122 168 122 174 126 M130 182 C136 184 144 184 150 182 M136 188 C138 189 142 189 144 188',
      neck: 'M112 198 C112 212 112 224 110 234 M168 198 C168 212 168 224 170 234 M110 234 C96 244 76 250 56 254 M170 234 C184 244 204 250 224 254',
      hair: 'M88 122 C82 72 106 42 140 42 C174 42 198 72 192 122 C190 112 188 104 186 98 L186 84 C182 74 176 72 166 72 C150 70 130 70 114 72 C104 72 98 74 94 84 L94 98 C92 104 90 112 88 122 Z',
      hairline: ['M88 122 C90 112 92 104 94 98 L94 84 C98 74 104 72 114 72 C130 70 150 70 166 72 C176 72 182 74 186 84 L186 98 C188 104 190 112 192 122'],
      long: 'M86 120 C80 70 106 40 140 40 C174 40 200 70 194 120 C198 160 204 210 210 252 L70 252 C76 210 82 160 86 120 Z',
      fringe: 'M88 122 C82 72 106 42 140 42 C174 42 198 72 192 122 C188 100 176 84 158 78 C150 76 144 72 141 62 C138 72 132 76 122 78 C104 84 92 100 88 122 Z',
      lines: { low: 116, mid: 104, high: 90, skin: 104 },
    },
    top: {
      head: 'M140 30 C150 30 154 40 164 44 C196 58 214 80 216 108 C218 124 226 146 226 166 C226 214 188 240 140 240 C92 240 54 214 54 166 C54 146 62 124 64 108 C66 80 84 58 116 44 C126 40 130 30 140 30 Z',
      ears: ['M58 152 C50 154 46 168 50 180 C52 186 58 186 60 182', 'M222 152 C230 154 234 168 230 180 C228 186 222 186 220 182'],
      hairline: ['M65 112 C74 112 78 108 84 98 C92 88 104 86 112 84 C122 80 130 74 140 74 C150 74 158 80 168 84 C176 86 188 88 196 98 C202 108 206 112 215 112'],
      hair: 'M65 112 C74 112 78 108 84 98 C92 88 104 86 112 84 C122 80 130 74 140 74 C150 74 158 80 168 84 C176 86 188 88 196 98 C202 108 206 112 215 112 C220 130 226 146 226 166 C226 214 188 240 140 240 C92 240 54 214 54 166 C54 146 60 130 65 112 Z',
    },
  };

  // Mjekra (që figurat me flokë të gjata të jenë qartë meshkuj)
  const BEARD_FRONT = 'M91 146 C92 174 108 200 140 207 C172 200 188 174 189 146 C184 166 170 184 154 189 C150 185 130 185 126 189 C110 184 96 166 91 146 Z';
  const MUSTACHE = 'M124 178 C130 172 150 172 156 178 C150 181 130 181 124 178 Z';
  const BEARD_SIDE = 'M194 166 C192 190 182 206 168 214 C156 220 140 222 128 218 C120 214 116 206 116 198 C118 192 122 190 126 192 C142 200 162 196 176 184 C184 176 188 168 190 158 Z';
  const beardFront = () => filled(BEARD_FRONT, '#dcdcdc', 1.2) + filled(MUSTACHE, '#cfcfcf', 1.1);
  const beardSide = () => filled(BEARD_SIDE, '#dcdcdc', 1.2) + line('M108 180 C113 178 119 180 122 185', 1.2);

  // ───────────── Elemente ndihmëse ─────────────
  const num = (x, y, n) => `<circle cx="${x}" cy="${y}" r="7.5" fill="${INK}"/><text x="${x}" y="${y + 3}" text-anchor="middle" class="dw-num">${n}</text>`;
  const label = (x, y, t, anchor = 'middle', cls = 'dw-label') => `<text x="${x}" y="${y}" text-anchor="${anchor}" class="${cls}">${t}</text>`;
  function arrow(x1, y1, x2, y2, w = 1.2) {
    const a = Math.atan2(y2 - y1, x2 - x1), s = 6;
    const h1 = [x2 - s * Math.cos(a - 0.45), y2 - s * Math.sin(a - 0.45)], h2 = [x2 - s * Math.cos(a + 0.45), y2 - s * Math.sin(a + 0.45)];
    return `<line x1="${r1(x1)}" y1="${r1(y1)}" x2="${r1(x2)}" y2="${r1(y2)}" stroke="${INK}" stroke-width="${w}"/><path d="M${r1(h1[0])} ${r1(h1[1])} L${r1(x2)} ${r1(y2)} L${r1(h2[0])} ${r1(h2[1])}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-linejoin="round"/>`;
  }
  const scissors = (x, y, rot = 0) => `<g transform="translate(${x} ${y}) rotate(${rot})" fill="none" stroke="${INK}" stroke-width="1.3"><circle cx="-7" cy="-4" r="3.4"/><circle cx="-7" cy="4" r="3.4"/><path d="M-4 -2.5 L10 4 M-4 2.5 L10 -4" stroke-linecap="round"/></g>`;
  const hline = (y, x1 = 0, x2 = 280) => `M${x1} ${y} L${x2} ${y}`;

  // Pikat e lëkurës së kokës nga anash (për ngritjen e flokëve)
  const C = [190, 122], R = 68;
  const pt = (deg, r = R) => { const a = (deg * Math.PI) / 180; return [r1(C[0] + r * Math.cos(a)), r1(C[1] - r * Math.sin(a))]; };
  const range = (a0, a1, n) => Array.from({ length: n }, (_, i) => a0 + ((a1 - a0) * i) / (n - 1));
  const radial = (a0, a1, n, len) => range(a0, a1, n).map((a) => { const [x1, y1] = pt(a), [x2, y2] = pt(a, R + len); return thin(`M${x1} ${y1} L${x2} ${y2}`, INK, 0.8); }).join('');
  const arcAt = (a0, a1, r) => { const [x1, y1] = pt(a0, r), [x2, y2] = pt(a1, r); return `M${x1} ${y1} A${r} ${r} 0 ${Math.abs(a0 - a1) > 180 ? 1 : 0} 1 ${x2} ${y2}`; };
  const toPoint = (a0, a1, n, tx, ty) => range(a0, a1, n).map((a) => { const [x, y] = pt(a); return thin(`M${x} ${y} L${tx} ${ty}`, INK, 0.8); }).join('');
  const angled = (a0, a1, n, len, dirDeg) => {
    const d = (dirDeg * Math.PI) / 180;
    return range(a0, a1, n).map((a) => { const [x, y] = pt(a); return thin(`M${x} ${y} L${r1(x + len * Math.cos(d))} ${r1(y - len * Math.sin(d))}`, INK, 0.8); }).join('');
  };

  // ───────────── Ndërtimi i një vizatimi ─────────────
  /**
   * opts: view ('side'|'back'|'front'|'top'), hair ('short'|'long'|'curly'|'none'),
   *       fade (lloji i fade-it), extra (SVG sipër), under (SVG brenda flokëve), vb (viewBox)
   */
  function draw({ view, hair = 'short', fade = null, extra = '', under = '', vb, title = '' }) {
    vb = vb || (view === 'side' ? '-8 0 300 262' : '0 0 280 260');
    const v = V[view] || {};
    const id = `dw${++uid}`;
    const shaded = !!fade;
    const hairFill = shaded ? HAIR : '#fff';
    let defs = `<filter id="${id}b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${fade === 'skin' ? 6 : 8}"/></filter>`;
    if (v.hair) defs += `<clipPath id="${id}c"><path d="${v.hair}"/></clipPath>`;
    const fadeLayer = fade ? fadeOverlay(view, fade, id) : '';
    const inHair = (s) => (v.hair ? `<g clip-path="url(#${id}c)">${s}</g>` : s);
    let s = '';

    if (view === 'side') {
      if (hair === 'long') {
        s += line(v.face) + line(v.neck) + line(v.brow) + beardSide();
        s += filled(v.long, LONG) + v.strands.map((d) => thin(d, '#9a9a9a')).join('');
      } else if (hair === 'curly') {
        s += line(v.face) + line(v.neck) + line(v.brow) + beardSide() + curls();
      } else {
        s += filled(v.hair, hairFill, 0) + inHair(fadeLayer + under);
        s += line(v.skull) + line(v.face) + line(v.neck) + line(v.brow) + filled(v.ear, '#fff', 1.5) + line(v.earIn, 1.2);
        s += v.hairline.map((d) => dash(d)).join('');
      }
    } else if (view === 'back') {
      s += line(v.shoulders);
      if (hair === 'long') {
        s += line(v.neck) + filled(v.long, LONG) + inHair('') + v.strands.map((d) => thin(d, '#9a9a9a')).join('');
        defs += `<clipPath id="${id}l"><path d="${v.long}"/></clipPath>`;
        s += `<g clip-path="url(#${id}l)">${under}</g>` + line(v.long);
      } else {
        s += filled(v.hair, hairFill, 0) + inHair(fadeLayer + under);
        s += line(v.skull) + line(v.neck) + v.ears.map((d) => filled(d, '#fff', 1.5)).join('');
        s += v.hairline.map((d) => dash(d)).join('');
      }
    } else if (view === 'front') {
      if (hair === 'long') {
        s += line(v.neck) + filled(v.long, LONG) + under + filled(v.face, '#fff') + filled(v.fringe, LONG, 1.4) + thin('M141 46 L141 62', '#9a9a9a') + beardFront() + line(v.details, 1.3);
        s += `<circle cx="134" cy="160" r="1.5" fill="${INK}"/><circle cx="146" cy="160" r="1.5" fill="${INK}"/>`;
      } else {
        s += filled(v.face, '#fff') + filled(v.hair, hairFill, 0) + inHair(fadeLayer + under) + line(v.face);
        s += v.ears.map((d) => line(d, 1.5)).join('') + line(v.details, 1.3) + line(v.neck);
        s += `<circle cx="134" cy="160" r="1.5" fill="${INK}"/><circle cx="146" cy="160" r="1.5" fill="${INK}"/>`;
        s += v.hairline.map((d) => dash(d)).join('');
      }
    } else if (view === 'top') {
      s += v.ears.map((d) => line(d, 1.5)).join('') + filled(v.head, '#fff') + filled(v.hair, hairFill, 0) + inHair(under) + line(v.head);
      s += v.hairline.map((d) => dash(d)).join('');
    }
    if (fade && ['low', 'mid', 'high', 'skin'].includes(fade) && v.lines) {
      s += inHair(dash(hline(v.lines[fade]), 1.5));
    }
    s += extra;
    return `<svg class="dw" viewBox="${vb}" role="img" aria-label="${title}"><defs>${defs}</defs>${s}</svg>`;
  }

  function fadeOverlay(view, type, id) {
    const W = (inner) => `<g fill="#fff" filter="url(#${id}b)">${inner}</g>`;
    const y = V[view].lines?.[type];
    if (y != null) {
      return W(`<rect x="0" y="${y + 8}" width="280" height="300"/>`) + (type === 'skin' ? `<rect x="0" y="${y + 22}" width="280" height="300" fill="#fff"/>` : '');
    }
    const shapes = {
      side: {
        burst: '<ellipse cx="214" cy="152" rx="40" ry="38"/>',
        taper: '<ellipse cx="188" cy="150" rx="14" ry="16"/><ellipse cx="230" cy="198" rx="22" ry="12"/>',
        drop: '<path d="M100 146 L196 146 C220 146 232 168 240 196 L280 200 L280 300 L100 300 Z"/>',
      },
      back: {
        burst: '<ellipse cx="86" cy="152" rx="30" ry="30"/><ellipse cx="194" cy="152" rx="30" ry="30"/>',
        taper: '<ellipse cx="140" cy="192" rx="46" ry="14"/>',
        drop: '<path d="M0 146 C60 146 100 168 140 176 C180 168 220 146 280 146 L280 300 L0 300 Z"/>',
      },
      front: {
        burst: '<ellipse cx="86" cy="128" rx="16" ry="18"/><ellipse cx="194" cy="128" rx="16" ry="18"/>',
        taper: '<ellipse cx="91" cy="120" rx="8" ry="10"/><ellipse cx="189" cy="120" rx="8" ry="10"/>',
        drop: '<rect x="0" y="124" width="280" height="200"/>',
      },
    };
    return W(shapes[view]?.[type] || '');
  }

  // Flokë kaçurrela nga anash: rrathë që bashkohen në një siluetë
  function curls() {
    const pts = [];
    for (const [r, a0, a1, n] of [[80, 172, -60, 22], [62, 160, -50, 16], [44, 140, -20, 9]]) range(a0, a1, n).forEach((a) => pts.push(pt(a, r)));
    for (let yy = 180; yy <= 236; yy += 16) pts.push([254, yy], [236, yy + 6]);
    const rad = 13;
    return `<g>${pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${rad}" fill="none" stroke="${INK}" stroke-width="3.2"/>`).join('')}
      ${pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${rad}" fill="${LONG}"/>`).join('')}
      ${pts.filter((_, i) => i % 3 === 0).map(([x, y]) => `<path d="M${x - 5} ${y + 2} q5 -9 9 -1" fill="none" stroke="#9a9a9a" stroke-width="0.9"/>`).join('')}</g>`;
  }

  // ───────────── Fade-t ─────────────
  const FADE = {
    low: { side: 'Vija e fade-it 1–2 cm mbi majën e veshit; zbehja zbret deri te konturi i qafës.', back: 'Nga pas fade-i rri poshtë, mbi vijën e qafës. Pjesa tjetër mbetet e gjatë.', front: 'Nga përpara duket vetëm zbehja e favoriteve.' },
    mid: { side: 'Vija në nivelin e tempullit, rreth 2–3 gishta mbi vesh, e njëjtë rreth e qark kokës.', back: 'Nga pas vija kalon mbi kockën okcipitale, në mes të kokës.', front: 'Nga përpara anët zbehen deri afër tempullit.' },
    high: { side: 'Vija afër vijës parietale — aty ku koka kthehet nga ana në majë.', back: 'Pothuajse e gjithë pjesa e pasme zbehet; mbetet vetëm maja.', front: 'Kontrast i fortë: anët shumë të shkurtra, maja e gjatë.' },
    skin: { side: 'Pjesa e poshtme shkon deri në lëkurë me shaver ose brisk, pastaj kalim i shpejtë.', back: 'Nga pas: lëkurë poshtë, zbehje e ngushtë drejt flokëve.', front: 'Anët deri në lëkurë — lëkura e thatë, pa presion.' },
    burst: { side: 'Zbehja në formë gjysmë-rrethi rreth veshit, si rreze që dalin nga veshi.', back: 'Qafa mbetet me flokë — kjo e dallon burst-in nga fade-t e tjera.', front: 'Nga përpara, zbehje vetëm rreth veshëve.' },
    taper: { side: 'Zbehen vetëm favoritet dhe qafa; anët mbeten të gjata.', back: 'Nga pas zbehet vetëm vija e qafës, 2–3 cm.', front: 'Nga përpara pothuajse nuk duket — pamje natyrale.' },
    drop: { side: 'Vija bie pas veshit në formë harku drejt qafës, poshtë kockës okcipitale.', back: 'Nga pas harku ulet drejt qendrës së qafës.', front: 'Nga përpara duket si një low ose mid fade.' },
  };
  const NAMES = { low: 'Low fade', mid: 'Mid fade', high: 'High fade', burst: 'Burst fade', taper: 'Taper fade', drop: 'Drop fade', skin: 'Skin fade' };

  function guardsCard(type) {
    const y = V.side.lines[type];
    const steps = type === 'skin' ? ['2', '1', '0.5', '0', 'Shaver'] : ['2', '1.5', '1', '0.5', '0'];
    let under = '', extra = '';
    steps.forEach((g, i) => {
      const yy = y + i * 9;
      if (i) under += dash(hline(yy), 0.8);
      extra += `<line x1="246" y1="${yy + 4}" x2="262" y2="${yy + 4}" stroke="#bbb" stroke-width="0.8"/>` + label(266, yy + 7, g, 'start', 'dw-small');
    });
    return { label: 'Anash', title: 'Kapëset nga poshtë-lart', text: 'Puno nga zero lart: çdo kapëse ngjitet pak më lart se e mëparshmja, me lëvizje “C” që del jashtë.', svg: draw({ view: 'side', fade: type, under, extra, title: 'Kapëset' }) };
  }

  function fadeFigures(type) {
    const t = FADE[type];
    if (!t) return [];
    const figs = [
      { label: 'Anash', title: `${NAMES[type]} nga anash`, text: t.side, svg: draw({ view: 'side', fade: type, title: `${NAMES[type]} anash` }) },
      { label: 'Prapa', title: 'Nga pas', text: t.back, svg: draw({ view: 'back', fade: type, title: `${NAMES[type]} prapa` }) },
      { label: 'Përpara', title: 'Nga përpara', text: t.front, svg: draw({ view: 'front', fade: type, title: `${NAMES[type]} përpara` }) },
    ];
    if (V.side.lines[type] != null) figs.push(guardsCard(type));
    return figs;
  }

  // ───────────── Flokët e gjata ─────────────
  const TALL = '-10 -56 320 316';
  const quadrants = () => draw({
    view: 'top',
    under: `<rect x="0" y="0" width="140" height="160" fill="${SHADE}"/><rect x="140" y="160" width="140" height="100" fill="${SHADE}"/>`,
    extra: dash('M140 30 L140 240', 1.4) + dash('M50 162 L230 162', 1.4) + num(108, 122, 1) + num(172, 122, 2) + num(108, 200, 3) + num(172, 200, 4) + label(140, 254, 'NGA VESHI NË VESH'),
    vb: '0 18 280 244',
  });

  const STRAND = (kind) => {
    if (kind === 'twist') {
      const a = 'M60 230 C80 200 60 180 90 160 C120 140 100 120 130 100 C160 80 140 60 170 40';
      const b = 'M70 236 C70 200 96 190 96 160 C96 130 124 126 126 100 C128 74 156 66 160 36';
      let ends = '';
      [[100, 150], [122, 118], [146, 84], [86, 176], [160, 60]].forEach(([x, y]) => { ends += thin(`M${x} ${y} l14 -6 M${x} ${y} l12 4`, INK, 0.8); });
      return `<svg class="dw" viewBox="0 0 280 260" role="img" aria-label="Përdredhja">${line(a, 2)}${line(b, 2)}${ends}${scissors(196, 64, -30)}${label(196, 92, 'MAJAT E ÇARA', 'start')}${num(60, 246, 1)}</svg>`;
    }
    // tkurrja: i drejtë kundrejt kaçurrelës
    let coil = 'M190 40';
    for (let i = 0; i < 9; i++) coil += ` c18 6 18 14 0 12 c-18 -2 -18 6 0 10`;
    return `<svg class="dw" viewBox="0 0 280 260" role="img" aria-label="Tkurrja">
      ${line('M80 40 L80 236', 2)}${label(80, 30, 'E LAGUR')}${arrow(48, 40, 48, 236)}${arrow(48, 236, 48, 40)}${label(40, 140, '100%', 'end', 'dw-small')}
      ${line(coil, 1.8)}${label(190, 30, 'E THATË')}${arrow(232, 40, 232, 146)}${arrow(232, 146, 232, 40)}${label(240, 96, '≈ 50%', 'start', 'dw-small')}
      ${dash('M60 146 L250 146', 1)}</svg>`;
  };

  const LONG_FIGS = {
    shtresat: () => [
      { label: 'Nga sipër', title: 'Ndaji në seksione', text: 'Vija e mesit nga balli te kurora dhe vija nga veshi në vesh: 4 seksione. Fiksoji me kapëse.', svg: quadrants() },
      { label: 'Prapa', title: 'Vija udhëzuese në fund', text: 'Prit gjatësinë totale në qendër pas, me 0° ngritje. Gjithë prerja ndjek këtë vijë.', svg: draw({ view: 'back', hair: 'long', extra: dash(hline(240, 60, 220), 1.5) + scissors(232, 240) + label(140, 232, '0°') + num(140, 252, 1) }) },
      { label: 'Anash', title: 'Udhëzuesi te kurora', text: 'Merr një seksion të hollë te kurora dhe ngrije në 90° nga koka. Ky përcakton gjatësinë e shtresave.', svg: draw({ view: 'side', hair: 'none', vb: TALL, extra: radial(60, 40, 7, 70) + dash(arcAt(64, 36, 138), 1.4) + num(...pt(50), 1) + label(...pt(50, 156), '90°') + scissors(...pt(32, 144), -60) }) },
      { label: 'Anash', title: 'Ngritja 90° — shtresa uniforme', text: 'Çdo seksion ngrihet pingul me kokën dhe pritet paralel me formën e saj. Gjatësia është e njëjtë kudo.', svg: draw({ view: 'side', hair: 'none', vb: TALL, extra: radial(150, -40, 34, 52) + dash(arcAt(150, -40, 120), 1.2) + label(190, -8, 'GJATËSI E NJËJTË') }) },
      { label: 'Anash', title: 'Ngritja 180° — shtresa të gjata', text: 'Tërhiq flokët drejt e lart në majë të kokës dhe prit atje. Poshtë mbetet gjatësi, sipër krijohen shtresa të gjata.', svg: draw({ view: 'side', hair: 'none', vb: TALL, extra: toPoint(150, -40, 26, 190, -26) + dash(hline(-26, 150, 230), 1.4) + scissors(242, -26) + label(150, -32, '180°', 'end') + num(190, -38, 1) }) },
      { label: 'Anash', title: 'Ngritja 45° — shtresa të lehta', text: 'Te pjesa e pasme ngri flokët vetëm 45°. Shtresat janë të buta dhe pesha mbetet poshtë.', svg: draw({ view: 'side', hair: 'none', vb: TALL, extra: angled(30, -60, 16, 74, -45) + dash('M222 190 L282 132', 1.4) + label(270, 190, '45°') + arrow(196, 214, 196, 244) + label(204, 252, 'POSHTË', 'start', 'dw-small') }) },
      { label: 'Nga sipër', title: 'Kontrolli i kryqëzuar', text: 'Kontrollo me seksione horizontale, kundër drejtimit të prerjes. Çdo pabarazi duket menjëherë.', svg: draw({ view: 'top', under: [104, 128, 152, 176, 200].map((yy) => line(hline(yy), 1)).join('') + `<rect x="0" y="104" width="280" height="24" fill="${SHADE}"/>`, extra: arrow(70, 252, 210, 252) + arrow(210, 252, 70, 252) + label(140, 248, 'NGA VESHI NË VESH') + num(140, 90, 1), vb: '0 18 280 244' }) },
    ],
    'prerja-e-njetrajtshme': () => [
      { label: 'Prapa', title: 'Koka drejt, vija e mesit', text: 'Klienti drejt, këmbët pa i kryqëzuar. Ndaj flokët në mes nga kurora deri në qafë.', svg: draw({ view: 'back', hair: 'long', extra: dash('M140 40 L140 252', 1.5) + num(140, 30, 1) }) },
      { label: 'Prapa', title: 'Seksioni i parë horizontal', text: 'Lësho vetëm një seksion të hollë poshtë dhe prite me 0° — drejt poshtë, pa e ngritur. Kjo është vija udhëzuese.', svg: draw({ view: 'back', hair: 'long', under: `<rect x="0" y="206" width="280" height="60" fill="#d4d4d4"/>`, extra: line(hline(206, 76, 204), 1.2) + dash(hline(244, 60, 220), 1.5) + scissors(232, 244) + label(60, 240, '0°', 'end') + num(140, 226, 1) }) },
      { label: 'Prapa', title: 'Seksionet nga poshtë-lart', text: 'Lësho seksionet e reja një nga një, nga poshtë lart, dhe prit çdo seksion sipas udhëzuesit.', svg: draw({ view: 'back', hair: 'long', extra: [206, 176, 146, 116].map((yy, i) => line(hline(yy, 80, 200), 1) + num(66, yy, i + 1)).join('') + dash(hline(244, 60, 220), 1.5) }) },
      { label: 'Përpara', title: 'Kontrollo simetrinë', text: 'Sille flokun e të dy anëve përpara dhe krahaso gjatësinë me gishta. Vija duhet të jetë e njëjtë.', svg: draw({ view: 'front', hair: 'long', extra: dash(hline(250, 50, 230), 1.5) + arrow(60, 200, 60, 246) + arrow(220, 200, 220, 246) + num(60, 190, 1) + num(220, 190, 2) }) },
    ],
    'pastrimi-i-majave': () => [
      { label: 'Prapa', title: 'Seksione të vogla', text: 'Me flokët të thatë dhe të krehur, ndaj seksione të vogla vertikale.', svg: draw({ view: 'back', hair: 'long', extra: [100, 120, 160, 180].map((x) => line(`M${x} 70 L${x} 250`, 1)).join('') + `<rect x="120" y="70" width="40" height="180" fill="${SHADE}" opacity=".85"/>` + line('M120 70 L120 250 M160 70 L160 250', 1.2) + num(140, 60, 1) }) },
      { label: 'Afër', title: 'Përdridh dhe prit majat', text: 'Përdridh lehtë seksionin: majat e çara dalin jashtë. Prit vetëm ato, me majë gërshëre.', svg: STRAND('twist') },
      { label: 'Prapa', title: 'Vetëm 0.5–1 cm', text: 'Në fund rregullo vijën duke hequr vetëm 0.5–1 cm. Trego me gishta para se të fillosh.', svg: draw({ view: 'back', hair: 'long', extra: dash(hline(238, 60, 222), 1.5) + scissors(234, 238) + arrow(50, 226, 50, 252) + arrow(50, 252, 50, 226) + label(44, 222, '0.5–1 cm', 'end', 'dw-small'), vb: '-30 0 310 260' }) },
    ],
    'floket-kacurrela': () => [
      { label: 'Anash', title: 'Shiko formën në të thatë', text: 'Para se të presësh, shiko kaçurrelat në formën e tyre natyrale të thatë dhe siluetën e përgjithshme.', svg: draw({ view: 'side', hair: 'curly', extra: dash('M98 70 C120 10 250 0 286 90 C300 150 286 220 276 258', 1.3) + label(256, 18, 'SILUETA') }) },
      { label: 'Anash', title: 'Kaçurrelë pas kaçurrele', text: 'Prit çdo kaçurrelë veç e veç, duke ndjekur siluetën. Mos e tërhiq kaçurrelën.', svg: draw({ view: 'side', hair: 'curly', extra: `<circle cx="${pt(40, 80)[0]}" cy="${pt(40, 80)[1]}" r="13" fill="#bdbdbd" stroke="${INK}" stroke-width="1.6"/>` + scissors(pt(40, 104)[0], pt(40, 104)[1], -40) + num(...pt(40, 80), 1) }) },
      { label: 'Afër', title: 'Tkurrja (shrinkage)', text: 'E thatë, kaçurrela mund të dalë deri në gjysmën e gjatësisë së lagur. Prandaj prit në të thatë.', svg: STRAND('coil') },
    ],
    'floke-te-gjata-per-meshkuj': () => [
      { label: 'Anash', title: 'Vija udhëzuese te supet', text: 'Prit gjatësinë në fund (zakonisht te supet ose qafa) me 0° ngritje.', svg: draw({ view: 'side', hair: 'long', extra: dash(hline(246, 196, 280), 1.5) + scissors(186, 246, 180) + num(240, 236, 1) }) },
      { label: 'Anash', title: 'Shtresa të gjata 45°', text: 'Hiq peshën në fund me shtresa të gjata dhe ngritje të ulët — pa krijuar formën “trekëndësh”.', svg: draw({ view: 'side', hair: 'none', vb: TALL, extra: angled(20, -60, 14, 80, -45) + dash('M226 196 L292 134', 1.4) + label(276, 196, '45°') }) },
      { label: 'Prapa', title: 'Hiq peshën nga brenda', text: 'Ngri shtresën e sipërme dhe rrallo vetëm seksionin e brendshëm. Nga jashtë flokët mbeten të plotë.', svg: draw({ view: 'back', hair: 'long', under: `<rect x="112" y="120" width="56" height="116" fill="#d4d4d4"/>`, extra: dash('M112 120 L168 120 L168 236 L112 236 Z', 1.2) + label(140, 182, 'BRENDA') + arrow(140, 110, 140, 70) + label(150, 94, 'SHTRESA E SIPËRME', 'start', 'dw-small') }) },
      { label: 'Përpara', title: 'Flokët pas veshëve', text: 'Anët duhet të bien natyrshëm pas veshëve. Përpara ruaj gjatësinë që lejon krehjen pas.', svg: draw({ view: 'front', hair: 'long', extra: arrow(104, 92, 82, 132) + arrow(176, 92, 198, 132) + num(104, 84, 1) + num(176, 84, 2) }) },
    ],
  };

  // ───────────── Mësimet e reja të flokëve të gjata ─────────────
  const curtain = () => line('M141 76 C126 96 110 112 98 140', 1.4) + line('M141 76 C156 96 172 112 184 140', 1.4) + thin('M141 76 C132 92 120 108 110 132 M141 76 C150 92 162 108 172 132', '#9a9a9a');
  const levelMarks = () => [[150, 'MOLLËZAT'], [182, 'BUZËT'], [206, 'MJEKRA']].map(([yy, t]) => `<line x1="214" y1="${yy}" x2="230" y2="${yy}" stroke="#bbb" stroke-width="0.8"/>` + label(234, yy + 3, t, 'start', 'dw-small')).join('');
  // Fundi i flokëve pas në formë U ose V (mbulon vijën e sheshtë dhe vizaton skajin e ri)
  const backEnd = (d) => `<path d="M28 ${d.y0} L58 ${d.y0} ${d.path.replace(/^M\S+ \S+/, (m) => `L${m.slice(1)}`)} L224 ${d.y0} L254 ${d.y0} L254 262 L28 262 Z" fill="#fff"/>` + line(d.path, 1.6);
  const U = { y0: 212, path: 'M73 214 C92 262 188 262 207 214' };
  const VV = { y0: 204, path: 'M74 206 L140 252 L206 206' };
  const horseshoe = 'M92 110 C88 150 92 192 140 200 C188 192 192 150 188 110 C170 96 150 92 140 92 C130 92 110 96 92 110 Z';
  const ragged = (y, x0, x1) => { let d = `M${x0} ${y}`; for (let x = x0 + 8, i = 0; x <= x1; x += 8, i++) d += ` L${x} ${y + (i % 2 ? 4 : -3)}`; return d; };

  Object.assign(LONG_FIGS, {
    'shtresat-rreth-fytyres': () => [
      { label: 'Përpara', title: 'Seksioni trekëndësh', text: 'Ndaj vetëm seksionin përpara: nga vija e ndarjes deri te dy tempujt. Pjesa tjetër mbetet e lidhur pas.', svg: draw({ view: 'front', hair: 'long', extra: p('M141 46 L100 98 L182 98 Z', `fill="${SHADE}" fill-opacity=".9" stroke="${INK}" stroke-width="1.2" stroke-dasharray="4 3"`) + num(141, 82, 1) }) },
      { label: 'Përpara', title: 'Pika më e shkurtër', text: 'Zgjidh ku fillon shtresa: mollëzat, buzët ose mjekra. Nga aty shtresa zbret drejt supeve.', svg: draw({ view: 'front', hair: 'long', vb: '0 0 300 260', extra: dash('M94 150 L72 246', 1.5) + dash('M188 150 L210 246', 1.5) + num(94, 150, 1) + num(188, 150, 2) + levelMarks() }) },
      { label: 'Përpara', title: 'Prerja me rrëshqitje', text: 'Me gërshërë gjysmë të hapura rrëshqit poshtë në kënd (slide cutting). Shtresa lidhet butë me gjatësinë.', svg: draw({ view: 'front', hair: 'long', extra: arrow(92, 156, 72, 236) + scissors(70, 186, 75) + dash('M188 150 L210 246', 1.2) + label(60, 248, 'SLIDE CUT', 'middle', 'dw-small') }) },
      { label: 'Përpara', title: 'Kontrollo simetrinë', text: 'Sill të dyja anët përpara dhe krahasoji me gishta në të njëjtën lartësi.', svg: draw({ view: 'front', hair: 'long', extra: dash(hline(232, 56, 224), 1.2) + arrow(122, 232, 78, 232) + arrow(158, 232, 202, 232) + num(140, 232, 1) }) },
    ],
    'balluke-perde': () => [
      { label: 'Nga sipër', title: 'Seksioni përpara', text: 'Trekëndësh përpara: baza nga tempulli në tempull, maja te kurora e përparme. Ky seksion bëhet “curtains”.', svg: draw({ view: 'top', under: p('M98 92 L140 132 L182 92 C160 78 120 78 98 92 Z', `fill="${SHADE}"`), extra: dash('M98 92 L140 132 L182 92', 1.3) + num(140, 104, 1) + label(140, 150, 'PËRPARA'), vb: '0 18 280 244' }) },
      { label: 'Përpara', title: 'Ndarja në mes', text: 'Ndaje në mes sipas vorbullës natyrale. Çdo anë bie anash si perde, drejt mollëzave.', svg: draw({ view: 'front', hair: 'long', extra: curtain() + dash('M141 44 L141 80', 1.3) + arrow(128, 118, 106, 140) + arrow(154, 118, 176, 140) + num(141, 34, 1) }) },
      { label: 'Përpara', title: 'Forma V e butë', text: 'Qendra te vetullat ose hunda, anët në diagonale drejt mollëzave. Prit më gjatë: kur thahen ngrihen.', svg: draw({ view: 'front', hair: 'long', extra: curtain() + dash('M96 140 L141 128 L186 140', 1.5) + scissors(200, 140) + num(141, 116, 1) }) },
      { label: 'Përpara', title: 'Lidhja me anët', text: 'Flokët përpara vazhdojnë butë te anët e kokës, pa vijë të prerë mes tyre.', svg: draw({ view: 'front', hair: 'long', extra: curtain() + dash('M98 140 C88 170 80 204 74 246', 1.3) + dash('M184 140 C194 170 202 204 208 246', 1.3) }) },
    ],
    'forma-v-dhe-u': () => [
      { label: 'Prapa', title: 'Forma U', text: 'Gjatësia më e madhe në qendër, anët pak më të shkurtra në vijë të lakuar. E butë dhe klasike.', svg: draw({ view: 'back', hair: 'long', extra: backEnd(U) + dash('M140 40 L140 250', 1) + scissors(220, 232, 200) + label(140, 30, 'U') }) },
      { label: 'Prapa', title: 'Forma V', text: 'Maja e V-së në qendër pas, anët në vijë të drejtë diagonale. Më e guximshme se U.', svg: draw({ view: 'back', hair: 'long', extra: backEnd(VV) + dash('M140 40 L140 250', 1) + num(140, 252, 1) + label(140, 30, 'V') }) },
      { label: 'Prapa', title: 'Sill anët drejt qendrës', text: 'Çdo anë krehet drejt qendrës pas dhe pritet aty. Kështu anët dalin vetvetiu pak më të shkurtra.', svg: draw({ view: 'back', hair: 'long', extra: dash('M140 40 L140 252', 1.3) + arrow(84, 160, 132, 230) + arrow(196, 160, 148, 230) + num(84, 150, 1) + num(196, 150, 2) }) },
      { label: 'Anash', title: 'Mbi-drejtimi përpara', text: 'Për shtresa: sill gjithë flokët përpara mbi ballë dhe prit aty. Pas flokët dalin gradualisht më të gjatë.', svg: draw({ view: 'side', hair: 'none', vb: TALL, extra: toPoint(130, -40, 24, 96, -10) + dash('M70 6 L110 -26', 1.4) + num(96, -10, 1) + label(60, -26, 'UDHËZUESI', 'middle', 'dw-small') + arrow(250, -10, 140, -20) }) },
    ],
    'shag-wolf-cut': () => [
      { label: 'Nga sipër', title: 'Seksioni i majës (patkoi)', text: 'Ndaj majën në formë patkoi, nga tempulli në tempull përmes kurorës. Këtu dalin shtresat e shkurtra.', svg: draw({ view: 'top', under: p(horseshoe, `fill="${SHADE}"`), extra: line(horseshoe, 1.4) + num(92, 110, 1) + num(188, 110, 1) + label(140, 156, 'MAJA') + label(140, 214, 'KURORA', 'middle', 'dw-small'), vb: '0 18 280 244' }) },
      { label: 'Anash', title: 'Maja drejt lart, 180°', text: 'Ngri flokët e majës drejt lart te udhëzuesi dhe prit të sheshtë. Sipër dalin shtresa të shkurtra.', svg: draw({ view: 'side', hair: 'none', vb: TALL, extra: toPoint(150, 30, 16, 192, -20) + dash(hline(-20, 150, 232), 1.4) + scissors(244, -20) + num(192, -32, 1) + label(146, -26, '180°', 'end') }) },
      { label: 'Anash', title: 'Lidhja me pjesën poshtë', text: 'Lësho anët dhe pjesën e pasme dhe lidhi me majën me ngritje 90°, që të mos dalin dy prerje të ndara.', svg: draw({ view: 'side', hair: 'none', vb: TALL, extra: radial(40, -50, 14, 46) + dash(arcAt(42, -52, 114), 1.3) + label(282, 120, '90°') + num(...pt(40, 114), 2) }) },
      { label: 'Anash', title: 'Silueta me shtresa', text: 'Rezultati: volum dhe teksturë në kurorë, gjatësi poshtë dhe balluke që lidhen me anët.', svg: draw({ view: 'side', hair: 'long', extra: thin(ragged(118, 204, 262), INK, 1.1) + thin(ragged(168, 206, 266), INK, 1.1) + thin(ragged(214, 210, 270), INK, 1.1) + line('M124 102 C116 116 112 128 114 140', 1.4) + label(240, 104, 'SHTRESA', 'middle', 'dw-small') }) },
    ],
  });

  const MULLET = 'M230 130 C250 138 258 160 258 186 C258 208 262 230 266 250 L222 250 C220 230 214 210 206 194 C214 176 222 152 230 130 Z';
  const mullet = () => filled(MULLET, LONG, 1.4) + thin('M238 150 C246 180 248 214 252 246 M228 160 C232 190 234 220 236 248', '#9a9a9a');
  const BACK_MULLET = 'M104 150 C100 190 98 222 96 250 L184 250 C182 222 180 190 176 150 Z';
  const bunSide = () => thin('M124 100 C160 74 200 62 226 60 M150 98 C180 80 206 70 228 66 M168 118 C196 96 216 80 232 72 M196 128 C214 106 226 88 238 76', INK, 0.8) + `<circle cx="242" cy="58" r="18" fill="${LONG}" stroke="${INK}" stroke-width="1.6"/>` + thin('M232 50 q10 -6 20 4 M230 62 q12 -4 22 4', '#9a9a9a');
  const bunBack = () => thin('M92 110 C106 84 122 66 132 58 M188 110 C174 84 158 66 148 58 M112 96 C122 78 130 68 136 60 M168 96 C158 78 150 68 144 60', INK, 0.8) + `<circle cx="140" cy="46" r="17" fill="${LONG}" stroke="${INK}" stroke-width="1.6"/>`;

  Object.assign(LONG_FIGS, {
    'mullet-modern': () => [
      { label: 'Anash', title: 'Tre zonat', text: '1 — maja me shtresa, 2 — anët të zbehura rreth veshit, 3 — pjesa e pasme e gjatë mbi qafë.', svg: draw({ view: 'side', fade: 'burst', extra: mullet() + num(190, 72, 1) + num(176, 136, 2) + num(244, 220, 3) }) },
      { label: 'Anash', title: 'Anët: burst rreth veshit', text: 'Zbehja bëhet në formë harku rreth veshit dhe ndalet pas tij. Qafa nuk zbehet — aty mbetet gjatësia.', svg: draw({ view: 'side', fade: 'burst', extra: mullet() + dash('M178 112 C200 92 236 98 240 132', 1.3) + label(212, 92, 'BURST', 'middle', 'dw-small') }) },
      { label: 'Anash', title: 'Maja me shtresa 90°', text: 'Ngri flokët e majës 90° nga koka dhe prit paralel me formën e saj, të lidhura me anët.', svg: draw({ view: 'side', fade: 'burst', vb: TALL, extra: mullet() + radial(150, 40, 12, 46) + dash(arcAt(150, 40, 114), 1.3) + label(190, 0, '90°') }) },
      { label: 'Prapa', title: 'Gjatësia pas', text: 'Pjesa e pasme pritet në qafë me 0° dhe pesha hiqet me point cutting. Anët pas veshit mbeten të zbehura.', svg: draw({ view: 'back', fade: 'burst', extra: filled(BACK_MULLET, LONG, 1.4) + thin('M120 156 L118 248 M140 156 L140 248 M160 156 L162 248', '#9a9a9a') + dash(hline(244, 84, 196), 1.5) + scissors(208, 244) }) },
    ],
    'undercut-man-bun': () => [
      { label: 'Nga sipër', title: 'Maja mbetet e gjatë', text: 'Ndaj majën në formë patkoi dhe lidhe lart. Gjithçka jashtë patkoit bëhet undercut.', svg: draw({ view: 'top', under: p(horseshoe, `fill="${SHADE}"`), extra: line(horseshoe, 1.4) + label(140, 150, 'MAJA E GJATË') + label(140, 254, 'UNDERCUT ANASH DHE PAS', 'middle', 'dw-small'), vb: '0 18 280 244' }) },
      { label: 'Anash', title: 'Vija e ndarjes', text: 'Anët dhe pas me makinë, deri 1–2 cm nën vijën parietale. Kalimi te maja është i ndarë (disconnected).', svg: draw({ view: 'side', fade: 'high', extra: bunSide() + label(18, 92, 'VIJA E NDARJES', 'start', 'dw-small') + arrow(70, 98, 116, 104) + num(160, 104, 1) }) },
      { label: 'Prapa', title: 'Nga pas, me man bun', text: 'Vija e ndarjes duhet të jetë e drejtë dhe në të njëjtën lartësi në të dyja anët.', svg: draw({ view: 'back', fade: 'high', extra: bunBack() + arrow(66, 110, 92, 110) + arrow(214, 110, 188, 110) }) },
    ],
  });

  // ───────────── API publike ─────────────
  window.Drawings = {
    figures(topic) {
      if (topic.diagram) return fadeFigures(topic.diagram);
      return LONG_FIGS[topic.slug] ? LONG_FIGS[topic.slug]() : [];
    },
    thumb(topic) {
      if (topic.diagram) return draw({ view: 'side', fade: topic.diagram, title: NAMES[topic.diagram] });
      return LONG_FIGS[topic.slug] ? LONG_FIGS[topic.slug]()[0].svg : '';
    },
    head(type, view = 'side') { return draw({ view, fade: type, title: NAMES[type] || '' }); },
    names: NAMES,
  };
})();
