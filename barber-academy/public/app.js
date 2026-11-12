'use strict';
/* Barber Academy — frontend (pa librari të jashtme) */

// ───────────────────────── Ndihmës ─────────────────────────
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
class Raw { constructor(s) { this.s = s; } }
const raw = (s) => new Raw(s);
const out = (v) => (v == null || v === false ? '' : v instanceof Raw ? v.s : Array.isArray(v) ? v.map(out).join('') : esc(v));
const html = (strings, ...vals) => raw(strings.reduce((acc, s, i) => acc + s + (i < vals.length ? out(vals[i]) : ''), ''));

const state = { pub: null, user: null, admin: null };
const S = () => state.pub?.settings || {};
const isAdmin = () => state.user?.role === 'admin';
const hasAccess = () => !!state.user?.access;

async function api(method, url, body) {
  const opt = { method, headers: { 'X-Requested-With': 'fetch' }, credentials: 'same-origin' };
  if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
  const r = await fetch(url, opt);
  let data = {};
  try { data = await r.json(); } catch { /* bosh */ }
  if (!r.ok) { const e = new Error(data.error || 'Ndodhi një gabim.'); e.status = r.status; e.data = data; throw e; }
  return data;
}

function toast(msg, type = 'ok') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = `toast show ${type}`;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.className = 'toast'; }, 3800);
}

