// Confere os dados do site antes do build: fichas, mapas e textos bíblicos.
// Uso: npm run check   (o CI roda isso em todo PR)
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const errors = [];
const err = (msg) => errors.push(msg);

// Livros e capítulos (a KJV é a referência de numeração)
const books = [...fs.readFileSync(path.join(root, 'src/data/books.js'), 'utf8').matchAll(/^\s*\['(\w+)', '[^']*', '[^']*', '[^']*', '[^']*', '(\w+)'\]/gm)].map((m) => m[1]);
if (books.length !== 66) err(`books.js: esperava 66 livros, achei ${books.length}`);
const counts = read('src/data/counts.json');
const chaptersOf = (slug) => counts[books.indexOf(slug) + 1][0];

const bilingual = (v, where) => {
  if (!v || typeof v.pt !== 'string' || typeof v.en !== 'string' || !v.pt.trim() || !v.en.trim()) err(`${where}: falta texto em PT ou EN`);
};
// "12:37", "19–20", "2:1–7": só confere se os capítulos citados existem no livro
const refOk = (ref, slug, where) => {
  if (typeof ref !== 'string' || !/^\d+(:\d+)?([–-]\d+(:\d+)?)?$/.test(ref)) { err(`${where}: referência inválida "${ref}"`); return; }
  const max = chaptersOf(slug);
  const chapters = ref.includes(':') ? [...ref.matchAll(/(\d+):/g)].map((m) => Number(m[1])) : [...ref.matchAll(/\d+/g)].map((m) => Number(m[0]));
  for (const c of chapters) if (c < 1 || c > max) err(`${where}: capítulo ${c} não existe (livro tem ${max})`);
};

// Região coberta pela costa em src/data/land.json (lon -12..72, lat -2..52)
const LON = [-12, 72];
const LAT = [-2, 52];

// `ids` do personagem da ficha: ids de people.json (ou null); com mais de um id, o número de nomes no texto precisa bater
// people-index.json (usado para ligar nomes nas fichas) precisa estar em dia com people.json
{
  const { buildIndex } = await import('./build-people-index.mjs');
  const saved = fs.readFileSync(path.join(root, 'src/data/people-index.json'), 'utf8').trim();
  if (saved !== JSON.stringify(buildIndex())) err('src/data/people-index.json está desatualizado: rode node scripts/build-people-index.mjs');
}
const personIds = new Set(read('src/data/people.json').people.map((p) => p.id));
function checkCharIds(c, where) {
  if (c.ids === undefined) return;
  if (!Array.isArray(c.ids) || !c.ids.length) { err(`${where}: ids deve ser uma lista não vazia`); return; }
  c.ids.forEach((id) => { if (id !== null && !personIds.has(id)) err(`${where}: personagem "${id}" não existe`); });
  if (c.ids.length > 1) {
    for (const [lang, sep] of [['pt', / e |, /], ['en', / and |, /]]) {
      const n = c.name?.[lang]?.split(sep).length;
      if (n !== c.ids.length) err(`${where}: ${c.ids.length} ids, mas o nome ${lang.toUpperCase()} tem ${n} parte(s)`);
    }
  }
}

