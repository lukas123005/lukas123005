"""Builds the designed eBook: book.html -> Quit_in_30_Days_eBook.pdf (6 x 9 in).

    python3 build.py && node pdf.js
"""
import html
import os

from days import BOOST, DAYS, MILESTONES

HERE = os.path.dirname(os.path.abspath(__file__))
E = html.escape

CSS = r"""
@page{size:6in 9in;margin:0}
:root{--navy:#10233A;--navy2:#183453;--mint:#2FCB8E;--mint-d:#1A9E6C;--mint-l:#E3F6EC;--sky:#F5FAF7;--coral:#FF7A59;--coral-l:#FFE9E2;
--ink:#1B2A38;--muted:#5E6E7C;--line:#DCE7E1}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Inter,system-ui,sans-serif;color:var(--ink);-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:6in;height:9in;position:relative;overflow:hidden;page-break-after:always;padding:.55in .55in .6in;background:#fff}
.page:last-child{page-break-after:auto}
.serif{font-family:Fraunces,Georgia,serif}
h1,h2,h3{font-family:Fraunces,Georgia,serif;font-weight:600;letter-spacing:-.01em}
h2{font-size:24pt;line-height:1.1;color:var(--navy)}
h3{font-size:13pt;color:var(--navy);margin:14pt 0 6pt}
p{font-size:10.2pt;line-height:1.5;margin-bottom:7pt}
.eyebrow{font-size:7.5pt;font-weight:700;letter-spacing:.16em;color:var(--mint-d);text-transform:uppercase;margin-bottom:6pt}
.folio{position:absolute;bottom:.28in;left:.55in;right:.55in;display:flex;justify-content:space-between;font-size:7pt;color:#9AA8B3;letter-spacing:.06em}
.lead{font-size:11.5pt;line-height:1.5;color:var(--muted)}
ul.clean,ol.clean{list-style:none}
.note{font-size:8pt;color:var(--muted);font-style:italic;line-height:1.45}
/* cover */
.cover{background:var(--navy);color:#fff;padding:.6in}
.cover .sun{position:absolute;width:5.6in;height:5.6in;border-radius:50%;right:-2.2in;top:-1.6in;background:radial-gradient(circle,rgba(47,203,142,.55),rgba(47,203,142,0) 65%)}
.cover .sun2{position:absolute;width:4in;height:4in;border-radius:50%;left:-1.6in;bottom:-1.2in;background:radial-gradient(circle,rgba(255,122,89,.35),rgba(255,122,89,0) 65%)}
.cover .tag{display:inline-block;font-size:7.5pt;font-weight:700;letter-spacing:.18em;border:1px solid rgba(255,255,255,.3);border-radius:99px;padding:4pt 9pt}
.cover h1{font-size:54pt;line-height:.95;margin:22pt 0 12pt}
.cover h1 em{font-style:italic;color:var(--mint)}
.cover .sub{font-size:13pt;line-height:1.4;color:#CFE0DA;max-width:4.2in}
.cover .dots{position:absolute;left:.6in;right:.6in;bottom:1.55in;display:grid;grid-template-columns:repeat(10,1fr);gap:7pt}
.cover .dots i{display:block;aspect-ratio:1;border-radius:50%;border:1.5px solid rgba(255,255,255,.35)}
.cover .dots i.on{background:var(--mint);border-color:var(--mint)}
.cover .by{position:absolute;left:.6in;bottom:.6in;font-size:9pt;color:#A9BFB7;letter-spacing:.06em}
.cover .chip{position:absolute;right:.6in;bottom:.55in;background:var(--coral);color:#fff;font-weight:700;font-size:8.5pt;border-radius:99px;padding:6pt 11pt}
/* reasons */
.reasons li{display:flex;gap:10pt;margin-bottom:9pt;align-items:flex-start}
.reasons .n{flex:0 0 22pt;height:22pt;border-radius:50%;background:var(--mint-l);color:var(--mint-d);font:700 10pt Inter;display:grid;place-items:center}
.reasons b{display:block;font-size:10.5pt;color:var(--navy);margin-bottom:1pt}
.reasons span{font-size:9.2pt;color:var(--muted);line-height:1.42}
/* boxes */
.card{border:1px solid var(--line);border-radius:10pt;padding:11pt 13pt;margin:9pt 0;background:#fff}
.card.mint{background:var(--mint-l);border-color:#BFE8D3}
.card.coral{background:var(--coral-l);border-color:#FFD1C4}
.card.navy{background:var(--navy);color:#fff;border:0}
.quote{border-left:3pt solid var(--mint);padding:4pt 0 4pt 11pt;font:600 13pt/1.35 Fraunces,Georgia,serif;color:var(--navy);margin:12pt 0}
.icons{display:grid;grid-template-columns:repeat(4,1fr);gap:7pt;margin-top:10pt}
.icons div{background:var(--sky);border-radius:9pt;padding:9pt 7pt;text-align:center;font-size:8pt;color:var(--muted);line-height:1.35}
.icons svg{width:20pt;height:20pt;display:block;margin:0 auto 5pt;color:var(--mint-d)}
.icons b{display:block;color:var(--navy);font-size:9pt}
/* timeline */
.tl{position:relative;margin-top:12pt;padding-left:22pt}
.tl:before{content:"";position:absolute;left:6pt;top:4pt;bottom:6pt;width:2pt;background:linear-gradient(var(--mint),var(--navy))}
.tl div{position:relative;margin-bottom:10.5pt}
.tl div:before{content:"";position:absolute;left:-20pt;top:2pt;width:10pt;height:10pt;border-radius:50%;background:#fff;border:2.5pt solid var(--mint)}
.tl b{display:block;font:600 11pt Fraunces,Georgia,serif;color:var(--navy)}
.tl span{font-size:9.2pt;color:var(--muted);line-height:1.4}
/* lists */
ol.steps{counter-reset:s;list-style:none}
ol.steps li{counter-increment:s;position:relative;padding-left:22pt;margin-bottom:6pt;font-size:10pt;line-height:1.45}
ol.steps li:before{content:counter(s);position:absolute;left:0;top:0;width:15pt;height:15pt;border-radius:50%;background:var(--navy);color:#fff;font:700 8pt Inter;display:grid;place-items:center}
.check li{position:relative;padding-left:20pt;margin-bottom:7pt;font-size:9.6pt;line-height:1.45}
.check li:before{content:"";position:absolute;left:2pt;top:4pt;width:8pt;height:8pt;border-radius:50%;background:var(--mint)}
table{width:100%;border-collapse:collapse;font-size:9pt;margin-top:8pt}
th{text-align:left;background:var(--navy);color:#fff;padding:6pt 8pt;font-weight:600}
td{padding:7pt 8pt;border-bottom:1px solid var(--line);vertical-align:top;line-height:1.4}
td:first-child{font-weight:600;color:var(--navy);width:44%}
.fill{border-bottom:1px dashed #B8C6BF;height:19pt}
.calc{display:grid;grid-template-columns:1fr auto 1fr auto 1fr;gap:6pt;align-items:end;margin-top:8pt;font-size:8pt;color:var(--muted);text-align:center}
.calc .box{height:26pt;border:1.5px solid var(--line);border-radius:6pt;background:#fff}
.calc .op{font:700 14pt Inter;color:var(--navy);padding-bottom:5pt}
/* SOS */
.sos{border:2px solid var(--coral);border-radius:14pt;padding:14pt 16pt;background:#fff}
.sos h3{margin-top:0;color:var(--coral)}
.scissors{font-size:8pt;color:var(--coral);margin-top:6pt;text-align:center;letter-spacing:.08em}
/* day pages */
.day{padding-top:.5in}
.day .num{position:absolute;right:.38in;top:.3in;font:600 78pt/1 Fraunces,Georgia,serif;color:var(--mint-l);letter-spacing:-.04em}
.day .label{font-size:7.5pt;font-weight:700;letter-spacing:.18em;color:var(--mint-d)}
.day h2{font-size:24pt;margin:4pt 0 3pt;position:relative;max-width:3.55in}
.day .tagline{font-style:italic;color:var(--muted);font-size:10.5pt;margin-bottom:12pt;position:relative}
.bar{display:flex;gap:2.2pt;margin:0 0 14pt}
.bar i{flex:1;height:5pt;border-radius:3pt;background:#E4ECE8}
.bar i.on{background:var(--mint)}
.bar i.now{background:var(--coral)}
.task{display:flex;gap:10pt;align-items:flex-start;border:1px solid var(--line);border-radius:10pt;padding:9pt 11pt;margin-bottom:7pt}
.task .ic{flex:0 0 24pt;height:24pt;border-radius:7pt;display:grid;place-items:center}
.task .ic svg{width:14pt;height:14pt}
.task b{display:block;font-size:8pt;letter-spacing:.12em;text-transform:uppercase;margin-bottom:2pt}
.task span{font-size:10pt;line-height:1.42}

.t-paper .ic{background:#EAF0FF;color:#4766E0}.t-paper b{color:#4766E0}
.t-do .ic{background:var(--mint-l);color:var(--mint-d)}.t-do b{color:var(--mint-d)}
.t-save .ic{background:#FFF4D9;color:#C98A00}.t-save b{color:#C98A00}
.dyk{background:var(--navy);color:#fff;border-radius:11pt;padding:11pt 13pt;margin-top:10pt;position:relative}
.dyk b{display:block;font-size:7.5pt;letter-spacing:.16em;color:var(--mint);margin-bottom:3pt}
.dyk span{font-size:9.6pt;line-height:1.45;color:#E4EEF0}
.boost{margin-top:16pt;text-align:center;padding:14pt 10pt 0;border-top:1px solid var(--line)}
.boost i{display:block;font:600 italic 15pt/1.35 Fraunces,Georgia,serif;color:var(--navy)}
.boost small{display:block;margin-top:6pt;font-size:7pt;letter-spacing:.16em;color:var(--mint-d);font-weight:700}
.ms{display:inline-block;background:var(--coral);color:#fff;font-size:7pt;font-weight:700;letter-spacing:.08em;padding:3.5pt 8pt;border-radius:99px;margin:-4pt 0 10pt}
/* tracker */
.grid30{display:grid;grid-template-columns:repeat(5,1fr);gap:7pt;margin-top:12pt}
.grid30 div{border:1.5px solid var(--line);border-radius:9pt;height:.62in;position:relative;padding:5pt 6pt;font:600 10pt Fraunces,Georgia,serif;color:var(--navy)}
.grid30 div.m{border-color:var(--coral);background:var(--coral-l)}
.grid30 div small{position:absolute;bottom:4pt;left:6pt;right:6pt;font:500 6.5pt Inter;color:var(--muted)}
/* certificate */
.cert{background:var(--sky);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.cert .frame{position:absolute;inset:.35in;border:2px solid var(--mint);border-radius:16pt}
.cert .frame:after{content:"";position:absolute;inset:6pt;border:1px solid #BFE8D3;border-radius:12pt}
.cert h2{font-size:30pt;margin:8pt 0}
.cert .medal{width:1.1in;height:1.1in;border-radius:50%;background:var(--mint);color:#fff;display:grid;place-items:center;font:600 30pt Fraunces,Georgia,serif;box-shadow:0 0 0 6pt var(--mint-l)}
.sig{display:flex;gap:30pt;margin-top:24pt}
.sig div{width:1.6in;border-top:1px solid var(--ink);padding-top:4pt;font-size:8pt;color:var(--muted)}
"""

