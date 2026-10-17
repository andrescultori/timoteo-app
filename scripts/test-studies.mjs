// Testes de src/studiesCore.js (Meus Estudos): modelos, itens, cotas e união no login. Funções puras.
import {
  LIMITS, TEMPLATES, ITEM_KEY_RE, isItemKey, blockKey, cleanItem, cleanStudy, cleanStudies, newStudy, addItem, removeItem, moveItem, setItemNote, renameStudy,
  studyQuota, mergeStudies, toStudyRow, fromStudyRow, cleanStudyQueue,
} from '../src/studiesCore.js';
import { T as I18N } from '../src/i18n.js';

let passed = 0;
let failed = 0;
const ok = (cond, msg) => { if (cond) passed += 1; else { failed += 1; console.error(`FALHOU: ${msg}`); } };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg} (esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)})`);

const T = (n) => new Date(Date.UTC(2026, 9, 20, 12, 0, n)).toISOString();
const ID = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const S = (n, title, items, at, template = null) => ({ id: ID(n), title, template, items, at: T(at) });

// ---- chaves de item ----
for (const k of ['ref:joh:3:16', 'ref:joh:3:16-21', 'book:gen', 'chapter:1sa:3', 'verse:psa:119:176', 'person:davi', 'person:josue-sacerdote', 'event:chamada-de-abraao', 'place:gen:Belém', 'place:gen:Belém: Judá', 'block:observacao', 'block:aplicacao-semana']) ok(isItemKey(k), `chave válida ${k}`);
for (const k of ['ref:joh:3', 'ref:joh:3:16-', 'ref:john:3:16', 'ref:joh:1234:1', 'book:', 'book:GEN', 'person:Davi', 'person:' + 'a'.repeat(61), 'event:a_b', 'place:gen:', 'place:gen:' + 'x'.repeat(81), 'block:a b', 'x:y', '', null, 5, 'ref:joh:3:16\n']) ok(!isItemKey(k), `chave recusada ${JSON.stringify(k)}`);
ok(isItemKey('place:gen:' + 'ã'.repeat(80)) && isItemKey('place:gen:' + '😀'.repeat(80)), 'place: 80 caracteres, contados por ponto de código como no Postgres');
ok(ITEM_KEY_RE.flags.includes('u'), 'o regex das chaves usa a flag u');

// ---- modelos ----
eq(Object.keys(TEMPLATES), ['passagem', 'personagem', 'sermao', 'ebd'], 'os 4 modelos aprovados');
eq(TEMPLATES.passagem, ['observacao', 'interpretacao', 'aplicacao', 'oracao'], 'passagem: observação, interpretação, aplicação e oração');
eq(TEMPLATES.personagem.length, 5, 'personagem: 5 blocos');
eq(TEMPLATES.sermao.length, 5, 'sermão: 5 blocos');
eq(TEMPLATES.ebd.length, 6, 'EBD: 6 blocos');
for (const [tpl, blocks] of Object.entries(TEMPLATES)) {
  ok(new Set(blocks).size === blocks.length, `${tpl}: blocos sem repetição`);
  for (const b of blocks) {
    ok(isItemKey(blockKey(b)), `${tpl}/${b}: o id do bloco vira chave válida`);
    for (const lang of ['pt', 'en']) {
      ok(typeof I18N[lang][`tplBlock_${tpl}_${b.replaceAll('-', '_')}`] === 'string' && typeof I18N[lang][`tplAsk_${tpl}_${b.replaceAll('-', '_')}`] === 'string', `${tpl}/${b}: título e pergunta-guia em ${lang}`);
    }
  }
  ok(['pt', 'en'].every((l) => typeof I18N[l][`tplName_${tpl}`] === 'string'), `${tpl}: nome nos dois idiomas`);
}

{
  const s = newStudy({ id: ID(1), title: '  Romanos 8  ', template: 'passagem', now: T(1) });
  eq([s.title, s.template, s.at], ['Romanos 8', 'passagem', T(1)], 'novo estudo com modelo');
  eq(s.items.map((i) => i.k), TEMPLATES.passagem.map(blockKey), 'o modelo já vem com os blocos, na ordem');
  eq(newStudy({ id: ID(2), title: 'Em branco', now: T(1) }).items, [], 'sem modelo: estudo em branco');
  eq(newStudy({ id: ID(3), title: 'x', template: 'inexistente', now: T(1) }).template, null, 'modelo desconhecido vira null');
  eq(newStudy({ id: ID(4), title: '   ', now: T(1) }), null, 'título vazio não cria estudo');
  eq(newStudy({ id: 'abc', title: 'x', now: T(1) }), null, 'id precisa ser uuid');
  eq(newStudy({ id: ID(5), title: 'constructor', template: 'constructor', now: T(1) }).template, null, 'modelo "constructor" não passa pela herança de objeto');
}

// ---- limpeza ----
eq(cleanItem({ k: 'ref:joh:3:16', note: '  ok  ' }), { k: 'ref:joh:3:16', note: 'ok' }, 'item com nota aparada');
eq(cleanItem({ k: 'ref:joh:3:16', note: '   ' }), { k: 'ref:joh:3:16' }, 'nota vazia some');
eq(cleanItem({ k: 'lixo' }), null, 'chave inválida');
eq(cleanItem({ k: 'ref:joh:3:16', note: 'x'.repeat(3000) }).note.length, LIMITS.noteMax, 'nota cortada em 2000');
{
  const c = cleanStudy({ id: ID(1).toUpperCase(), title: 'T', template: 'ebd', at: T(1), items: [{ k: 'block:objetivo' }, { k: 'block:objetivo', note: 'repetido' }, { k: 'ref:joh:3:16' }, { k: 'ref:joh:3:16' }, { k: 'lixo' }, null] });
  eq(c.id, ID(1), 'id em minúsculas');
  eq(c.items.map((i) => i.k), ['block:objetivo', 'ref:joh:3:16', 'ref:joh:3:16'], 'bloco repetido sai; item inválido sai');
  eq(cleanStudy({ id: ID(1), title: 'T', at: 'x', items: [] }), null, 'data inválida');
  const big = cleanStudy({ id: ID(1), title: 'T', at: T(1), items: Array.from({ length: 150 }, (_, i) => ({ k: `chapter:gen:${(i % 50) + 1}` })) });
  eq(big.items.length, LIMITS.itemsMax, 'no máximo 100 itens');
  eq(cleanStudy({ id: ID(1), title: 'x'.repeat(200), at: T(1) }).title.length, LIMITS.titleMax, 'título cortado em 120');
  eq(cleanStudy({ id: ID(1), title: 'T', at: T(1) }).items, [], 'sem itens vale');
  eq(cleanStudy(null), null, 'cleanStudy(null)');
}
{
  const list = cleanStudies([S(1, 'a', [], 1), S(1, 'a2', [], 5), S(2, 'b', [], 3), { lixo: 1 }]);
  eq(list.map((s) => s.title), ['a2', 'b'], 'duplicata por id: vale a mais recente; ordem do mais novo para o mais velho');
  eq(cleanStudies(Array.from({ length: 5 }, (_, i) => S(i + 1, `s${i}`, [], i)), 3).length, 3, 'respeita o teto');
}

// ---- edição ----
{
  let s = newStudy({ id: ID(1), title: 'Estudo', now: T(1) });
  let r = addItem(s, 'ref:joh:3:16-18', 'minha nota', T(2));
  ok(!r.error, 'adiciona item');
  s = r.study;
  eq([s.items.length, s.at], [1, T(2)], 'item entra e a data do estudo avança');
  eq(addItem(s, 'ref:joh:3:16-18', '', T(3)).error, 'duplicate', 'mesmo item duas vezes é recusado');
  eq(addItem(s, 'lixo', '', T(3)).error, 'invalid', 'chave inválida é recusada');
  s = addItem(s, 'person:davi', '', T(3)).study;
  s = addItem(s, 'event:abraao', '', T(4)).study;
  eq(s.items.map((i) => i.k), ['ref:joh:3:16-18', 'person:davi', 'event:abraao'], 'ordem de inserção');
  s = moveItem(s, 2, -1, T(5)).study;
  eq(s.items.map((i) => i.k), ['ref:joh:3:16-18', 'event:abraao', 'person:davi'], 'sobe um item');
  s = moveItem(s, 0, 1, T(6)).study;
  eq(s.items.map((i) => i.k)[1], 'ref:joh:3:16-18', 'desce um item');
  eq(moveItem(s, 0, -1, T(7)).error, 'invalid', 'não sobe o primeiro');
  eq(moveItem(s, 2, 1, T(7)).error, 'invalid', 'não desce o último');
  s = setItemNote(s, 1, '  texto novo ', T(8)).study;
  eq(s.items[1].note, 'texto novo', 'nota do item');
  s = setItemNote(s, 1, '', T(9)).study;
  eq(s.items[1].note, undefined, 'nota apagada');
  eq(setItemNote(s, 9, 'x', T(9)).error, 'invalid', 'índice inexistente');
  s = removeItem(s, 0, T(10)).study;
  eq(s.items.length, 2, 'remove item');
  eq(removeItem(s, -1, T(11)).error, 'invalid', 'remover índice inválido');
  eq(renameStudy(s, ' Novo ', T(12)).study.title, 'Novo', 'renomeia');
  eq(renameStudy(s, '  ', T(12)).error, 'invalid', 'nome vazio');
  const original = JSON.stringify(s);
  moveItem(s, 0, 1, T(13)); addItem(s, 'book:gen', '', T(13)); removeItem(s, 0, T(13));
  eq(JSON.stringify(s), original, 'as edições não alteram o estudo original (imutável)');
  let full = newStudy({ id: ID(9), title: 'cheio', now: T(1) });
  for (let i = 1; i <= LIMITS.itemsMax; i += 1) full = addItem(full, `chapter:gen:${i}`, '', T(2)).study;
  eq(full.items.length, 100, 'chegou a 100 itens');
  eq(addItem(full, 'book:exo', '', T(3)).error, 'full', 'o 101º item é recusado');
}

// ---- cota (só a CRIAÇÃO é limitada) ----
eq(studyQuota({ count: 0, pro: false }), { ok: true, reason: null }, 'Essencial: o primeiro');
eq(studyQuota({ count: 4, pro: false }), { ok: true, reason: null }, 'Essencial: o quinto');
eq(studyQuota({ count: 5, pro: false }), { ok: false, reason: 'plan' }, 'Essencial: o sexto é recusado pelo plano');
eq(studyQuota({ count: 20, pro: false }), { ok: false, reason: 'plan' }, 'Essencial com 20 (caiu de Pro): não cria mais um');
eq(studyQuota({ count: 5, pro: true }), { ok: true, reason: null }, 'Pro: sem o limite do Essencial');
eq(studyQuota({ count: 199, pro: true }), { ok: true, reason: null }, 'Pro: o 200º');
eq(studyQuota({ count: 200, pro: true }), { ok: false, reason: 'max' }, 'Pro: teto técnico de 200');
eq(studyQuota({ count: 3, pro: false, essencialMax: 3 }), { ok: false, reason: 'plan' }, 'limites podem ser passados (plans.json)');

// ---- união no login ----
const ids = (r) => r.studies.map((s) => s.id).sort();
{
  const local = [S(1, 'local velho', [], 1), S(2, 'só local', [], 2)];
  const remote = [S(1, 'conta nova', [], 9), S(3, 'só conta', [], 3)];
  const r = mergeStudies({ local, remote, queue: {}, synced: false });
  eq(ids(r), [ID(1), ID(2), ID(3)], '1ª união: junta');
  eq(r.studies.find((s) => s.id === ID(1)).title, 'conta nova', '1ª união: a conta mais nova vence');
  eq(r.upload.map((s) => s.id), [ID(2)], '1ª união: sobe só o que só existe aqui');
  const r2 = mergeStudies({ local: [S(1, 'local novo', [], 20)], remote, queue: {}, synced: false });
  eq(r2.upload.map((s) => s.title), ['local novo'], '1ª união: o aparelho mais novo sobe');
}
{
  const local = [S(1, 'a', [], 1), S(2, 'apagado em outro aparelho', [], 1)];
  const remote = [S(1, 'a', [], 1)];
  const r = mergeStudies({ local, remote, queue: {}, synced: true });
  eq(ids(r), [ID(1)], 'sincronizado: o apagado em outro aparelho não ressuscita');
  eq(r.upload, [], 'sincronizado: nada sobe');
  const r2 = mergeStudies({ local: [...local, S(4, 'feito offline', [], 5)], remote, queue: { [ID(4)]: { op: 'upsert', at: T(5) } }, synced: true });
  eq(ids(r2), [ID(1), ID(4)], 'sincronizado: o estudo criado offline entra');
  eq(r2.upload.map((s) => s.id), [ID(4)], 'sincronizado: e sobe');
  const r3 = mergeStudies({ local: [], remote: [S(1, 'a', [], 1)], queue: { [ID(1)]: { op: 'delete', at: T(9) } }, synced: true });
  eq([ids(r3), r3.remove], [[], [ID(1)]], 'exclusão pendente apaga na conta');
  const r4 = mergeStudies({ local: [], remote: [S(1, 'editado em outro aparelho', [], 30)], queue: { [ID(1)]: { op: 'delete', at: T(9) } }, synced: true });
  eq([ids(r4), r4.remove], [[ID(1)], []], 'o mais recente vence: edição da conta ganha da exclusão pendente mais velha');
  const r5 = mergeStudies({ local: [S(1, 'meu', [], 5)], remote: [S(1, 'dele', [], 30)], queue: { [ID(1)]: { op: 'upsert', at: T(5) } }, synced: true });
  eq([r5.studies[0].title, r5.upload], ['dele', []], 'o mais recente vence: pendente mais velha perde');
  eq(mergeStudies({ local: [], remote: [], queue: { x: 1 }, synced: false }).studies, [], 'fila com lixo não quebra');
}

// ---- linhas do banco e fila ----
{
  const s = S(1, 'Estudo', [{ k: 'ref:joh:3:16', note: 'n' }], 4, 'passagem');
  const row = toStudyRow(s, 'u1');
  eq(row, { id: ID(1), user_id: 'u1', title: 'Estudo', template: 'passagem', items: [{ k: 'ref:joh:3:16', note: 'n' }], updated_at: T(4) }, 'toStudyRow');
  eq(fromStudyRow(row), s, 'ida e volta da linha');
  eq(fromStudyRow({ ...row, items: 'lixo' }).items, [], 'itens que não são lista viram vazio');
  eq(fromStudyRow(null), null, 'fromStudyRow(null)');
  eq(cleanStudyQueue({ [ID(1)]: { op: 'upsert', at: T(1) }, x: { op: 'upsert', at: T(1) }, [ID(2)]: { op: 'zap', at: T(1) }, [ID(3)]: { op: 'delete', at: 'x' } }), { [ID(1)]: { op: 'upsert', at: T(1) } }, 'fila de estudos: só o válido');
  eq(cleanStudyQueue([]), {}, 'fila de estudos: lista não vale');
}

console.log(failed ? `\n${failed} teste(s) falharam, ${passed} passaram.` : `OK: ${passed} testes de estudos passaram.`);
process.exit(failed ? 1 : 0);