for (const slug of books) {
  const file = `src/data/info/${slug}.json`;
  if (!fs.existsSync(path.join(root, file))) { err(`${file}: ficha ausente`); continue; }
  const d = read(file);
  for (const k of ['place', 'recipients', 'theme', 'historicalContext', 'connections']) bilingual(d[k], `${slug}.${k}`);
  for (const k of ['author', 'date']) for (const v of ['traditional', 'scholarly']) bilingual(d[k]?.[v], `${slug}.${k}.${v}`);
  refOk(d.keyVerse, slug, `${slug}.keyVerse`);
  if (!Array.isArray(d.characters) || !d.characters.length) err(`${slug}: sem personagens`);
  (d.characters ?? []).forEach((c, i) => { bilingual(c.name, `${slug}.characters[${i}].name`); bilingual(c.role, `${slug}.characters[${i}].role`); checkCharIds(c, `${slug}.characters[${i}]`); });
  if (!Array.isArray(d.outline) || !d.outline.length) err(`${slug}: sem esboço`);
  (d.outline ?? []).forEach((o, i) => { refOk(o.ref, slug, `${slug}.outline[${i}]`); bilingual(o.title, `${slug}.outline[${i}].title`); });

  if (d.structure) {
    const st = d.structure;
    const n = chaptersOf(slug);
    if (st.note) bilingual(st.note, `${slug}.structure.note`);
    const voiceIds = new Set((st.voices ?? []).map((v) => v.id));
    (st.voices ?? []).forEach((v) => bilingual(v.name, `${slug}.structure.voices.${v.id}`));
    const seen = [];
    (st.parts ?? []).forEach((p, i) => {
      const w = `${slug}.structure.parts[${i}]`;
      bilingual(p.title, `${w}.title`);
      p.ref.split(';').forEach((r) => refOk(r.trim(), slug, `${w}.ref`));
      if (p.voice && !voiceIds.has(p.voice)) err(`${w}: voz "${p.voice}" não existe`);
      if (voiceIds.size && !p.voice) err(`${w}: falta a voz`);
      seen.push(...(p.chapters ?? []));
    });
    const sorted = [...seen].sort((a, b) => a - b);
    if (sorted.length !== n || sorted.some((c, k) => c !== k + 1)) err(`${slug}.structure: as partes devem cobrir os capítulos 1 a ${n}, cada um uma vez`);
    (st.readings ?? []).forEach((r, i) => {
      bilingual(r.name, `${slug}.structure.readings[${i}].name`); bilingual(r.summary, `${slug}.structure.readings[${i}].summary`);
      if (r.view !== null && !['traditional', 'scholarly'].includes(r.view)) err(`${slug}.structure.readings[${i}].view: use traditional, scholarly ou null`);
    });
  }

  if (d.map) {
    const m = d.map;
    if (typeof m.route !== 'boolean') err(`${slug}.map.route: deve ser true/false`);
    if (m.note) bilingual(m.note, `${slug}.map.note`);
    if (!Array.isArray(m.places) || m.places.length < 2) err(`${slug}.map: precisa de pelo menos 2 lugares`);
    const seen = new Set();
    (m.places ?? []).forEach((p, i) => {
      const w = `${slug}.map.places[${i}]`;
      bilingual(p.name, `${w}.name`); bilingual(p.note, `${w}.note`);
      const [lon, lat] = p.lonLat ?? [];
      if (![lon, lat].every(Number.isFinite)) err(`${w}: lonLat inválido`);
      else if (lon < LON[0] || lon > LON[1] || lat < LAT[0] || lat > LAT[1]) err(`${w}: fora da região da costa (${lon}, ${lat})`);
      refOk(p.ref, slug, `${w}.ref`);
      if (p.uncertain !== undefined && typeof p.uncertain !== 'boolean') err(`${w}.uncertain: deve ser true/false`);
      if (p.label && !(p.label.length === 3 && typeof p.label[0] === 'number' && typeof p.label[1] === 'number' && ['start', 'middle', 'end'].includes(p.label[2]))) err(`${w}.label: use [dx, dy, "start"|"middle"|"end"]`);
      if (seen.has(p.name?.pt)) err(`${w}: nome repetido "${p.name?.pt}"`);
      seen.add(p.name?.pt);
    });
  }
}

// Textos bíblicos: 66 livros por versão, mesmos capítulos da KJV; versículo é texto ou null
const { VERSIONS } = await import(new URL('../src/data/bible.js', import.meta.url).href);
const versionIds = VERSIONS.map((v) => v.id);
if (!versionIds.length) err('bible.js: nenhuma versão encontrada');
for (const ver of VERSIONS) {
  const v = ver.id;
  // `books` (números 1 a 66) marca versões parciais, como a Almeida 1911 atualizada em revisão
  books.forEach((slug, i) => {
    if (ver.books && !ver.books.includes(i + 1)) return;
    const f = `public/bible/${v}/${i + 1}.json`;
    if (!fs.existsSync(path.join(root, f))) { err(`${f}: ausente`); return; }
    const chs = read(f);
    if (chs.length !== chaptersOf(slug)) err(`${f}: ${chs.length} capítulos (esperado ${chaptersOf(slug)})`);
    chs.forEach((c, ci) => c.forEach((t, vi) => {
      if (t !== null && (typeof t !== 'string' || !t.trim())) err(`${f} ${ci + 1}:${vi + 1}: versículo vazio ou inválido (use null)`);
      else if (typeof t === 'string' && /\s[,.;:?!]|\s{2,}|^\s|\s$/.test(t)) err(`${f} ${ci + 1}:${vi + 1}: espaçamento irregular`);
    }));
  });
  if (!fs.existsSync(path.join(root, `public/bible/${v}/LICENSE.txt`)) && v !== 'kjv') err(`public/bible/${v}: falta LICENSE.txt`);
}