ICON = {
    "paper": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></svg>',
    "do": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="13" cy="4" r="2"/><path d="M7 21l3-6 3 2v4M10 15l1-5 4 2 3-1M11 10l-3 1-1 3"/></svg>',
    "save": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 6h10l1 3H6z"/><rect x="5" y="9" width="14" height="12" rx="2"/><path d="M12 12v6M10 14h3a1 1 0 0 1 0 2h-2a1 1 0 0 0 0 2h3"/></svg>',
    "fact": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/></svg>',
}


def folio(n, label="Quit in 30 Days"):
    return f'<div class="folio"><span>{label.upper()}</span><span>{n}</span></div>'


def cover():
    dots = "".join(f'<i class="{"on" if i == 0 else ""}"></i>' for i in range(30))
    return f"""<section class="page cover">
<div class="sun"></div><div class="sun2"></div>
<span class="tag">A DAY-BY-DAY PLAN · 30 DAYS</span>
<h1>Quit in<br><em>30 Days.</em></h1>
<p class="sub">A day-by-day plan for people who have tried before. One page a day. One small win at a time.</p>
<div class="dots">{dots}</div>
<div class="by">BY DIAMANT</div>
<div class="chip">For people who've tried before</div>
</section>"""


def reasons_page(n):
    items = [
        ("Built for people who have tried before", "No lectures. A plan that expects hard days and shows you what to do on each one."),
        ("One page a day, about 10 minutes", "Every day has one paper task, one real-life task and one Save Box step. Nothing more."),
        ("You watch your money grow", "The Save Box turns every skipped pack into cash in a jar you can see, with treats on Day 3, 7, 14, 21 and a big reward on Day 30."),
        ("A plan for every craving", "A six-step craving routine and an SOS card you can screenshot, because a craving lasts only a few minutes."),
        ("Real facts, not scare tactics", "30 “Did you know?” facts from the World Health Organization, the CDC and the US Surgeon General."),
        ("You see the proof in your body", "A sport or activity you pick on day one, a warm-up on Day 13 and a Sport Test on Day 30, so you feel how your breathing changes."),
        ("Slip-proof, not perfect", "A ready “If I slip” plan so one bad moment does not become a bad week."),
    ]
    lis = "".join(f'<li><span class="n">{i + 1}</span><div><b>{E(t)}</b><span>{E(d)}</span></div></li>' for i, (t, d) in enumerate(items))
    return f"""<section class="page">
<div class="eyebrow">Why this book</div>
<h2>7 reasons this time can be different</h2>
<ul class="clean reasons" style="margin-top:14pt">{lis}</ul>
{folio(n)}</section>"""


