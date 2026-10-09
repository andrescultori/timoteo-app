// Personagens por capítulo: acha, no texto bíblico, em quais capítulos cada personagem é CITADO PELO NOME.
// Só aparição nomeada (nada de pronome nem contexto). Funções puras + `buildPeopleChapters`, usadas por
// scripts/build-people-chapters.mjs (gera src/data/people-chapters.json e o relatório), pelo `npm run check` e pelos testes.
//
// Regras (ver docs/formatos-de-dados.md):
//  - casamento por palavra inteira, SENSÍVEL a maiúsculas e a acentos (grafias alternativas ficam em people-aliases.json);
//  - o nome mais longo vence ("José de Arimateia" não conta como "José"); hífen colado não conta ("Abel-Maim" não é "Abel");
//  - cada personagem só é procurado nos livros de `books[]` (e em `linkBooks`, se houver); `autoLink: false` desliga a busca automática;
//  - nome que serve a mais de um personagem do mesmo livro NÃO é decidido: vai para "a revisar" (relatório) até haver um `assign`;
//  - quem decide o que entra ou sai é o André, em scripts/data/people-chapters-overrides.json (assign, include, exclude).
import fs from 'node:fs';
import path from 'node:path';

const L = '\\p{L}\\p{N}';
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const REVIEW = '?';
export const baseAlias = (name) => name.split(/[,(]/)[0].trim();

export function readBooks(root) {
  return [...fs.readFileSync(path.join(root, 'src/data/books.js'), 'utf8').matchAll(/^\s*\['(\w+)', '[^']*', '[^']*', '[^']*', '[^']*', '(\w+)'\]/gm)].map((m) => m[1]);
}

// Livros em que o personagem é procurado automaticamente
export function searchBooks(p) {
  const all = p.books.map((b) => b.book);
  return p.linkBooks ? all.filter((b) => p.linkBooks.includes(b)) : all;
}

// aliases (derivados do nome + extras de people-aliases.json) por idioma
export function aliasesOf(p, lang, extra = {}) {
  const set = new Set();
  const a = baseAlias(p.name[lang]);
  if (a.length >= 2) set.add(a);
  for (const x of extra[p.id]?.[lang] ?? []) set.add(x);
  return [...set];
}

// aliases que NUNCA se resolvem sozinhos (ex.: "Herodes" pode ser mais de um, "Simão" também): vão sempre para "a revisar"
export const reviewAliasesOf = (p, lang, extra = {}) => extra[p.id]?.[`${lang}Review`] ?? [];

// alias → ids dos personagens (restritos a `ids`, se dado)
export function aliasTable(people, lang, extra, filter = () => true) {
  const t = new Map();
  for (const p of people) {
    if (p.autoLink === false || !filter(p)) continue;
    for (const a of [...aliasesOf(p, lang, extra), ...reviewAliasesOf(p, lang, extra)]) {
      if (!t.has(a)) t.set(a, []);
      if (!t.get(a).includes(p.id)) t.get(a).push(p.id);
    }
    for (const a of reviewAliasesOf(p, lang, extra)) if (!t.get(a).includes(REVIEW)) t.get(a).push(REVIEW);
  }
  // nome curto que é o começo do nome de outro personagem do mesmo livro ("João" × "João Batista") também é ambíguo
  for (const [a, ids] of t) {
    for (const [b, others] of t) {
      if (b.startsWith(a + ' ')) for (const o of others) if (o !== REVIEW && !ids.includes(o)) ids.push(o);
    }
  }
  return t;
}

export function compile(table) {
  const names = [...table.keys()].sort((a, b) => b.length - a.length || (a < b ? -1 : 1));
  if (!names.length) return null;
  return new RegExp(`(?<![${L}]|[${L}]-)(${names.map(esc).join('|')})(?![${L}]|-[${L}])`, 'gu');
}

// Procura num livro (chapters[c][v] = texto ou null). Devolve:
//   hits: Map id → Map capítulo → { n, first }       (alias que serve a uma pessoa só)
//   amb:  [{ alias, ch, v, ids, snippet }]            (alias que serve a mais de uma)
//   `local` = ids procurados neste livro (os demais nomes só "consomem" o trecho, para o nome mais longo vencer: "Judas Iscariotes" não vira "Judas")
export function scanBook(chapters, table, re, local = null) {
  const hits = new Map();
  const amb = [];
  if (!re) return { hits, amb };
  chapters.forEach((verses, ci) => {
    verses.forEach((text, vi) => {
      if (!text) return;
      for (const m of text.matchAll(re)) {
        let ids = table.get(m[1]);
        if (local) ids = ids.filter((i) => i === REVIEW || local.has(i));
        if (!ids.some((i) => i !== REVIEW)) continue; // só personagens de outros livros
        if (ids.length === 1) {
          if (!hits.has(ids[0])) hits.set(ids[0], new Map());
          const per = hits.get(ids[0]);
          const cur = per.get(ci + 1);
          if (cur) cur.n++; else per.set(ci + 1, { n: 1, first: vi + 1 });
        } else {
          amb.push({ alias: m[1], ch: ci + 1, v: vi + 1, ids: ids.filter((i) => i !== REVIEW), snippet: text.slice(Math.max(0, m.index - 40), m.index + m[1].length + 40).trim() });
        }
      }
    });
  });
  return { hits, amb };
}

// "3–11", "3-11", 5 ou lista deles → lista ordenada de capítulos
export function expandChapters(spec) {
  const out = new Set();
  for (const s of Array.isArray(spec) ? spec : [spec]) {
    if (typeof s === 'number') { out.add(s); continue; }
    const m = String(s).match(/^(\d+)(?:\s*[–-]\s*(\d+))?$/);
    if (!m) throw new Error(`capítulos inválidos: ${JSON.stringify(s)}`);
    for (let c = Number(m[1]); c <= Number(m[2] ?? m[1]); c++) out.add(c);
  }
  return [...out].sort((a, b) => a - b);
}

// Aplica, nesta ordem, assign (resolve ambíguos), include e exclude (quem exclui tem a última palavra). `auto` = Map id → Map livro → Map cap → {n, first}; `amb` = Map livro → lista de ambíguos.
export function applyOverrides(auto, amb, overrides, ctx) {
  const { personIds, books, chaptersOf } = ctx;
  const bad = (m) => { throw new Error(`people-chapters-overrides.json: ${m}`); };
  const check = (id, book, chs) => {
    if (!personIds.has(id)) bad(`personagem desconhecido "${id}"`);
    if (!books.includes(book)) bad(`livro desconhecido "${book}"`);
    for (const c of chs) if (c < 1 || c > chaptersOf(book)) bad(`${book} não tem o capítulo ${c}`);
  };
  const add = (id, book, ch, n, first) => {
    if (!auto.has(id)) auto.set(id, new Map());
    if (!auto.get(id).has(book)) auto.get(id).set(book, new Map());
    const per = auto.get(id).get(book);
    const cur = per.get(ch);
    if (cur) { cur.n += n; cur.first = Math.min(cur.first, first); } else per.set(ch, { n, first });
  };
  const rest = new Map();
  for (const [book, list] of amb) rest.set(book, [...list]);

  for (const a of overrides.assign ?? []) {
    const chs = expandChapters(a.chapters);
    check(a.person, a.book, chs);
    const list = rest.get(a.book) ?? [];
    let used = 0;
    rest.set(a.book, list.filter((h) => {
      if (h.alias !== a.alias || !chs.includes(h.ch)) return true;
      if (!h.ids.includes(a.person)) bad(`assign "${a.alias}" em ${a.book}: "${a.person}" não é um dos candidatos (${h.ids.join(', ')})`);
      add(a.person, a.book, h.ch, 1, h.v);
      used++;
      return false;
    }));
    if (!used) bad(`assign "${a.alias}" em ${a.book} ${a.chapters}: nenhuma ocorrência ambígua nesses capítulos`);
  }
  for (const x of overrides.include ?? []) {
    const chs = expandChapters(x.chapters);
    check(x.person, x.book, chs);
    for (const c of chs) if (!auto.get(x.person)?.get(x.book)?.has(c)) add(x.person, x.book, c, 0, 0); // 0 = incluído à mão
  }
  for (const x of overrides.exclude ?? []) {
    const chs = expandChapters(x.chapters);
    check(x.person, x.book, chs);
    for (const c of chs) auto.get(x.person)?.get(x.book)?.delete(c);
  }
  return rest;
}

// Resultado final ordenado: { id: { livro: [[capítulo, ocorrências, 1º versículo], ...] } }; versículo 0 = título do salmo, n = 0 e 1º versículo 0 = à mão
export function toJson(auto, books) {
  const out = {};
  for (const id of [...auto.keys()].sort()) {
    const per = {};
    for (const b of [...auto.get(id).keys()].sort((x, y) => books.indexOf(x) - books.indexOf(y))) {
      const m = auto.get(id).get(b);
      const rows = [...m.keys()].sort((x, y) => x - y).map((c) => [c, m.get(c).n, m.get(c).first]);
      if (rows.length) per[b] = rows;
    }
    if (Object.keys(per).length) out[id] = per;
  }
  return out;
}

// Texto do arquivo: uma linha por livro, estável
export function jsonText(data) {
  const ids = Object.keys(data);
  return '{\n' + ids.map((id) => `  ${JSON.stringify(id)}: {\n` + Object.entries(data[id]).map(([b, rows]) => `    ${JSON.stringify(b)}: ${JSON.stringify(rows)}`).join(',\n') + '\n  }').join(',\n') + '\n}\n';
}

export function loadInputs(root) {
  const rd = (p, dflt) => (fs.existsSync(path.join(root, p)) ? JSON.parse(fs.readFileSync(path.join(root, p), 'utf8')) : dflt);
  return {
    people: rd('src/data/people.json').people,
    extra: rd('scripts/data/people-aliases.json', {}),
    overrides: rd('scripts/data/people-chapters-overrides.json', {}),
    psalms: rd('src/data/psalms.json').psalms,
    counts: rd('src/data/counts.json'),
    books: readBooks(root),
  };
}

const bible = (root, version, n) => JSON.parse(fs.readFileSync(path.join(root, `public/bible/${version}/${n}.json`), 'utf8'));

export function buildPeopleChapters({ root, inputs = loadInputs(root), withReport = false }) {
  const { people, extra, overrides, psalms, counts, books } = inputs;
  const chaptersOf = (b) => counts[books.indexOf(b) + 1][0];
  const personIds = new Set(people.map((p) => p.id));
  const byId = new Map(people.map((p) => [p.id, p]));
  const auto = new Map();
  const amb = new Map();
  const only = new Map(); // relatório: achados só em PT / só em EN
  const outside = new Map(); // relatório: achados fora de books[]

  const globalPt = aliasTable(people, 'pt', extra);
  const globalPtRe = compile(globalPt);
  const globalEn = aliasTable(people, 'en', extra);
  const globalEnRe = compile(globalEn);
  const uniquePt = new Map([...globalPt].filter(([, ids]) => ids.length === 1));
  const uniqueRe = compile(uniquePt);

  books.forEach((book, bi) => {
    const n = bi + 1;
    const here = (p) => searchBooks(p).includes(book);
    const local = new Set(people.filter(here).map((p) => p.id));
    const pt = bible(root, 'blivre', n);
    const { hits, amb: a } = scanBook(pt, globalPt, globalPtRe, local);
    for (const [id, per] of hits) {
      if (!auto.has(id)) auto.set(id, new Map());
      auto.get(id).set(book, per);
    }
    if (a.length) amb.set(book, a);

    if (!withReport) return;
    // conferência: a mesma busca na KJV, com os nomes em inglês
    const en = bible(root, 'kjv', n);
    const r = scanBook(en, globalEn, globalEnRe, local);
    for (const p of people.filter(here)) {
      const a1 = [...(hits.get(p.id)?.keys() ?? [])];
      const a2 = [...(r.hits.get(p.id)?.keys() ?? [])];
      const onlyPt = a1.filter((c) => !a2.includes(c)).sort((x, y) => x - y);
      const onlyEn = a2.filter((c) => !a1.includes(c)).sort((x, y) => x - y);
      if (onlyPt.length || onlyEn.length) only.set(`${p.id}\u0000${book}`, { id: p.id, book, onlyPt, onlyEn });
    }
    // segunda passada: nomes sem ambiguidade em livros que NÃO estão em books[] do personagem
    const o = scanBook(pt, uniquePt, uniqueRe);
    for (const [id, per] of o.hits) {
      const p = byId.get(id);
      if (p.autoLink === false || searchBooks(p).includes(book) || p.books.some((b) => b.book === book)) continue;
      outside.set(`${id}\u0000${book}`, { id, book, chapters: [...per.keys()].sort((x, y) => x - y) });
    }
  });

  // títulos dos salmos: pessoas citadas no título histórico (dado explícito de psalms.json); autoria não conta
  for (const ps of psalms) {
    for (const id of ps.hist?.people ?? []) {
      const p = byId.get(id);
      if (!p) throw new Error(`psalms.json: personagem desconhecido "${id}" (salmo ${ps.n})`);
      if (!searchBooks(p).includes('psa')) {
        const k = `${id}\u0000psa`;
        const cur = outside.get(k) ?? { id, book: 'psa', chapters: [], title: true };
        cur.chapters.push(ps.n);
        outside.set(k, cur);
        continue;
      }
      if (!auto.has(id)) auto.set(id, new Map());
      if (!auto.get(id).has('psa')) auto.get(id).set('psa', new Map());
      const per = auto.get(id).get('psa');
      const cur = per.get(ps.n);
      if (cur) { cur.n++; cur.first = 0; } else per.set(ps.n, { n: 1, first: 0 });
    }
  }

  const pending = applyOverrides(auto, amb, overrides, { personIds, books, chaptersOf });
  const data = toJson(auto, books);
  if (!withReport) return { data };
  return { data, pending, only: [...only.values()], outside: [...outside.values()], people, books, chaptersOf };
}