// Linha do tempo: blocos, períodos e eventos
{
  const tl = read('src/data/timeline.json');
  const year = (y) => Number.isInteger(y) && y !== 0 && y >= -5000 && y <= 120; // não existe o ano 0
  const dateOk = (d, where) => {
    if (!d || !year(d.start)) { err(`${where}: start inválido`); return null; }
    if (d.end !== undefined && (!year(d.end) || d.end < d.start)) err(`${where}: end inválido ou antes de start`);
    if (d.approx !== undefined && typeof d.approx !== 'boolean') err(`${where}.approx: deve ser true/false`);
    if (d.note) bilingual(d.note, `${where}.note`);
    return d;
  };
  // {start,end?} ou {traditional:{...}, scholarly:{...}}
  const datesOk = (dates, where) => {
    if (dates?.start !== undefined) return dateOk(dates, where);
    if (!dates?.traditional || !dates?.scholarly) { err(`${where}: use start/end ou traditional + scholarly`); return null; }
    dateOk(dates.scholarly, `${where}.scholarly`);
    return dateOk(dates.traditional, `${where}.traditional`);
  };
  const blockIds = new Set((tl.blocks ?? []).map((b) => b.id));
  (tl.blocks ?? []).forEach((b) => { bilingual(b.title, `timeline.blocks.${b.id}.title`); if (!(b.ppy > 0)) err(`timeline.blocks.${b.id}: ppy deve ser > 0`); });
  const periodIds = new Set();
  let prev = -Infinity;
  (tl.periods ?? []).forEach((p) => {
    const w = `timeline.periods.${p.id}`;
    if (periodIds.has(p.id)) err(`${w}: id repetido`);
    periodIds.add(p.id);
    if (!blockIds.has(p.block)) err(`${w}: bloco "${p.block}" não existe`);
    bilingual(p.title, `${w}.title`); bilingual(p.summary, `${w}.summary`);
    if (!p.undated) {
      const m = datesOk(p.dates, `${w}.dates`);
      if (m) { if (m.start < prev) err(`${w}: períodos fora de ordem cronológica`); prev = m.start; if (m.end === undefined) err(`${w}: período precisa de end`); }
    }
    (p.books ?? []).forEach((b) => { if (!books.includes(b)) err(`${w}: livro "${b}" não existe`); });
  });
  const eventIds = new Set();
  (tl.events ?? []).forEach((e) => {
    const w = `timeline.events.${e.id}`;
    if (eventIds.has(e.id)) err(`${w}: id repetido`);
    eventIds.add(e.id);
    if (!periodIds.has(e.period)) err(`${w}: período "${e.period}" não existe`);
    bilingual(e.title, `${w}.title`); bilingual(e.note, `${w}.note`);
    datesOk(e.dates, `${w}.dates`);
    if (e.ref) { if (!books.includes(e.ref.book)) err(`${w}.ref: livro "${e.ref.book}" não existe`); else refOk(e.ref.ref, e.ref.book, `${w}.ref`); }
    // lugares ligados ao mapa: precisam existir (nome em PT) no mapa da ficha do livro
    (e.places ?? []).forEach((pl, i) => {
      if (!books.includes(pl.book)) { err(`${w}.places[${i}]: livro "${pl.book}" não existe`); return; }
      const place = (read(`src/data/info/${pl.book}.json`).map?.places ?? []).find((x) => x.name?.pt === pl.name);
      if (!place) err(`${w}.places[${i}]: lugar "${pl.name}" não está no mapa de ${pl.book}`);
      else if (place.name.en !== pl.en) err(`${w}.places[${i}]: "en" deve ser "${place.name.en}"`);
    });
    for (const k of ['attested', 'uncertain']) if (e[k] !== undefined && typeof e[k] !== 'boolean') err(`${w}.${k}: deve ser true/false`);
  });
}