def welcome(n):
    return f"""<section class="page">
<div class="eyebrow">Welcome</div>
<h2>You can do this.</h2>
<p class="lead" style="margin-top:10pt">You have probably tried before, and you are still here. That says a lot about you.</p>
<p>This book gives you one page for each of your 30 smoke-free days. Every day gives you a paper task, a real-life task and a surprising fact. Do one page a day and let the days add up.</p>
<p style="font-style:italic;color:var(--muted)">Remember, change comes from within…</p>
<div class="quote">Every day you do not smoke is a day you give back to yourself.</div>
<h3>How each day works</h3>
<div class="icons">
<div>{ICON['paper']}<b>Paper</b>a short writing task</div>
<div>{ICON['do']}<b>Do</b>one real-life action</div>
<div>{ICON['save']}<b>Save Box</b>money into your jar</div>
<div>{ICON['fact']}<b>Did you know?</b>a fact to keep you going</div>
</div>
<p class="note" style="margin-top:14pt">Each day ends with a short thought to carry with you. Read it in the morning, and again when a craving hits.</p>
{folio(n)}</section>"""


def timeline(n):
    rows = [
        ("Within minutes", "Your heart rate starts to drop."),
        ("Within hours", "Carbon monoxide levels in your blood begin to fall."),
        ("First few days", "Taste and smell often start to improve. Cravings peak around days 2–3, then ease."),
        ("2 to 12 weeks", "Circulation tends to improve."),
        ("1 to 9 months", "Coughing and shortness of breath tend to decrease."),
        ("1 year", "Risk of coronary heart disease is about half that of a smoker."),
        ("5 to 15 years", "Risk of stroke falls to that of a non-smoker."),
        ("10 years", "Lung cancer death rate is about half that of a smoker."),
        ("15 years", "Risk of coronary heart disease is the same as for someone who never smoked."),
    ]
    tl = "".join(f"<div><b>{E(a)}</b><span>{E(b)}</span></div>" for a, b in rows)
    return f"""<section class="page">
<div class="eyebrow">Your body, after the last cigarette</div>
<h2>What starts to change</h2>
<p class="lead" style="margin-top:6pt">The facts in this book, on one page.</p>
<div class="tl">{tl}</div>
<p class="note">Source: World Health Organization. Timings are typical and vary from person to person.</p>
{folio(n)}</section>"""


