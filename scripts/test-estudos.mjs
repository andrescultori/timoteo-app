// Testes da migration 20261020000000_estudos_marcacoes.sql em Postgres de verdade (PGlite), com as tabelas mínimas do Supabase simuladas
// (mesmo preâmbulo de scripts/test-payments.mjs): RLS, restrições, validação do JSON, limites (marcações e estudos por plano), consistência com
// can_read_pro(), exclusão de conta e o teste de guarda da LGPD (toda tabela com dados do usuário é apagada na exclusão e entra em "Baixar meus dados").
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { cleanMark, cleanCategories } from '../src/marksCore.js';
import { isItemKey, TEMPLATES, blockKey, newStudy } from '../src/studiesCore.js';

const root = path.resolve(import.meta.dirname, '..');
let passed = 0;
let failed = 0;
const ok = (cond, msg) => { if (cond) passed += 1; else { failed += 1; console.error(`FALHOU: ${msg}`); } };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg} (esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)})`);
const rejects = async (fn, msg, re) => { try { await fn(); ok(false, `${msg} (não lançou erro)`); } catch (e) { ok(!re || re.test(`${e.message} ${e.hint ?? ''}`), `${msg} (erro: ${e.message})`); } };

const db = new PGlite();
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to authenticated, service_role, anon;
  grant usage on schema public to authenticated, service_role, anon;
  create schema storage;
  create table storage.buckets (id text primary key, name text not null, public boolean not null default false, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id), name text not null, owner uuid);
  alter table storage.objects enable row level security;
  grant usage on schema storage to authenticated, anon, service_role;
  grant select, insert, update, delete on storage.objects to authenticated, anon;
  grant all on storage.objects, storage.buckets to service_role;
`);
for (const f of fs.readdirSync(path.join(root, 'supabase/migrations')).sort()) await db.exec(fs.readFileSync(path.join(root, 'supabase/migrations', f), 'utf8'));
await db.exec(`grant select, insert, update on public.entitlements to service_role;`);

// a migration pode ser reaplicada sem erro e sem duplicar nada
await db.exec(fs.readFileSync(path.join(root, 'supabase/migrations/20261020000000_estudos_marcacoes.sql'), 'utf8'));
ok(true, 'a migration reaplicada não dá erro');
await db.exec(fs.readFileSync(path.join(root, 'supabase/migrations/20261021000000_estudos_inc.sql'), 'utf8'));
ok(true, 'a migration do inc reaplicada não dá erro');

const q = async (sql, params) => (await db.query(sql, params)).rows;
const n = async (sql, params) => Number((await q(sql, params))[0].n);
const newUser = async () => (await q(`insert into auth.users (email) values ($1) returning id`, [`u${Math.random()}@t.com`]))[0].id;
const as = async (uid, fn) => {
  await db.exec(`set role ${uid === 'anon' ? 'anon' : 'authenticated'}; select set_config('request.jwt.claim.sub', '${uid && uid !== 'anon' ? uid : ''}', false);`);
  try { return await fn(); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); }
};
const setPlan = (u, plan, expires) => q(`update public.entitlements set plan = $2, expires_at = $3 where user_id = $1`, [u, plan, expires]);
const setLimit = (key, value) => q(`update public.app_limits set value = $2 where key = $1`, [key, value]);
const mark = (u, b, c, v, cat = 'c1', note = null) => q(`insert into public.verse_marks (user_id, book, chapter, verse, cat, note) values ($1, $2, $3, $4, $5, $6)`, [u, b, c, v, cat, note]);
const study = (u, title = 'Estudo', items = '[]', template = null) => q(`insert into public.studies (user_id, title, template, items) values ($1, $2, $3, $4::jsonb)`, [u, title, template, items]);
const DAY = 86400000;
const inFuture = new Date(Date.now() + 30 * DAY).toISOString();
const inPast = new Date(Date.now() - DAY).toISOString();

