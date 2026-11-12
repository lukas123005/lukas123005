# Barber Academy — platformë mësimore për barberë me abonim mujor

Faqe web e plotë (frontend + backend): fade-t, flokët e gjata, mjetet e punës, gabimet & zgjidhjet,
takime live në Zoom, kontakt, abonim mujor (Whop ose Stripe) dhe panel administratori ku **vetëm ti** ngarkon foto/video.

## Nisja lokale
```bash
cp .env.example .env      # plotëso ADMIN_EMAIL dhe ADMIN_PASSWORD (min. 10 karaktere)
npm install
npm start                 # http://localhost:3000
```
Kërkon Node.js 22.13 ose më të ri (databaza SQLite është e integruar në Node — s’ka nevojë për server tjetër).

Hyr me email-in e administratorit → **Paneli**:
- **Ngarko** — foto/video për çdo mësim (Low Fade, Mid Fade, Burst, Shtresat, Gërshërët…), me etiketë: Para / Pas / Gabim / Zgjidhje / Procesi.
- **Media** — ndrysho titullin, mësimin, etiketën ose fshi.
- **Mësimet** — ndrysho tekstet (procesi, gabimet | zgjidhjet, mjetet, këshillat) ose shto mësime të reja.
- **Takimet** — planifiko takime Zoom (linku shihet vetëm nga abonentët).
- **Anëtarët** — statusi i abonimit, akses manual, fjalëkalim i ri, fshirje.
- **Mesazhet** — mesazhet nga formulari i kontaktit.
- **Cilësimet** — emri, telefoni, email-i, WhatsApp, Instagram, çmimi, linku i Whop, të dhënat për faqet ligjore.

## Abonimi mujor
**Whop (parazgjedhur):** krijo produkt me abonim mujor → vendos linkun e checkout-it te Cilësimet →
te Whop shto webhook `https://FAQJA-JOTE/webhooks/whop` (eventet e membership) → sekretin vendose te `.env` si `WHOP_WEBHOOK_SECRET`.
Aksesi lidhet me email-in: anëtari paguan me të njëjtin email me të cilin u regjistrua. Nëse ndryshon, jepi “Akses manual”.

**Stripe (alternativë):** `PAYMENT_PROVIDER=stripe` dhe plotëso `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`;
webhook `https://FAQJA-JOTE/webhooks/stripe` me `checkout.session.completed` dhe `customer.subscription.*`.

## Publikimi (hosting)
Duhet një server Node me **disk të përhershëm** (për databazën dhe videot): VPS, Railway, Render, Fly.io etj.
Me Docker: `docker build -t barber . && docker run -p 3000:3000 -v barber-data:/data --env-file .env barber`.
Në prodhim: HTTPS i detyrueshëm, `COOKIE_SECURE=1`, `BASE_URL=https://domeni-yt`. Bëj backup të rregullt të dosjes `DATA_DIR`.

## Privatësia dhe siguria
- Faqet: `/privatesia`, `/kushtet`, `/cookies` (Ligji 124/2024 + GDPR, e drejta e autorit, abonimi, tërheqja). Janë model i mirë,
  por **kontrolloji me një jurist** para publikimit.
- Vetëm një cookie e nevojshme; pa reklama, pa analitikë, pa shkronja/skripte nga palë të treta.
- Fjalëkalime me scrypt, mbrojtje CSRF, kufizim përpjekjesh, CSP strikte, kontroll i llojit real të skedarëve.
- Foto/video shërbehen vetëm për abonentët aktivë, me email-in e anëtarit si watermark. (Asnjë faqe s’mund ta ndalojë 100% regjistrimin e ekranit.)
- Anëtari mund të shkarkojë ose fshijë të dhënat e veta te “Llogaria ime”.