def tools(n):
    return f"""<section class="page">
<div class="eyebrow">Your toolkit</div>
<h2>Three tools you will use every day</h2>
<div class="card mint"><b>1. Save Box.</b> Each day, put the money a pack would have cost into a jar you can see.</div>
<div class="card"><b>2. Store Question.</b> Heading out to buy cigarettes? Ask: <i>why go to the store to buy cigarettes, when I can buy something else instead?</i> Then buy a drink, a snack or gum.</div>
<div class="card"><b>3. Full Breath.</b> Three slow breaths morning and evening. Notice how your breathing changes.</div>
<h3>When a craving hits <span style="font:400 9pt Inter;color:var(--muted)">(it lasts only a few minutes)</span></h3>
<ol class="steps">
<li>Name it: “This is a craving. It will pass.”</li>
<li>Take three Full Breaths.</li>
<li>Drink water in slow sips.</li>
<li>Move: stand up, step outside, change rooms.</li>
<li>Keep your hands and mouth busy: gum, a snack, a pen.</li>
<li>Read your reasons card and picture your sport.</li>
</ol>
<p class="note" style="margin-top:8pt">General information, not medical advice. If you have a health condition, are pregnant, take medication or want nicotine replacement or prescription help, talk to a doctor or pharmacist first.</p>
{folio(n)}</section>"""


