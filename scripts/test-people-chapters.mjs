// Testes do casamento de personagens por capítulo (scripts/people-chapters-lib.mjs) e do helper src/peopleChapters.js.
// Uso: node scripts/test-people-chapters.mjs   (roda no `npm test`)
import assert from 'node:assert/strict';
import path from 'node:path';
import { aliasTable, compile, scanBook, applyOverrides, expandChapters, toJson, buildPeopleChapters, jsonText } from './people-chapters-lib.mjs';
import { peopleInChapterFrom, chaptersOfPersonFrom } from '../src/peopleChapters.js';

const P = (id, pt, books, more = {}) => ({ id, name: { pt, en: pt }, books: books.map((book) => ({ book })), ...more });
const people = [
  P('davi', 'Davi', ['1sa', 'psa']),
  P('lo', 'Ló', ['gen']),
  P('job', 'Jó', ['job']),
  P('abel', 'Abel', ['gen']),
  P('jose', 'José, filho de Jacó', ['gen']),
  P('jose-m', 'José, marido de Maria', ['mat']),
  P('jose-a', 'José de Arimateia', ['mat']),
  P('joao-b', 'João Batista', ['mat']),
  P('joao-a', 'João, o apóstolo', ['mat']),
  P('juda', 'Judá, filho de Jacó', ['gen'], { autoLink: false }),
  P('ismael', 'Ismael, filho de Abraão', ['gen', 'jer'], { linkBooks: ['gen'] }),
  P('herodes', 'Herodes o Grande', ['mat']),
];
const run = (lang, texts, bookSlug, extra = {}) => {
  const table = aliasTable(people, lang, extra);
  const local = new Set(people.filter((p) => (p.linkBooks ?? p.books.map((b) => b.book)).includes(bookSlug) && p.books.some((b) => b.book === bookSlug)).map((p) => p.id));
  return scanBook(texts.map((c) => [].concat(c)), table, compile(table), local);
};
const chs = (r, id) => [...(r.hits.get(id)?.keys() ?? [])];

let n = 0;
const ok = (name, fn) => { fn(); n++; };