// ---------------------------------------------------------------------------------------------------------------------------------------
// Permissões: as 3 tabelas só para o dono; app_limits e as funções internas fora do alcance do app
// ---------------------------------------------------------------------------------------------------------------------------------------
{
  const a = await newUser();
  const b = await newUser();
  for (const t of ['verse_marks', 'study_settings', 'studies']) {
    await rejects(() => as('anon', () => q(`select * from public.${t}`)), `anon não lê ${t}`);
    eq(await as(a, async () => n(`select count(*) as n from public.${t}`)), 0, `${t} começa vazia para o usuário`);
  }
  await rejects(() => as(a, () => q(`select * from public.app_limits`)), 'o app não lê app_limits');
  await rejects(() => as(a, () => q(`update public.app_limits set value = 99999`)), 'o app não altera app_limits');
  await rejects(() => as(a, () => q(`select public.app_limit('verse_marks_max')`)), 'o app não executa app_limit');
  await rejects(() => as(a, () => q(`select public.is_pro_active($1)`, [a])), 'o app não executa is_pro_active (não dá para consultar o plano de outro usuário)');
  await rejects(() => as('anon', () => q(`select public.study_items_valid('[]'::jsonb)`)), 'anon não executa a validação');
  eq(await n(`select count(*) as n from public.app_limits`), 3, 'app_limits: 3 limites');
  eq(Object.fromEntries((await q(`select key, value from public.app_limits order by key`)).map((r) => [r.key, r.value])), { studies_essencial_max: 5, studies_max: 200, verse_marks_max: 10000 }, 'valores de partida: 5, 200 e 10000');
  void b;
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// verse_marks: RLS, restrições (iguais às do cliente) e limite
// ---------------------------------------------------------------------------------------------------------------------------------------
{
  const a = await newUser();
  const b = await newUser();
  await as(a, () => mark(a, 'joh', 3, 16, 'c1'));
  await as(a, () => mark(a, 'psa', 119, 176, null, 'só nota'));
  await as(a, () => mark(a, 'gen', 1, 1, 'c6', 'as duas'));
  eq(await as(a, async () => n(`select count(*) as n from public.verse_marks`)), 3, 'dono lê as próprias marcações');
  eq(await as(b, async () => n(`select count(*) as n from public.verse_marks`)), 0, 'outro usuário não vê');
  await rejects(() => as(b, () => mark(a, 'joh', 3, 17, 'c1')), 'ninguém grava para outro usuário');
  eq(await as(b, async () => (await q(`update public.verse_marks set cat = 'c2' where user_id = $1 returning 1`, [a])).length), 0, 'outro usuário não altera a marcação alheia');
  eq(await as(b, async () => (await q(`delete from public.verse_marks where user_id = $1 returning 1`, [a])).length), 0, 'outro usuário não apaga a marcação alheia');
  await as(a, () => q(`insert into public.verse_marks (user_id, book, chapter, verse, cat) values ($1, 'joh', 3, 16, 'c2') on conflict (user_id, book, chapter, verse) do update set cat = excluded.cat`, [a]));
  eq((await q(`select cat from public.verse_marks where user_id = $1 and book = 'joh'`, [a]))[0].cat, 'c2', 'upsert troca a categoria');

  const bad = [
    ['categoria fora de c1..c6', () => mark(a, 'joh', 1, 1, 'c7')],
    ['categoria c0', () => mark(a, 'joh', 1, 1, 'c0')],
    ['versículo 0', () => mark(a, 'joh', 1, 0)],
    ['versículo 177', () => mark(a, 'joh', 1, 177)],
    ['capítulo 0', () => mark(a, 'joh', 0, 1)],
    ['capítulo 151', () => mark(a, 'joh', 151, 1)],
    ['livro com 4 letras', () => mark(a, 'joao', 1, 1)],
    ['livro em maiúsculas', () => mark(a, 'JOH', 1, 1)],
    ['nota vazia', () => mark(a, 'joh', 1, 1, 'c1', '')],
    ['nota de 2001 caracteres', () => mark(a, 'joh', 1, 1, 'c1', 'x'.repeat(2001))],
    ['sem categoria e sem nota', () => mark(a, 'joh', 1, 1, null, null)],
  ];
  for (const [label, fn] of bad) await rejects(() => as(a, fn), `o banco recusa: ${label}`);
  await as(a, () => mark(a, 'joh', 1, 2, 'c1', 'x'.repeat(2000)));
  ok(true, 'nota de 2000 caracteres passa');
  await as(a, () => mark(a, 'jhn', 150, 176, 'c3'));
  ok(true, 'capítulo 150 e versículo 176 passam');

  // o cliente (cleanMark) e o banco aceitam exatamente a mesma coisa
  const fresh = await newUser();
  for (const c of [0, 1, 150, 151]) {
    for (const v of [0, 1, 176, 177]) {
      let accepted = true;
      try { await as(fresh, () => mark(fresh, 'rom', c, v, 'c1')); } catch { accepted = false; }
      eq(accepted, cleanMark({ b: 'rom', c, v, cat: 'c1', at: new Date().toISOString() }) !== null, `cliente e banco concordam em ${c}:${v}`);
    }
  }
  for (const cat of ['c1', 'c6', 'c7', 'C1', 'x', null]) {
    let accepted = true;
    try { await as(fresh, () => mark(fresh, 'act', 1, 1, cat, 'nota')); } catch { accepted = false; }
    await q(`delete from public.verse_marks where user_id = $1 and book = 'act'`, [fresh]);
    eq(accepted && true, cat === null || ['c1', 'c6'].includes(cat), `banco: categoria ${cat} com nota`);
    eq(cleanMark({ b: 'act', c: 1, v: 1, cat, note: 'nota', at: new Date().toISOString() }).cat === cat, cat === null || ['c1', 'c6'].includes(cat) || false, `cliente: categoria ${cat} (inválida vira null e a nota fica)`);
  }

  // data do cliente nunca no futuro
  await as(a, () => q(`insert into public.verse_marks (user_id, book, chapter, verse, cat, updated_at) values ($1, 'gen', 2, 2, 'c1', now() + interval '10 days')`, [a]));
  eq((await q(`select updated_at <= now() as ok from public.verse_marks where user_id = $1 and book = 'gen' and chapter = 2`, [a]))[0].ok, true, 'insert: updated_at no futuro é limitado a now()');
  await as(a, () => q(`update public.verse_marks set updated_at = now() + interval '10 days' where user_id = $1 and book = 'gen' and chapter = 2`, [a]));
  eq((await q(`select updated_at <= now() as ok from public.verse_marks where user_id = $1 and book = 'gen' and chapter = 2`, [a]))[0].ok, true, 'update: updated_at no futuro é limitado a now()');
  await as(a, () => q(`insert into public.verse_marks (user_id, book, chapter, verse, cat, updated_at) values ($1, 'gen', 2, 3, 'c1', '2026-01-01T00:00:00Z')`, [a]));
  eq((await q(`select to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD') as d from public.verse_marks where user_id = $1 and book = 'gen' and chapter = 2 and verse = 3`, [a]))[0].d, '2026-01-01', 'data do passado vale como veio (o cliente decide o "mais recente vence")');

  // limite por usuário (reduzido para 3 no teste; em produção é 10000)
  const L = await newUser();
  const other = await newUser();
  await setLimit('verse_marks_max', 3);
  for (const v of [1, 2, 3]) await as(L, () => mark(L, 'gen', 1, v));
  await rejects(() => as(L, () => mark(L, 'gen', 1, 4)), 'a 4ª marcação passa do limite', /marks_limit|Limite de marcações/);
  await as(L, () => q(`insert into public.verse_marks (user_id, book, chapter, verse, cat) values ($1, 'gen', 1, 3, 'c5') on conflict (user_id, book, chapter, verse) do update set cat = excluded.cat`, [L]));
  eq((await q(`select cat from public.verse_marks where user_id = $1 and verse = 3`, [L]))[0].cat, 'c5', 'regravar uma marcação existente (upsert) não conta como nova');
  await as(other, () => mark(other, 'gen', 1, 1));
  ok(true, 'o limite é por usuário');
  await as(L, () => q(`delete from public.verse_marks where user_id = $1 and verse = 1`, [L]));
  await as(L, () => mark(L, 'gen', 1, 4));
  ok(true, 'apagar uma libera uma vaga');
  await setLimit('verse_marks_max', 10000);
  eq(await n(`select value as n from public.app_limits where key = 'verse_marks_max'`), 10000, 'limite restaurado para 10000');
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// study_settings e study_categories_valid
// ---------------------------------------------------------------------------------------------------------------------------------------
{
  const cat = async (j) => (await q(`select public.study_categories_valid($1::jsonb) as v`, [JSON.stringify(j)]))[0].v;
  const six = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'].map((id, i) => ({ id, name: `Cat ${i}` }));
  ok(await cat([]), 'vazio vale');
  ok(await cat(six), 'seis categorias valem');
  ok(await cat([{ id: 'c3', name: 'Intercessão' }]), 'uma categoria renomeada vale');
  ok(await cat([{ id: 'c1', name: 'x'.repeat(30) }]), 'nome de 30 caracteres vale');
  ok(await cat([{ id: 'c1', name: '😀'.repeat(30) }]), 'nome de 30 emojis vale (conta por caractere)');
  for (const [label, j] of [
    ['sete categorias', [...six, { id: 'c7', name: 'x' }]],
    ['id repetido', [{ id: 'c1', name: 'a' }, { id: 'c1', name: 'b' }]],
    ['id fora de c1..c6', [{ id: 'c7', name: 'a' }]],
    ['sem id', [{ name: 'a' }]],
    ['chave extra (color)', [{ id: 'c1', name: 'a', color: '#fff' }]],
    ['nome vazio', [{ id: 'c1', name: '' }]],
    ['nome de 31 caracteres', [{ id: 'c1', name: 'x'.repeat(31) }]],
    ['nome que não é texto', [{ id: 'c1', name: 5 }]],
    ['sem nome', [{ id: 'c1' }]],
    ['nome nulo', [{ id: 'c1', name: null }]],
    ['elemento que não é objeto', ['c1']],
    ['não é lista', { c1: 'a' }],
    ['texto', 'c1'],
    ['número', 3],
    ['nulo', null],
  ]) ok(!(await cat(j)), `categorias: o banco recusa ${label}`);
  // o que o cliente limpa sempre passa no banco
  for (const raw of [[{ id: 'c2', name: ' Fé ' }, { id: 'c1', name: 'Missão' }], [{ id: 'c1', name: 'x'.repeat(80) }], [{ id: 'c9', name: 'x' }], [{ id: 'c1', name: 'a', color: 'red' }], six]) {
    ok(await cat(cleanCategories(raw)), `cleanCategories gera sempre um valor aceito pelo banco (${JSON.stringify(raw).slice(0, 40)})`);
  }

  const a = await newUser();
  const b = await newUser();
  await as(a, () => q(`insert into public.study_settings (user_id, categories) values ($1, $2::jsonb)`, [a, JSON.stringify(six)]));
  eq(await as(a, async () => n(`select count(*) as n from public.study_settings`)), 1, 'dono lê as próprias categorias');
  eq(await as(b, async () => n(`select count(*) as n from public.study_settings`)), 0, 'outro usuário não vê');
  await rejects(() => as(b, () => q(`insert into public.study_settings (user_id, categories) values ($1, '[]')`, [a])), 'ninguém grava as categorias de outro');
  await rejects(() => as(a, () => q(`update public.study_settings set categories = '[{"id":"c1","name":""}]' where user_id = $1`, [a])), 'o banco recusa categoria inválida');
  await as(a, () => q(`update public.study_settings set categories = '[]', updated_at = now() + interval '5 days' where user_id = $1`, [a]));
  eq((await q(`select updated_at <= now() as ok from public.study_settings where user_id = $1`, [a]))[0].ok, true, 'categorias: updated_at no futuro é limitado');
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// study_items_valid e studies
// ---------------------------------------------------------------------------------------------------------------------------------------
{
  const items = async (j) => (await q(`select public.study_items_valid($1::jsonb) as v`, [JSON.stringify(j)]))[0].v;
  ok(await items([]), 'sem itens vale');
  ok(await items([{ k: 'ref:joh:3:16-21', note: 'nota' }, { k: 'person:davi' }, { k: 'block:observacao', note: '' }]), 'itens válidos');
  ok(await items(Array.from({ length: 100 }, (_, i) => ({ k: `chapter:gen:${(i % 50) + 1}` }))), '100 itens valem');
  for (const [label, j] of [
    ['101 itens', Array.from({ length: 101 }, () => ({ k: 'book:gen' }))],
    ['chave inválida', [{ k: 'lixo' }]],
    ['campo extra', [{ k: 'book:gen', x: 1 }]],
    ['sem chave', [{ note: 'x' }]],
    ['chave que não é texto', [{ k: 5 }]],
    ['nota de 5001 caracteres', [{ k: 'book:gen', note: 'x'.repeat(5001) }]],
    ['inc que não é booleano', [{ k: 'person:davi', inc: 'sim' }]],
    ['inc numérico', [{ k: 'person:davi', inc: 1 }]],
    ['inc nulo', [{ k: 'person:davi', inc: null }]],
    ['campo extra ao lado do inc', [{ k: 'person:davi', inc: true, x: 1 }]],
    ['nota que não é texto', [{ k: 'book:gen', note: 5 }]],
    ['item que não é objeto', ['book:gen']],
    ['não é lista', { k: 'book:gen' }],
    ['texto', 'x'],
    ['nulo', null],
    ['JSON grande', Array.from({ length: 60 }, (_, i) => ({ k: `chapter:gen:${i + 1}`, note: 'y'.repeat(2000) }))],
  ]) ok(!(await items(j)), `itens: o banco recusa ${label}`);
  ok(await items([{ k: 'book:gen', note: 'x'.repeat(2000) }]), 'nota de 2000 caracteres vale');
  ok(await items([{ k: 'book:gen', note: 'x'.repeat(5000) }]), 'nota de 5000 caracteres vale (item de estudo)');
  ok(await items([{ k: 'person:davi', inc: true }, { k: 'place:gen:Harã', inc: false, note: 'n' }, { k: 'block:ctx', inc: true }]), 'inc booleano vale, com ou sem nota; block:ctx é uma chave válida');
  ok(await items([{ k: 'event:abraao', note: 'a'.repeat(5000), inc: true }, { k: 'book:gen', note: 'b'.repeat(5000) }]), 'itens de nota longa com inc passam abaixo de 100000 caracteres');
  ok(!(await items(Array.from({ length: 21 }, (_, i) => ({ k: `chapter:gen:${i + 1}`, note: 'z'.repeat(5000) })))), 'o teto de 100000 caracteres do JSON continua valendo');

  // as chaves: o banco e o cliente (isItemKey) concordam
  const corpus = [
    'ref:joh:3:16', 'ref:joh:3:16-21', 'ref:joh:3', 'ref:joh:3:16-', 'ref:john:3:16', 'ref:joh:1234:1', 'book:gen', 'book:', 'book:GEN', 'chapter:1sa:3', 'chapter:1sa:x',
    'verse:psa:119:176', 'verse:psa:119', 'person:davi', 'person:Davi', 'person:' + 'a'.repeat(60), 'person:' + 'a'.repeat(61), 'event:chamada-de-abraao', 'event:a_b',
    'place:gen:Belém', 'place:gen:Belém: Judá', 'place:gen:', 'place:gen:' + 'x'.repeat(80), 'place:gen:' + 'x'.repeat(81), 'place:gen:' + '😀'.repeat(80), 'place:gen:' + '😀'.repeat(81),
    'place:gen:a\nb', 'block:observacao', 'block:aplicacao-semana', 'block:a b', 'block:' + 'a'.repeat(30), 'block:' + 'a'.repeat(31), 'x:y', 'ref:joh:3:16\n', ' ref:joh:3:16',
  ];
  for (const k of corpus) eq(await items([{ k }]), isItemKey(k), `chave ${JSON.stringify(k).slice(0, 50)}: banco e cliente concordam`);
  // os blocos de todos os modelos passam
  for (const [tpl, blocks] of Object.entries(TEMPLATES)) ok(await items(blocks.map((b) => ({ k: blockKey(b) }))), `modelo ${tpl}: os blocos passam no banco`);

  const a = await newUser();
  const b = await newUser();
  const tplStudy = newStudy({ id: '00000000-0000-4000-8000-000000000001', title: 'Passagem', template: 'passagem' });
  await as(a, () => q(`insert into public.studies (id, user_id, title, template, items) values ($1, $2, $3, $4, $5::jsonb)`, [tplStudy.id, a, tplStudy.title, tplStudy.template, JSON.stringify(tplStudy.items)]));
  eq(await as(a, async () => n(`select count(*) as n from public.studies`)), 1, 'dono lê os próprios estudos');
  await as(a, () => study(a, 'Com inc', JSON.stringify([{ k: 'person:davi', inc: true }, { k: 'block:ctx', inc: true }, { k: 'book:gen', note: 'n'.repeat(5000) }])));
  eq(await as(a, async () => (await q(`select items from public.studies where title = 'Com inc'`))[0].items.map((x) => x.inc ?? null)), [true, true, null], 'a tabela guarda e devolve o inc');
  await rejects(() => as(a, () => study(a, 'Inc ruim', JSON.stringify([{ k: 'person:davi', inc: 'sim' }]))), 'a tabela recusa inc que não é booleano');
  await as(a, () => q(`delete from public.studies where title = 'Com inc'`));
  eq(await as(b, async () => n(`select count(*) as n from public.studies`)), 0, 'outro usuário não vê');
  await rejects(() => as(b, () => study(a)), 'ninguém grava estudo para outro usuário');
  await rejects(() => as(b, () => q(`insert into public.studies (id, user_id, title) values ($1, $2, 'roubo') on conflict (id) do update set title = excluded.title`, [tplStudy.id, b])), 'não dá para tomar o estudo de outro pelo id');
  eq(await as(b, async () => (await q(`update public.studies set title = 'x' where id = $1 returning 1`, [tplStudy.id])).length), 0, 'outro usuário não altera o estudo alheio');
  eq(await as(b, async () => (await q(`delete from public.studies where id = $1 returning 1`, [tplStudy.id])).length), 0, 'outro usuário não apaga o estudo alheio');
  for (const [label, fn] of [
    ['título vazio', () => study(a, '')],
    ['título de 121 caracteres', () => study(a, 'x'.repeat(121))],
    ['modelo desconhecido', () => study(a, 't', '[]', 'outro')],
    ['itens inválidos', () => study(a, 't', '[{"k":"lixo"}]')],
  ]) await rejects(() => as(a, fn), `o banco recusa estudo com ${label}`);
  await as(a, () => study(a, 'x'.repeat(120)));
  ok(true, 'título de 120 caracteres passa');
  await as(a, () => q(`update public.studies set updated_at = now() + interval '9 days' where id = $1`, [tplStudy.id]));
  eq((await q(`select updated_at <= now() as ok from public.studies where id = $1`, [tplStudy.id]))[0].ok, true, 'estudos: updated_at no futuro é limitado');
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// Limite de estudos por plano (gatilho studies_guard) e consistência com can_read_pro()
// ---------------------------------------------------------------------------------------------------------------------------------------
{
  // Essencial: 5
  const e = await newUser();
  for (let i = 0; i < 5; i += 1) await as(e, () => study(e, `E${i}`));
  await rejects(() => as(e, () => study(e, 'E5')), 'Essencial: o 6º estudo é recusado', /studies_plan|Essencial/);
  await as(e, () => q(`update public.studies set title = 'editado' where user_id = $1 and title = 'E0'`, [e]));
  ok(true, 'Essencial no limite ainda edita estudo existente');
  await as(e, () => q(`delete from public.studies where user_id = $1 and title = 'E1'`, [e]));
  await as(e, () => study(e, 'E6'));
  ok(true, 'apagar um libera uma vaga');
  eq(await n(`select count(*) as n from public.studies where user_id = $1`, [e]), 5, 'Essencial termina com 5');

  // o gatilho lê o plano pelo id do estudo (new.user_id), não por auth.uid(): vale também para o service_role (Edge Function, script)
  await rejects(() => study(e, 'via service_role'), 'inserir como service_role também respeita o plano do dono', /studies_plan|Essencial/);

  // Pro vigente: passa de 5, até o teto técnico (reduzido para 8 no teste)
  const p = await newUser();
  await setPlan(p, 'pro', null);
  await setLimit('studies_max', 8);
  for (let i = 0; i < 8; i += 1) await as(p, () => study(p, `P${i}`));
  ok(true, 'Pro: passa dos 5 do Essencial');
  await rejects(() => as(p, () => study(p, 'P8')), 'Pro: o teto técnico vale', /studies_max|técnico/);
  await setLimit('studies_max', 200);

  // Pro com vencimento no futuro, Premium e admin
  const pf = await newUser(); await setPlan(pf, 'pro', inFuture);
  const pm = await newUser(); await setPlan(pm, 'premium', null);
  const ad = await newUser(); await q(`insert into public.app_admins (user_id) values ($1)`, [ad]);
  for (const [u, label] of [[pf, 'Pro com vencimento futuro'], [pm, 'Premium'], [ad, 'admin (mesmo no plano Essencial)']]) {
    for (let i = 0; i < 6; i += 1) await as(u, () => study(u, `S${i}`));
    ok(true, `${label}: 6 estudos`);
  }

  // queda de plano: continua lendo, editando e apagando; só não cria
  const d = await newUser();
  await setPlan(d, 'pro', null);
  for (let i = 0; i < 7; i += 1) await as(d, () => study(d, `D${i}`));
  await setPlan(d, 'pro', inPast);
  await rejects(() => as(d, () => study(d, 'novo')), 'Pro vencido conta como Essencial: não cria', /studies_plan|Essencial/);
  eq(await as(d, async () => n(`select count(*) as n from public.studies`)), 7, 'Pro vencido: continua lendo os 7');
  await as(d, () => q(`update public.studies set title = 'continua editando' where user_id = $1 and title = 'D0'`, [d]));
  eq(await n(`select count(*) as n from public.studies where title = 'continua editando' and user_id = $1`, [d]), 1, 'Pro vencido: continua editando');
  await as(d, () => q(`delete from public.studies where user_id = $1 and title in ('D1', 'D2')`, [d]));
  eq(await n(`select count(*) as n from public.studies where user_id = $1`, [d]), 5, 'Pro vencido: continua apagando');
  await rejects(() => as(d, () => study(d, 'ainda não')), 'com 5 ainda não cria (limite do Essencial)', /studies_plan|Essencial/);
  await as(d, () => q(`delete from public.studies where user_id = $1 and title = 'D3'`, [d]));
  await as(d, () => study(d, 'agora sim'));
  ok(true, 'abaixo de 5, volta a criar');
  await setPlan(d, 'pro', inFuture);
  await as(d, () => study(d, 'renovou'));
  ok(true, 'renovou o Pro: cria de novo');

  // is_pro_active(uuid) e can_read_pro() respondem igual em todos os estados de plano
  const states = [
    ['essencial', 'essencial', null], ['pro sem vencimento', 'pro', null], ['pro vigente', 'pro', inFuture], ['pro vencido', 'pro', inPast],
    ['premium sem vencimento', 'premium', null], ['premium vencido', 'premium', inPast], ['essencial com data futura', 'essencial', inFuture],
  ];
  for (const [label, plan, exp] of states) {
    const u = await newUser();
    await setPlan(u, plan, exp);
    const viaId = (await q(`select public.is_pro_active($1) as r`, [u]))[0].r;
    const viaUid = await as(u, async () => (await q(`select public.can_read_pro() as r`))[0].r);
    eq([viaId, viaUid], [viaUid, viaUid], `${label}: is_pro_active e can_read_pro concordam`);
  }
  const adm = await newUser(); await q(`insert into public.app_admins (user_id) values ($1)`, [adm]);
  eq([(await q(`select public.is_pro_active($1) as r`, [adm]))[0].r, await as(adm, async () => (await q(`select public.can_read_pro() as r`))[0].r)], [true, true], 'admin: as duas dizem sim');
  eq((await q(`select public.is_pro_active(gen_random_uuid()) as r`))[0].r, false, 'usuário inexistente: não é Pro');
  eq((await q(`select public.is_pro_active(null) as r`))[0].r, false, 'id nulo: não é Pro');
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// Exclusão de conta
// ---------------------------------------------------------------------------------------------------------------------------------------
{
  const d = await newUser();
  const other = await newUser();
  await mark(d, 'joh', 3, 16, 'c1', 'nota'); await mark(d, 'gen', 1, 1, 'c2');
  await q(`insert into public.study_settings (user_id, categories) values ($1, '[{"id":"c1","name":"x"}]')`, [d]);
  await study(d, 'meu estudo', '[{"k":"book:gen"}]'); await study(d, 'outro estudo');
  await mark(other, 'joh', 3, 16, 'c1'); await study(other, 'do outro');
  await q(`insert into public.study_settings (user_id, categories) values ($1, '[]')`, [other]);
  await q(`select public.delete_account_data($1)`, [d]);
  for (const t of ['verse_marks', 'study_settings', 'studies']) eq(await n(`select count(*) as n from public.${t} where user_id = $1`, [d]), 0, `exclusão apaga ${t}`);
  for (const [t, c] of [['verse_marks', 1], ['study_settings', 1], ['studies', 1]]) eq(await n(`select count(*) as n from public.${t} where user_id = $1`, [other]), c, `exclusão não mexe em ${t} de outro usuário`);
  await q(`select public.delete_account_data($1)`, [d]);
  ok(true, 'exclusão é idempotente');
  await q(`delete from auth.users where id = $1`, [d]);
  await q(`delete from auth.users where id = $1`, [other]);
  eq(await n(`select count(*) as n from public.verse_marks`) >= 0, true, 'apagar o usuário do Auth não quebra (cascade)');
  await rejects(() => as(other, () => q(`select public.delete_account_data($1)`, [other])), 'cliente não executa delete_account_data');
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// Guarda da LGPD: toda tabela do schema public com dados do usuário (coluna user_id) precisa
//   (a) ser apagada por delete_account_data (ou estar na lista de exceções com o motivo) e
//   (b) entrar no arquivo de "Baixar meus dados" (src/YourData.jsx) (ou estar na lista de exceções com o motivo).
// Se amanhã nascer uma tabela nova com user_id e ninguém lembrar da exclusão e da exportação, este teste falha.
// ---------------------------------------------------------------------------------------------------------------------------------------
{
  const tables = (await q(`select distinct table_name as t from information_schema.columns where table_schema = 'public' and column_name = 'user_id' order by 1`)).map((r) => r.t);
  ok(tables.length >= 10, `a guarda enxerga as tabelas com user_id (${tables.join(', ')})`);
  for (const t of ['verse_marks', 'study_settings', 'studies', 'favorites', 'reading_position', 'reading_prefs', 'entitlements', 'waitlist', 'payments']) ok(tables.includes(t), `a guarda enxerga ${t}`);
  const fn = (await q(`select pg_get_functiondef('public.delete_account_data(uuid)'::regprocedure) as d`))[0].d;
  // não são apagadas por escolha: payments (anonimizados pelo prazo fiscal; user_id vira nulo)
  const NOT_DELETED = { payments: 'anonimizado pelo prazo fiscal (user_id nulo), não apagado' };
  for (const t of tables) {
    if (t in NOT_DELETED) { ok(new RegExp(`update public\\.${t}\\b`).test(fn), `exclusão: ${t} é ${NOT_DELETED[t]} (update na função)`); continue; }
    ok(new RegExp(`delete from public\\.${t}\\b`).test(fn), `exclusão: delete_account_data apaga ${t}`);
  }
  // tabelas com user_id que não entram no arquivo de "Baixar meus dados", com o motivo (revisão LGPD do André)
  const NOT_EXPORTED = { app_admins: 'interna: marca de administrador, sem dado do usuário', user_roles: 'interna: papéis editor e revisor dados pelo administrador (decisão LGPD do André: exportar ou não)' };
  const yourData = fs.readFileSync(path.join(root, 'src/YourData.jsx'), 'utf8');
  for (const t of tables) {
    if (t in NOT_EXPORTED) continue;
    ok(new RegExp(`['"]${t}['"]`).test(yourData), `exportação: src/YourData.jsx inclui ${t} em "Baixar meus dados"`);
  }
  for (const t of Object.keys(NOT_EXPORTED)) ok(tables.includes(t), `exceção da exportação existe de fato (${t})`);
}

console.log(failed ? `\n${failed} teste(s) falharam, ${passed} passaram.` : `OK: ${passed} testes de marcações, categorias e estudos (banco) passaram.`);
process.exit(failed ? 1 : 0);
