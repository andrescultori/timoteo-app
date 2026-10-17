// Testes de src/studyContext.js (painel Contexto de Meus Estudos) com os dados reais do app: o que cada plano recebe, o que fica trancado e
// que a posição acadêmica só sai para admin. Funções puras, sem rede.
import { readFileSync } from 'node:fs';
import { createCan } from '../src/planRules.js';
import { buildContext, baseOf, chapterOfRef } from '../src/studyContext.js';

let passed = 0;
let failed = 0;
const ok = (cond, msg) => { if (cond) passed += 1; else { failed += 1; console.error(`FALHOU: ${msg}`); } };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg} (esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)})`);

const load = (p) => JSON.parse(readFileSync(new URL(`../src/data/${p}`, import.meta.url), 'utf8'));
const plans = load('plans.json');
const timeline = load('timeline.json');
const peopleIndex = load('people-index.json');
const peopleChapters = load('people-chapters.json');
const rawCan = createCan(plans);
const info = (slug) => load(`info/${slug}.json`);
const BOOK = { joh: { slug: 'joh', name: 'João', testament: 'nt', section: 'evangelhos', chapters: 21 }, gen: { slug: 'gen', name: 'Gênesis', testament: 'at', section: 'lei', chapters: 50 } };
const run = (slug, chapter, who, over = {}) => {
  const can = (f, c = {}) => rawCan(f, { isAdmin: who.isAdmin, ...c });
  return buildContext({ slug, chapter, lang: 'pt', book: BOOK[slug], info: info(slug), peopleChapters, peopleIndex, timeline, can, plan: who.plan, scholarly: !!who.isAdmin, hasMap: !!info(slug).map, ...over });
};
const ESS = { plan: 'essencial', isAdmin: false };
const PRO = { plan: 'pro', isAdmin: false };
const ADM = { plan: 'essencial', isAdmin: true };

// ---- base de um item ----
eq(chapterOfRef('12:1-3'), 12, 'chapterOfRef: capítulo:versículos');
eq(chapterOfRef('Gênesis'), null, 'chapterOfRef: sem número');
eq(baseOf('ref:joh:3:16'), { slug: 'joh', chapter: 3 }, 'baseOf: passagem');
eq(baseOf('chapter:gen:12'), { slug: 'gen', chapter: 12 }, 'baseOf: capítulo');
eq(baseOf('book:gen'), { slug: 'gen', chapter: null }, 'baseOf: livro');
eq(baseOf('place:gen:Harã'), { slug: 'gen', chapter: null }, 'baseOf: lugar');
eq(baseOf('person:davi'), null, 'baseOf: personagem não tem texto-base');
eq(baseOf('block:quem'), null, 'baseOf: bloco não tem texto-base');
eq(baseOf('event:abraao', timeline), { slug: 'gen', chapter: 12 }, 'baseOf: evento vem do livro e capítulo da referência');
eq(baseOf('event:nao-existe', timeline), null, 'baseOf: evento desconhecido');

// ---- João 3 ----
{
  const e = run('joh', 3, ESS);
  eq(e.book.slug, 'joh', 'ficha do livro');
  ok(e.ficha.author.traditional && e.ficha.theme && e.ficha.keyVerse, 'Essencial recebe autor (tradição), tema e versículo-chave');
  ok(!('scholarly' in e.ficha.author) && !('scholarly' in e.ficha.date), 'Essencial NÃO recebe a posição acadêmica');
  ok(e.outline.length >= 1, 'esboço do capítulo 3');
  ok(e.characters.status === 'ok' && e.characters.items.length > 0, 'personagens do capítulo 3');
  ok(e.characters.items.every((c) => c.id && c.name), 'personagens com id e nome');
  eq(e.events.status, 'locked', 'Essencial: eventos trancados');
  eq(e.events.items, [], 'Essencial: trancado não expõe itens');
  ok(['locked', 'ok', 'empty'].includes(e.places.status), 'lugares com estado definido');
  const p = run('joh', 3, PRO);
  ok(p.events.status !== 'locked', 'Pro: eventos liberados');
  ok(!('scholarly' in p.ficha.author), 'Pro também NÃO recebe a posição acadêmica');
  const a = run('joh', 3, ADM);
  ok(a.ficha.author.scholarly && a.ficha.date.scholarly, 'admin recebe a posição acadêmica');
  ok(a.events.status !== 'locked', 'admin: eventos liberados');
}

// ---- Gênesis 12: tem evento (Chamada de Abraão) e mapa ----
{
  const p = run('gen', 12, PRO);
  ok(p.events.status === 'ok' && p.events.items.some((x) => x.id === 'abraao'), 'Pro: Gênesis 12 traz a Chamada de Abraão');
  ok(p.events.items.every((x) => x.ref && chapterOfRef(x.ref) === 12), 'só eventos do capítulo 12');
  ok(p.places.status === 'ok' && p.places.items.every((x) => chapterOfRef(x.ref) === 12), 'lugares só do capítulo 12');
  const e = run('gen', 12, ESS);
  eq(e.events.items, [], 'Essencial: Gênesis 12 sem eventos');
  eq(JSON.stringify(e).includes('Chamada de Abraão'), false, 'Essencial: o texto do evento Pro não vaza no contexto');
  const whole = run('gen', null, PRO);
  ok(whole.events.items.length >= p.events.items.length, 'livro inteiro tem ao menos os eventos do capítulo');
  ok(whole.outline.length === 0, 'sem capítulo não há seção de esboço');
}

// ---- lugares: livro sem mapa e livro com mapa Pro ----
{
  const noMap = run('joh', 3, ESS, { info: { ...info('joh'), map: undefined }, hasMap: false });
  eq(noMap.places.status, 'none', 'livro sem mapa não mostra a seção');
  const locked = run('joh', 3, ESS, { can: () => false, hasMap: true });
  eq([locked.places.status, locked.places.items], ['locked', []], 'mapa fora do plano: trancado e vazio');
  const ess = createCan(plans);
  const pickBook = plans.essencial.mapBooks[0];
  ok(ess('map', { plan: 'essencial', slug: pickBook }), 'sanidade: livro de mapa do Essencial');
}

// ---- entradas ainda carregando ----
{
  const c = buildContext({ slug: 'joh', chapter: 3, lang: 'pt', book: BOOK.joh, info: null, peopleChapters: null, peopleIndex, timeline: null, can: (f, x) => rawCan(f, x), plan: 'essencial' });
  eq([c.ficha, c.outline], [null, []], 'sem ficha carregada: vazio, sem erro');
  eq(c.events.status, 'locked', 'sem timeline e sem plano: trancado');
  const p = buildContext({ slug: 'joh', chapter: 3, lang: 'pt', book: BOOK.joh, info: info('joh'), peopleChapters: null, peopleIndex, timeline: null, can: (f, x) => rawCan(f, x), plan: 'pro' });
  ok(p.characters.status === 'ok', 'sem people-chapters: cai nos personagens da ficha');
  const en = buildContext({ slug: 'joh', chapter: 3, lang: 'en', book: BOOK.joh, info: info('joh'), peopleChapters, peopleIndex, timeline, can: (f, x) => rawCan(f, x), plan: 'pro' });
  ok(typeof en.ficha.theme === 'string' && en.ficha.theme !== c.ficha, 'idioma EN');
}

// ---- linhas novas da matriz: marks, studies, study-export ----
{
  const lim = plans.essencial.studyLimit;
  ok(rawCan('marks', { plan: 'essencial' }) && rawCan('marks', { plan: 'pro' }), 'can(marks): todos os planos');
  ok(rawCan('studies', { plan: 'essencial', count: lim - 1 }), `can(studies): Essencial cria o ${lim}º`);
  ok(!rawCan('studies', { plan: 'essencial', count: lim }), `can(studies): Essencial não cria o ${lim + 1}º`);
  ok(!rawCan('studies', { plan: 'essencial', count: 99 }), 'can(studies): Essencial com mais que o limite (caiu de plano) não cria');
  ok(rawCan('studies', { plan: 'pro', count: 150 }) && rawCan('studies', { plan: 'premium', count: 150 }), 'can(studies): Pro e Premium sem limite de plano');
  ok(rawCan('studies', { plan: 'essencial', count: 99, isAdmin: true }), 'can(studies): admin pode');
  ok(!rawCan('study-export', { plan: 'essencial' }) && rawCan('study-export', { plan: 'pro' }) && rawCan('study-export', { plan: 'premium' }) && rawCan('study-export', { plan: 'essencial', isAdmin: true }), 'can(study-export): só Pro, Premium e admin');
}

console.log(failed ? `\n${failed} teste(s) falharam, ${passed} passaram.` : `OK: ${passed} testes do contexto de estudos passaram.`);
process.exit(failed ? 1 : 0);