ok('palavra inteira: "Davidson" e "Davis" não são Davi', () => {
  const r = run('pt', [['Davi disse'], ['Davidson e Davis']], '1sa');
  assert.deepEqual(chs(r, 'davi'), [1]);
});
ok('conta ocorrências e o primeiro versículo', () => {
  const r = run('pt', [[null, 'Davi e Davi', 'Davi']], '1sa');
  assert.deepEqual(r.hits.get('davi').get(1), { n: 3, first: 2 });
});
ok('versículo ausente (null) é ignorado', () => {
  assert.deepEqual(chs(run('pt', [[null, null]], '1sa'), 'davi'), []);
});
ok('sensível a maiúsculas: "job" não é Jó nem "Job"', () => {
  assert.deepEqual(chs(run('pt', [['um job', 'Jó falou']], 'job'), 'job'), [1]);
});
ok('sensível a acentos: "Ló" casa, "Lo" não', () => {
  assert.deepEqual(chs(run('pt', [['Lo disse'], ['Ló disse']], 'gen'), 'lo'), [2]);
});
ok('possessivo em inglês: "David\'s" é David', () => {
  const eng = [{ ...P('d', 'David', ['1sa']), name: { pt: 'Davi', en: 'David' } }];
  const t = aliasTable(eng, 'en', {});
  const r = scanBook([["David's house"]], t, compile(t), new Set(['d']));
  assert.deepEqual([...r.hits.get('d').keys()], [1]);
});
ok('hífen colado não conta: "Abel-Maim" não é Abel', () => {
  assert.deepEqual(chs(run('pt', [['Abel-Maim'], ['o irmão Abel.']], 'gen'), 'abel'), [2]);
});
ok('nome mais longo vence: "José de Arimateia" não conta como "José"', () => {
  const r = run('pt', [['José de Arimateia pediu o corpo']], 'mat');
  assert.deepEqual(chs(r, 'jose-a'), [1]);
  assert.equal(r.amb.length, 0);
});
ok('ambiguidade: "José" sozinho em Mateus vai para revisão, não é decidido', () => {
  const r = run('pt', [['José, filho de Davi']], 'mat');
  assert.equal(r.hits.size, 0);
  assert.deepEqual(r.amb.map((a) => [a.alias, a.ch, a.v, a.ids]), [['José', 1, 1, ['jose-m', 'jose-a']]]);
});
ok('nome curto que começa o nome de outro ("João" × "João Batista") é ambíguo', () => {
  const r = run('pt', [['João batizava', 'João Batista batizava']], 'mat');
  assert.deepEqual(chs(r, 'joao-b'), [1]);
  assert.deepEqual(r.amb.map((a) => a.ids), [['joao-a', 'joao-b']]);
});
ok('só personagens do livro: José de Gênesis não conta em Mateus', () => {
  const r = run('pt', [['José'], ['José de Arimateia']], 'gen');
  assert.deepEqual(chs(r, 'jose'), [1]);
  assert.deepEqual(chs(r, 'jose-a'), []);
});
ok('autoLink: false não é procurado; linkBooks restringe os livros', () => {
  assert.deepEqual(chs(run('pt', [['Judá reinou']], 'gen'), 'juda'), []);
  assert.deepEqual(chs(run('pt', [['Ismael']], 'jer'), 'ismael'), []);
  assert.deepEqual(chs(run('pt', [['Ismael']], 'gen'), 'ismael'), [1]);
});
ok('aliases extras (ex.: Abrão) e aliases "sempre revisar"', () => {
  const extra = { davi: { pt: ['Davidão'] }, herodes: { ptReview: ['Herodes'] } };
  assert.deepEqual(chs(run('pt', [['Davidão'], ['Davi']], '1sa', extra), 'davi'), [1, 2]);
  const r = run('pt', [['Herodes'], ['Herodes o Grande']], 'mat', extra);
  assert.deepEqual(chs(r, 'herodes'), [2]);
  assert.deepEqual(r.amb.map((a) => [a.alias, a.ids]), [['Herodes', ['herodes']]]);
});