def sos(n):
    return f"""<section class="page">
<div class="eyebrow">Keep it close</div>
<h2>Your Craving SOS card</h2>
<p class="lead" style="margin:6pt 0 12pt">Take a screenshot of this page and keep it on your phone. When a craving hits, read it slowly, one line at a time.</p>
<div class="sos">
<h3>CRAVING? It passes in minutes.</h3>
<ol class="steps">
<li>Name it: “This will pass.”</li>
<li>3 Full Breaths.</li>
<li>Slow sips of water.</li>
<li>Move: step outside or change rooms.</li>
<li>Gum, a snack or a pen in your hands.</li>
<li>Read my reasons. Picture my sport.</li>
</ol>
<p style="margin-top:10pt;font-size:9.4pt;color:var(--muted)">Then remember why you started, and who you can message right now.</p>
</div>
<div class="card coral" style="margin-top:16pt"><b>The Store Question</b><br><span style="font-size:9.6pt">Why go to the store to buy cigarettes, when I can buy something else instead?</span></div>
{folio(n)}</section>"""


def ready(n):
    items = [
        ("Write your top 3 reasons", " on a card and on your phone. Be specific, like “I want to play football without losing my breath.”"),
        ("Name your sport or activity.", " Put it at the top of the card. You will test it on Day 30."),
        ("Pick a quit date", " within the next 7 to 14 days, and tell one person."),
        ("Build your Save Box.", " Use a clear jar. Daily save = price of a pack × packs per day. Write it on the jar and choose what the money is for."),
        ("Note your top 3 triggers", " (coffee, stress, drinks, driving) and decide what you will do instead."),
        ("On the night before:", " throw away all cigarettes, lighters and ashtrays, and stock gum, water and snacks."),
    ]
    lis = "".join(f"<li><b>{E(a)}</b>{E(b)}</li>" for a, b in items)
    return f"""<section class="page">
<div class="eyebrow">Before Day 1</div>
<h2>Get ready</h2>
<ol class="steps" style="margin-top:14pt">{lis}</ol>
<div class="quote">A quit date you have told someone about is a promise, not a wish.</div>
{folio(n)}</section>"""


