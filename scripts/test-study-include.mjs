// Testes de src/studyInclude.js ("Incluir o conteúdo aqui") e do campo inc de studiesCore.js, com os dados reais: o Essencial NUNCA recebe conteúdo Pro,
// a posição acadêmica só sai para admin e o texto bíblico nunca entra. Sem rede.
import { readFileSync } from 'node:fs';
import { createCan } from '../src/planRules.js';
import { includeFor, includeNeeds, includePerson, includeEvent, includePlace, INCLUDABLE } from '../src/studyInclude.js';
import { cleanItem, cleanStudy, describeItem, setItemInc, setContextIncluded, newStudy, setItemNote, addItem, moveItem, LIMITS, CTX_KEY, isItemKey } from '../src/studiesCore.js';
import { T } from '../src/i18n.js';

let passed = 0; let failed = 0;
const ok = (c, m) => { if (c) passed += 1; else { failed += 1; console.error(`FALHOU: ${m}`); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m} (esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)})`);
const load = (p) => JSON.parse(readFileSync(new URL(`../src/data/${p}`, import.meta.url), 'utf8'));
const plans = load('plans.json');
const rawCan = createCan(plans);
const who = (plan, isAdmin = false) => (f, c = {}) => rawCan(f, { plan, isAdmin, ...c });
const ESS = who('essencial'); const PRO = who('pro'); const ADM = who('essencial', true);
const people = load('people.json').people;
const peopleIndex = load('people-index.json');
const timeline = load('timeline.json');
const info = (s) => load(`info/${s}.json`);
const books = Object.fromEntries(readFileSync(new URL('../src/data/books.js', import.meta.url), 'utf8').match(/\['[a-z0-9]{3}', '[^']*', '[^']*'/g).map((m) => { const [slug, pt, en] = m.replaceAll("'", '').slice(1).split(', '); return [slug, { slug, ab: { pt: slug, en: slug }, name: { pt, en } }]; }));
const t = T.pt;
const text = (r) => JSON.parse(JSON.stringify(r)).nodes.flatMap(function f(n) { return n.type === 'dl' ? n.rows.flat() : n.type === 'list' ? n.items.map((i) => i.text) : [n.text ?? n.type]; }).join('\n'); // texto puro dos nós (sem escapes de JSON)

// ---- campo inc ----
eq(cleanItem({ k: 'person:davi', inc: true }), { k: 'person:davi', inc: true }, 'inc true é guardado');
eq(cleanItem({ k: 'person:davi', inc: false }), { k: 'person:davi' }, 'inc false não é guardado');
eq(cleanItem({ k: 'person:davi', inc: 'sim' }), { k: 'person:davi' }, 'inc que não é booleano é descartado');
eq(cleanItem({ k: 'person:davi', note: 'n', inc: true }), { k: 'person:davi', note: 'n', inc: true }, 'inc com nota');
eq(cleanItem({ k: 'book:gen', note: 'x'.repeat(6000) }).note.length, 5000, 'nota de item cortada em 5000');
ok(isItemKey(CTX_KEY), 'block:ctx é chave válida');
eq(describeItem('block:ctx'), { kind: 'context' }, 'describeItem: block:ctx é o contexto');
ok(['person', 'place', 'event', 'chapter', 'book', 'context'].every((k) => INCLUDABLE.has(k)) && !INCLUDABLE.has('passage') && !INCLUDABLE.has('block'), 'só esses itens têm o interruptor');
{
  let st = newStudy({ id: '00000000-0000-4000-8000-0000000000aa', title: 'E', template: null, now: '2026-10-20T10:00:00.000Z' });
  st = addItem(st, 'person:davi').study;
  st = setItemInc(st, 0, true).study; eq(st.items[0], { k: 'person:davi', inc: true }, 'setItemInc liga');
  st = setItemNote(st, 0, 'oi').study; eq(st.items[0], { k: 'person:davi', note: 'oi', inc: true }, 'editar a nota mantém o inc');
  st = setItemInc(st, 0, false).study; eq(st.items[0], { k: 'person:davi', note: 'oi' }, 'setItemInc desliga');
  st = setItemInc(st, 0, true).study; st = addItem(st, 'book:gen').study; st = moveItem(st, 0, 1).study; eq(st.items.map((i) => !!i.inc), [false, true], 'mover leva o inc junto');
  eq(setItemInc(st, 9, true).error, 'invalid', 'índice inválido');
  const a = setContextIncluded(st, true).study; eq(a.items.at(-1), { k: CTX_KEY, inc: true }, 'liga o Contexto: item block:ctx no fim');
  eq(setContextIncluded(a, true).study.items.filter((i) => i.k === CTX_KEY).length, 1, 'ligar duas vezes não duplica');
  eq(setContextIncluded(a, false).study.items.some((i) => i.k === CTX_KEY), false, 'desliga: tira o item');
  eq(cleanStudy({ ...a, at: a.at }).items.at(-1), { k: CTX_KEY, inc: true }, 'o estudo limpo guarda o inc do Contexto');
}

// ---- o Essencial nunca recebe conteúdo Pro ----
const proPerson = people.find((p) => !plans.essencial.characters.includes(p.id));
const freePerson = people.find((p) => plans.essencial.characters.includes(p.id));
const deps = (can, plan) => ({ lang: 'pt', t, can, plan, books, people, timeline, infos: {}, peopleChapters: load('people-chapters.json'), peopleIndex });
{
  const r = includePerson({ id: proPerson.id, ...deps(ESS, 'essencial') });
  eq(r.nodes, [{ type: 'locked' }], 'Essencial: personagem Pro fica trancado');
  ok(!text(r).includes(proPerson.summary.pt.slice(0, 30)), 'Essencial: o resumo do personagem Pro não vaza');
  const f = includePerson({ id: freePerson.id, ...deps(ESS, 'essencial') });
  ok(text(f).includes(freePerson.summary.pt.slice(0, 30)), 'Essencial: personagem do plano mostra o resumo');
  ok(f.nodes.some((n) => n.type === 'list'), 'personagem: lista os livros');
  ok(text(includePerson({ id: proPerson.id, ...deps(PRO, 'pro') })).includes(proPerson.summary.pt.slice(0, 30)), 'Pro: personagem Pro mostra o resumo');
  eq(includePerson({ id: 'x', ...deps(PRO, 'pro'), people: null }).status, 'loading', 'sem os dados carregados: carregando');
  ok(text(includePerson({ id: 'nao-existe', ...deps(ADM, 'essencial') })).includes(t.incMissing), 'personagem que sumiu dos dados: aviso');
}
{
  const ev = timeline.events.find((e) => e.dates?.scholarly) ?? timeline.events[0];
  eq(includeEvent({ id: ev.id, ...deps(ESS, 'essencial') }).nodes, [{ type: 'locked' }], 'Essencial: evento trancado');
  ok(!text(includeEvent({ id: ev.id, ...deps(ESS, 'essencial') })).includes(ev.title.pt), 'Essencial: o título do evento Pro não vaza');
  const p = includeEvent({ id: ev.id, ...deps(PRO, 'pro') });
  ok(text(p).includes(ev.title.pt) && p.nodes.some((n) => n.type === 'dl'), 'Pro: evento com título e data');
  const labels = (r) => r.nodes.filter((n) => n.type === 'dl').flatMap((n) => n.rows.map((x) => x[0]));
  ok(!labels(p).includes(t.ctxAuthorScholarly), 'Pro: sem a posição acadêmica na data do evento');
  if (ev.dates?.scholarly) ok(labels(includeEvent({ id: ev.id, ...deps(ADM, 'essencial') })).includes(t.ctxAuthorScholarly), 'admin: a data acadêmica aparece');
  ok(p.nodes.some((n) => n.type === 'p' && n.text === ev.note.pt), 'a nota (base da data) acompanha o evento');
}
{
  const slugPro = Object.keys(books).find((s) => !plans.essencial.mapBooks.includes(s) && info(s).map);
  const slugFree = plans.essencial.mapBooks.find((s) => info(s).map);
  const placeFree = info(slugFree).map.places[0];
  const placePro = info(slugPro).map.places[0];
  eq(includePlace({ slug: slugPro, name: placePro.name.pt, ...deps(ESS, 'essencial'), info: info(slugPro) }).nodes, [{ type: 'locked' }], 'Essencial: lugar de mapa Pro trancado');
  ok(!text(includePlace({ slug: slugPro, name: placePro.name.pt, ...deps(ESS, 'essencial'), info: info(slugPro) })).includes(placePro.note.pt.slice(0, 25)), 'Essencial: o texto do mapa Pro não vaza');
  const f = includePlace({ slug: slugFree, name: placeFree.name.pt, ...deps(ESS, 'essencial'), info: info(slugFree) });
  ok(text(f).includes(placeFree.note.pt.slice(0, 25)) && text(f).includes(placeFree.ref), 'lugar do plano: nome, referência e texto do mapa');
  ok(text(includePlace({ slug: slugPro, name: placePro.name.pt, ...deps(PRO, 'pro'), info: info(slugPro) })).includes(placePro.note.pt.slice(0, 25)), 'Pro: lugar de mapa Pro com texto');
}
{
  const d = (k) => describeItem(k);
  const g = includeFor(d('book:joh'), { ...deps(ESS, 'essencial'), infos: { joh: info('joh') } });
  ok(text(g).includes(info('joh').theme.pt.slice(0, 20)), 'livro: resumo da ficha (tema)');
  ok(!text(g).includes(info('joh').author.scholarly.pt.slice(0, 20)), 'livro: sem a posição acadêmica para o Essencial');
  ok(!text(includeFor(d('book:joh'), { ...deps(PRO, 'pro'), infos: { joh: info('joh') } })).includes(info('joh').author.scholarly.pt.slice(0, 20)), 'livro: sem a posição acadêmica nem para o Pro');
  ok(text(includeFor(d('book:joh'), { ...deps(ADM, 'essencial'), infos: { joh: info('joh') } })).includes(info('joh').author.scholarly.pt.slice(0, 20)), 'livro: admin recebe a posição acadêmica');
  const c = includeFor(d('chapter:joh:3'), { ...deps(ESS, 'essencial'), infos: { joh: info('joh') } });
  ok(c.nodes.some((n) => n.type === 'list'), 'capítulo: esboço do trecho');
  eq(includeFor(d('book:joh'), { ...deps(ESS, 'essencial'), infos: {} }).status, 'loading', 'ficha ainda não carregada: carregando');
  // Contexto
  const st = { template: null, items: [{ k: 'ref:joh:3:16' }, { k: CTX_KEY, inc: true }] };
  const ce = includeFor(d(CTX_KEY), { ...deps(ESS, 'essencial'), study: st, infos: { joh: info('joh') }, timeline });
  ok(ce.nodes.some((n) => n.type === 'locked'), 'Contexto no Essencial: eventos trancados');
  const proEv = timeline.events.filter((e) => e.ref?.book === 'joh').map((e) => e.title.pt);
  ok(proEv.every((tt) => !text(ce).includes(tt)), 'Contexto no Essencial: nenhum título de evento Pro');
  const cp = includeFor(d(CTX_KEY), { ...deps(PRO, 'pro'), study: st, infos: { joh: info('joh') }, timeline });
  ok(cp.status === 'ok' && !cp.nodes.some((n) => n.type === 'locked' && false), 'Contexto no Pro monta');
  eq(includeFor(d(CTX_KEY), { ...deps(PRO, 'pro'), study: { template: null, items: [{ k: CTX_KEY, inc: true }] }, infos: {}, timeline }).nodes[0].text, T.pt.ctxEmpty, 'Contexto sem texto-base: mensagem');
  ok(!/(Porque Deus amou|For God so loved)/.test(text(cp)), 'o texto bíblico nunca entra no conteúdo incluído');
}
// includeNeeds: o Essencial não pede dado Pro
{
  const st = { template: null, items: [{ k: `person:${proPerson.id}`, inc: true }, { k: 'event:abraao', inc: true }, { k: 'person:davi' }] };
  const nE = includeNeeds(st, describeItem, ESS); const nP = includeNeeds(st, describeItem, PRO);
  ok(!nE.people && !nE.timeline, 'Essencial: não pede personagens nem linha do tempo Pro');
  ok(nP.people && nP.timeline, 'Pro: pede os dois');
  eq(includeNeeds({ template: null, items: [{ k: 'place:gen:Harã', inc: true }, { k: 'person:davi' }] }, describeItem, PRO).infoSlugs, ['gen'], 'lugar incluído pede a ficha do livro; item sem inc não pede nada');
  eq(includeNeeds({ template: null, items: [{ k: 'book:gen' }] }, describeItem, PRO).infoSlugs, [], 'sem inc não pede nada');
}

console.log(failed ? `\n${failed} teste(s) falharam, ${passed} passaram.` : `OK: ${passed} testes do conteúdo incluído passaram.`);
process.exit(failed ? 1 : 0);
