// Gera os dados dos "originais" (hebraico no AT, grego no NT), palavra a palavra, em public/interlinear/.
//
//   node scripts/build-interlinear.mjs [--src /home/user] [--check]
//
// Fontes (clones rasos, FORA do repositório; nada bruto é commitado). Caminhos relativos a --src (padrão /home/user):
//   openscriptures/morphhb/wlc/*.xml                 OSHB: texto do WLC (domínio público) + lema e morfologia (CC BY 4.0)
//   openscriptures/hebrewlexicon/{LexicalIndex,HebrewStrong}.xml   Léxico hebraico (CC BY 4.0; BDB e Strong em domínio público)
//   biblicalhumanities/nestle1904/morph/Nestle1904.csv   Nestlé 1904: texto (domínio público), morfologia, lema e Strong (CC0)
//   biblicalhumanities/nestle1904/glosses/berean-interlinear-glosses.xml   glosas da Berean Interlinear (domínio público, segundo o README do repositório)
//   morphgnt/strongs-dictionary-xml/strongsgreek.xml  Strong grego (CC0)
//
// Determinístico, sem rede, sem IA: só o que as fontes trazem. Onde a fonte não tem Strong ou glosa, a palavra fica sem ela.
//
// Saída: public/interlinear/<n>.json (n = 1..66, ordem canônica), lex-h.json e lex-g.json (léxicos, só os números usados).
// Formato (ver docs/formatos-de-dados.md):
//   { v: 1, lang: 'he'|'grc', src: {...}, m: [códigos de morfologia],
//     w: [capítulo][versículo] -> [[texto, strong, idxMorfologia, glosa?], ...]   (numeração da KJV; posição i = versículo i+1),
//     t: { "<cap>": [palavras do título] }   (só Salmos e Habacuque 3: título não numerado na KJV) }
// Strong: "H7225", "H1254a" (a letra distingue sentidos no OSHB) ou "G3056". Hebraico em ordem lógica (a direção é da interface).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const SRC = arg('--src', '/home/user');
const OUT = path.join(root, 'public/interlinear');
const problems = [];
const missing = new Map();
const fail = (m) => problems.push(m);
const warn = [];

const counts = JSON.parse(fs.readFileSync(path.join(root, 'src/data/counts.json'), 'utf8')); // { n: [capítulos, versículos] }
const kjvChapters = (n) => JSON.parse(fs.readFileSync(path.join(root, `public/bible/kjv/${n}.json`), 'utf8')).map((c) => c.length);

// ---- livros --------------------------------------------------------------------------------------------------------------
const OSHB_FILES = ('Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr Ezra Neh Esth Job Ps Prov Eccl Song Isa Jer Lam Ezek Dan '
  + 'Hos Joel Amos Obad Jonah Mic Nah Hab Zeph Hag Zech Mal').split(' ');
const NT_CODES = ('Matt Mark Luke John Acts Rom 1Cor 2Cor Gal Eph Phil Col 1Thess 2Thess 1Tim 2Tim Titus Phlm Heb Jas 1Pet 2Pet 1John 2John 3John Jude Rev').split(' ');
const bookNumber = { ...Object.fromEntries(OSHB_FILES.map((c, i) => [c, i + 1])), ...Object.fromEntries(NT_CODES.map((c, i) => [c, 40 + i])) };