def method(n):
    rows = [("Cold turkey", "You want a clean break and have a plan for cravings"),
            ("Cutting down, then stopping", "Stopping suddenly feels overwhelming (set an end date)"),
            ("Nicotine replacement (patch, gum, lozenge)", "Cravings are strong. Follow the package, ask a pharmacist"),
            ("Prescription help or a quitline", "You have tried before and want extra support")]
    tr = "".join(f"<tr><td>{E(a)}</td><td>{E(b)}</td></tr>" for a, b in rows)
    return f"""<section class="page">
<div class="eyebrow">Before Day 1</div>
<h2>Choose your method</h2>
<p style="margin-top:10pt">The best method is the one you will follow. Pairing a method with support usually works better than going alone.</p>
<table><tr><th>Method</th><th>Good if</th></tr>{tr}</table>
<div class="card coral" style="margin-top:14pt"><b>Talk to a doctor or pharmacist first</b> if you are pregnant, have a heart or lung condition, take regular medication, are under 18, or have a history of depression or anxiety.</div>
{folio(n)}</section>"""


def reasons_card(n):
    return f"""<section class="page">
<div class="eyebrow">Make it personal</div>
<h2>Your reasons are your engine</h2>
<p class="lead" style="margin-top:8pt">General reasons fade. Specific ones keep you going on the hard days.</p>
<div class="card"><b style="color:var(--coral)">Too general</b><br><span style="font-size:9.6pt">“Smoking is bad for me.”</span></div>
<div class="card mint"><b style="color:var(--mint-d)">Specific, and it works</b><br><span style="font-size:9.6pt">“I want to play football without losing my breath.”<br>“I want my clothes to smell like me again.”<br>“I want to save for something I actually want.”</span></div>
<h3>Your Save Box, in one line</h3>
<div class="card navy"><span style="font:600 13pt Fraunces,Georgia,serif">price of a pack × packs per day = your daily save</span></div>
<p style="font-size:9.4pt;color:var(--muted)">Example only: if a pack costs 5 and you smoke 1 pack a day, that is 5 a day, 35 after one week and 150 after 30 days. Your own numbers may be bigger.</p>
<div class="quote">Watching the jar fill is proof you can see.</div>
{folio(n)}</section>"""


def day_page(i, d, n):
    title, tag, paper, do, save, fact = d
    num = i + 1
    bar = "".join(f'<i class="{"now" if k == num else ("on" if k < num else "")}"></i>' for k in range(1, 31))
    ms = f'<div class="ms">MILESTONE · {E(MILESTONES[num].upper())}</div>' if num in (7, 14, 21, 28, 30) else ""

    def task(kind, label, text):
        return (f'<div class="task t-{kind}"><div class="ic">{ICON[kind]}</div>'
                f'<div><b>{label}</b><span>{E(text[0].upper() + text[1:])}</span></div></div>')

    return f"""<section class="page day">
<div class="num">{num:02d}</div>
<div class="label">DAY {num} OF 30</div>
<h2>{E(title)}</h2>
<p class="tagline">{E(tag)}</p>
{ms}
<div class="bar">{bar}</div>
{task('paper', 'Paper', paper)}
{task('do', 'Do', do)}
{task('save', 'Save Box', save)}
<div class="dyk"><b>DID YOU KNOW?</b><span>{E(fact)}</span></div>
<div class="boost"><i>“{E(BOOST[i])}”</i><small>TODAY'S THOUGHT</small></div>
{folio(n)}</section>"""