const fmtDate = (iso, withTime = true) => {
  const d = new Date(iso);
  return d.toLocaleString('sq-AL', { weekday: withTime ? 'long' : undefined, day: 'numeric', month: 'long', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) });
};
const fmtSize = (b) => (b > 1e9 ? `${(b / 1e9).toFixed(1)} GB` : b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.ceil(b / 1e3)} KB`);
const telHref = (p) => `tel:${String(p).replace(/[^\d+]/g, '')}`;
const waHref = (p) => `https://wa.me/${String(p).replace(/[^\d]/g, '')}`;
const igHref = (h) => (/^https?:\/\//.test(h) ? h : `https://instagram.com/${String(h).replace(/^@/, '')}`);
const sectionOf = (key) => state.pub.sections.find((s) => s.key === key);
const topicsOf = (key) => state.pub.topics.filter((t) => t.section === key);
const TAGS = { shembull: 'Shembull', procesi: 'Procesi', para: 'Para', pas: 'Pas', gabim: 'Gabim', zgjidhje: 'Zgjidhje', mjeti: 'Mjeti' };
const DIAGRAMS = { low: 'Low fade', mid: 'Mid fade', high: 'High fade', burst: 'Burst fade', taper: 'Taper fade', drop: 'Drop fade', skin: 'Skin fade' };

// ───────────────────── Vizatimet (shiko drawings.js) ─────────────────────
const fadeSvg = (type, { size = '' } = {}) => raw(`<div class="dw-wrap ${size}">${window.Drawings.head(type)}</div>`);
const thumbSvg = (t) => { const svg = window.Drawings.thumb(t); return svg ? raw(`<div class="dw-wrap">${svg}</div>`) : ''; };
function figCards(t) {
  const figs = window.Drawings.figures(t);
  if (!figs.length) return '';
  return html`<h2 id="vizatimet">Procesi në vizatime</h2>
    <div class="fig-grid">${figs.map((f, i) => html`<figure class="fig-card">
      <div class="fig-top"><span>${String(i + 1).padStart(2, '0')}</span><span>${f.label}</span></div>
      ${raw(f.svg)}
      <figcaption><h3>${f.title}</h3><p>${f.text}</p></figcaption>
    </figure>`)}</div>`;
}

// ───────────────────────── Paraqitja e përgjithshme ─────────────────────────
function renderChrome() {
  const s = S();
  const u = state.user;
  const navSections = state.pub.sections.map((x) => html`<a href="#/seksioni/${x.key}" data-nav="/seksioni/${x.key}">${x.title}</a>`);
  $('#topbar').innerHTML = html`<div class="wrap topbar-in">
    <a class="logo" href="#/"><span class="logo-mark" aria-hidden="true"></span>${s.brand_name}</a>
    <button class="menu-btn" data-act="menu" aria-expanded="false" aria-controls="nav" aria-label="Menyja"><span></span><span></span><span></span></button>
    <nav id="nav" class="nav">
      ${navSections}
      <a href="#/live" data-nav="/live">Live Zoom</a>
      <a href="#/kontakt" data-nav="/kontakt">Kontakt</a>
      <span class="nav-sep"></span>
      ${u ? html`
        ${isAdmin() ? html`<a href="#/admin" data-nav="/admin" class="nav-admin">Paneli</a>` : ''}
        <a href="#/llogaria" data-nav="/llogaria" class="nav-account">${u.name.split(' ')[0]}</a>`
      : html`<a href="#/hyr" data-nav="/hyr">Hyr</a><a href="#/abonimi" class="btn sm">Abonohu</a>`}
    </nav>
  </div>`.s;

  $('#footer').innerHTML = html`<div class="wrap footer-in">
    <div>
      <div class="logo"><span class="logo-mark" aria-hidden="true"></span>${s.brand_name}</div>
      <p class="muted small">${s.tagline}</p>
    </div>
    <div class="footer-col">
      <strong>Kontakt</strong>
      <span>${s.owner_name}</span>
      ${s.phone ? html`<a href="${telHref(s.phone)}">${s.phone}</a>` : ''}
      ${s.email ? html`<a href="mailto:${s.email}">${s.email}</a>` : ''}
      ${s.city ? html`<span>${s.city}</span>` : ''}
    </div>
    <div class="footer-col">
      <strong>Ligjore</strong>
      <a href="/privatesia">Politika e Privatësisë</a>
      <a href="/kushtet">Kushtet e Përdorimit</a>
      <a href="/cookies">Politika e Cookies</a>
    </div>
  </div>
  <div class="wrap footer-bottom muted small">© ${new Date().getFullYear()} ${s.owner_name} · ${s.brand_name}. Të gjitha të drejtat e rezervuara. Përmbajtja mbrohet nga e drejta e autorit.</div>`.s;

  const cookie = $('#cookie');
  let ok = false;
  try { ok = localStorage.getItem('ba_cookie_ok') === '1'; } catch { ok = true; }
  if (!ok) {
    cookie.hidden = false;
    cookie.innerHTML = html`<p>Përdorim vetëm një cookie teknike të nevojshme për hyrjen në llogari — pa reklama dhe pa gjurmim. <a href="/cookies">Më shumë</a></p><button class="btn sm" data-act="cookie-ok">Në rregull</button>`.s;
  }
}

function markNav(path) {
  $$('#nav a[data-nav]').forEach((a) => a.classList.toggle('active', path === a.dataset.nav || (a.dataset.nav !== '/' && path.startsWith(a.dataset.nav))));
}

// ───────────────────────── Faqet ─────────────────────────
function pricingCard() {
  const s = S();
  return html`<div class="price-card">
    <div class="kicker">Abonim mujor</div>
    <div class="price">${s.price_label}</div>
    <ul class="checks">
      <li>Të gjitha proceset e fade-ve: low, mid, high, burst, taper, drop, skin</li>
      <li>Flokët e gjata: shtresat, kaçurrelat, pastrimi i majave</li>
      <li>Njohja e mjeteve të punës dhe mirëmbajtja</li>
      <li>Gabimet që bëhen dhe zgjidhjet e tyre</li>
      <li>Foto dhe video të reja çdo muaj</li>
      <li>Takime live në Zoom</li>
      <li>Anulo kur të duash — pa kontratë</li>
    </ul>
    ${hasAccess() ? html`<a class="btn wide" href="#/seksioni/fade">Vazhdo mësimet →</a>` : html`<a class="btn wide" href="#/abonimi">Fillo abonimin</a>`}
  </div>`;
}

function topicCard(t) {
  const locked = !hasAccess();
  return html`<a class="topic-card" href="#/tema/${t.slug}">
    ${thumbSvg(t) ? html`<div class="topic-diagram">${thumbSvg(t)}</div>` : ''}
    <div class="topic-body">
      <h3>${t.title} ${locked ? raw('<span class="lock" title="Kërkon abonim" aria-label="Kërkon abonim">🔒</span>') : ''}</h3>
      <p>${t.summary}</p>
      <div class="meta">${t.photos ? html`<span>📷 ${t.photos} foto</span>` : ''}${t.videos ? html`<span>🎬 ${t.videos} video</span>` : ''}</div>
    </div>
  </a>`;
}

function contactBlock() {
  const s = S();
  return html`<section class="section" id="kontakt"><div class="wrap grid-2">
    <div>
      <div class="kicker">Kontakt</div>
      <h2>Na shkruaj ose na telefono</h2>
      <p class="muted">Pyetje për abonimin, takimet live apo bashkëpunime.</p>
      <ul class="contact-list">
        <li><span>Emri</span><strong>${s.owner_name}</strong></li>
        ${s.phone ? html`<li><span>Telefoni</span><a href="${telHref(s.phone)}">${s.phone}</a></li>` : ''}
        ${s.email ? html`<li><span>Email</span><a href="mailto:${s.email}">${s.email}</a></li>` : ''}
        ${s.whatsapp ? html`<li><span>WhatsApp</span><a href="${waHref(s.whatsapp)}" target="_blank" rel="noopener noreferrer">${s.whatsapp}</a></li>` : ''}
        ${s.instagram ? html`<li><span>Instagram</span><a href="${igHref(s.instagram)}" target="_blank" rel="noopener noreferrer">${s.instagram}</a></li>` : ''}
        ${s.city ? html`<li><span>Qyteti</span><strong>${s.city}</strong></li>` : ''}
      </ul>
      ${!s.phone && !s.email && isAdmin() ? html`<p class="note">Shto numrin dhe email-in te <a href="#/admin/cilesimet">Paneli → Cilësimet</a>.</p>` : ''}
    </div>
    <form class="card form" data-form="contact" novalidate>
      <label>Emri<input name="name" required maxlength="80" autocomplete="name" value="${state.user?.name || ''}"></label>
      <label>Email<input name="email" type="email" required maxlength="254" autocomplete="email" value="${state.user?.email || ''}"></label>
      <label>Telefoni (opsional)<input name="phone" type="tel" maxlength="40" autocomplete="tel"></label>
      <label>Mesazhi<textarea name="message" rows="4" required maxlength="3000"></textarea></label>
      <label class="hp" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label>
      <label class="check"><input type="checkbox" name="consent" required> Pranoj që të dhënat e mia të përdoren vetëm për t’iu përgjigjur këtij mesazhi, sipas <a href="/privatesia" target="_blank">Politikës së Privatësisë</a>.</label>
      <button class="btn">Dërgo mesazhin</button>
    </form>
  </div></section>`;
}

function viewHome() {
  const s = S(), p = state.pub;
  const nPhotos = p.topics.reduce((a, t) => a + t.photos, 0), nVideos = p.topics.reduce((a, t) => a + t.videos, 0);
  const fades = topicsOf('fade');
  return html`
  <section class="hero"><div class="wrap hero-in">
    <div>
      <div class="kicker">Akademi online për barberë · ${s.owner_name}</div>
      <h1>${s.brand_name}</h1>
      <p class="lead">${s.tagline}</p>
      <div class="actions">
        ${hasAccess() ? html`<a class="btn" href="#/seksioni/fade">Vazhdo mësimet</a>` : html`<a class="btn" href="#/abonimi">Fillo abonimin · ${s.price_label}</a>`}
        <button class="btn ghost" data-act="scroll" data-target="program">Shiko programin</button>
      </div>
      <dl class="stats">
        <div><dt>${p.topics.length}</dt><dd>mësime</dd></div>
        <div><dt>${nPhotos}</dt><dd>foto</dd></div>
        <div><dt>${nVideos}</dt><dd>video</dd></div>
        <div><dt>Live</dt><dd>në Zoom</dd></div>
      </dl>
    </div>
    <div class="hero-art">${fadeSvg("mid", { size: "xl" })}</div>
  </div></section>

  <section class="section" id="program"><div class="wrap">
    <div class="kicker">Programi</div>
    <h2>Çdo sektor me rëndësinë e vet</h2>
    <div class="cards-4">
      ${p.sections.map((x, i) => html`<a class="sec-card" href="#/seksioni/${x.key}">
        <span class="num">0${i + 1}</span><div class="kicker">${x.kicker}</div><h3>${x.title}</h3><p>${x.summary}</p>
        <span class="more">${topicsOf(x.key).length} mësime →</span></a>`)}
      <a class="sec-card live" href="#/live"><span class="num">0${p.sections.length + 1}</span><div class="kicker">Takime</div><h3>Live në Zoom</h3><p>${s.meeting_schedule}</p><span class="more">Shiko takimet →</span></a>
    </div>
  </div></section>

  <section class="section alt"><div class="wrap">
    <div class="kicker">Proceset e qethjes</div>
    <h2>Fade-t, një nga një</h2>
    <div class="fade-strip">
      ${fades.map((t) => html`<a class="fade-chip" href="#/tema/${t.slug}">${thumbSvg(t)}<span>${t.title}</span></a>`)}
    </div>
  </div></section>

  <section class="section"><div class="wrap">
    <div class="kicker">Si funksionon</div>
    <h2>Tre hapa</h2>
    <ol class="steps-3">
      <li><strong>Krijo llogarinë</strong><span>Me emrin dhe email-in tënd.</span></li>
      <li><strong>Abonohu mujor</strong><span>Pagesë e sigurt përmes ${p.provider === 'stripe' ? 'Stripe' : 'Whop'}, me të njëjtin email.</span></li>
      <li><strong>Mëso & praktiko</strong><span>Foto, video, procese hap pas hapi dhe takime live.</span></li>
    </ol>
  </div></section>

  <section class="section alt"><div class="wrap grid-2 center">
    <div>
      <div class="kicker">Instruktori</div>
      <h2>${s.owner_name}</h2>
      <p class="lead small">${s.about}</p>
      ${p.upcoming.length ? html`<div class="next-meet"><div class="kicker">Takimi i radhës</div><strong>${p.upcoming[0].title}</strong><span>${fmtDate(p.upcoming[0].starts_at)}</span></div>` : ''}
    </div>
    ${pricingCard()}
  </div></section>
  ${contactBlock()}`;
}

function viewSection(key) {
  const sec = sectionOf(key);
  if (!sec) return viewNotFound();
  const topics = topicsOf(key);
  return html`<section class="page-head"><div class="wrap">
      <a class="crumb" href="#/">← Kreu</a>
      <div class="kicker">${sec.kicker}</div><h1>${sec.title}</h1><p class="lead">${sec.summary}</p>
      ${isAdmin() ? html`<a class="btn sm ghost" href="#/admin/temat?new=${key}">+ Shto mësim në këtë sektor</a>` : ''}
    </div></section>
    <section class="section tight"><div class="wrap">
      ${!hasAccess() ? html`<div class="banner">🔒 Këto mësime janë për anëtarët me abonim. <a href="#/abonimi">Abonohu</a> ${state.user ? '' : html`ose <a href="#/hyr">hyr në llogari</a>`}.</div>` : ''}
      <div class="topic-grid">${topics.map(topicCard)}</div>
      ${!topics.length ? html`<p class="muted">Ende nuk ka mësime këtu.</p>` : ''}
    </div></section>`;
}

function mediaItem(m, adminMode) {
  const wm = state.user?.email || '';
  const body = m.kind === 'video'
    ? html`<div class="video-wrap"><video src="${m.url}" controls preload="metadata" playsinline controlslist="nodownload" disablepictureinpicture></video><span class="wm" aria-hidden="true">${wm}</span></div>`
    : html`<button class="img-btn" data-act="lightbox" data-src="${m.url}" data-title="${m.title}"><img src="${m.url}" alt="${m.title || 'Foto'}" loading="lazy"></button>`;
  return html`<figure class="media-item" data-kind="${m.kind}" data-tag="${m.tag}">
    ${body}
    <figcaption><span class="tag t-${m.tag}">${TAGS[m.tag] || m.tag}</span>${m.title ? html`<strong>${m.title}</strong>` : ''}${m.description ? html`<p>${m.description}</p>` : ''}
    ${adminMode ? html`<button class="link danger" data-act="del-media" data-id="${m.id}">Fshi</button>` : ''}</figcaption>
  </figure>`;
}

async function viewTopic(slug) {
  let data;
  try { data = await api('GET', `/api/topics/${encodeURIComponent(slug)}`); } catch (e) {
    if (e.status === 402) return paywall(e.data.preview);
    return viewNotFound();
  }
  const t = data.topic, sec = sectionOf(t.section);
  const photos = data.media.filter((m) => m.kind === 'photo').length, videos = data.media.length - photos;
  const usedTags = [...new Set(data.media.map((m) => m.tag))];
  return html`<section class="page-head"><div class="wrap">
      <a class="crumb" href="#/seksioni/${t.section}">← ${sec?.title}</a>
      <div class="topic-head">
        <div><div class="kicker">${sec?.kicker}</div><h1>${t.title}</h1><p class="lead">${t.summary}</p>
        ${isAdmin() ? html`<div class="actions"><a class="btn sm ghost" href="#/admin/temat?edit=${t.id}">Edito tekstin</a><a class="btn sm ghost" href="#/admin/ngarko?topic=${t.id}">+ Ngarko foto/video</a></div>` : ''}</div>
        ${thumbSvg(t) ? html`<div class="topic-head-art">${thumbSvg(t)}</div>` : ''}
      </div>
    </div></section>
    <section class="section tight"><div class="wrap topic-layout">
      <article class="topic-main">
        ${t.intro ? html`<p class="intro">${t.intro}</p>` : ''}
        ${figCards(t)}
        ${t.steps.length ? html`<h2 id="procesi">Procesi hap pas hapi</h2><ol class="process">${t.steps.map((x) => html`<li>${x}</li>`)}</ol>` : ''}
        ${t.mistakes.length ? html`<h2 id="gabimet">Gabimet që bëhen & zgjidhja</h2>
          <div class="mistakes">${t.mistakes.map((m) => html`<div class="mistake"><div class="m-bad"><span>Gabimi</span>${m.problem}</div><div class="m-good"><span>Zgjidhja</span>${m.solution}</div></div>`)}</div>` : ''}
        <h2 id="galeria">Foto & video</h2>
        ${data.media.length ? html`
          <div class="filters" role="tablist">
            <button class="chip on" data-act="filter" data-f="all">Të gjitha (${data.media.length})</button>
            ${photos ? html`<button class="chip" data-act="filter" data-f="photo">Foto (${photos})</button>` : ''}
            ${videos ? html`<button class="chip" data-act="filter" data-f="video">Video (${videos})</button>` : ''}
            ${usedTags.length > 1 ? usedTags.map((g) => html`<button class="chip" data-act="filter" data-f="tag:${g}">${TAGS[g] || g}</button>`) : ''}
          </div>
          <div class="gallery">${data.media.map((m) => mediaItem(m, isAdmin()))}</div>`
        : html`<p class="muted empty">Fotot dhe videot për këtë mësim do të shtohen së shpejti.${isAdmin() ? raw(' <a href="#/admin/ngarko?topic=' + t.id + '">Ngarko tani →</a>') : ''}</p>`}
      </article>
      <aside class="topic-side">
        ${t.tools.length ? html`<div class="card"><h3>Mjetet që duhen</h3><ul class="dots">${t.tools.map((x) => html`<li>${x}</li>`)}</ul></div>` : ''}
        ${t.tips.length ? html`<div class="card"><h3>Këshilla</h3><ul class="dots">${t.tips.map((x) => html`<li>${x}</li>`)}</ul></div>` : ''}
        <div class="card"><h3>Në këtë sektor</h3><ul class="side-links">${topicsOf(t.section).map((x) => html`<li><a href="#/tema/${x.slug}" class="${x.slug === t.slug ? 'on' : ''}">${x.title}</a></li>`)}</ul></div>
      </aside>
    </div></section>`;
}

function paywall(p) {
  const sec = p ? sectionOf(p.section) : null;
  return html`<section class="page-head"><div class="wrap">
    ${sec ? html`<a class="crumb" href="#/seksioni/${p.section}">← ${sec.title}</a>` : ''}
    <div class="topic-head"><div><div class="kicker">${sec?.kicker || ''}</div><h1>${p?.title || 'Mësim'}</h1><p class="lead">${p?.summary || ''}</p></div>
    ${p && thumbSvg({ diagram: p.diagram, slug: p.slug }) ? html`<div class="topic-head-art">${thumbSvg({ diagram: p.diagram, slug: p.slug })}</div>` : ''}</div>
  </div></section>
  <section class="section tight"><div class="wrap paywall">
    ${p?.intro ? html`<p class="intro">${p.intro}</p>` : ''}
    <div class="paywall-box">
      <div class="lock-big" aria-hidden="true">🔒</div>
      <h2>Ky mësim është për anëtarët</h2>
      <p class="muted">Procesi i plotë hap pas hapi, gabimet & zgjidhjet, fotot dhe videot hapen me abonimin mujor.</p>
      ${state.user ? html`<a class="btn" href="#/abonimi">Abonohu · ${S().price_label}</a>` : html`<div class="actions center"><a class="btn" href="#/regjistrohu">Krijo llogari</a><a class="btn ghost" href="#/hyr">Kam llogari</a></div>`}
    </div>
  </div></section>`;
}

async function viewLive() {
  const s = S();
  if (!state.user) {
    return html`<section class="page-head"><div class="wrap"><div class="kicker">Takime</div><h1>Live në Zoom</h1><p class="lead">${s.meeting_schedule}</p>
      <div class="actions"><a class="btn" href="#/abonimi">Abonohu</a><a class="btn ghost" href="#/hyr">Hyr</a></div></div></section>`;
  }
  const { meetings, access } = await api('GET', '/api/meetings');
  const now = Date.now();
  const upcoming = meetings.filter((m) => new Date(m.starts_at).getTime() + m.duration_min * 60e3 >= now).reverse();
  const past = meetings.filter((m) => !upcoming.includes(m));
  const card = (m, isPast) => html`<div class="meet ${isPast ? 'past' : ''}">
    <div class="meet-date"><span>${new Date(m.starts_at).toLocaleDateString('sq-AL', { day: 'numeric' })}</span><small>${new Date(m.starts_at).toLocaleDateString('sq-AL', { month: 'short' })}</small></div>
    <div class="meet-body"><h3>${m.title}</h3><p class="muted small">${fmtDate(m.starts_at)} · ${m.duration_min} min</p>${m.description ? html`<p>${m.description}</p>` : ''}
      ${!isPast && access ? html`<div class="actions">${m.join_url ? html`<a class="btn sm" href="${m.join_url}" target="_blank" rel="noopener noreferrer">Bashkohu në Zoom</a>` : html`<span class="muted small">Linku shtohet para takimit.</span>`}<a class="btn sm ghost" href="/api/meetings/${m.id}/ics">+ Kalendar</a></div>` : ''}
      ${isAdmin() ? html`<button class="link danger" data-act="del-meeting" data-id="${m.id}">Fshi</button>` : ''}
    </div></div>`;
  return html`<section class="page-head"><div class="wrap"><div class="kicker">Takime</div><h1>Live në Zoom</h1><p class="lead">${s.meeting_schedule}</p>
    ${isAdmin() ? html`<a class="btn sm ghost" href="#/admin/takimet">+ Planifiko takim</a>` : ''}</div></section>
    <section class="section tight"><div class="wrap narrow">
      ${!access ? html`<div class="banner">🔒 Linqet e takimeve shfaqen vetëm për anëtarët me abonim aktiv. <a href="#/abonimi">Abonohu</a></div>` : ''}
      <h2>Takimet e ardhshme</h2>
      ${upcoming.length ? upcoming.map((m) => card(m, false)) : html`<p class="muted">Takimi i radhës do të njoftohet këtu.</p>`}
      ${past.length ? html`<h2>Takimet e kaluara</h2>${past.map((m) => card(m, true))}` : ''}
    </div></section>`;
}

function authShell(title, sub, inner) {
  return html`<section class="section auth"><div class="wrap narrow-s"><div class="card">
    <h1>${title}</h1><p class="muted">${sub}</p>${inner}</div></div></section>`;
}

const viewLogin = () => authShell('Hyr në llogari', 'Mirë se u ktheve.', html`<form class="form" data-form="login">
  <label>Email<input name="email" type="email" required autocomplete="email"></label>
  <label>Fjalëkalimi<input name="password" type="password" required autocomplete="current-password"></label>
  <button class="btn wide">Hyr</button>
  <p class="small muted">S’ke llogari? <a href="#/regjistrohu">Regjistrohu</a> · Ke harruar fjalëkalimin? <a href="#/kontakt">Na kontakto</a> dhe do të të japim një fjalëkalim të ri.</p>
</form>`);

const viewRegister = () => authShell('Krijo llogari', 'Përdor të njëjtin email që do të përdorësh për pagesën.', html`<form class="form" data-form="register">
  <label>Emri dhe mbiemri<input name="name" required maxlength="80" autocomplete="name"></label>
  <label>Email<input name="email" type="email" required autocomplete="email"></label>
  <label>Fjalëkalimi (min. 8 karaktere)<input name="password" type="password" required minlength="8" autocomplete="new-password"></label>
  <label class="check"><input type="checkbox" name="acceptTerms" required> Kam lexuar dhe pranoj <a href="/kushtet" target="_blank">Kushtet e Përdorimit</a> dhe <a href="/privatesia" target="_blank">Politikën e Privatësisë</a>.</label>
  <label class="check"><input type="checkbox" name="ageConfirm" required> Jam të paktën 16 vjeç (nën 18 vjeç me lejen e prindit).</label>
  <button class="btn wide">Krijo llogarinë</button>
  <p class="small muted">Ke llogari? <a href="#/hyr">Hyr</a></p>
</form>`);

function viewSubscribe() {
  const s = S(), p = state.pub;
  if (hasAccess()) return html`<section class="section"><div class="wrap narrow-s"><div class="card center"><h1>Ke akses të plotë ✓</h1><p class="muted">Abonimi yt është aktiv.</p><a class="btn" href="#/seksioni/fade">Vazhdo mësimet</a></div></div></section>`;
  return html`<section class="section"><div class="wrap grid-2 center">
    <div>
      <div class="kicker">Abonimi</div><h1>Mëso me ritmin tënd</h1>
      <p class="lead">Një çmim mujor, akses në gjithçka. Anulo kur të duash.</p>
      <ol class="steps-3 vertical">
        <li><strong>${state.user ? 'Llogaria ✓' : 'Krijo llogari'}</strong><span>${state.user ? state.user.email : 'Me emrin dhe email-in.'}</span></li>
        <li><strong>Paguaj te ${p.provider === 'stripe' ? 'Stripe' : 'Whop'}</strong><span>Me <b>të njëjtin email</b>${state.user ? html` (<b>${state.user.email}</b>)` : ''}. Ne nuk shohim të dhënat e kartës.</span></li>
        <li><strong>Akses automatik</strong><span>Pas pagesës kthehu këtu dhe rifresko faqen.</span></li>
      </ol>
    </div>
    <div class="price-card">
      <div class="kicker">Abonim mujor</div><div class="price">${s.price_label}</div>
      ${state.user ? html`<form class="form" data-form="checkout">
          <label class="check"><input type="checkbox" name="waiver" required> Kërkoj që aksesi në përmbajtjen digjitale të fillojë menjëherë dhe pranoj që kështu humbas të drejtën e tërheqjes 14-ditore. Abonimi rinovohet çdo muaj derisa ta anuloj.</label>
          <label class="check"><input type="checkbox" name="terms" required> Pranoj <a href="/kushtet" target="_blank">Kushtet</a>.</label>
          <button class="btn wide">Vazhdo te pagesa →</button>
        </form>`
      : html`<a class="btn wide" href="#/regjistrohu">Krijo llogari për të vazhduar</a><p class="small muted center">Ke llogari? <a href="#/hyr">Hyr</a></p>`}
    </div>
  </div></section>`;
}

function viewAccount(query) {
  const u = state.user;
  if (!u) { location.hash = '#/hyr'; return ''; }
  const sub = u.subscription;
  const status = u.role === 'admin' ? 'Administrator' : u.access ? (u.manual_access && !(sub?.status === 'active') ? 'Akses i dhënë nga administratori' : 'Aktiv') : 'Joaktiv';
  return html`<section class="page-head"><div class="wrap"><div class="kicker">Llogaria ime</div><h1>${u.name}</h1><p class="muted">${u.email}</p></div></section>
  <section class="section tight"><div class="wrap grid-2">
    <div class="card">
      ${query.get('pagesa') === 'ok' ? html`<div class="banner ok">Faleminderit! Nëse aksesi nuk është aktivizuar ende, rifresko faqen pas pak sekondash.</div>` : ''}
      <h3>Abonimi</h3>
      <p><span class="badge ${u.access ? 'on' : 'off'}">${status}</span></p>
      ${sub?.current_period_end ? html`<p class="small muted">Rinovohet/skadon më: ${fmtDate(new Date(sub.current_period_end * 1000).toISOString(), false)}</p>` : ''}
      <div class="actions">
        ${!u.access ? html`<a class="btn" href="#/abonimi">Abonohu</a>` : ''}
        ${sub ? html`<button class="btn ghost" data-act="billing">Menaxho / anulo abonimin</button>` : ''}
        <button class="btn ghost" data-act="refresh-me">Rifresko statusin</button>
      </div>
      ${!u.access && u.role !== 'admin' ? html`<p class="small muted">Ke paguar por nuk ke akses? Sigurohu që ke përdorur të njëjtin email (${u.email}) te pagesa, ose <a href="#/kontakt">na kontakto</a>.</p>` : ''}
    </div>
    <form class="card form" data-form="password">
      <h3>Ndrysho fjalëkalimin</h3>
      <label>Fjalëkalimi aktual<input name="currentPassword" type="password" required autocomplete="current-password"></label>
      <label>Fjalëkalimi i ri<input name="newPassword" type="password" required minlength="8" autocomplete="new-password"></label>
      <button class="btn ghost">Ruaj</button>
    </form>
    <div class="card">
      <h3>Të dhënat e mia</h3>
      <p class="small muted">Sipas ligjit për mbrojtjen e të dhënave ke të drejtë t’i shkarkosh ose t’i fshish.</p>
      <div class="actions"><a class="btn ghost" href="/api/me/export">Shkarko të dhënat (JSON)</a><button class="btn ghost" data-act="logout">Dil</button></div>
    </div>
    ${u.role !== 'admin' ? html`<form class="card form danger-zone" data-form="delete-account">
      <h3>Fshi llogarinë</h3>
      <p class="small muted">Llogaria fshihet përgjithmonë. ${state.pub.provider === 'stripe' ? 'Abonimi Stripe anulohet automatikisht.' : 'Abonimin te Whop anuloje edhe atje (Menaxho abonimin).'}</p>
      <label>Konfirmo me fjalëkalim<input name="password" type="password" required autocomplete="current-password"></label>
      <button class="btn danger">Fshi llogarinë</button>
    </form>` : ''}
  </div></section>`;
}

function viewContact() {
  return html`<section class="page-head"><div class="wrap"><div class="kicker">Kontakt</div><h1>Na kontakto</h1></div></section>${contactBlock()}`;
}

const viewNotFound = () => html`<section class="section"><div class="wrap narrow-s center"><h1>Faqja nuk u gjet</h1><a class="btn" href="#/">Kthehu në kreu</a></div></section>`;

// ───────────────────────── Paneli i administratorit ─────────────────────────
const ADMIN_TABS = [['ngarko', 'Ngarko'], ['media', 'Media'], ['temat', 'Mësimet'], ['takimet', 'Takimet'], ['anetaret', 'Anëtarët'], ['mesazhet', 'Mesazhet'], ['cilesimet', 'Cilësimet']];

function topicOptions(selected) {
  const groups = state.pub.sections.map((sec) => html`<optgroup label="${sec.title}">${state.admin.topics.filter((t) => t.section === sec.key)
    .map((t) => html`<option value="${t.id}" ${String(selected) === String(t.id) ? 'selected' : ''}>${t.title}</option>`)}</optgroup>`);
  return html`${groups}`;
}
const tagOptions = (sel) => Object.entries(TAGS).map(([k, v]) => html`<option value="${k}" ${sel === k ? 'selected' : ''}>${v}</option>`);

async function viewAdmin(tab = 'ngarko', query) {
  if (!isAdmin()) { location.hash = '#/hyr'; return ''; }
  state.admin = await api('GET', '/api/admin/overview');
  const A = state.admin;
  const nav = html`<nav class="tabs">${ADMIN_TABS.map(([k, v]) => html`<a href="#/admin/${k}" class="${tab === k ? 'on' : ''}">${v}${k === 'mesazhet' && A.stats.unread ? html` <span class="pill">${A.stats.unread}</span>` : ''}</a>`)}</nav>`;
  let body = '';

  if (tab === 'ngarko') {
    body = html`<form class="card form" data-form="upload">
      <h3>Ngarko foto ose video</h3>
      <p class="small muted">Vetëm ti (administratori) mund të ngarkosh. Anëtarët vetëm i shohin. Formatet: JPG, PNG, WEBP, GIF, MP4, WEBM, MOV — deri në ${A.config.maxUploadMb} MB për skedar. Fotot e iPhone (HEIC) ruaji si JPG.</p>
      <label>Mësimi (p.sh. Low Fade, Burst Fade, Shtresat…)<select name="topic_id" required>${topicOptions(query.get('topic'))}</select></label>
      <div class="grid-2 tight">
        <label>Etiketa<select name="tag">${tagOptions('shembull')}</select></label>
        <label>Titulli (opsional)<input name="title" maxlength="120" placeholder="p.sh. Mid fade — pamje nga pas"></label>
      </div>
      <label>Përshkrimi (opsional)<textarea name="description" rows="2" maxlength="2000" placeholder="Çfarë duhet të vërejë anëtari në këtë foto/video?"></textarea></label>
      <label class="drop">Zgjidh skedarët<input name="files" type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" required></label>
      <div class="progress" hidden><div></div><span></span></div>
      <button class="btn">Ngarko</button>
    </form>`;
  } else if (tab === 'media') {
    const topicName = (id) => A.topics.find((t) => t.id === id)?.title || 'E përgjithshme';
    body = html`<div class="admin-media">${A.media.length ? A.media.map((m) => html`<form class="card media-row" data-form="media-edit" data-id="${m.id}">
        <div class="thumb">${m.kind === 'video' ? html`<video src="${m.url}" preload="metadata" muted></video>` : html`<img src="${m.url}" alt="" loading="lazy">`}</div>
        <div class="form">
          <div class="small muted">${m.kind === 'video' ? 'Video' : 'Foto'} · ${fmtSize(m.size)} · ${topicName(m.topic_id)}</div>
          <input name="title" value="${m.title}" maxlength="120" aria-label="Titulli">
          <div class="grid-2 tight"><select name="topic_id" aria-label="Mësimi">${topicOptions(m.topic_id)}</select><select name="tag" aria-label="Etiketa">${tagOptions(m.tag)}</select></div>
          <textarea name="description" rows="2" maxlength="2000" aria-label="Përshkrimi">${m.description}</textarea>
          <div class="actions"><button class="btn sm">Ruaj</button><button type="button" class="btn sm danger" data-act="del-media" data-id="${m.id}">Fshi</button></div>
        </div></form>`) : html`<p class="muted">Ende nuk ke ngarkuar asgjë. <a href="#/admin/ngarko">Ngarko tani →</a></p>`}</div>`;
  } else if (tab === 'temat') {
    const editId = query.get('edit');
    const newSec = query.get('new');
    const t = editId ? A.topics.find((x) => String(x.id) === editId) : null;
    if (t || newSec !== null) {
      const v = t || { section: newSec || 'fade', title: '', summary: '', intro: '', diagram: '', steps: [], tools: [], tips: [], mistakes: [] };
      body = html`<form class="card form" data-form="topic" data-id="${t ? t.id : ''}">
        <h3>${t ? `Edito: ${t.title}` : 'Mësim i ri'}</h3>
        <div class="grid-2 tight">
          <label>Sektori<select name="section">${state.pub.sections.map((s) => html`<option value="${s.key}" ${v.section === s.key ? 'selected' : ''}>${s.title}</option>`)}</select></label>
          <label>Diagrami i fade-it<select name="diagram"><option value="">— Pa diagram —</option>${Object.entries(DIAGRAMS).map(([k, n]) => html`<option value="${k}" ${v.diagram === k ? 'selected' : ''}>${n}</option>`)}</select></label>
        </div>
        <label>Titulli<input name="title" required maxlength="120" value="${v.title}"></label>
        <label>Përmbledhja (shfaqet edhe për jo-anëtarët)<textarea name="summary" rows="2" maxlength="400">${v.summary}</textarea></label>
        <label>Hyrja<textarea name="intro" rows="3" maxlength="4000">${v.intro}</textarea></label>
        <label>Procesi — një hap për rresht<textarea name="steps" rows="8">${v.steps.join('\n')}</textarea></label>
        <label>Gabimet & zgjidhjet — një për rresht: <code>Gabimi | Zgjidhja</code><textarea name="mistakes" rows="6">${v.mistakes.map((m) => `${m.problem} | ${m.solution}`).join('\n')}</textarea></label>
        <div class="grid-2 tight">
          <label>Mjetet — një për rresht<textarea name="tools" rows="5">${v.tools.join('\n')}</textarea></label>
          <label>Këshilla — një për rresht<textarea name="tips" rows="5">${v.tips.join('\n')}</textarea></label>
        </div>
        <div class="actions"><button class="btn">Ruaj</button><a class="btn ghost" href="#/admin/temat">Anulo</a>
        ${t ? html`<button type="button" class="btn danger" data-act="del-topic" data-id="${t.id}">Fshi mësimin</button>` : ''}</div>
      </form>`;
    } else {
      body = html`<div class="actions">${state.pub.sections.map((s) => html`<a class="btn sm ghost" href="#/admin/temat?new=${s.key}">+ ${s.title}</a>`)}</div>
      ${state.pub.sections.map((s) => html`<h3 class="sub">${s.title}</h3><div class="list">${A.topics.filter((t) => t.section === s.key).map((t) => html`<div class="list-row">
        <a href="#/tema/${t.slug}">${t.title}</a><span class="muted small">${A.media.filter((m) => m.topic_id === t.id).length} media</span>
        <a class="btn sm ghost" href="#/admin/temat?edit=${t.id}">Edito</a><a class="btn sm ghost" href="#/admin/ngarko?topic=${t.id}">Ngarko</a></div>`)}</div>`)}`;
    }
  } else if (tab === 'takimet') {
    body = html`<div class="grid-2">
      <form class="card form" data-form="meeting">
        <h3>Planifiko takim Zoom</h3>
        <label>Titulli<input name="title" required maxlength="160" placeholder="p.sh. Takimi mujor — pyetje & përgjigje"></label>
        <div class="grid-2 tight"><label>Data dhe ora<input name="starts_at" type="datetime-local" required></label>
        <label>Kohëzgjatja (min)<input name="duration_min" type="number" min="10" max="600" value="60"></label></div>
        <label>Linku i Zoom<input name="join_url" type="url" placeholder="https://zoom.us/j/…"></label>
        <label>Përshkrimi<textarea name="description" rows="3" maxlength="3000"></textarea></label>
        <button class="btn">Shto takimin</button>
        <p class="small muted">Linku shihet vetëm nga anëtarët me abonim aktiv. Teksti i orarit (“një herë në muaj…”) ndryshohet te Cilësimet.</p>
      </form>
      <div class="card"><h3>Takimet</h3>${A.meetings.length ? A.meetings.map((m) => html`<div class="list-row"><div><strong>${m.title}</strong><div class="small muted">${fmtDate(m.starts_at)}</div></div><button class="btn sm danger" data-act="del-meeting" data-id="${m.id}">Fshi</button></div>`) : html`<p class="muted">Asnjë takim.</p>`}</div>
    </div>`;
  } else if (tab === 'anetaret') {
    body = html`<div class="card"><p class="muted small">${A.stats.members} anëtarë · ${A.stats.active} me akses aktiv. “Akses manual” jep akses pa pagesë (p.sh. për miq, nxënës ose kur pagesa është bërë me një email tjetër).</p>
      <div class="table-wrap"><table class="table"><thead><tr><th>Emri</th><th>Email</th><th>Regjistruar</th><th>Statusi</th><th></th></tr></thead><tbody>
      ${A.users.map((u) => html`<tr><td>${u.name}${u.role === 'admin' ? ' (admin)' : ''}</td><td>${u.email}</td><td>${fmtDate(u.created_at.replace(' ', 'T') + 'Z', false)}</td>
        <td><span class="badge ${u.access ? 'on' : 'off'}">${u.access ? 'Aktiv' : 'Joaktiv'}</span>${u.subscription ? html` <span class="small muted">${u.subscription.provider}</span>` : ''}</td>
        <td class="row-actions">${u.role !== 'admin' ? html`<button class="btn sm ghost" data-act="toggle-access" data-id="${u.id}" data-v="${u.manual_access ? 0 : 1}">${u.manual_access ? 'Hiq aksesin manual' : 'Jep akses manual'}</button>
          <button class="btn sm ghost" data-act="reset-pw" data-id="${u.id}">Fjalëkalim i ri</button><button class="btn sm danger" data-act="del-user" data-id="${u.id}">Fshi</button>` : ''}</td></tr>`)}
      </tbody></table></div></div>`;
  } else if (tab === 'mesazhet') {
    body = html`<div class="list">${A.messages.length ? A.messages.map((m) => html`<div class="card msg ${m.is_read ? '' : 'unread'}">
      <div class="msg-head"><strong>${m.name}</strong><a href="mailto:${m.email}">${m.email}</a>${m.phone ? html`<a href="${telHref(m.phone)}">${m.phone}</a>` : ''}<span class="muted small">${fmtDate(m.created_at.replace(' ', 'T') + 'Z')}</span></div>
      <p class="pre">${m.message}</p>
      <div class="actions"><button class="btn sm ghost" data-act="read-msg" data-id="${m.id}" data-v="${m.is_read ? 0 : 1}">${m.is_read ? 'Shëno si të palexuar' : 'Shëno si të lexuar'}</button><button class="btn sm danger" data-act="del-msg" data-id="${m.id}">Fshi</button></div>
    </div>`) : html`<p class="muted">Asnjë mesazh.</p>`}</div>`;
  } else if (tab === 'cilesimet') {
    const s = A.settings, c = A.config;
    const f = (k, label, type = 'text', ph = '') => html`<label>${label}<input name="${k}" type="${type}" value="${s[k] || ''}" placeholder="${ph}"></label>`;
    body = html`<div class="grid-2">
      <form class="card form" data-form="settings">
        <h3>Të dhënat e faqes</h3>
        ${f('brand_name', 'Emri i akademisë')}
        ${f('owner_name', 'Emri yt')}
        ${f('tagline', 'Slogani')}
        <label>Rreth meje<textarea name="about" rows="3">${s.about}</textarea></label>
        <h3>Kontakti (shfaqet publikisht)</h3>
        ${f('phone', 'Numri i telefonit', 'tel', '+355 6X XXX XXXX')}
        ${f('email', 'Email', 'email')}
        ${f('whatsapp', 'WhatsApp (numri)', 'tel')}
        ${f('instagram', 'Instagram', 'text', '@emri')}
        ${f('city', 'Qyteti')}
        <h3>Abonimi & takimet</h3>
        ${f('price_label', 'Çmimi (si shfaqet)', 'text', '€15 / muaj')}
        ${c.provider === 'whop' ? html`${f('checkout_url', 'Linku i checkout-it Whop', 'url', 'https://whop.com/checkout/...')}${f('manage_url', 'Linku ku anëtari menaxhon abonimin', 'url', 'https://whop.com/...')}` : ''}
        ${f('meeting_schedule', 'Orari i takimeve Zoom (tekst)')}
        <h3>Për faqet ligjore</h3>
        ${f('legal_entity', 'Emri ligjor / biznesi (NIPT nëse ke)', 'text', s.owner_name)}
        ${f('legal_address', 'Adresa')}
        <button class="btn">Ruaj cilësimet</button>
      </form>
      <div class="card">
        <h3>Pagesat</h3>
        <p>Ofruesi: <strong>${c.provider === 'stripe' ? 'Stripe' : 'Whop'}</strong></p>
        ${c.provider === 'whop' ? html`<ol class="small">
            <li>Te Whop krijo produktin me <b>abonim mujor</b> dhe kopjo linkun e checkout-it në fushën majtas.</li>
            <li>Te Whop → Developer → Webhooks shto URL-në:<br><code>${c.baseUrl}/webhooks/whop</code><br>me eventet e anëtarësimit (membership valid / invalid).</li>
            <li>Kopjo sekretin e webhook-ut te <code>.env</code> → <code>WHOP_WEBHOOK_SECRET</code>. Statusi: <b>${c.whopWebhook ? '✓ i vendosur' : '✗ mungon'}</b></li>
            <li>Nëse dikush paguan me email tjetër, jepi “Akses manual” te Anëtarët.</li></ol>`
        : html`<p class="small">Stripe: ${c.stripeReady ? '✓ i konfiguruar' : '✗ plotëso STRIPE_SECRET_KEY, STRIPE_PRICE_ID, STRIPE_WEBHOOK_SECRET te .env'}.<br>Webhook: <code>${c.baseUrl}/webhooks/stripe</code></p>`}
        <h3>Faqet ligjore</h3>
        <p class="small"><a href="/privatesia" target="_blank">Privatësia</a> · <a href="/kushtet" target="_blank">Kushtet</a> · <a href="/cookies" target="_blank">Cookies</a> — plotësohen automatikisht me të dhënat e tua.</p>
      </div>
    </div>`;
  }

  return html`<section class="page-head"><div class="wrap"><div class="kicker">Administratori</div><h1>Paneli</h1>
    <p class="muted">${A.stats.members} anëtarë · ${A.stats.active} aktivë · ${A.media.length} media · ${A.topics.length} mësime</p>${nav}</div></section>
    <section class="section tight"><div class="wrap">${body}</div></section>`;
}

// ───────────────────────── Router ─────────────────────────
const ROUTES = [
  [/^\/$/, () => viewHome()],
  [/^\/seksioni\/([\w-]+)$/, (m) => viewSection(m[1])],
  [/^\/tema\/([\w-]+)$/, (m) => viewTopic(m[1])],
  [/^\/live$/, () => viewLive()],
  [/^\/hyr$/, () => (state.user ? (location.hash = '#/llogaria', '') : viewLogin())],
  [/^\/regjistrohu$/, () => (state.user ? (location.hash = '#/abonimi', '') : viewRegister())],
  [/^\/abonimi$/, () => viewSubscribe()],
  [/^\/llogaria$/, (_m, q) => viewAccount(q)],
  [/^\/kontakt$/, () => viewContact()],
  [/^\/admin(?:\/(\w+))?$/, (m, q) => viewAdmin(m[1] || 'ngarko', q)],
];

let routeToken = 0;
async function route() {
  const token = ++routeToken;
  const [path, qs] = (location.hash.slice(1) || '/').split('?');
  const query = new URLSearchParams(qs || '');
  const main = $('#main');
  let view = viewNotFound;
  let match;
  for (const [re, fn] of ROUTES) { match = path.match(re); if (match) { view = fn; break; } }
  $('#nav')?.classList.remove('open');
  try {
    const result = await view(match, query);
    if (token !== routeToken) return;
    main.innerHTML = out(result);
  } catch (e) {
    if (token !== routeToken) return;
    main.innerHTML = out(html`<section class="section"><div class="wrap narrow-s center"><h1>Diçka shkoi keq</h1><p class="muted">${e.message}</p><a class="btn" href="#/">Kreu</a></div></section>`);
  }
  markNav(path);
  if (!route.keepScroll) window.scrollTo(0, 0);
  route.keepScroll = false;
  document.title = `${(main.querySelector('h1')?.textContent || '').trim()} · ${S().brand_name}`.replace(/^ · /, '');
}

async function refresh(keepScroll = true) {
  state.pub = await api('GET', '/api/public');
  state.user = state.pub.user;
  renderChrome();
  route.keepScroll = keepScroll;
  await route();
}

// ───────────────────────── Veprimet ─────────────────────────
const formData = (form) => {
  const o = {};
  for (const el of form.elements) {
    if (!el.name || el.type === 'file') continue;
    o[el.name] = el.type === 'checkbox' ? el.checked : el.value;
  }
  return o;
};

const FORMS = {
  async login(f, d) { await api('POST', '/api/login', d); location.hash = '#/llogaria'; await refresh(false); toast('Mirë se erdhe!'); },
  async register(f, d) { await api('POST', '/api/register', d); location.hash = '#/abonimi'; await refresh(false); toast('Llogaria u krijua.'); },
  async contact(f, d) { await api('POST', '/api/contact', d); f.reset(); toast('Mesazhi u dërgua. Do të të përgjigjemi së shpejti.'); },
  async checkout() { const { url } = await api('POST', '/api/checkout'); location.href = url; },
  async password(f, d) { await api('POST', '/api/me/password', d); f.reset(); toast('Fjalëkalimi u ndryshua.'); },
  async 'delete-account'(f, d) {
    if (!confirm('Je i sigurt? Llogaria fshihet përgjithmonë.')) return;
    await api('DELETE', '/api/me', d); location.hash = '#/'; await refresh(false); toast('Llogaria u fshi.');
  },
  async topic(f, d) {
    const id = f.dataset.id;
    const { topic } = await api(id ? 'PUT' : 'POST', id ? `/api/admin/topics/${id}` : '/api/admin/topics', d);
    toast('Mësimi u ruajt.');
    location.hash = `#/tema/${topic.slug}`;
    await refresh(false);
  },
  async meeting(f, d) {
    d.starts_at = new Date(d.starts_at).toISOString();
    await api('POST', '/api/admin/meetings', d); toast('Takimi u shtua.'); await refresh();
  },
  async settings(f, d) { await api('PUT', '/api/admin/settings', d); toast('Cilësimet u ruajtën.'); await refresh(); },
  async 'media-edit'(f, d) { await api('PATCH', `/api/admin/media/${f.dataset.id}`, d); toast('U ruajt.'); await refresh(); },
  upload(f, d) {
    const input = f.elements.files;
    if (!input.files.length) throw new Error('Zgjidh të paktën një skedar.');
    const fd = new FormData();
    for (const [k, v] of Object.entries(d)) fd.append(k, v);
    for (const file of input.files) fd.append('files', file);
    const bar = $('.progress', f);
    bar.hidden = false;
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/admin/media');
      xhr.setRequestHeader('X-Requested-With', 'fetch');
      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return;
        const p = Math.round((e.loaded / e.total) * 100);
        $('div', bar).style.width = `${p}%`;
        $('span', bar).textContent = `${p}% · ${fmtSize(e.loaded)} / ${fmtSize(e.total)}`;
      };
      xhr.onload = async () => {
        let res = {};
        try { res = JSON.parse(xhr.responseText); } catch { /* */ }
        if (xhr.status >= 300) return reject(new Error(res.error || 'Ngarkimi dështoi.'));
        toast(`U ngarkuan ${res.created.length} skedarë${res.rejected.length ? ` · ${res.rejected.length} u refuzuan (format i pavlefshëm)` : ''}.`);
        const topic = state.admin.topics.find((t) => String(t.id) === d.topic_id);
        if (topic) location.hash = `#/tema/${topic.slug}`;
        await refresh(!topic);
        resolve();
      };
      xhr.onerror = () => reject(new Error('Lidhja u ndërpre gjatë ngarkimit.'));
      xhr.send(fd);
    });
  },
};

