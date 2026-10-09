// Gera a landing estática em landing/dist. Sem dependências: só Node (>= 20).
//   node landing/build.mjs            gera landing/dist
//   node landing/build.mjs --check    gera e confere preços, matriz e números contra os dados do app (falha se divergir)
//
// Fonte única: preços, nomes e matriz de planos vêm de src/data/plans.json; contagens, de people.json, timeline.json, books.js e bible.js;
// dias de reembolso, de src/data/billing.json; meses do Pro, de supabase/functions/_shared/pricing.js; cores das seções, de src/styles.css.
// Textos da landing ficam em landing/content.json (nada com número de plano ou preço digitado à mão).
import fs from 'node:fs';
import path from 'node:path';

const here = import.meta.dirname;
const root = path.resolve(here, '..');
const dist = path.join(here, 'dist');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const json = (p) => JSON.parse(read(p));
const check = process.argv.includes('--check');
const problems = [];
const warnings = [];
const fail = (m) => problems.push(m);

const config = JSON.parse(fs.readFileSync(path.join(here, 'config.json'), 'utf8'));
const C = JSON.parse(fs.readFileSync(path.join(here, 'content.json'), 'utf8'));
const plansData = json('src/data/plans.json');
const billing = json('src/data/billing.json');
const { PRO_MONTHS } = await import(new URL('../supabase/functions/_shared/pricing.js', import.meta.url).href);
const { VERSIONS } = await import(new URL('../src/data/bible.js', import.meta.url).href);

// ---------- dados do app ----------
const books = [...read('src/data/books.js').matchAll(/^\s*\['(\w+)', '([^']*)', '([^']*)', '([^']*)', '([^']*)', '(\w+)'\]/gm)]
  .map((m) => ({ slug: m[1], ab: m[2], name: m[3], section: m[6] }));
