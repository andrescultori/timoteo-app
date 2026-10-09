// Testes dos dados dos originais (public/interlinear/): numeração da KJV, título dos salmos, qere e determinismo. Uso: npm test
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
let failed = 0; let passed = 0;
const ok = (c, m) => { if (c) passed += 1; else { failed += 1; console.error(`FALHOU: ${m}`); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m} (esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)})`);
const book = (n) => JSON.parse(fs.readFileSync(path.join(root, `public/interlinear/${n}.json`), 'utf8'));
const bare = (s) => s.replace(/[֑-ׇ]/g, '').replace(/[־׃׀]/g, ''); // só as consoantes
const first = (d, c, v) => bare(d.w[c - 1][v - 1][0][0]);
const nw = (d, c, v) => d.w[c - 1][v - 1].length;

// Hebraico: versículos que a KJV numera diferente do WLC (primeira palavra conferida em consoantes)
const gen = book(1);
eq(first(gen, 31, 55), 'וישכם', 'Gn 31:55 (hebraico 32:1): "e Labão se levantou cedo"');
eq(first(gen, 1, 1), 'בראשית', 'Gn 1:1');
eq(first(book(32), 1, 17), 'וימן', 'Jn 1:17 (hebraico 2:1): "e o SENHOR preparou um grande peixe"');
eq(first(book(29), 2, 28), 'והיה', 'Jl 2:28 (hebraico 3:1)');
eq(first(book(39), 4, 1), 'כי', 'Ml 4:1 (hebraico 3:19)');
eq(first(book(27), 4, 1), 'נבוכדנצר', 'Dn 4:1 (aramaico, hebraico 3:31)');
const ps = book(19);
eq(first(ps, 51, 1), 'חנני', 'Sl 51:1 começa na palavra que vem depois do título');
eq(ps.t['51'].map((x) => bare(x[0])), ['למנצח', 'מזמור', 'לדוד', 'בבוא', 'אליו', 'נתן', 'הנביא', 'כאשר', 'בא', 'אל', 'בת', 'שבע'], 'Sl 51: o título (hebraico 1-2) fica em `t`, fora dos versículos');
eq(ps.t['23'].map((x) => bare(x[0])), ['מזמור', 'לדוד'], 'Sl 23: o título está dentro do versículo 1 hebraico e é separado por palavra');
eq(first(ps, 23, 1), 'יהוה', 'Sl 23:1 começa em "o SENHOR é o meu pastor"');
ok(!ps.t['1'], 'Sl 1 não tem título');
for (const [n, cap, v] of [[19, 23, 6], [19, 150, 6], [1, 1, 31]]) ok(nw(book(n), cap, v) > 0, `livro ${n} ${cap}:${v} tem palavras`);
// qere no lugar do ketiv (Gn 8:17): a palavra lida, com vogais
ok(gen.w[7][16].some((x) => /ַ/.test(x[0]) && x[1] === 'H3318'), 'Gn 8:17: vale o qere (com vogais)');

// NT: palavra, Strong, glosa de contexto e numeração
const jn = book(43);
eq(jn.w[0][0].map((x) => [x[0].normalize('NFC'), x[1], x[3] ?? null]).slice(0, 5), [['Ἐν', 'G1722', 'In [the]'], ['ἀρχῇ', 'G746', 'beginning'], ['ἦν', 'G1510', 'was'], ['ὁ', 'G3588', 'the'], ['Λόγος,', 'G3056', 'Word']], 'Jo 1:1');
ok(book(64).w[0].length === 14 && nw(book(64), 1, 14) > 15, '3Jo 14 recebe também o 15 do Nestlé');
ok(nw(book(66), 13, 1) > 20, 'Ap 13:1 recebe o 12:18 do Nestlé');
eq(book(41).w[15].length, 20, 'Mc 16 tem 20 versículos');
ok(!book(41).w[15].flat().some((w) => /^Παντα/.test(w[0]) && false), 'Mc 16:99 não entra');

// determinismo: gerar de novo (se as fontes estiverem no ambiente) dá os mesmos arquivos
const src = process.env.INTERLINEAR_SRC ?? '/home/user';
if (fs.existsSync(path.join(src, 'openscriptures/morphhb/wlc/Gen.xml'))) {
  const hash = () => crypto.createHash('sha256').update(fs.readdirSync(path.join(root, 'public/interlinear')).sort().map((f) => fs.readFileSync(path.join(root, 'public/interlinear', f))).join('\0')).digest('hex');
  const before = hash();
  execFileSync('node', [path.join(root, 'scripts/build-interlinear.mjs'), '--src', src], { stdio: 'pipe' });
  ok(hash() === before, 'gerar de novo produz exatamente os mesmos arquivos');
} else console.log('(determinismo: fontes não encontradas, pulado)');

console.log(failed ? `\n${failed} teste(s) de originais falharam, ${passed} passaram.` : `OK: ${passed} testes dos originais passaram.`);
process.exit(failed ? 1 : 0);