// Personagens: ids, textos, livros, eventos da linha do tempo e lugares do mapa
{
  const { people } = read('src/data/people.json');
  const tl = read('src/data/timeline.json');
  const eventIds = new Set(tl.events.map((e) => e.id));
  const seen = new Set();
  people.forEach((p) => {
    const w = `people.${p.id}`;
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.id ?? '')) err(`${w}: id inválido (use minúsculas e hífens)`);
    if (seen.has(p.id)) err(`${w}: id repetido`);
    seen.add(p.id);
    bilingual(p.name, `${w}.name`); bilingual(p.summary, `${w}.summary`);
    if (p.note) bilingual(p.note, `${w}.note`);
    if (p.bio !== undefined) {
      const [a, b] = [p.bio?.pt, p.bio?.en];
      if (!Array.isArray(a) || !Array.isArray(b) || a.length < 2 || a.length !== b.length || [...a, ...b].some((x) => typeof x !== 'string' || !x.trim())) err(`${w}.bio: precisa de listas PT e EN de parágrafos, com 2 ou mais e o mesmo número`);
    }
    if (p.uncertain !== undefined && typeof p.uncertain !== 'boolean') err(`${w}.uncertain: deve ser true/false`);
    if (p.autoLink !== undefined && typeof p.autoLink !== 'boolean') err(`${w}.autoLink: deve ser true/false`);
    (p.linkBooks ?? []).forEach((b) => { if (!books.includes(b)) err(`${w}.linkBooks: livro "${b}" não existe`); });
    if (!Array.isArray(p.books) || !p.books.length) err(`${w}: sem livros`);
    const bs = new Set();
    (p.books ?? []).forEach((b, i) => {
      if (!books.includes(b.book)) err(`${w}.books[${i}]: livro "${b.book}" não existe`);
      if (bs.has(b.book)) err(`${w}.books[${i}]: livro "${b.book}" repetido`);
      bs.add(b.book);
      bilingual(b.role, `${w}.books[${i}].role`);
    });
    (p.events ?? []).forEach((id) => { if (!eventIds.has(id)) err(`${w}: evento "${id}" não existe na linha do tempo`); });
    (p.places ?? []).forEach((pl, i) => {
      if (!books.includes(pl.book)) { err(`${w}.places[${i}]: livro "${pl.book}" não existe`); return; }
      const place = (read(`src/data/info/${pl.book}.json`).map?.places ?? []).find((x) => x.name?.pt === pl.name);
      if (!place) err(`${w}.places[${i}]: lugar "${pl.name}" não está no mapa de ${pl.book}`);
      else if (place.name.en !== pl.en) err(`${w}.places[${i}]: "en" deve ser "${place.name.en}"`);
    });
  });
}