const sections = [...read('src/data/books.js').matchAll(/\{ id: '(\w+)', pt: '([^']*)'/g)].map((m) => ({ id: m[1], name: m[2] }));
const sectionColor = Object.fromEntries([...read('src/styles.css').matchAll(/--s-(\w+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
if (books.length !== 66) fail(`books.js: esperava 66 livros, achei ${books.length}`);
for (const s of sections) if (!sectionColor[s.id]) fail(`styles.css: sem cor --s-${s.id}`);
const people = json('src/data/people.json').people.length;
const timeline = json('src/data/timeline.json');
const versions = VERSIONS.filter((v) => v.available && !config.hideVersions.includes(v.id));

const money = (v) => `R$ ${v.toFixed(2).replace('.', ',')}`.replace(',00', '');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => { if (!(k in vars)) { fail(`marcador {${k}} sem valor em: ${s.slice(0, 50)}`); return ''; } return vars[k]; });

const proPlan = plansData.plans.pro;
const vars = {
  refundDays: billing.refundDays, months: PRO_MONTHS, price: money(proPlan.price), entry: money(proPlan.entryPrice),
  periods: timeline.periods.length, versions: versions.map((v) => v.label).join(', ').replace(/, ([^,]*)$/, ' e $1'),
};
const stats = { books: books.length, people, events: timeline.events.length, versions: versions.length };

// ---------- matriz de planos ----------
const PLAN_IDS = ['essencial', 'pro', 'premium'];
const STATE = { true: 'yes', false: 'no', partial: 'partial', soon: 'soon' };
const feature = (id) => plansData.features.find((f) => f.id === id);
const used = new Set([...C.plans.omit, ...C.plans.rows.flatMap((r) => r.ids)]);
for (const f of plansData.features) if (!used.has(f.id)) fail(`plans.json tem a linha "${f.id}" que a landing não mostra nem omite (landing/content.json)`);
for (const id of used) if (!feature(id)) fail(`content.json cita "${id}", que não existe em plans.json`);
const rows = C.plans.rows.map((r) => {
  const states = PLAN_IDS.map((p) => {
    const vals = new Set(r.ids.map((id) => String(feature(id)?.[p])));
    if (vals.size !== 1) fail(`linha "${r.label}": ${r.ids.join(' + ')} têm estados diferentes no plano ${p}`);
    return STATE[[...vals][0]] ?? (fail(`estado desconhecido "${[...vals][0]}"`), 'no');
  });
  return { label: r.label, states, notes: r.notes };
});

const ICONS = {
  yes: '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#0F2D24"/><path d="M7 12.5l3.2 3.2L17 8.8" fill="none" stroke="#F8F7F2" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  no: '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#ECEBE3"/><path d="M8.5 8.5l7 7M15.5 8.5l-7 7" fill="none" stroke="#4F5853" stroke-width="2.2" stroke-linecap="round"/></svg>',
  partial: '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#E4EBE6"/><path d="M12 5.5a6.5 6.5 0 010 13z" fill="#0F2D24"/><circle cx="12" cy="12" r="6.5" fill="none" stroke="#0F2D24" stroke-width="1.8"/></svg>',
  soon: '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#E4EBE6"/><circle cx="12" cy="12" r="6.2" fill="none" stroke="#3F6553" stroke-width="2"/><path d="M12 8.6V12l2.4 1.6" fill="none" stroke="#3F6553" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};
const NUM_ICONS = {
  book: '<path d="M12 6.5C10.5 5 8 4.5 4 4.5v13c4 0 6.5.5 8 2 1.5-1.5 4-2 8-2v-13c-4 0-6.5.5-8 2z"/><path d="M12 6.5v13"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3 19c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16 13.2c2.9.2 5 2.5 5 5.3"/>',
  timeline: '<path d="M3 12h18"/><circle cx="6" cy="12" r="2" fill="#E4EBE6"/><circle cx="12" cy="12" r="2" fill="#E4EBE6"/><circle cx="18" cy="12" r="2" fill="#E4EBE6"/><path d="M6 10V6M12 14v4M18 10V7"/>',
  text: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4"/>',
};

const app = config.appUrl.replace(/\/$/, '');
const planCards = PLAN_IDS.map((id, col) => {
  const p = plansData.plans[id];
  const card = C.plans.cards[id];
  const soon = p.available === false;
  const featured = id === 'pro';
  const old = p.entryPrice != null ? money(p.price) : '';
  const now = p.entryPrice != null ? money(p.entryPrice) : money(p.price);
  const note = p.entryPrice != null ? fill(C.plans.priceNote, { price: money(p.price) }) : card.note;
  const items = rows.map((r) => {
    const st = r.states[col];
    const n = r.notes[id] ?? '';
    return `<li><span class="mark">${ICONS[st]}<span class="sr">${esc(C.plans.legend[st])}: </span></span><span class="txt"><span>${esc(r.label)}</span>${n ? `<span class="sub">${esc(n)}</span>` : ''}</span></li>`;
  }).join('\n');
  return `<article class="plan${featured ? ' plan-pro' : ''}${soon ? ' plan-soon' : ''}" aria-labelledby="plano-${id}">
  <div class="plan-head"><h3 id="plano-${id}">${esc(p.name.pt)}</h3>${card.badge ? `<span class="badge${featured ? ' badge-dark' : ''}">${esc(card.badge)}</span>` : ''}</div>
  <div class="price"><div class="price-old">${old ? `<span class="sr">de </span><s>${old}</s>` : ''}</div><div class="price-now">${old ? '<span class="sr">por </span>' : ''}${now}</div><div class="price-note">${esc(note)}</div></div>
  <a class="btn ${featured ? 'btn-main' : 'btn-line'}" href="${app}/">${esc(card.cta)}</a>
  ${card.after ? `<p class="plan-after">${esc(card.after)}</p>` : ''}
  <ul class="items">
${items}
  </ul>
</article>`;
}).join('\n');

// ---------- páginas ----------
const tiles = books.map((b) => `<span style="background:${sectionColor[b.section]}">${esc(b.ab)}</span>`).join('');
const legend = sections.map((s) => `<span class="lg"><i style="background:${sectionColor[s.id]}"></i>${esc(s.name)}</span>`).join('');
const numbers = C.numbers.map((n) => `<div class="stat"><div class="stat-ico"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0F2D24" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${NUM_ICONS[n.icon]}</svg></div><div class="stat-n">${stats[n.key]}</div><div class="stat-l">${esc(fill(n.label, vars))}</div></div>`).join('\n');
const features = C.what.features.map((f) => `<div class="feat"><img src="img/${f.img}.webp" width="960" height="600" loading="lazy" decoding="async" alt="${esc(f.alt)}"><h3>${esc(f.title)}</h3><p>${esc(f.text)}</p></div>`).join('\n');
const faq = C.faq.items.map((q) => `<details><summary><span>${esc(q.q)}</span><span class="plus" aria-hidden="true"></span></summary><p>${esc(fill(q.a, vars))}</p></details>`).join('\n');
const chips = C.links.chips.map((c) => `<span class="chip">${esc(c)}</span>`).join('<span class="arrows" aria-hidden="true">⇄</span>');

const siteUrl = config.siteUrl.replace(/\/$/, '');
const ogImage = `${app}/og-image.png`;
const head = (title, desc, canonicalPath, d = 0) => `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="#F8F7F2">
${siteUrl ? `<link rel="canonical" href="${siteUrl}${canonicalPath}">\n<meta property="og:url" content="${siteUrl}${canonicalPath}">` : ''}
<meta property="og:type" content="website">
<meta property="og:locale" content="pt_BR">
<meta property="og:site_name" content="Timóteo App">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${ogImage}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${'../'.repeat(d)}favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="${'../'.repeat(d)}apple-touch-icon.png">
<link rel="preload" href="${'../'.repeat(d)}fonts/bricolage-grotesque-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${'../'.repeat(d)}fonts/source-sans-3-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${'../'.repeat(d)}styles.css">
</head>`;

const rel = (depth) => '../'.repeat(depth);
const top = (depth) => `<header class="nav"><div class="wrap nav-in">
<a class="brand" href="${rel(depth) || './'}" aria-label="${esc(C.nav.home)}"><img src="${rel(depth)}brand/marca-verde.svg" width="39" height="44" alt=""><span>Timóteo App</span></a>
<nav aria-label="${esc(C.nav.label)}">
<a href="${rel(depth)}#o-que-e">${esc(C.nav.what)}</a><a href="${rel(depth)}#planos">${esc(C.nav.plans)}</a><a href="${rel(depth)}#perguntas">${esc(C.nav.faq)}</a>
<a class="btn btn-main btn-sm" href="${app}/">${esc(C.nav.open)}</a>
</nav></div></header>`;
const foot = (contactHref) => `<footer class="foot"><div class="wrap foot-in">
<span>${esc(C.footer.madeBy)} <a href="https://github.com/andrescultori">André Scultori</a> · © 2026 · <a href="https://github.com/andrescultori/timoteo-app">GitHub</a></span>
<span class="foot-links"><a href="${app}/#terms">${esc(C.footer.terms)}</a><a href="${app}/#privacy">${esc(C.footer.privacy)}</a><a href="${contactHref}">${esc(C.footer.contact)}</a></span>
</div></footer>`;

const index = `${head(C.title, C.description, '/')}
<body>
<a class="skip" href="#conteudo">Ir para o conteúdo</a>
${top(0)}
<main id="conteudo">
<section class="hero wrap">
  <div class="hero-text">
    <p class="tag">${esc(C.hero.tag)}</p>
    <h1>${esc(C.hero.title)}</h1>
    <p class="lead">${esc(C.hero.lead)}</p>
    <div class="actions"><a class="btn btn-main" href="${app}/">${esc(C.nav.open)}</a><a class="btn btn-line" href="#planos">Ver planos</a></div>
    <p class="small">${esc(C.hero.note)}</p>
  </div>
  <div class="hero-card">
    <div class="grid66" role="img" aria-label="${esc(C.hero.gridLabel)}">${tiles}</div>
    <div class="legend" aria-hidden="true">${legend}</div>
  </div>
</section>

<section class="numbers" aria-label="Números"><div class="wrap stats">
${numbers}
</div></section>

<section id="o-que-e" class="wrap what">
  <div class="intro"><h2>${esc(C.what.title)}</h2><p>${esc(C.what.lead)}</p></div>
  <div class="feats">
${features}
  </div>
</section>

<section class="wrap pair">
  <div class="card-dark"><h3>${esc(C.links.title)}</h3><div class="chips" aria-hidden="true">${chips}</div><p>${esc(C.links.text)}</p></div>
  <div class="card-light"><h3>${esc(C.views.title)}</h3>
    <div class="views" aria-hidden="true">
      <div class="view view-a"><b>${esc(C.views.traditional)}</b><i></i><i style="width:70%"></i></div>
      <div class="view view-b"><b>${esc(C.views.scholarly)}</b><i></i><i style="width:55%"></i><em>${esc(C.views.soon)}</em></div>
    </div>
    <p>${esc(C.views.text)}</p></div>
</section>

<section id="planos" class="plans"><div class="wrap">
  <div class="intro"><h2>${esc(C.plans.title)}</h2><p>${esc(C.plans.lead)}</p></div>
  <div class="plan-grid">
${planCards}
  </div>
  <ul class="legend-plans" aria-label="Legenda">${['yes', 'no', 'partial', 'soon'].map((k) => `<li><span class="mark">${ICONS[k]}</span>${esc(C.plans.legend[k])}</li>`).join('')}</ul>
  <p class="small pay">${esc(fill(C.plans.payment, vars))}</p>
</div></section>

<section id="perguntas" class="wrap faq">
  <h2>${esc(C.faq.title)}</h2>
${faq}
</section>

<section class="wrap final"><div class="cta">
  <img src="brand/marca-bege.svg" width="50" height="56" alt="">
  <h2>${esc(C.cta.title)}</h2>
  <a class="btn btn-light" href="${app}/">${esc(C.cta.button)}</a>
</div></section>
</main>
${foot('contato/')}
</body>
</html>
`;

const contactBody = config.contactChannel
  ? `<p><a class="btn btn-main" href="${esc(config.contactChannel.url)}">${esc(config.contactChannel.label)}</a></p>`
  : `<p class="soon-note">${esc(C.contact.pending)}</p>`;
if (!config.contactChannel) warnings.push('config.json: contactChannel vazio. A página /contato/ avisa que o canal será informado; defina antes de publicar.');
if (!config.siteUrl) warnings.push('config.json: siteUrl vazio. Sem canonical e og:url; defina o endereço final antes de publicar.');
const contact = `${head(`${C.contact.title} · Timóteo App`, fill(C.contact.intro, vars), '/contato/', 1)}
<body>
<a class="skip" href="#conteudo">Ir para o conteúdo</a>
${top(1)}
<main id="conteudo" class="wrap page">
  <h1>${esc(C.contact.title)}</h1>
  <p class="lead">${esc(fill(C.contact.intro, vars))}</p>
  ${contactBody}
  <p><a href="../">${esc(C.contact.back)}</a></p>
</main>
${foot('./')}
</body>
</html>
`;

// ---------- saída ----------
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'contato'), { recursive: true });
fs.mkdirSync(path.join(dist, 'fonts'), { recursive: true });
fs.mkdirSync(path.join(dist, 'brand'), { recursive: true });
fs.mkdirSync(path.join(dist, 'licencas'), { recursive: true });
fs.mkdirSync(path.join(dist, 'img'), { recursive: true });
fs.writeFileSync(path.join(dist, 'index.html'), index);
fs.writeFileSync(path.join(dist, 'contato', 'index.html'), contact);
fs.copyFileSync(path.join(here, 'styles.css'), path.join(dist, 'styles.css'));
for (const f of ['bricolage-grotesque-latin.woff2', 'source-sans-3-latin.woff2']) fs.copyFileSync(path.join(root, 'src/fonts', f), path.join(dist, 'fonts', f));
for (const f of ['OFL-Bricolage-Grotesque.txt', 'OFL-Source-Sans-3.txt']) fs.copyFileSync(path.join(root, 'public/licencas', f), path.join(dist, 'licencas', f));
for (const f of ['marca-verde.svg', 'marca-bege.svg']) fs.copyFileSync(path.join(root, 'public/brand', f), path.join(dist, 'brand', f));
for (const f of ['favicon.svg', 'apple-touch-icon.png']) fs.copyFileSync(path.join(root, 'public', f), path.join(dist, f));
if (fs.existsSync(path.join(here, 'img'))) for (const f of fs.readdirSync(path.join(here, 'img'))) fs.copyFileSync(path.join(here, 'img', f), path.join(dist, 'img', f));
fs.writeFileSync(path.join(dist, '_headers'), '/fonts/*\n  Cache-Control: public, max-age=31536000, immutable\n/img/*\n  Cache-Control: public, max-age=86400\n/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n');
fs.writeFileSync(path.join(dist, 'robots.txt'), 'User-agent: *\nAllow: /\n');

// ---------- conferências (sempre; --check só muda a mensagem final) ----------
const html = index;
for (const [id, p] of Object.entries(plansData.plans)) {
  if (!html.includes(`>${p.name.pt}</h3>`)) fail(`plano ${id}: nome "${p.name.pt}" não apareceu`);
  if (p.price > 0 && !html.includes(money(p.price))) fail(`plano ${id}: preço ${money(p.price)} não apareceu`);
  if (p.entryPrice != null && !html.includes(money(p.entryPrice))) fail(`plano ${id}: preço de entrada ${money(p.entryPrice)} não apareceu`);
}
if ((html.match(/<li><span class="mark">/g) ?? []).length - 4 !== rows.length * 3) fail('a matriz não tem linhas × 3 planos');
for (const [name, text] of [['index.html', html], ['styles.css', fs.readFileSync(path.join(here, 'styles.css'), 'utf8')]]) if (/googleapis|gstatic|google-analytics|googletagmanager/i.test(text)) fail(`${name}: a landing não pode carregar recursos do Google (Política de Privacidade)`);
if (/\bundefined\b|\{\w+\}/.test(html)) fail('sobrou marcador ou "undefined" no HTML');
if (!/<h1[ >]/.test(html) || (html.match(/<h1[ >]/g) ?? []).length !== 1) fail('a página inicial deve ter exatamente uma h1');
for (const m of html.matchAll(/<img [^>]*>/g)) { if (!/ alt=/.test(m[0])) fail(`img sem alt: ${m[0].slice(0, 60)}`); if (!/ width=/.test(m[0]) || !/ height=/.test(m[0])) fail(`img sem width/height: ${m[0].slice(0, 60)}`); }
for (const m of html.matchAll(/src="(img\/[^"]+)"/g)) if (!fs.existsSync(path.join(dist, m[1]))) fail(`imagem ausente: landing/${m[1]} (rode landing/capture.mjs)`);

for (const w of warnings) console.warn(`Aviso: ${w}`);
if (problems.length) { console.error(`\nlanding: ${problems.length} problema(s)\n- ${problems.join('\n- ')}`); process.exit(1); }
const size = (d) => fs.readdirSync(d, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? size(path.join(d, e.name)) : fs.statSync(path.join(d, e.name)).size), 0);
console.log(`OK landing${check ? ' (conferida)' : ''}: ${rows.length} linhas × 3 planos, ${books.length} livros, ${stats.people} personagens, ${stats.events} eventos, ${stats.versions} versões; ${(size(dist) / 1024).toFixed(0)} KB em landing/dist`);
