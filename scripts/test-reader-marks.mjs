// Testes da seleção de versículos no leitor (src/verseSelect.js), das rotas com versículo (src/routeCore.js) e das cores de marcação por tema de
// leitura (src/readStyle.js): funções puras, sem navegador. A prova de pixels do leitor sem marcações é scripts/visual-regression.mjs (fora do CI).
import fs from 'node:fs';
import path from 'node:path';
import { toggleVerse, selectRange, sortedVerses, versesLabel, refLabel, commonCat, nextCat, withNote } from '../src/verseSelect.js';
import { parseHash, hrefs } from '../src/routeCore.js';
import { readStyle } from '../src/readStyle.js';
import { MARK_COLORS, markColors } from '../src/readingPrefs.js';

let passed = 0;
let failed = 0;
const ok = (cond, msg) => { if (cond) passed += 1; else { failed += 1; console.error(`FALHOU: ${msg}`); } };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg} (esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)})`);

// ---- seleção ----
{
  let s = new Set();
  s = toggleVerse(s, 16); s = toggleVerse(s, 17);
  eq(sortedVerses(s), [16, 17], 'tocar em dois números seleciona os dois');
  s = toggleVerse(s, 16);
  eq(sortedVerses(s), [17], 'tocar de novo desmarca');
  const orig = new Set([1]);
  toggleVerse(orig, 2);
  eq([...orig], [1], 'toggleVerse não altera o Set original');
  const existing = [1, 2, 3, 5, 6, 7]; // o 4 não existe nesta versão
  eq(sortedVerses(selectRange(new Set(), 2, 6, existing)), [2, 3, 5, 6], 'Shift: do âncora até o clicado, só versículos que existem');
  eq(sortedVerses(selectRange(new Set([1]), 6, 2, existing)), [1, 2, 3, 5, 6], 'Shift: de trás para frente e somando à seleção');
  eq(sortedVerses(selectRange(new Set(), null, 3, existing)), [3], 'Shift sem âncora seleciona só o clicado');
  eq(sortedVerses(selectRange(new Set([3]), 3, 3, existing)), [], 'Shift no próprio âncora desmarca');
  eq(sortedVerses([5, 3, 3, 1]), [1, 3, 5], 'ordem crescente e sem repetição');
}

// ---- rótulos ----
eq(versesLabel(3, [16]), '3.16', 'um versículo: 3.16');
eq(versesLabel(3, [16, 17]), '3.16-17', 'contíguos viram intervalo: 3.16-17');
eq(versesLabel(3, [16, 17, 18, 20]), '3.16-18, 20', 'intervalo e avulso');
eq(versesLabel(3, [20, 16, 17]), '3.16-17, 20', 'fora de ordem');
eq(versesLabel(119, [176]), '119.176', 'Salmo 119:176');
eq(versesLabel(3, []), '', 'sem seleção');
eq(refLabel('João', 3, [16, 17]), 'João 3.16-17', 'rótulo da barra');
eq(refLabel('1 Samuel', 17, [4, 50]), '1 Samuel 17.4, 50', 'livro com número');

// ---- categoria ativa e troca ----
{
  const marks = new Map([[16, { cat: 'c1', note: null }], [17, { cat: 'c1', note: 'n' }], [18, { cat: 'c2', note: null }], [19, { cat: null, note: 'só nota' }]]);
  eq(commonCat(marks, [16, 17]), 'c1', 'todos na mesma categoria: ela está ativa');
  eq(commonCat(marks, [16, 18]), null, 'categorias diferentes: nenhuma ativa');
  eq(commonCat(marks, [16, 20]), null, 'um sem marca: nenhuma ativa');
  eq(commonCat(marks, [19]), null, 'só nota não é categoria');
  eq(commonCat(marks, []), null, 'sem seleção');
  eq(nextCat(marks, [16, 17], 'c1'), null, 'tocar na categoria ativa de TODOS remove a marca');
  eq(nextCat(marks, [16, 17], 'c2'), 'c2', 'outra categoria troca');
  eq(nextCat(marks, [16, 18], 'c1'), 'c1', 'mistura: aplica a todos');
  eq(nextCat(marks, [20], 'c3'), 'c3', 'sem marca: aplica');
  eq(nextCat(marks, [16], 'c9'), 'c9', 'categoria inexistente passa adiante (o cleanMark do userdata a descarta)');
  eq(withNote(marks, [16, 17, 19]), 2, 'quantos têm nota');
}

// ---- rotas ----
const slugs = [...fs.readFileSync(path.resolve(import.meta.dirname, '../src/data/books.js'), 'utf8').matchAll(/^\s*\['(\w+)', /gm)].map((m) => m[1]);
ok(slugs.length === 66, 'achei os 66 livros');
const isBook = (s) => slugs.includes(s);
const P = (h) => parseHash(h, isBook);
eq(P('#joh/read/3/16'), { kind: 'book', slug: 'joh', tab: 'read', place: '3', verse: 16 }, 'rota com versículo');
eq(P('#joh/read/3'), { kind: 'book', slug: 'joh', tab: 'read', place: '3', verse: null }, 'rota só com capítulo (como antes)');
eq(P('#joh/read'), { kind: 'book', slug: 'joh', tab: 'read', place: null, verse: null }, 'rota sem capítulo');
eq(P('#joh').verse, null, 'livro sem aba');
eq(P('#joh/map/Laquis/5').verse, null, 'versículo só vale na aba Ler');
eq([P('#joh/read/3/0').verse, P('#joh/read/3/177').verse, P('#joh/read/3/x').verse, P('#joh/read/3/1234').verse], [null, null, null, null], 'versículo fora de 1..176 ou não numérico é ignorado');
eq(P('#joh/read/3/176').verse, 176, 'versículo 176 vale');
eq(P('#psa/read/119/105'), { kind: 'book', slug: 'psa', tab: 'read', place: '119', verse: 105 }, 'Salmo 119:105');
eq(P('#joh/sheet'), { kind: 'book', slug: 'joh', tab: 'summary', place: null, verse: null }, 'endereço antigo #joh/sheet continua');
eq(P('#joh/map/Laquis'), { kind: 'book', slug: 'joh', tab: 'map', place: 'Laquis', verse: null }, 'lugar do mapa continua');
eq(P('#psa/psalms/51').place, '51', 'salmo da tabela continua');
eq(P('#favorites'), { kind: 'favorites', tab: null }, 'favoritos sem aba: a tela escolhe');
eq(P('#favorites/verses').tab, 'verses', 'favoritos, aba Versículos');
eq(P('#favorites/items').tab, 'items', 'favoritos, aba Favoritos');
eq(P('#favorites/lixo').tab, null, 'aba desconhecida cai no padrão');
eq(P('#settings/reading'), { kind: 'settings', view: 'reading' }, 'opções de leitura continuam');
eq(P('#timeline/exodo'), { kind: 'timeline', id: 'exodo' }, 'linha do tempo continua');
eq(P('#nada'), { kind: 'home' }, 'rota desconhecida');
eq(P('#'), { kind: 'home' }, 'início');
eq([hrefs.book('joh', 'read', '3', 16), hrefs.book('joh', 'read', '3'), hrefs.book('joh', 'read'), hrefs.book('joh'), hrefs.book('joh', 'map', 'Laquis', 5), hrefs.book('psa', 'read', '23')],
  ['#joh/read/3/16', '#joh/read/3', '#joh/read', '#joh', '#joh/map/Laquis', '#psa/read/23'], 'hrefs.book');
eq([hrefs.favorites, hrefs.favoritesVerses], ['#favorites', '#favorites/verses'], 'hrefs de favoritos');
for (const slug of slugs) for (const [c, v] of [[1, 1], [3, 16], [150, 176]]) {
  const r = P(hrefs.book(slug, 'read', String(c), v));
  if (r.slug !== slug || r.tab !== 'read' || r.place !== String(c) || r.verse !== v) { ok(false, `ida e volta de ${slug} ${c}:${v}`); break; }
}
ok(true, 'ida e volta da rota com versículo em todos os livros');

// ---- cores por tema de leitura ----
for (const theme of ['light', 'sepia', 'dark']) {
  const st = readStyle({ theme, size: 21, spacing: 1.7, width: 660, font: 'serif' }, 'light');
  for (let i = 1; i <= 6; i += 1) {
    eq([st[`--mk${i}`], st[`--mk${i}i`]], [MARK_COLORS[theme].fill[i - 1], MARK_COLORS[theme].ink[i - 1]], `readStyle: ${theme}, categoria ${i}`);
  }
}
eq(readStyle({ theme: 'follow', size: 21, spacing: 1.7, width: 660, font: 'serif' }, 'dark')['--mk1'], MARK_COLORS.dark.fill[0], 'tema "acompanhar o site" usa o escuro quando o site é escuro');
eq(readStyle({ theme: 'follow', size: 21, spacing: 1.7, width: 660, font: 'serif' }, 'light')['--mk1'], MARK_COLORS.light.fill[0], 'tema "acompanhar o site" usa o claro quando o site é claro');
eq(readStyle({ theme: 'sepia', size: 21, spacing: 1.7, width: 660, font: 'serif' }, 'dark')['--mk1'], MARK_COLORS.sepia.fill[0], 'leitura sépia é independente do tema do site');
eq(markColors('inexistente', 'light'), MARK_COLORS.light, 'tema desconhecido cai no claro');
eq(Object.keys(readStyle({ theme: 'light', size: 21, spacing: 1.7, width: 660, font: 'serif' })).filter((k) => /^--r-/.test(k)), ['--r-bg', '--r-fg', '--r-accent', '--r-size', '--r-lead', '--r-width', '--r-font'], 'as variáveis --r-* de antes continuam as mesmas');

// rotas de Meus Estudos
eq(P('#studies'), { kind: 'studies', id: null }, 'rota: #studies');
eq(P('#studies/10000000-1000-4000-8000-100000000000'), { kind: 'studies', id: '10000000-1000-4000-8000-100000000000' }, 'rota: #studies/<id>');
eq([hrefs.studies(), hrefs.studies('abc')], ['#studies', '#studies/abc'], 'hrefs.studies');

console.log(failed ? `\n${failed} teste(s) falharam, ${passed} passaram.` : `OK: ${passed} testes do leitor com marcações passaram.`);
process.exit(failed ? 1 : 0);