const read = (...p) => fs.readFileSync(path.join(SRC, ...p), 'utf8');
const gitRev = (...p) => { try { return execFileSync('git', ['-C', path.join(SRC, ...p), 'rev-parse', '--short=12', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { return null; } };
const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e) => {
  if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
  return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[e.toLowerCase()];
});

// ---- hebraico (OSHB) -----------------------------------------------------------------------------------------------------
// Cada versículo do WLC pode trazer <note>KJV:Livro.cap.v</note>: marca onde começa um versículo da numeração da KJV
// (no meio do versículo, quando o título do salmo vem junto). Entre duas notas, as palavras pertencem ao versículo da última nota.
function parseHebrewBook(code) {
  const xml = read('openscriptures/morphhb/wlc', `${code}.xml`);
  const n = bookNumber[code];
  const words = []; // { ch, v, text, lemma, morph, pre }
  const mk = (h, w) => ({ ch: h.kch, v: h.kv, text: w.text, lemma: w.lemma, morph: w.morph, pre: h.pre });
  let cur = null; // posição KJV atual { kch, kv, pre }
  let offset = 0; // deslocamento (versículo KJV - versículo hebraico) da última nota do capítulo
  let hebCh = 0;
  let firstNoteInChapter = true;
  const chapters = xml.split(/<chapter osisID="/).slice(1);
  for (const chunk of chapters) {
    hebCh = Number(chunk.match(/^[A-Za-z0-9]+\.(\d+)"/)[1]);
    cur = { kch: hebCh, kv: 1, pre: false };
    offset = 0;
    firstNoteInChapter = true;
    let sawNote = false;
    const preWords = [];
    for (const vchunk of chunk.split(/<verse osisID="/).slice(1)) {
      const hv = Number(vchunk.match(/^[A-Za-z0-9]+\.\d+\.(\d+)"/)[1]);
      cur = { kch: sawNote ? cur.kch : hebCh, kv: hv + offset, pre: false }; // sem nota no início do versículo: mesmo deslocamento da última nota
      let body = vchunk.slice(vchunk.indexOf('>') + 1, vchunk.indexOf('</verse>'));
      // ketiv + qere: vale o qere (é o que se lê e o que a KJV segue)
      body = body.replace(/<w type="x-ketiv"[^>]*>[^<]*<\/w>\s*<note type="variant">[\s\S]*?<rdg type="x-qere">(<w [^>]*>[^<]*<\/w>)<\/rdg>[\s\S]*?<\/note>/g, '$1');
      body = body.replace(/<note type="variant">[\s\S]*?<\/note>/g, '');
      body = body.replace(/<note (?:n|type)="[^"]*">[\s\S]*?<\/note>/g, '');
      const re = /<note>KJV:[A-Za-z0-9]+\.(\d+)\.(\d+)<\/note>|<w\b([^>]*)>([^<]*)<\/w>|<seg type="([^"]*)">([^<]*)<\/seg>/g;
      let m;
      while ((m = re.exec(body))) {
        if (m[1]) {
          const kch = Number(m[1]); const kv = Number(m[2]);
          if (firstNoteInChapter) { firstNoteInChapter = false; if (kv === 1 && kch === hebCh) for (const w of preWords) w.pre = true; }
          sawNote = true;
          cur = { kch, kv, pre: false };
          offset = kv - hv;
        } else if (m[3] !== undefined) {
          const lemma = (m[3].match(/lemma="([^"]*)"/) ?? [])[1] ?? '';
          const morph = (m[3].match(/morph="([^"]*)"/) ?? [])[1] ?? '';
          const w = { ch: cur.kch, v: cur.kv, text: decode(m[4]).replace(/\//g, ''), lemma, morph, pre: false };
          words.push(w);
          if (!sawNote) preWords.push(w);
        } else if (m[5] === 'x-maqqef' || m[5] === 'x-sof-pasuq' || m[5] === 'x-paseq') {
          const last = words[words.length - 1];
          if (last) last.text += decode(m[6]);
        }
      }
    }
  }
  return { n, words };
}

// lema do OSHB ("b/7225", "1254 a", "1339+") -> "H7225", "H1254a"
function strongOf(lemma) {
  const main = lemma.split('/').pop().trim();
  const m = main.match(/^(\d+)\s*([a-z])?/);
  return m ? `H${m[1]}${m[2] ?? ''}` : null;
}

// ---- léxico hebraico -----------------------------------------------------------------------------------------------------
function loadHebrewLexicon() {
  const li = read('openscriptures/hebrewlexicon/LexicalIndex.xml');
  const byKey = new Map(); // "H1254a" -> [lema, translit, glosa]
  for (const m of li.matchAll(/<entry id="[^"]*">\s*<w xlit="([^"]*)">([^<]*)<\/w>\s*(?:<pos>[^<]*<\/pos>)?\s*(?:<def>([^<]*)<\/def>)?\s*<xref [^>]*?strong="(\d+)"(?: aug="([a-z])")?[^>]*\/>/g)) {
    const [, xlit, lemma, def, num, aug] = m;
    if (!def) continue;
    const key = `H${num}${aug ?? ''}`;
    if (!byKey.has(key)) byKey.set(key, [decode(lemma), decode(xlit), decode(def)]);
  }
  // Strong simples (sem a letra), para palavras cujo lema não traz a letra, e como último recurso
  const hs = read('openscriptures/hebrewlexicon/HebrewStrong.xml');
  const strong = new Map();
  for (const m of hs.matchAll(/<entry id="(H\d+)">\s*<w [^>]*xlit="([^"]*)"[^>]*>([^<]*)<\/w>([\s\S]*?)<\/entry>/g)) {
    const def = (m[4].match(/<def>([^<]*)<\/def>/) ?? [])[1];
    strong.set(m[1], [decode(m[3]), decode(m[2]), def ? decode(def) : '']);
  }
  return { byKey, strong };
}

// ---- grego ---------------------------------------------------------------------------------------------------------------
function loadGreekLexicon() {
  const xml = read('morphgnt/strongs-dictionary-xml/strongsgreek.xml');
  const out = new Map();
  for (const m of xml.matchAll(/<entry strongs="(\d+)">([\s\S]*?)<\/entry>/g)) {
    const g = m[2].match(/<greek [^>]*unicode="([^"]*)"[^>]*translit="([^"]*)"/) ?? m[2].match(/<greek [^>]*translit="([^"]*)"[^>]*unicode="([^"]*)"/);
    const def = (m[2].match(/<strongs_def>([\s\S]*?)<\/strongs_def>/) ?? [])[1] ?? '';
    const clean = (s) => decode(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
    out.set(`G${Number(m[1])}`, [g ? decode(g[1]) : '', g ? decode(g[2]) : '', clean(def)]);
  }
  return out;
}

function parseNT(glossXml) {
  const csv = read('biblicalhumanities/nestle1904/morph/Nestle1904.csv').replace(/^﻿/, '').split('\n').slice(1).filter(Boolean);
  const gl = new Map(); // "Matt.1.1!3" -> [greek, gloss]
  for (const m of glossXml.matchAll(/<w [^>]*osisId="([^"]+)">\s*<greek>([^<]*)<\/greek>\s*<gloss>([^<]*)<\/gloss>/g)) gl.set(m[1], [decode(m[2]), decode(m[3])]);
  const books = {};
  const idx = new Map();
  let aligned = 0; let glossMiss = 0; let glossDash = 0;
  for (const line of csv) {
    const f = line.split('\t');
    const m = f[0].match(/^(\S+) (\d+):(\d+)$/);
    if (!m) { fail(`Nestle1904.csv: referência inesperada "${f[0]}"`); continue; }
    const [, code, ch, v] = m;
    const b = (books[code] ??= { words: [] });
    const key = `${code}.${ch}.${v}`;
    const i = (idx.get(key) ?? 0) + 1; idx.set(key, i);
    const strong = f[4] ? `G${Number(f[4].split('&')[0])}` : null;
    let gloss = null;
    const g = gl.get(`${key}!${i}`);
    if (g) {
      const norm = (s) => s.normalize('NFC').replace(/[\s·.,;:!?··;()\[\]"“”‘’'—–-]/g, '');
      if (norm(g[0]) === norm(f[1])) { aligned += 1; if (g[1] && g[1] !== '-') gloss = g[1]; else glossDash += 1; } else glossMiss += 1;
    } else glossMiss += 1;
    const ex = NT_EXCEPTIONS[`${code} ${ch}:${v}`];
    if (ex === null) { dropped.push(`${code} ${ch}:${v}`); continue; }
    b.words.push({ ch: ex ? ex[0] : Number(ch), v: ex ? ex[1] : Number(v), text: f[1], strong, morph: f[2], gloss });
  }
  return { books, stats: { aligned, glossMiss, glossDash } };
}

// Nestlé 1904 × KJV: versículos que a KJV numera de outro jeito (o único trabalho manual; o resto vem das fontes).
// null = não existe na KJV (a "conclusão curta" de Marcos), então as palavras ficam de fora.
const NT_EXCEPTIONS = {
  '3John 1:15': [1, 14], // o último versículo da 3 João, que a KJV junta ao 14
  'Rev 12:18': [13, 1], // "E parou sobre a areia do mar": na KJV é o começo de Ap 13:1
};
NT_EXCEPTIONS['Mark 16:99'] = null;
const dropped = [];

// ---- montagem ------------------------------------------------------------------------------------------------------------
function assemble(n, lang, words, src) {
  const kc = kjvChapters(n);
  const m = []; const mIdx = new Map();
  const mi = (s) => { if (!mIdx.has(s)) { mIdx.set(s, m.length); m.push(s); } return mIdx.get(s); };
  const w = kc.map((nv) => Array.from({ length: nv }, () => []));
  const t = {};
  for (const x of words) {
    const word = [x.text, x.strong, mi(x.morph)];
    if (x.gloss) word.push(x.gloss);
    if (x.pre) { (t[x.ch] ??= []).push(word); continue; }
    const chap = w[x.ch - 1];
    if (!chap || !chap[x.v - 1]) { const k = `livro ${n}: ${x.ch}:${x.v} não existe na KJV`; missing.set(k, (missing.get(k) ?? 0) + 1); continue; }
    chap[x.v - 1].push(word);
  }
  return { v: 1, lang, src, m, w, ...(Object.keys(t).length ? { t } : {}) };
}

function main() {
  const used = new Set();
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const lexH = loadHebrewLexicon();
  const lexG = loadGreekLexicon();
  const hsrc = { oshb: gitRev('openscriptures/morphhb'), lexicon: gitRev('openscriptures/hebrewlexicon') };
  const gsrc = { nestle1904: gitRev('biblicalhumanities/nestle1904'), strongs: gitRev('morphgnt/strongs-dictionary-xml') };
  const total = { words: 0, noStrong: 0 };

  for (const code of OSHB_FILES) {
    const { n, words } = parseHebrewBook(code);
    for (const x of words) { x.strong = strongOf(x.lemma); total.words += 1; if (!x.strong) total.noStrong += 1; else used.add(x.strong); }
    write(n, assemble(n, 'he', words, hsrc));
  }
  const gloss = fs.readFileSync(path.join(SRC, 'biblicalhumanities/nestle1904/glosses/berean-interlinear-glosses.xml'), 'utf8');
  const nt = parseNT(gloss);
  for (const code of NT_CODES) {
    const b = nt.books[code];
    if (!b) { fail(`Nestle1904.csv: sem o livro ${code}`); continue; }
    for (const x of b.words) { total.words += 1; if (!x.strong) total.noStrong += 1; else used.add(x.strong); }
    write(bookNumber[code], assemble(bookNumber[code], 'grc', b.words, gsrc));
  }

  // léxicos: só os números usados
  const lh = {}; const lg = {};
  for (const k of [...used].sort()) {
    if (k[0] === 'H') {
      const e = lexH.byKey.get(k) ?? lexH.byKey.get(k.replace(/[a-z]$/, '')) ?? lexH.strong.get(k.replace(/[a-z]$/, ''));
      if (e) lh[k] = e; else warn.push(`léxico hebraico sem entrada para ${k}`);
    } else {
      const e = lexG.get(k);
      if (e) lg[k] = e; else warn.push(`léxico grego sem entrada para ${k}`);
    }
  }
  fs.writeFileSync(path.join(OUT, 'lex-h.json'), JSON.stringify({ v: 1, src: hsrc, e: lh }));
  fs.writeFileSync(path.join(OUT, 'lex-g.json'), JSON.stringify({ v: 1, src: gsrc, e: lg }));

  for (const [k, c] of missing) fail(`${k} (${c} palavras)`);
  console.log(`palavras: ${total.words} (sem Strong: ${total.noStrong}); glosas Berean alinhadas: ${nt.stats.aligned}, sem alinhamento: ${nt.stats.glossMiss}, "-": ${nt.stats.glossDash}`);
  console.log(`léxicos: hebraico ${Object.keys(lh).length}, grego ${Object.keys(lg).length}`);
  if (warn.length) console.log(`avisos: ${warn.length} (ex.: ${warn.slice(0, 5).join('; ')})`);
  if (problems.length) { console.error(`\n${problems.length} problema(s):\n- ${problems.slice(0, 40).join('\n- ')}${problems.length > 40 ? `\n… e mais ${problems.length - 40}` : ''}`); process.exit(1); }
}

function write(n, data) { fs.writeFileSync(path.join(OUT, `${n}.json`), JSON.stringify(data)); }
main();