def tracker(n):
    rows = [(1, "Quit Day", "Your body starts to recover within minutes."), (3, "The hardest stretch", "It eases from here."),
            (7, "One week", "A treat from the Save Box."), (14, "Two weeks", "A treat for your sport or hobby."),
            (21, "Three weeks", "Look how far you have come."), (28, "Four weeks", "That is a real change."),
            (30, "You did it", "The Sport Test and your big reward.")]
    tl = "".join(f"<div><b>Day {d} · {E(a)}</b><span>{E(b)}</span></div>" for d, a, b in rows)
    return f"""<section class="page">
<div class="eyebrow">The road you walked</div>
<h2>Your 30-day milestones</h2>
<div class="tl" style="margin-top:16pt">{tl}</div>
{folio(n)}</section>"""


def slip(n):
    return f"""<section class="page">
<div class="eyebrow">If it happens</div>
<h2>If you slip</h2>
<p class="lead" style="margin-top:8pt">One cigarette is a moment, not a verdict. Prepare for a bad day, so it does not become a bad week.</p>
<ol class="steps" style="margin-top:8pt">
<li>Put it out.</li><li>Take three Full Breaths.</li><li>Tell someone.</li><li>Go back on the plan, today, at the page you were on.</li>
</ol>
<div class="card mint" style="margin-top:12pt">Fewer than 4 in 10 adults who try to quit use counselling or medication. If you slip, adding support is one of the best ways to improve your next try.</div>
<div class="quote" style="margin-top:16pt">Quitting is not about never falling. It is about always getting back up.</div>
{folio(n)}</section>"""


def certificate(n):
    return f"""<section class="page cert">
<div class="frame"></div>
<div class="medal">30</div>
<div class="eyebrow" style="margin-top:16pt">Day 30 and beyond</div>
<h2>Thirty days smoke-free.</h2>
<p class="lead" style="max-width:3.9in">Thirty days ago this felt impossible. Now it is something you have done, one page at a time.</p>
<div class="quote" style="text-align:left;max-width:3.9in">You did not just quit. You started.</div>
<p class="note" style="margin-top:10pt">Keep going, one day at a time.</p>
</section>"""


def sources(n):
    return f"""<section class="page">
<div class="eyebrow">Help and sources</div>
<h2>Where to get support</h2>
<ul class="clean check" style="margin-top:12pt">
<li><b>A doctor or pharmacist</b> can advise on nicotine replacement and prescription help.</li>
<li><b>A free quitline.</b> Many countries have one. Search “quitline” with your country’s name.</li>
<li><b>A support person.</b> A friend or family member you message on hard days.</li>
</ul>
<h3>Facts in this book come from</h3>
<p>World Health Organization (WHO): tobacco fact sheets and health benefits of quitting.<br>
US Centers for Disease Control and Prevention (CDC): data on quitting.<br>
US Surgeon General’s report on smoking cessation.</p>
<div class="card coral" style="margin-top:10pt;font-size:9pt">General information, not medical advice. If you have a health condition, are pregnant, take medication or want nicotine replacement or prescription help, talk to a doctor or pharmacist first.</div>
<p class="note" style="margin-top:14pt">Quit in 30 Days: A Day-by-Day Plan for People Who’ve Tried Before · by Diamant</p>
{folio(n)}</section>"""


def build():
    pages = [cover()]
    n = 2
    for f in (reasons_page, welcome, timeline, tools, sos, ready, method, reasons_card):
        pages.append(f(n))
        n += 1
    for i, d in enumerate(DAYS):
        pages.append(day_page(i, d, n))
        n += 1
    for f in (tracker, slip, certificate, sources):
        pages.append(f(n))
        n += 1
    doc = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Quit in 30 Days</title>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,600;1,9..144,600&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>{CSS}</style></head><body>{''.join(pages)}</body></html>"""
    open(os.path.join(HERE, "book.html"), "w", encoding="utf-8").write(doc)
    print("pages:", len(pages))


if __name__ == "__main__":
    build()