const ctx = { personIds: new Set(people.map((p) => p.id)), books: ['gen', 'mat', '1sa'], chaptersOf: () => 10 };
const fresh = () => ({ auto: new Map([['davi', new Map([['1sa', new Map([[3, { n: 2, first: 1 }]])]])]]), amb: new Map([['mat', [{ alias: 'José', ch: 2, v: 4, ids: ['jose-m', 'jose-a'], snippet: '' }, { alias: 'José', ch: 9, v: 1, ids: ['jose-m', 'jose-a'], snippet: '' }]]]) });
ok('override assign resolve ambíguos por faixa de capítulos e deixa o resto pendente', () => {
  const { auto, amb } = fresh();
  const rest = applyOverrides(auto, amb, { assign: [{ alias: 'José', book: 'mat', chapters: '1–5', person: 'jose-m' }] }, ctx);
  assert.deepEqual([...auto.get('jose-m').get('mat').keys()], [2]);
  assert.deepEqual(rest.get('mat').map((h) => h.ch), [9]);
});
ok('override assign exige que a pessoa seja candidata e que haja ocorrência', () => {
  assert.throws(() => { const { auto, amb } = fresh(); applyOverrides(auto, amb, { assign: [{ alias: 'José', book: 'mat', chapters: [2], person: 'davi' }] }, ctx); }, /não é um dos candidatos/);
  assert.throws(() => { const { auto, amb } = fresh(); applyOverrides(auto, amb, { assign: [{ alias: 'José', book: 'mat', chapters: [7], person: 'jose-m' }] }, ctx); }, /nenhuma ocorrência/);
});
ok('override include (n = 0, "à mão") e exclude', () => {
  const { auto, amb } = fresh();
  applyOverrides(auto, amb, { include: [{ person: 'davi', book: '1sa', chapters: [3, 4] }], exclude: [{ person: 'davi', book: '1sa', chapters: [3] }] }, ctx);
  assert.deepEqual([...auto.get('davi').get('1sa').entries()], [[4, { n: 0, first: 0 }]]);
});
ok('override com personagem, livro ou capítulo inexistente falha', () => {
  for (const o of [{ include: [{ person: 'xx', book: 'gen', chapters: [1] }] }, { include: [{ person: 'davi', book: 'zzz', chapters: [1] }] }, { exclude: [{ person: 'davi', book: 'gen', chapters: [11] }] }]) {
    assert.throws(() => { const { auto, amb } = fresh(); applyOverrides(auto, amb, o, ctx); }, /overrides/);
  }
});
ok('expandChapters aceita número, faixa e lista', () => {
  assert.deepEqual(expandChapters([1, '3–5', '9-10']), [1, 3, 4, 5, 9, 10]);
  assert.throws(() => expandChapters('abc'));
});
ok('saída ordenada e estável', () => {
  const auto = new Map([['z', new Map([['mat', new Map([[2, { n: 1, first: 1 }]])], ['gen', new Map([[5, { n: 2, first: 3 }], [1, { n: 1, first: 1 }]])]])], ['a', new Map([['gen', new Map([[1, { n: 1, first: 1 }]])]])]]);
  const out = toJson(auto, ['gen', 'mat']);
  assert.deepEqual(Object.keys(out), ['a', 'z']);
  assert.deepEqual(Object.keys(out.z), ['gen', 'mat']);
  assert.deepEqual(out.z.gen, [[1, 1, 1], [5, 2, 3]]);
});

ok('helper: mais citados primeiro, empate pelo versículo, depois id; limite', () => {
  const data = { b: { gen: [[1, 3, 5]] }, a: { gen: [[1, 3, 5], [2, 1, 1]] }, c: { gen: [[1, 9, 1]] }, d: { gen: [[1, 3, 2]] } };
  assert.deepEqual(peopleInChapterFrom(data, 'gen', 1), ['c', 'd', 'a', 'b']);
  assert.deepEqual(peopleInChapterFrom(data, 'gen', 1, 2), ['c', 'd']);
  assert.deepEqual(peopleInChapterFrom(data, 'gen', 3), []);
  assert.deepEqual(peopleInChapterFrom(data, 'exo', 1), []);
  assert.deepEqual(chaptersOfPersonFrom(data, 'a', 'gen'), [1, 2]);
  assert.deepEqual(chaptersOfPersonFrom(data, 'x', 'gen'), []);
});

// dados reais: determinístico e com resultados conhecidos
const root = path.resolve(import.meta.dirname, '..');
const a = jsonText(buildPeopleChapters({ root }).data);
const b = jsonText(buildPeopleChapters({ root }).data);
ok('dados reais: mesma entrada, mesma saída', () => assert.equal(a, b));
const real = JSON.parse(a);
ok('dados reais: Jesus em Mateus 1:16 e a posição do José ambíguo', () => {
  const rows = Object.fromEntries(real.jesus.mat.map((r) => [r[0], r]));
  assert.ok(rows[1] && rows[28]);
  assert.equal(real['jose-marido-de-maria']?.mat?.some((r) => r[0] === 1) ?? false, false, 'José em Mt 1 é ambíguo e não é decidido sozinho');
});
ok('dados reais: Abraão em Gênesis 22, Moisés em Êxodo 3, Paulo em Atos 9 (Saulo)', () => {
  assert.ok(real.abraao.gen.some((r) => r[0] === 22));
  assert.ok(real.moises.exo.some((r) => r[0] === 3));
  assert.ok(real.paulo.act.some((r) => r[0] === 9));
});
console.log(`OK: ${n} testes de personagens por capítulo passaram.`);