const ACTS = {
  menu(el) { const n = $('#nav'); n.classList.toggle('open'); el.setAttribute('aria-expanded', n.classList.contains('open')); },
  'cookie-ok'() { try { localStorage.setItem('ba_cookie_ok', '1'); } catch { /* */ } $('#cookie').hidden = true; },
  scroll(el) { document.getElementById(el.dataset.target)?.scrollIntoView({ behavior: 'smooth' }); },
  async logout() { await api('POST', '/api/logout'); location.hash = '#/'; await refresh(false); },
  async billing() { const { url } = await api('POST', '/api/billing'); window.open(url, '_blank', 'noopener'); },
  async 'refresh-me'() { await refresh(); toast(hasAccess() ? 'Abonimi është aktiv ✓' : 'Ende pa abonim aktiv.', hasAccess() ? 'ok' : 'warn'); },
  filter(el) {
    $$('.filters .chip').forEach((c) => c.classList.toggle('on', c === el));
    const f = el.dataset.f;
    $$('.gallery .media-item').forEach((m) => {
      m.hidden = !(f === 'all' || m.dataset.kind === f || (f.startsWith('tag:') && m.dataset.tag === f.slice(4)));
    });
  },
  lightbox(el) {
    const lb = $('#lightbox');
    lb.innerHTML = out(html`<button class="lb-close" data-act="lb-close" aria-label="Mbyll">×</button><figure><img src="${el.dataset.src}" alt="${el.dataset.title}"><figcaption>${el.dataset.title}</figcaption></figure><span class="wm" aria-hidden="true">${state.user?.email || ''}</span>`);
    lb.hidden = false;
  },
  'lb-close'() { $('#lightbox').hidden = true; $('#lightbox').innerHTML = ''; },
  async 'del-media'(el) { if (!confirm('Ta fshij këtë foto/video?')) return; await api('DELETE', `/api/admin/media/${el.dataset.id}`); toast('U fshi.'); await refresh(); },
  async 'del-topic'(el) { if (!confirm('Ta fshij këtë mësim bashkë me fotot/videot e tij?')) return; await api('DELETE', `/api/admin/topics/${el.dataset.id}`); location.hash = '#/admin/temat'; await refresh(false); },
  async 'del-meeting'(el) { if (!confirm('Ta fshij takimin?')) return; await api('DELETE', `/api/admin/meetings/${el.dataset.id}`); await refresh(); },
  async 'toggle-access'(el) { await api('PATCH', `/api/admin/users/${el.dataset.id}`, { manual_access: el.dataset.v === '1' }); await refresh(); },
  async 'reset-pw'(el) {
    if (!confirm('Të krijohet një fjalëkalim i ri i përkohshëm për këtë anëtar?')) return;
    const { password } = await api('POST', `/api/admin/users/${el.dataset.id}/reset-password`);
    prompt('Fjalëkalimi i ri (dërgoja anëtarit; ai mund ta ndryshojë te Llogaria):', password);
  },
  async 'del-user'(el) { if (!confirm('Ta fshij këtë anëtar përgjithmonë?')) return; await api('DELETE', `/api/admin/users/${el.dataset.id}`); await refresh(); },
  async 'read-msg'(el) { await api('PATCH', `/api/admin/messages/${el.dataset.id}`, { is_read: el.dataset.v === '1' }); await refresh(); },
  async 'del-msg'(el) { if (!confirm('Ta fshij mesazhin?')) return; await api('DELETE', `/api/admin/messages/${el.dataset.id}`); await refresh(); },
};