// Textos da interface: chave repetida no mesmo idioma faz a última sobrescrever a primeira (já causou "Alternar tema" no lugar de "Tema")
{
  const src = fs.readFileSync(path.join(root, 'src/i18n.js'), 'utf8');
  const blocks = src.split(/^  (?=\w+: \{)/m).filter((b) => /^\w+: \{/.test(b));
  const keysOf = (b) => [...b.matchAll(/^ {4}(\w+):/gm)].map((m) => m[1]);
  const all = blocks.map((b) => ({ lang: b.slice(0, b.indexOf(':')), keys: keysOf(b) }));
  for (const { lang, keys } of all) {
    const dup = keys.filter((k, i) => keys.indexOf(k) !== i);
    if (dup.length) err(`i18n.js (${lang}): chave repetida: ${[...new Set(dup)].join(', ')}`);
  }
  const base = new Set(all[0]?.keys);
  for (const { lang, keys } of all.slice(1)) {
    const missing = [...base].filter((k) => !keys.includes(k));
    if (missing.length) err(`i18n.js (${lang}): faltam chaves presentes no primeiro idioma: ${missing.join(', ')}`);
  }
}


// Salmos: 150, com livro do Saltério, título e (nos 13 de título histórico) pessoas e referências existentes
{
  const { psalms } = read('src/data/psalms.json');
  const people = new Set(read('src/data/people.json').people.map((p) => p.id));
  const events = new Set(read('src/data/timeline.json').events.map((e) => e.id));
  const AUTHORS = ['david', 'asaph', 'korah', 'solomon', 'moses', 'heman', 'ethan'];
  const GENRES = ['hino', 'lamento-ind', 'lamento-col', 'confianca', 'acao-gracas', 'real', 'sapiencial', 'historico', 'liturgia'];
  if (psalms.length !== 150) err(`psalms.json: esperava 150 salmos, achei ${psalms.length}`);
  psalms.forEach((p, i) => {
    const w = `psalms[${i + 1}]`;
    if (p.n !== i + 1) err(`${w}: n deve ser ${i + 1}`);
    const book = p.n <= 41 ? 1 : p.n <= 72 ? 2 : p.n <= 89 ? 3 : p.n <= 106 ? 4 : 5;
    if (p.book !== book) err(`${w}: livro do Saltério deve ser ${book}`);
    (p.by ?? []).forEach((a) => { if (!AUTHORS.includes(a)) err(`${w}: autor "${a}" inválido`); });
    if (!GENRES.includes(p.genre)) err(`${w}: gênero "${p.genre}" inválido`);
    if (p.hist) {
      bilingual(p.hist.text, `${w}.hist.text`);
      (p.hist.people ?? []).forEach((id) => { if (!people.has(id)) err(`${w}: personagem "${id}" não existe`); });
      (p.hist.events ?? []).forEach((id) => { if (!events.has(id)) err(`${w}: evento "${id}" não existe`); });
      if (p.hist.ref) {
        if (!books.includes(p.hist.ref.book)) err(`${w}.hist.ref: livro inválido`);
        else p.hist.ref.ref.split(';').forEach((r) => refOk(r.trim(), p.hist.ref.book, `${w}.hist.ref`));
      }
      (p.hist.places ?? []).forEach((pl) => {
        const place = (read(`src/data/info/${pl.book}.json`).map?.places ?? []).find((x) => x.name?.pt === pl.name);
        if (!place || place.name.en !== pl.en) err(`${w}.hist.places: "${pl.name}" não confere com o mapa de ${pl.book}`);
      });
    }
  });
}

// Genealogia: cada ligação pai → filho tem referência bíblica; árvores sem ciclo, com um pai por nó e tudo ligado à raiz
{
  const g = read('src/data/genealogia.json');
  const personIds = new Set(read('src/data/people.json').people.map((p) => p.id));
  const parent = {};
  const kids = {};
  Object.entries(g.nodes).forEach(([id, n]) => {
    bilingual(n.name, `genealogia.nodes.${id}.name`);
    if (n.note) bilingual(n.note, `genealogia.nodes.${id}.note`);
    if (n.personId && !personIds.has(n.personId)) err(`genealogia.nodes.${id}: personagem "${n.personId}" não existe`);
  });
  g.links.forEach((l, i) => {
    const w = `genealogia.links[${i}] (${l.from} → ${l.to})`;
    if (!g.nodes[l.from] || !g.nodes[l.to]) { err(`${w}: nó não existe`); return; }
    if (parent[l.to]) err(`${w}: ${l.to} já tem pai (${parent[l.to]})`);
    parent[l.to] = l.from;
    (kids[l.from] ??= []).push(l.to);
    if (!l.refs?.length) err(`${w}: falta referência bíblica`);
    (l.refs ?? []).forEach((r) => { if (!books.includes(r.book)) err(`${w}: livro "${r.book}" não existe`); else refOk(r.ref, r.book, w); });
    if (l.mother && !personIds.has(l.mother)) err(`${w}: mãe "${l.mother}" não existe em people.json`);
    if (l.motherName) bilingual(l.motherName, `${w}.motherName`);
    if (l.note) bilingual(l.note, `${w}.note`);
  });
  const reached = new Set();
  g.trees.forEach((tr) => {
    bilingual(tr.title, `genealogia.trees.${tr.id}.title`);
    bilingual(tr.intro, `genealogia.trees.${tr.id}.intro`);
    if (tr.layout && !['svg', 'list'].includes(tr.layout)) err(`genealogia.trees.${tr.id}: layout "${tr.layout}" inválido`);
    if (!g.nodes[tr.root]) { err(`genealogia.trees.${tr.id}: raiz "${tr.root}" não existe`); return; }
    const seen = new Set();
    const walk = (id) => { if (seen.has(id)) { err(`genealogia: ciclo em ${id}`); return; } seen.add(id); reached.add(id); (kids[id] ?? []).forEach(walk); };
    walk(tr.root);
    seen.forEach((id) => { const b = g.nodes[id].branch; if (b && !tr.branches?.[b]) err(`genealogia: ramo "${b}" sem nome em ${tr.id}`); });
  });
  Object.keys(g.nodes).filter((id) => !reached.has(id)).forEach((id) => err(`genealogia: nó "${id}" não está ligado a nenhuma raiz`));
}

// Favoritos: as chaves geradas por src/favKeys.js precisam ser únicas e voltar iguais ao serem desmontadas (livro, capítulo, personagem e lugar do mapa)
{
  const { favKey, parseFavKey } = await import(new URL('../src/favKeys.js', import.meta.url).href);
  const seen = new Set();
  const roundtrip = (key, expected, where) => {
    const k = parseFavKey(key);
    if (!k || Object.entries(expected).some(([a, b]) => k[a] !== b)) err(`favoritos: chave "${key}" não volta igual (${where})`);
    if (seen.has(key)) err(`favoritos: chave repetida "${key}" (${where})`);
    seen.add(key);
  };
  books.forEach((slug) => {
    roundtrip(favKey.book(slug), { type: 'book', slug }, slug);
    const chapters = chaptersOf(slug);
    for (const n of new Set([1, chapters])) roundtrip(favKey.chapter(slug, n), { type: 'chapter', slug, n }, slug);
    (read(`src/data/info/${slug}.json`).map?.places ?? []).forEach((p) => roundtrip(favKey.place(slug, p.name.pt), { type: 'place', slug, name: p.name.pt }, `${slug}.map`));
  });
  read('src/data/people.json').people.forEach((p) => roundtrip(favKey.person(p.id), { type: 'person', id: p.id }, 'people'));
}

// Planos (src/data/plans.json): ids de personagens e slugs existem; a matriz ✅/❌ concorda com as listas e com as regras de can()
{
  const cfg = read('src/data/plans.json');
  const { createCan, FEATURE_ROW, PLAN_ORDER } = await import(new URL('../src/planRules.js', import.meta.url).href);
  const personIds = new Set(read('src/data/people.json').people.map((p) => p.id));
  const sectionOf = Object.fromEntries([...fs.readFileSync(path.join(root, 'src/data/books.js'), 'utf8').matchAll(/^\s*\['(\w+)', '[^']*', '[^']*', '[^']*', '[^']*', '(\w+)'\]/gm)].map((m) => [m[1], m[2]]));
  const sections = [...fs.readFileSync(path.join(root, 'src/data/books.js'), 'utf8').matchAll(/id: '(\w+)', pt:/g)].map((m) => m[1]);
  const w = 'plans.json';
  if (JSON.stringify(Object.keys(cfg.plans)) !== JSON.stringify(PLAN_ORDER)) err(`${w}: os planos devem ser ${PLAN_ORDER.join(', ')}`);
  for (const [id, p] of Object.entries(cfg.plans)) {
    bilingual(p.name, `${w}.plans.${id}.name`);
    if (typeof p.price !== 'number' || p.price < 0) err(`${w}.plans.${id}: preço inválido`);
    if (p.entryPrice !== null && (typeof p.entryPrice !== 'number' || p.entryPrice > p.price)) err(`${w}.plans.${id}: preço de entrada inválido`);
  }
  const ess = cfg.essencial;
  if (new Set(ess.characters).size !== ess.characters.length) err(`${w}: ids de personagens repetidos em essencial.characters`);
  ess.characters.forEach((id) => { if (!personIds.has(id)) err(`${w}: personagem "${id}" não existe em people.json`); });
  const listed = [...ess.mapBooks, ...ess.structureBooks, ...cfg.pro.structureBooks];
  listed.forEach((slug) => { if (!books.includes(slug)) err(`${w}: livro "${slug}" não existe em books.js`); });
  (ess.mapSections ?? []).forEach((sec) => { if (!sections.includes(sec)) err(`${w}: seção "${sec}" não existe`); });
  const expectedMaps = books.filter((s) => ess.mapSections.includes(sectionOf[s]));
  if (JSON.stringify([...ess.mapBooks].sort()) !== JSON.stringify([...expectedMaps].sort())) err(`${w}: essencial.mapBooks deve ser exatamente os livros das seções ${ess.mapSections.join(', ')}`);
  // todo livro com `structure` na ficha precisa estar em alguma lista de estrutura
  books.forEach((slug) => { if (read(`src/data/info/${slug}.json`).structure && !ess.structureBooks.includes(slug) && !cfg.pro.structureBooks.includes(slug)) err(`${w}: ${slug} tem estrutura na ficha mas não está em nenhuma lista de plano`); });
  // matriz
  const ids = new Set();
  cfg.features.forEach((f) => {
    const fw = `${w}.features.${f.id}`;
    if (ids.has(f.id)) err(`${fw}: id repetido`);
    ids.add(f.id);
    bilingual(f.label, `${fw}.label`);
    if (f.note) bilingual(f.note, `${fw}.note`);
    PLAN_ORDER.forEach((pl) => { if (![true, false, 'partial', 'soon'].includes(f[pl])) err(`${fw}.${pl}: valor deve ser true, false, "partial" ou "soon"`); });
    PLAN_ORDER.forEach((pl) => { if (f[pl] === 'partial' && pl !== 'essencial') err(`${fw}.${pl}: "partial" só vale no Essencial`); });
  });
  Object.values(FEATURE_ROW).forEach((row) => { if (!ids.has(row)) err(`${w}: falta a linha "${row}" na matriz`); });
  const can = createCan(cfg);
  const sample = { slug: null, id: null };
  const mapNo = books.find((s) => !ess.mapBooks.includes(s) && read(`src/data/info/${s}.json`).map);
  const strNo = cfg.pro.structureBooks[0];
  const perNo = [...personIds].find((id) => !ess.characters.includes(id));
  const subject = { map: [ess.mapBooks[0], mapNo], structure: [ess.structureBooks[0], strNo], person: [ess.characters[0], perNo] };
  for (const [feature, rowId] of Object.entries(FEATURE_ROW)) {
    const row = cfg.features.find((f) => f.id === rowId);
    if (!row) continue;
    for (const pl of PLAN_ORDER) {
      const cell = row[pl];
      const key = feature === 'map' ? 'slug' : feature === 'structure' ? 'slug' : 'id';
      const [yes, no] = subject[feature] ?? [null, null];
      const gotYes = can(feature, { plan: pl, [key]: yes });
      const gotNo = subject[feature] ? can(feature, { plan: pl, [key]: no }) : gotYes;
      const wantYes = cell === true || cell === 'partial';
      const wantNo = cell === true;
      if (gotYes !== wantYes || gotNo !== wantNo) err(`${w}: a matriz diverge de can("${feature}") no plano ${pl} (linha ${rowId}: ${cell})`);
    }
    if (can(feature, { plan: 'essencial', isAdmin: true, ...sample }) !== true) err(`${w}: o administrador deve poder tudo (${feature})`);
  }
  if (row_partial_without_list(cfg)) err(`${w}: linha "partial" sem lista no Essencial`);
  function row_partial_without_list(c) {
    const need = { maps: c.essencial.mapBooks, structure: c.essencial.structureBooks, characters: c.essencial.characters };
    return c.features.some((f) => f.essencial === 'partial' && !(need[f.id]?.length));
  }
}

if (errors.length) {
  console.error(`${errors.length} problema(s):`);
  errors.slice(0, 60).forEach((e) => console.error(` - ${e}`));
  if (errors.length > 60) console.error(` … e mais ${errors.length - 60}`);
  process.exit(1);
}
const tlData = read('src/data/timeline.json');
const peopleCount = read('src/data/people.json').people.length;
const maps = books.filter((s) => read(`src/data/info/${s}.json`).map).length;
console.log(`OK: ${books.length} fichas (${maps} com mapa), ${versionIds.length} versões (${versionIds.join(', ')}), linha do tempo com ${tlData.periods.length} períodos e ${tlData.events.length} eventos, ${peopleCount} personagens.`);
