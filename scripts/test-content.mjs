// Testes do núcleo de carregamento (src/data/contentCore.js): origem `public` × `storage`, por nível de acesso, com um Storage simulado
// montado a partir do pacote Pro REAL (scripts/pro-lib.mjs). Roda no `npm test`. O Storage de verdade é provado por scripts/storage-poc.mjs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createContent } from '../src/data/contentCore.js';
import { loadSources, buildPackage } from './pro-lib.mjs';
import { buildFlags } from './build-content-flags.mjs';

const root = path.resolve(import.meta.dirname, '..');
const src = loadSources(root);
const flags = buildFlags(root);
const { files } = buildPackage(root);
const store = new Map([...files].filter(([k]) => !k.startsWith('interlinear/')).map(([k, b]) => [k, JSON.parse(b.toString('utf8'))]));
let n = 0;
const t = async (name, fn) => { await fn(); n += 1; };

const mk = (source, { deny = false, calls = [] } = {}) => createContent({
  source, ess: src.ess, flags,
  publicLoaders: {
    people: async () => structuredClone(src.people),
    timeline: async () => structuredClone(src.timeline),
    genealogy: async () => structuredClone(src.genealogy),
    info: async (slug) => (src.info[slug] ? structuredClone(src.info[slug]) : null),
  },
  fetchPro: async (key) => { calls.push(key); if (deny) return null; return store.has(key) ? structuredClone(store.get(key)) : null; },
});
const as = (c, userId, level) => c.setAccess({ userId, level, ready: true });
const get = async (c, k) => { await c.load(k); return c.get(k); };

const ess = new Set(src.ess.characters);
const proIds = src.people.filter((p) => !ess.has(p.id)).map((p) => p.id);

await t('local: devolve exatamente os dados de hoje, sem tocar o Storage', async () => {
  const calls = []; const c = mk('local', { calls });
  as(c, 'u', 'none');
  assert.deepEqual(await get(c, 'people'), src.people);
  assert.deepEqual(await get(c, 'timeline'), src.timeline);
  assert.deepEqual(await c.loadInfo('exo'), src.info.exo);
  assert.deepEqual(await c.loadInfo('job'), src.info.job);
  assert.equal(calls.length, 0);
});

await t('storage + Essencial/deslogado: só nome e livros dos Pro, sem linha do tempo, genealogia, mapa Pro, estrutura nem posição acadêmica', async () => {
  const calls = []; const c = mk('storage', { calls });
  as(c, null, 'none');
  const people = await get(c, 'people');
  assert.equal(people.length, src.people.length);
  for (const p of people) {
    if (ess.has(p.id)) assert.deepEqual(p, src.people.find((x) => x.id === p.id));
    else { assert.deepEqual(Object.keys(p).sort(), ['books', 'id', 'name']); assert.ok(p.books.every((b) => Object.keys(b).join() === 'book')); }
  }
  assert.deepEqual((await get(c, 'timeline')).events, []);
  assert.deepEqual((await get(c, 'genealogy')).trees, []);
  const gen = await c.loadInfo('gen'); // mapa do Essencial continua público
  assert.ok(gen.map && !JSON.stringify(gen).includes('"scholarly"'));
  const rom = await c.loadInfo('rom'); // mapa Pro
  assert.ok(!('map' in rom) && !JSON.stringify(rom).includes('"scholarly"'));
  const job = await c.loadInfo('job');
  assert.ok(!('structure' in job));
  assert.equal(calls.length, 0, 'sem direito, nem tenta o Storage');
});

await t('storage + Pro: completa personagens, linha do tempo, genealogia, mapa e estrutura; sem posição acadêmica', async () => {
  const c = mk('storage'); as(c, 'u1', 'pro');
  const people = await get(c, 'people');
  assert.deepEqual(people.find((p) => p.id === proIds[0]), src.people.find((p) => p.id === proIds[0]));
  assert.equal(people.filter((p) => !p.summary).length, 0, 'todos completos');
  const tl = await get(c, 'timeline');
  assert.equal(tl.events.length, src.timeline.events.length);
  assert.ok(!JSON.stringify(tl).includes('"scholarly"'));
  assert.deepEqual((await get(c, 'genealogy')).links, src.genealogy.links);
  const rom = await c.loadInfo('rom');
  assert.deepEqual(rom.map, src.info.rom.map);
  assert.ok(!JSON.stringify(rom).includes('"scholarly"'));
  const job = await c.loadInfo('job');
  assert.deepEqual(job.structure.voices, src.info.job.structure.voices);
  assert.ok(!JSON.stringify(job).includes('"view":"scholarly"'));
});

await t('storage + admin: volta a ter a posição acadêmica, idêntica ao original', async () => {
  const c = mk('storage'); as(c, 'adm', 'admin');
  assert.deepEqual(await get(c, 'timeline'), src.timeline);
  for (const slug of ['joh', 'rom', 'job', 'sng', 'ecc', 'psa']) assert.deepEqual(await c.loadInfo(slug), src.info[slug], `ficha ${slug}`);
});

await t('storage + Pro, mas o banco nega (plano vencido no servidor): cai para o público, sem erro', async () => {
  const c = mk('storage', { deny: true }); as(c, 'u2', 'pro');
  const people = await get(c, 'people');
  assert.ok(people.filter((p) => !ess.has(p.id)).every((p) => !p.summary));
  assert.deepEqual((await get(c, 'timeline')).events, []);
  assert.ok(!('map' in (await c.loadInfo('rom'))));
});

await t('trocar de acesso descarta o cache (logout/login/plano): nada de Pro de outra conta', async () => {
  const c = mk('storage'); as(c, 'u1', 'pro');
  assert.ok((await get(c, 'timeline')).events.length > 0);
  as(c, null, 'none');
  assert.equal(c.isReady(['timeline']), false, 'cache do Pro descartado ao sair');
  assert.deepEqual((await get(c, 'timeline')).events, []);
  as(c, 'u3', 'pro');
  assert.ok((await get(c, 'timeline')).events.length > 0);
});

await t('não carrega enquanto o plano não chegou (ready = false)', async () => {
  const calls = []; const c = mk('storage', { calls });
  c.setAccess({ userId: 'u', level: 'none', ready: false });
  assert.equal(c.canLoad(), false);
  c.setAccess({ userId: 'u', level: 'pro', ready: true });
  assert.equal(c.canLoad(), true);
  assert.equal(c.isReady(['people']), false);
});

await t('erro de rede no Storage não vira cache de sucesso: a falha é registrada e não se repete sozinha', async () => {
  const c = createContent({ source: 'storage', ess: src.ess, flags, publicLoaders: { people: async () => src.people, timeline: async () => src.timeline, genealogy: async () => src.genealogy, info: async () => null }, fetchPro: async () => { throw new Error('rede'); } });
  as(c, 'u', 'pro');
  await assert.rejects(c.load('people'));
  assert.equal(c.hasFailed(['people']), true);
  assert.equal(c.isReady(['people']), false);
});

await t('os arquivos do pacote têm as chaves que o carregador pede', () => {
  for (const k of ['people.json', 'timeline.json', 'genealogy.json', 'admin/scholarly.json', 'info/rom.json', 'info/job.json']) assert.ok(store.has(k), k);
  assert.ok(flags.map.every((s) => store.has(`info/${s}.json`)) && flags.structure.every((s) => store.has(`info/${s}.json`)));
  assert.ok(fs.existsSync(path.join(root, 'src/data/content-flags.json')));
});

console.log(`OK: ${n} testes do carregamento de conteúdo passaram.`);
