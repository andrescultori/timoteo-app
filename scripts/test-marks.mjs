// Testes de src/marksCore.js e src/favKeys.js (marcações de versículos e categorias): funções puras, sem rede nem navegador.
import {
  CATS, LIMITS, DEFAULT_CATEGORY_NAMES, validBook, cleanText, cleanMark, cleanMarks, indexMarks, markKey, cleanOp, compactOps, applyOps, mergeMarks,
  toRow, fromRow, chunk, groupRemovals, versesToRanges, cleanCategories, categoryList, pickNewer,
} from '../src/marksCore.js';
import { favKey, parseFavKey, FAV_TYPES, ITEM_TYPES } from '../src/favKeys.js';

let passed = 0;
let failed = 0;
const ok = (cond, msg) => { if (cond) passed += 1; else { failed += 1; console.error(`FALHOU: ${msg}`); } };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg} (esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)})`);

const T = (n) => new Date(Date.UTC(2026, 9, 20, 12, 0, n)).toISOString();
const M = (b, c, v, cat, note, n) => ({ b, c, v, cat, note, at: T(n) });

// ---- favKeys: ref, verse e event ----
eq(favKey.ref('joh', 3, 16, 18), 'ref:joh:3:16-18', 'ref com intervalo');
eq(favKey.ref('joh', 3, 16), 'ref:joh:3:16', 'ref de um versículo');
eq(favKey.ref('joh', 3, 16, 16), 'ref:joh:3:16', 'ref com v2 igual ao v1 vira versículo único');
eq(parseFavKey('ref:joh:3:16-18'), { type: 'ref', slug: 'joh', n: 3, v1: 16, v2: 18 }, 'parse de ref com intervalo');
eq(parseFavKey('ref:joh:3:16'), { type: 'ref', slug: 'joh', n: 3, v1: 16, v2: 16 }, 'parse de ref simples');
eq(parseFavKey(favKey.verse('psa', 119, 176)), { type: 'verse', slug: 'psa', n: 119, v: 176 }, 'ida e volta de verse');
eq(parseFavKey(favKey.event('abraao')), { type: 'event', id: 'abraao' }, 'ida e volta de event');
for (const bad of ['ref:joh:3', 'ref:joh:3:x', 'ref:joh:3:16-', 'verse:joh:3', 'verse:joh:a:1', 'event:', 'ref:', 'verse:joh:3:16-18']) eq(parseFavKey(bad), null, `chave inválida "${bad}"`);
eq(FAV_TYPES, ['book', 'chapter', 'person', 'place'], 'Favoritos continua com os 4 tipos de sempre (marcações têm tabela própria)');
ok(['ref', 'verse', 'event'].every((t) => ITEM_TYPES.includes(t)), 'tipos de item de estudo incluem ref, verse e event');
// as chaves antigas continuam iguais (regressão)
eq(parseFavKey(favKey.place('gen', 'Belém: Judá')), { type: 'place', slug: 'gen', name: 'Belém: Judá' }, 'place com ":" no nome continua igual');
eq(parseFavKey(favKey.chapter('1sa', 3)), { type: 'chapter', slug: '1sa', n: 3 }, 'chapter continua igual');

// ---- textos e livros ----
ok(validBook('joh') && validBook('1sa') && !validBook('Joh') && !validBook('jo') && !validBook('john') && !validBook(null), 'slug do livro: 3 caracteres [a-z0-9]');
eq(cleanText('  oi  ', 10), 'oi', 'texto aparado');
eq(cleanText('   ', 10), null, 'texto vazio vira null');
eq(cleanText(5, 10), null, 'só aceita texto');
eq(cleanText('a'.repeat(30), 10), 'a'.repeat(10), 'corta no máximo');
eq(Array.from(cleanText('😀'.repeat(15), 10)).length, 10, 'corta por caractere, não por unidade UTF-16 (como o char_length do banco)');

// ---- marcação ----
ok(cleanMark(M('joh', 3, 16, 'c1', null, 1)) !== null, 'marcação só com categoria vale');
ok(cleanMark(M('joh', 3, 16, null, 'nota', 1)) !== null, 'marcação só com nota vale');
eq(cleanMark(M('joh', 3, 16, null, null, 1)), null, 'sem categoria e sem nota não existe');
eq(cleanMark(M('joh', 3, 16, 'c9', null, 1)), null, 'categoria fora de c1..c6 sem nota não existe');
eq(cleanMark(M('joh', 3, 16, 'c9', 'x', 1)).cat, null, 'categoria inválida some, a nota fica');
eq(cleanMark(M('joh', 0, 1, 'c1', null, 1)), null, 'capítulo 0');
eq(cleanMark(M('joh', 151, 1, 'c1', null, 1)), null, 'capítulo 151');
eq(cleanMark(M('joh', 1, 0, 'c1', null, 1)), null, 'versículo 0');
eq(cleanMark(M('joh', 1, 177, 'c1', null, 1)), null, 'versículo 177');
ok(cleanMark(M('psa', 119, 176, 'c6', null, 1)) !== null && cleanMark(M('psa', 150, 1, 'c1', null, 1)) !== null, 'limites aceitos: Salmo 119:176 e Salmo 150');
eq(cleanMark(M('JOH', 1, 1, 'c1', null, 1)), null, 'livro fora do formato');
eq(cleanMark({ b: 'joh', c: 1, v: 1, cat: 'c1', at: 'ontem' }), null, 'data inválida');
eq(cleanMark(M('joh', 1, 1, null, 'x'.repeat(3000), 1)).note.length, LIMITS.noteMax, 'nota cortada em 2000');
eq(cleanMark({ ...M('joh', 1, 1, 'c1', null, 1), c: '1' }), null, 'capítulo precisa ser inteiro');

// ---- lista limpa, índice ----
{
  const list = cleanMarks([M('joh', 3, 16, 'c1', null, 1), M('joh', 3, 16, 'c2', null, 5), M('gen', 1, 1, 'c3', null, 2), { lixo: true }, M('joh', 3, 2, null, 'n', 3), null]);
  eq(list.map((m) => markKey(m.b, m.c, m.v)), ['gen:1:1', 'joh:3:2', 'joh:3:16'], 'ordem livro, capítulo, versículo; inválidas saem');
  eq(list.find((m) => m.v === 16).cat, 'c2', 'duplicata: vale a mais recente');
  const idx = indexMarks(list);
  eq([...idx.get('joh:3').keys()], [2, 16], 'índice por capítulo');
  eq(idx.get('joh:4'), undefined, 'capítulo sem marcação');
  const many = Array.from({ length: 6 }, (_, i) => M('gen', 1, i + 1, 'c1', null, i));
  eq(cleanMarks(many, 4).map((m) => m.v), [3, 4, 5, 6], 'acima do limite saem as mais antigas');
  eq(cleanMarks('x'), [], 'entrada que não é lista');
}

// ---- fila ----
eq(cleanOp({ op: 'set', ...M('joh', 1, 1, 'c1', null, 1) }).op, 'set', 'operação set');
eq(cleanOp({ op: 'del', b: 'joh', c: 1, v: 1, at: T(1) }), { op: 'del', b: 'joh', c: 1, v: 1, at: T(1) }, 'operação del');
eq(cleanOp({ op: 'zap', b: 'joh', c: 1, v: 1, at: T(1) }), null, 'operação desconhecida');
eq(cleanOp({ op: 'set', b: 'joh', c: 1, v: 1, at: T(1) }), null, 'set sem categoria nem nota');
{
  const q = compactOps([{ op: 'set', ...M('joh', 1, 1, 'c1', null, 1) }, { op: 'set', ...M('joh', 1, 2, 'c1', null, 2) }, { op: 'del', b: 'joh', c: 1, v: 1, at: T(3) }, { op: 'set', ...M('joh', 1, 2, 'c3', null, 4) }, 'lixo']);
  eq(q.map((o) => `${o.op}:${o.v}:${o.cat ?? ''}`), ['del:1:', 'set:2:c3'], 'só a última operação de cada versículo vale (e a ordem é a da última)');
  const m = applyOps(new Map([['joh:1:1', M('joh', 1, 1, 'c1', null, 0)]]), q);
  eq([...m.keys()].sort(), ['joh:1:2'], 'applyOps aplica del e set');
}

// ---- união no login ----
const keys = (r) => r.marks.map((m) => markKey(m.b, m.c, m.v));
{
  // 1ª união (dados do modo local): o que só existe aqui sobe; havendo as duas, vale a mais recente
  const local = [M('joh', 3, 16, 'c1', null, 10), M('gen', 1, 1, 'c2', null, 1), M('rom', 8, 28, 'c4', null, 5)];
  const remote = [M('gen', 1, 1, 'c3', null, 9), M('rom', 8, 28, 'c5', null, 2), M('psa', 23, 1, 'c1', null, 3)];
  const r = mergeMarks({ local, remote, queue: [], synced: false });
  eq(keys(r), ['gen:1:1', 'joh:3:16', 'psa:23:1', 'rom:8:28'], '1ª união: junta tudo');
  eq(r.marks.find((m) => m.b === 'gen').cat, 'c3', '1ª união: a conta mais nova vence');
  eq(r.marks.find((m) => m.b === 'rom').cat, 'c4', '1ª união: o aparelho mais novo vence');
  eq(r.upload.map((m) => `${m.b}${m.c}${m.v}`).sort(), ['joh316', 'rom828'], '1ª união: sobem só as do aparelho que ganharam');
  eq(r.remove, [], '1ª união: nada a apagar');
}
{
  // cache já sincronizado com a conta: apagado em outro aparelho NÃO ressuscita
  const local = [M('joh', 3, 16, 'c1', null, 1), M('gen', 1, 1, 'c2', null, 1)];
  const remote = [M('gen', 1, 1, 'c2', null, 1)];
  const r = mergeMarks({ local, remote, queue: [], synced: true });
  eq(keys(r), ['gen:1:1'], 'sincronizado: o item apagado em outro aparelho não volta');
  eq(r.upload, [], 'sincronizado: nada sobe');
  // mas o que está na fila (feito offline) vale
  const r2 = mergeMarks({ local, remote, queue: [{ op: 'set', ...M('joh', 3, 16, 'c1', null, 7) }], synced: true });
  eq(keys(r2), ['gen:1:1', 'joh:3:16'], 'sincronizado: a marcação feita offline entra');
  eq(r2.upload.length, 1, 'sincronizado: e sobe');
  // remoção pendente não ressuscita e apaga na conta
  const r3 = mergeMarks({ local, remote: [...remote, M('joh', 3, 16, 'c1', null, 1)], queue: [{ op: 'del', b: 'joh', c: 3, v: 16, at: T(8) }], synced: true });
  eq(keys(r3), ['gen:1:1'], 'remoção pendente vale');
  eq(r3.remove, ['joh:3:16'], 'remoção pendente apaga na conta');
  // a conta tem edição mais nova que a operação pendente: a operação perde
  const r4 = mergeMarks({ local: [], remote: [M('joh', 3, 16, 'c5', null, 20)], queue: [{ op: 'set', ...M('joh', 3, 16, 'c1', null, 10) }], synced: true });
  eq(r4.marks[0].cat, 'c5', 'o mais recente vence: a edição da conta ganha da pendente mais velha');
  eq(r4.upload, [], 'a pendente perdedora não sobe');
  const r5 = mergeMarks({ local: [], remote: [M('joh', 3, 16, 'c5', null, 20)], queue: [{ op: 'del', b: 'joh', c: 3, v: 16, at: T(10) }], synced: true });
  eq(keys(r5), ['joh:3:16'], 'remoção pendente mais velha que a edição da conta perde');
  eq(r5.remove, [], 'e não apaga na conta');
  // idempotência
  const again = mergeMarks({ local: r2.marks, remote: [...remote, ...r2.upload], queue: [], synced: true });
  eq(keys(again), keys(r2), 'repetir a união dá o mesmo resultado');
}
{
  const r = mergeMarks({ local: [], remote: [], queue: [], synced: false });
  eq([r.marks, r.upload, r.remove], [[], [], []], 'tudo vazio');
}

// ---- linhas do banco ----
{
  const m = M('joh', 3, 16, 'c2', 'nota', 4);
  const row = toRow(m, 'u1');
  eq(row, { user_id: 'u1', book: 'joh', chapter: 3, verse: 16, cat: 'c2', note: 'nota', updated_at: T(4) }, 'toRow');
  eq(fromRow(row), m, 'ida e volta da linha');
  eq(fromRow({ ...row, updated_at: '2026-10-20T12:00:04+00:00' }).at, T(4), 'fromRow normaliza a data');
  eq(fromRow({ ...row, cat: null, note: null }), null, 'linha sem categoria e sem nota é ignorada');
  eq(fromRow(null), null, 'fromRow(null)');
}
eq(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]], 'chunk');
eq(chunk([], 3), [], 'chunk vazio');
eq(groupRemovals(['joh:3:16', 'joh:3:2', 'gen:1:1', 'joh:4:1']), [{ b: 'joh', c: 3, verses: [16, 2] }, { b: 'gen', c: 1, verses: [1] }, { b: 'joh', c: 4, verses: [1] }], 'apagar agrupado por livro e capítulo');
eq(versesToRanges([16, 17, 18, 20, 18, 22, 21]), [[16, 18], [20, 22]], 'versículos viram intervalos');
eq(versesToRanges([]), [], 'sem versículos');
eq(versesToRanges([3, 0, -1, 2.5, 1]), [[1, 1], [3, 3]], 'ignora o que não é versículo');

// ---- categorias ----
eq(CATS, ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'], 'seis categorias');
eq(DEFAULT_CATEGORY_NAMES.pt, ['Missões', 'Salvação', 'Oração', 'Promessa', 'Obediência', 'Para memorizar'], 'nomes de partida em português (decisão do André)');
eq(DEFAULT_CATEGORY_NAMES.en.length, 6, 'nomes de partida em inglês');
eq(cleanCategories([{ id: 'c2', name: ' Fé ' }, { id: 'c1', name: 'Missão' }, { id: 'c1', name: 'repetida' }, { id: 'c9', name: 'x' }, { id: 'c3', name: '' }, { id: 'c4', name: 'x'.repeat(50) }]),
  [{ id: 'c1', name: 'Missão' }, { id: 'c2', name: 'Fé' }, { id: 'c4', name: 'x'.repeat(LIMITS.nameMax) }], 'categorias: limpa, ordena, corta o nome');
eq(cleanCategories('x'), [], 'categorias: entrada inválida');
eq(cleanCategories([{ id: 'c1', name: 'a', color: '#fff' }])[0], { id: 'c1', name: 'a' }, 'categorias: não guarda cor (a cor vem do app)');
{
  const list = categoryList([{ id: 'c3', name: 'Intercessão' }], 'pt');
  eq(list.map((c) => c.name), ['Missões', 'Salvação', 'Intercessão', 'Promessa', 'Obediência', 'Para memorizar'], 'lista pronta: o renomeado e os nomes de partida');
  eq(list.map((c) => c.custom), [false, false, true, false, false, false], 'lista pronta: marca o que foi renomeado');
  eq(categoryList([], 'en')[0].name, 'Missions', 'lista pronta em inglês');
  eq(categoryList(undefined, 'xx')[0].name, 'Missões', 'idioma desconhecido cai no português');
}
eq(pickNewer({ value: 'a', at: T(1) }, { value: 'b', at: T(2) }), { value: 'b', at: T(2), up: false, down: true }, 'pickNewer: a conta mais nova vence');
eq(pickNewer({ value: 'a', at: T(3) }, { value: 'b', at: T(2) }), { value: 'a', at: T(3), up: true, down: false }, 'pickNewer: o aparelho mais novo sobe');
eq(pickNewer({ value: 'a', at: T(3) }, null), { value: 'a', at: T(3), up: true, down: false }, 'pickNewer: só no aparelho');
eq(pickNewer(null, { value: 'b', at: T(2) }).down, true, 'pickNewer: só na conta');
eq(pickNewer(null, null), { value: undefined, at: null, up: false, down: false }, 'pickNewer: nada');
eq(pickNewer({ value: 'a', at: T(2) }, { value: 'b', at: T(2) }).up, false, 'pickNewer: empate não sobe');

console.log(failed ? `\n${failed} teste(s) falharam, ${passed} passaram.` : `OK: ${passed} testes de marcações e categorias passaram.`);
process.exit(failed ? 1 : 0);
