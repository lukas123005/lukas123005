// Builds the PDF buyers get in the zip: one big button that opens the BOOM 14 Barber app.
// Usage: node make_delivery_pdf.js https://emri-yt.netlify.app
const { chromium } = require('playwright');
const path = require('path');

const url = process.argv[2];
if (!url || !/^https:\/\//.test(url)) { console.error('Jep linkun: node make_delivery_pdf.js https://...'); process.exit(1); }

const html = `<!doctype html><html lang="sq"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,800&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<style>
@page{size:A4;margin:0}
*{box-sizing:border-box;margin:0;padding:0}
body{width:210mm;height:297mm;background:#14111C;color:#fff;font-family:Inter,sans-serif;padding:22mm 18mm;position:relative}
.pole{position:absolute;left:0;right:0;top:0;height:6mm;background:repeating-linear-gradient(-45deg,#E63946 0 6mm,#fff 6mm 12mm,#3A86FF 12mm 18mm,#fff 18mm 24mm)}
.badge{display:inline-block;font-size:10pt;font-weight:700;letter-spacing:.14em;border:1px solid rgba(255,255,255,.2);padding:2mm 4mm;border-radius:99px;margin-top:6mm}
h1{font:800 46pt "Bricolage Grotesque",sans-serif;line-height:.95;margin:8mm 0 4mm}
h1 span{color:#E63946}
.lead{font-size:13pt;color:#D9D4E3;max-width:150mm}
a.btn{display:block;margin:14mm 0 4mm;background:linear-gradient(120deg,#E63946,#FF6B5E 45%,#F1C27D);color:#fff;text-decoration:none;text-align:center;font:800 22pt "Bricolage Grotesque",sans-serif;padding:9mm;border-radius:6mm}
.url{text-align:center;font-size:10.5pt;color:#B9B2C7;word-break:break-all}
.url a{color:#F1C27D}
h2{font:800 15pt "Bricolage Grotesque",sans-serif;margin:14mm 0 4mm}
ol{padding-left:6mm;font-size:12pt;line-height:1.6;color:#EDE9F5}
li{margin-bottom:2mm}
.tip{margin-top:10mm;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:4mm;padding:5mm;font-size:11pt;color:#D9D4E3}
.tip b{color:#F1C27D}
.foot{position:absolute;left:18mm;right:18mm;bottom:14mm;font-size:9pt;color:#8F879E}
</style></head><body><div class="pole"></div>
<span class="badge">CREATOR LAB · LUKA SHEHU</span>
<h1>BOOM 14<br><span>Barber.</span></h1>
<p class="lead">Faleminderit për blerjen! Aplikacioni yt është gati. Prek butonin më poshtë dhe krijo 14 ditët e tua të postimeve.</p>
<a class="btn" href="${url}">HAP BOOM 14 BARBER →</a>
<p class="url">Nëse butoni nuk hapet, kopjo këtë link në browser: <a href="${url}">${url}</a></p>
<h2>Si ta përdorësh</h2>
<ol>
<li>Shkruaj emrin e berberisë dhe qytetin.</li>
<li>Shtyp <b>BOOM</b>: dalin 14 ditë me çfarë të filmosh, tekstin në ekran dhe caption-in.</li>
<li>Çdo ditë: filmo 3 pamjet, kopjo caption-in dhe posto.</li>
</ol>
<div class="tip"><b>Këshillë:</b> hape linkun në Safari ose Chrome dhe zgjidh “Shto në ekranin kryesor” (Add to Home Screen), që ta kesh si aplikacion në telefon. Të dhënat ruhen vetëm në pajisjen tënde.</div>
<p class="foot">Ndihmë: Instagram @barber_luka__ · Për përdorim nga blerësi për biznesin e vet ose të klientëve të tij. Nuk lejohet rishitja.</p>
</body></html>`;

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.setContent(html, { waitUntil: 'networkidle' });
  const out = path.join(__dirname, 'HAP_BOOM_14_Barber.pdf');
  await p.pdf({ path: out, format: 'A4', printBackground: true });
  await b.close();
  console.log('ok:', out, '->', url);
})();
