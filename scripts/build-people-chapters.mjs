// Gera src/data/people-chapters.json (capítulos em que cada personagem é citado pelo nome) e docs/personagens-por-capitulo.md.
// Rode depois de mudar people.json, people-aliases.json, people-chapters-overrides.json ou o texto da Bíblia Livre:
//   node scripts/build-people-chapters.mjs
// Determinístico e sem rede. O JSON é conferido pelo `npm run check` (refaz a busca em memória e compara).
import fs from 'node:fs';
import path from 'node:path';
import { buildPeopleChapters, jsonText } from './people-chapters-lib.mjs';

const root = path.resolve(import.meta.dirname, '..');
const bookNames = (books) => {
  const src = fs.readFileSync(path.join(root, 'src/data/books.js'), 'utf8');
  return Object.fromEntries([...src.matchAll(/^\s*\['(\w+)', '([^']*)', '([^']*)'/gm)].map((m) => [m[1], m[2]]).filter(([s]) => books.includes(s)));
};

function ranges(list) {
  const out = [];
  for (let i = 0; i < list.length; i++) {
    let j = i;
    while (j + 1 < list.length && list[j + 1] === list[j] + 1) j++;
    out.push(j - i >= 2 ? `${list[i]}–${list[j]}` : list.slice(i, j + 1).join(', '));
    i = j;
  }
  return out.join(', ');
}

function report(r, date) {
  const { data, pending, only, outside, people, books, chaptersOf } = r;
  const sig = bookNames(books);
  const nm = (id) => people.find((p) => p.id === id)?.name.pt ?? id;
  const L = [];
  const withCh = Object.keys(data);
  const pairs = Object.values(data).reduce((s, per) => s + Object.values(per).reduce((t, rows) => t + rows.length, 0), 0);
  const pendList = [...pending.entries()].flatMap(([book, list]) => list.map((h) => ({ ...h, book })));
  const byPerson = new Map();
  for (const h of pendList) for (const id of h.ids) byPerson.set(id, (byPerson.get(id) ?? 0) + 1);

  L.push('# Personagens por capítulo (relatório gerado)', '');
  L.push(`Gerado em ${date} por \`node scripts/build-people-chapters.mjs\`. **Não edite à mão**: as decisões vão em \`scripts/data/people-chapters-overrides.json\` e \`scripts/data/people-aliases.json\`.`, '');
  L.push('"Aparece" aqui significa **citado pelo nome** no texto da Bíblia Livre (nada de pronome nem contexto), nos livros de `books[]` do personagem.', '');
  L.push('## Totais', '');
  L.push(`- Personagens em people.json: ${people.length}`);
  L.push(`- Com pelo menos um capítulo: ${withCh.length}`);
  L.push(`- Sem nenhum capítulo achado: ${people.length - withCh.length}`);
  L.push(`- Pares personagem + livro + capítulo: ${pairs}`);
  L.push(`- Ocorrências ambíguas ainda "a revisar": ${pendList.length}`, '');

  const none = people.filter((p) => !data[p.id]);
  L.push('## Personagens sem nenhum capítulo achado', '');
  L.push('Provável causa: grafia diferente na Bíblia Livre (acrescente em `people-aliases.json`), `autoLink: false`, ou o nome não aparece no texto (ex.: "as filhas de Zelofeade").', '');
  for (const p of none) L.push(`- \`${p.id}\` — ${p.name.pt}${p.autoLink === false ? ' (autoLink: false, só `include` manual)' : ''}; livros: ${p.books.map((b) => b.book).join(', ')}`);
  L.push('');

  L.push('## Achados fora de `books[]` (não entram no JSON)', '');
  L.push('Nome sem ambiguidade citado em livro que não consta em `books[]` do personagem. Se o livro deve constar, acrescente em people.json (precisa de `role` PT/EN, decisão sua); a lateral só mostra o que está em `books[]`.', '');
  const out = outside.filter((o) => o.chapters.length).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : books.indexOf(a.book) - books.indexOf(b.book)));
  for (const o of out) L.push(`- ${nm(o.id)} (\`${o.id}\`) em ${sig[o.book]}: ${o.title ? 'títulos dos salmos ' : 'caps. '}${ranges(o.chapters.sort((a, b) => a - b))}`);
  L.push('');

  L.push('## Lacunas: capítulos de livros bem cobertos sem o nome', '');
  L.push('Livros em que o personagem aparece em pelo menos metade dos capítulos; os que faltam podem ser capítulos em que ele age sem ser nomeado. Se quiser mostrá-lo ali, use `include`.', '');
  for (const [id, per] of Object.entries(data)) for (const [b, rows] of Object.entries(per)) {
    const total = chaptersOf(b), got = rows.map((x) => x[0]);
    if (total >= 4 && got.length >= total / 2 && got.length < total) {
      const miss = []; for (let c = 1; c <= total; c++) if (!got.includes(c)) miss.push(c);
      L.push(`- ${nm(id)} em ${sig[b]}: faltam ${ranges(miss)} (${got.length} de ${total})`);
    }
  }
  L.push('');

  L.push('## Conferência PT × EN (Bíblia Livre × KJV)', '');
  L.push('Diferenças entre as duas buscas. Costumam ser grafia (aliases) ou diferença de texto entre as versões; não entram no JSON.', '');
  for (const o of only.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : books.indexOf(a.book) - books.indexOf(b.book)))) {
    const bits = [];
    if (o.onlyPt.length) bits.push(`só na Bíblia Livre: ${ranges(o.onlyPt)}`);
    if (o.onlyEn.length) bits.push(`só na KJV: ${ranges(o.onlyEn)}`);
    L.push(`- ${nm(o.id)} em ${sig[o.book]}: ${bits.join('; ')}`);
  }
  L.push('');

  L.push('## A revisar (nome ambíguo, não incluído por padrão)', '');
  L.push('O mesmo nome serve a mais de um personagem do livro. Decida com `assign` em `people-chapters-overrides.json` (alias + livro + capítulos → personagem).', '');
  L.push('| Personagem | Ocorrências pendentes |', '|---|---|');
  for (const [id, n] of [...byPerson].sort((a, b) => (a[0] < b[0] ? -1 : 1))) L.push(`| ${nm(id)} (\`${id}\`) | ${n} |`);
  L.push('');
  const groups = new Map();
  for (const h of pendList) {
    const k = `${h.alias}\u0000${h.book}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(h);
  }
  for (const [k, list] of [...groups].sort((a, b) => { const [x, bx] = a[0].split('\u0000'), [y, by] = b[0].split('\u0000'); return x < y ? -1 : x > y ? 1 : books.indexOf(bx) - books.indexOf(by); })) {
    const [alias, book] = k.split('\u0000');
    L.push(`### "${alias}" em ${sig[book]} — candidatos: ${list[0].ids.map((i) => `\`${i}\``).join(', ')}`, '');
    const perCh = new Map();
    for (const h of list) { if (!perCh.has(h.ch)) perCh.set(h.ch, []); perCh.get(h.ch).push(h); }
    for (const [ch, hs] of [...perCh].sort((a, b) => a[0] - b[0])) L.push(`- ${ch}:${hs.map((h) => h.v).join(',')} (${hs.length}×) — «…${hs[0].snippet}…»`);
    L.push('');
  }
  return L.join('\n');
}

if (process.argv[1]?.endsWith('build-people-chapters.mjs')) {
  const r = buildPeopleChapters({ root, withReport: true });
  fs.writeFileSync(path.join(root, 'src/data/people-chapters.json'), jsonText(r.data));
  const date = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(path.join(root, 'docs/personagens-por-capitulo.md'), report(r, date) + '\n');
  const pend = [...r.pending.values()].reduce((s, l) => s + l.length, 0);
  console.log(`src/data/people-chapters.json: ${Object.keys(r.data).length} personagens com capítulos; ${r.people.length - Object.keys(r.data).length} sem; ${pend} ocorrências a revisar`);
}