document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) {
    if (e.target.id === 'lightbox') ACTS['lb-close']();
    return;
  }
  e.preventDefault();
  try { await ACTS[el.dataset.act]?.(el); } catch (err) { toast(err.message, 'err'); }
});

document.addEventListener('submit', async (e) => {
  const f = e.target.closest('form[data-form]');
  if (!f) return;
  e.preventDefault();
  if (!f.checkValidity()) { f.reportValidity(); return; }
  const btn = f.querySelector('button:not([type="button"])');
  btn && (btn.disabled = true);
  try { await FORMS[f.dataset.form](f, formData(f)); } catch (err) { toast(err.message, 'err'); } finally { btn && (btn.disabled = false); }
});

document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#lightbox').hidden) ACTS['lb-close'](); });
// Mbrojtje e lehtë kundër shkarkimit të thjeshtë të fotove/videove
document.addEventListener('contextmenu', (e) => { if (e.target.closest('.gallery, .lightbox')) e.preventDefault(); });
document.addEventListener('dragstart', (e) => { if (e.target.closest('.gallery, .lightbox')) e.preventDefault(); });

window.addEventListener('hashchange', route);
refresh(false).catch((e) => { $('#main').innerHTML = out(html`<div class="wrap section"><h1>Serveri nuk përgjigjet</h1><p>${e.message}</p></div>`); });
