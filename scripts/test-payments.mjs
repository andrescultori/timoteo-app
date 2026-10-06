// Testes da cobrança (Fase 4). Uso: npm test
//  1) funções puras das Edge Functions (preço, x-signature, status, preferência, conferência do pagamento);
//  2) as migrations de verdade, rodadas em Postgres (PGlite) com as tabelas mínimas do Supabase simuladas:
//     soma de meses, renovação antecipada, vencido, reembolso, estorno, idempotência e permissões.
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { PRICE_CENTS, priceKind, priceCents, ITEM_TITLE } from '../supabase/functions/_shared/pricing.js';
import { buildManifest, parseSignature, hmacHex, verifySignature, mapStatus, preferenceBody } from '../supabase/functions/_shared/mp.js';
import { applyMpPayment, applyAll } from '../supabase/functions/_shared/payments.js';

const root = path.resolve(import.meta.dirname, '..');
let failed = 0;
let passed = 0;
const ok = (cond, msg) => { if (cond) passed += 1; else { failed += 1; console.error(`FALHOU: ${msg}`); } };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg} (esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)})`);
const rejects = async (fn, msg) => { try { await fn(); ok(false, `${msg} (não lançou erro)`); } catch { ok(true, msg); } };

// ---------------------------------------------------------------------------------------------------------------------
// 1) funções puras
// ---------------------------------------------------------------------------------------------------------------------
eq(priceKind(false), 'entrada', 'primeiro pagamento = preço de entrada');
eq(priceKind(true), 'cheio', 'depois do primeiro = preço cheio');
eq(priceCents(false), 2990, 'entrada em centavos');
eq(priceCents(true), 4990, 'cheio em centavos');
eq(Object.keys(PRICE_CENTS).sort(), ['cheio', 'entrada'], 'só dois preços');

eq(buildManifest({ dataId: 'ABC123', requestId: 'r-1', ts: '1742505638683' }), 'id:abc123;request-id:r-1;ts:1742505638683;', 'manifest: id alfanumérico em minúsculas');
eq(buildManifest({ dataId: '123-X', requestId: 'r', ts: '1' }), 'id:123-X;request-id:r;ts:1;', 'manifest: id com hífen fica como veio');
eq(buildManifest({ requestId: 'r', ts: '1' }), 'request-id:r;ts:1;', 'manifest: sem id, a parte some');
eq(parseSignature('ts=1742505638683,v1=abcdef'), { ts: '1742505638683', v1: 'abcdef' }, 'x-signature lido');
eq(parseSignature(null), { ts: null, v1: null }, 'x-signature ausente');

{
  const secret = 'segredo-de-teste';
  const ts = '1742505638683';
  const sig = await hmacHex(secret, buildManifest({ dataId: '123456', requestId: 'req-1', ts }));
  const header = `ts=${ts},v1=${sig}`;
  ok(await verifySignature({ secret, signatureHeader: header, requestId: 'req-1', dataId: '123456' }), 'assinatura válida aceita');
  ok(!(await verifySignature({ secret, signatureHeader: header, requestId: 'req-1', dataId: '999999' })), 'id trocado recusa');
  ok(!(await verifySignature({ secret, signatureHeader: header, requestId: 'req-2', dataId: '123456' })), 'request-id trocado recusa');
  ok(!(await verifySignature({ secret: 'outro', signatureHeader: header, requestId: 'req-1', dataId: '123456' })), 'segredo errado recusa');
  ok(!(await verifySignature({ secret, signatureHeader: `ts=${ts},v1=${sig.slice(0, -2)}00`, requestId: 'req-1', dataId: '123456' })), 'hash adulterado recusa');
  ok(!(await verifySignature({ secret, signatureHeader: null, requestId: 'req-1', dataId: '123456' })), 'sem x-signature recusa');
  ok(!(await verifySignature({ secret: '', signatureHeader: header, requestId: 'req-1', dataId: '123456' })), 'sem segredo configurado recusa');
  ok(await verifySignature({ secret, signatureHeader: `ts=${ts},v1=${sig.toUpperCase()}`, requestId: 'req-1', dataId: '123456' }), 'hex em maiúsculas é aceito');
}

eq(['approved', 'rejected', 'cancelled', 'refunded', 'charged_back'].map(mapStatus), ['approved', 'rejected', 'cancelled', 'refunded', 'charged_back'], 'status diretos');
eq(['pending', 'in_process', 'authorized', 'in_mediation', 'algo-novo', undefined].map(mapStatus), Array(6).fill('pending'), 'em andamento ou desconhecido = pending (nunca libera)');

{
  const id = '3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
  const b = preferenceBody({ paymentId: id, cents: 2990, appUrl: 'https://timoteo-app.pages.dev/', notificationUrl: 'https://x.supabase.co/functions/v1/mp-webhook' });
  eq(b.external_reference, id, 'preferência: external_reference = id do pagamento');
  eq(b.items, [{ id: 'timoteo-pro-12m', title: ITEM_TITLE, quantity: 1, unit_price: 29.9, currency_id: 'BRL' }], 'preferência: um item, valor do servidor');
  eq(b.payment_methods, { excluded_payment_types: [{ id: 'ticket' }], installments: 12 }, 'preferência: sem boleto, até 12 parcelas');
  eq(b.auto_return, 'approved', 'preferência: auto_return');
  eq(b.back_urls.success, 'https://timoteo-app.pages.dev/?checkout=success', 'preferência: back_url sem barra duplicada');
  eq(b.notification_url, 'https://x.supabase.co/functions/v1/mp-webhook', 'preferência: notification_url');
}

{
  const id = '3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
  const calls = [];
  const db = {
    getPayment: async (x) => (x === id ? { id, amount_cents: 2990 } : null),
    applyPayment: async (a) => { calls.push(a); return { result: 'granted' }; },
  };
  const mp = (o) => ({ id: 777, external_reference: id, currency_id: 'BRL', transaction_amount: 29.9, status: 'approved', ...o });
  eq((await applyMpPayment(mp(), db)).result, 'applied', 'pagamento correto é aplicado');
  eq(calls.at(-1), { paymentId: id, mpPaymentId: '777', status: 'approved', amountCents: 2990 }, 'apply recebe os dados certos');
  eq((await applyMpPayment(mp({ external_reference: 'nao-e-uuid' }), db)).reason, 'no_reference', 'referência inválida ignorada');
  eq((await applyMpPayment(mp({ external_reference: '00000000-0000-4000-8000-000000000000' }), db)).reason, 'unknown_reference', 'referência desconhecida ignorada');
  eq((await applyMpPayment(mp({ currency_id: 'USD' }), db)).reason, 'currency', 'moeda diferente recusada');
  eq((await applyMpPayment(mp({ transaction_amount: 1 }), db)).reason, 'amount', 'valor diferente recusado');
  eq((await applyMpPayment(mp({ transaction_amount: 29.9 + 1e-9 }), db)).result, 'applied', 'arredondamento de ponto flutuante não quebra');
  const n = calls.length;
  await applyMpPayment(mp({ currency_id: 'USD' }), db);
  await applyMpPayment(mp({ transaction_amount: 1 }), db);
  eq(calls.length, n, 'conferência recusada nunca chega ao banco');
  eq((await applyMpPayment(mp({ status: 'in_process' }), db)).status, 'pending', 'em análise vira pending');
  calls.length = 0;
  await applyAll([mp({ id: 1, status: 'refunded' }), mp({ id: 2, status: 'rejected' }), mp({ id: 3, status: 'approved' })], db);
  eq(calls.map((c) => c.mpPaymentId), ['3', '2', '1'], 'aprovados primeiro, reembolsados por último');
}

// ---------------------------------------------------------------------------------------------------------------------
// 2) SQL (migrations reais em PGlite)
// ---------------------------------------------------------------------------------------------------------------------
const db = new PGlite();
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to authenticated, service_role, anon;
  grant usage on schema public to authenticated, service_role, anon;
`);
for (const f of fs.readdirSync(path.join(root, 'supabase/migrations')).sort()) {
  await db.exec(fs.readFileSync(path.join(root, 'supabase/migrations', f), 'utf8'));
}
await db.exec(`grant select, insert, update on public.entitlements to service_role;`); // o Supabase concede isto por padrão ao service_role

const q = async (sql, params) => (await db.query(sql, params)).rows;
const newUser = async () => (await q(`insert into auth.users (email) values ($1) returning id`, [`u${Math.random()}@t.com`]))[0].id;
const newPay = async (user, cents = 2990, kind = 'entrada') =>
  (await q(`insert into public.payments (user_id, amount_cents, price_kind) values ($1, $2, $3) returning id`, [user, cents, kind]))[0].id;
let mpSeq = 1000;
const apply = async (id, status, cents = 2990, mpId = null) => (await q(`select public.apply_payment($1, $2, $3, $4) as r`, [id, mpId ?? `mp${mpSeq += 1}`, status, cents]))[0].r;
const ent = async (user) => (await q(`select plan, expires_at, usou_preco_de_entrada from public.entitlements where user_id = $1`, [user]))[0];
const pay = async (id) => (await q(`select status, months_granted, mp_payment_id from public.payments where id = $1`, [id]))[0];
// diferença, em segundos, entre expires_at e (agora em UTC + N meses)
const driftSec = async (user, months) => Number((await q(
  `select abs(extract(epoch from expires_at - (((now() at time zone 'UTC') + make_interval(months => $2)) at time zone 'UTC'))) as d from public.entitlements where user_id = $1`,
  [user, months]))[0].d);

// funções puras de data
{
  const ext = async (cur, now, m) => (await q(`select public.payment_extend_expiry($1::timestamptz, $2::timestamptz, $3) as r`, [cur, now, m]))[0].r.toISOString();
  eq(await ext(null, '2026-10-08T12:00:00Z', 12), '2027-10-08T12:00:00.000Z', 'nunca pagou: 12 meses da data do pagamento');
  eq(await ext('2026-12-01T00:00:00Z', '2026-10-08T12:00:00Z', 12), '2027-12-01T00:00:00.000Z', 'renovação antecipada: soma ao vencimento atual');
  eq(await ext('2026-09-01T00:00:00Z', '2026-10-08T12:00:00Z', 12), '2027-10-08T12:00:00.000Z', 'vencido: conta da data do pagamento');
  eq(await ext('2026-10-08T12:00:00Z', '2026-10-08T12:00:00Z', 12), '2027-10-08T12:00:00.000Z', 'vence exatamente agora: 12 meses a partir de agora');
  eq(await ext('2027-02-28T00:00:00Z', '2026-10-08T00:00:00Z', 12), '2028-02-28T00:00:00.000Z', 'fevereiro de ano não bissexto');
  eq(await ext('2027-01-31T00:00:00Z', '2026-10-08T00:00:00Z', 1), '2027-02-28T00:00:00.000Z', 'fim de mês não transborda');
  const rev = async (cur, m) => (await q(`select public.payment_reverse_expiry($1::timestamptz, $2) as r`, [cur, m]))[0].r.toISOString();
  eq(await rev('2028-10-08T12:00:00Z', 12), '2027-10-08T12:00:00.000Z', 'reembolso tira os 12 meses');
}

// primeiro pagamento aprovado
{
  const u = await newUser();
  const p = await newPay(u);
  eq((await ent(u)).plan, 'essencial', 'usuário novo começa no Essencial');
  eq((await apply(p, 'pending')).result, 'noop', 'Pix pendente não faz nada');
  eq((await ent(u)).plan, 'essencial', 'Pix pendente nunca libera o Pro');
  const r = await apply(p, 'approved', 2990, 'mpA');
  eq(r.result, 'granted', 'aprovado concede');
  const e = await ent(u);
  eq([e.plan, e.usou_preco_de_entrada], ['pro', true], 'plano Pro e preço de entrada marcado');
  ok((await driftSec(u, 12)) < 60, 'vence em 12 meses');
  eq(await pay(p), { status: 'approved', months_granted: 12, mp_payment_id: 'mpA' }, 'pagamento registrado');
  // idempotência: o mesmo evento de novo não concede de novo
  const before = (await ent(u)).expires_at.toISOString();
  eq((await apply(p, 'approved', 2990, 'mpA')).reason, 'already_applied', 'webhook repetido: já aplicado');
  eq((await ent(u)).expires_at.toISOString(), before, 'webhook repetido não soma meses');
  // segundo pagamento aprovado no mesmo checkout (outro mp id)
  eq((await apply(p, 'approved', 2990, 'mpB')).result, 'duplicate_payment', 'pagamento em dobro no mesmo checkout não concede de novo');
  eq((await ent(u)).expires_at.toISOString(), before, 'pagamento em dobro não soma meses');
  // reembolso do pagamento em dobro (outro mp id) não desfaz o primeiro
  eq((await apply(p, 'refunded', 2990, 'mpB')).result, 'noop', 'reembolso do pagamento duplicado não mexe no direito');
  eq((await ent(u)).plan, 'pro', 'direito segue valendo');
}

// recusado e depois aprovado no mesmo checkout; valor diferente; pagamento inexistente
{
  const u = await newUser();
  const p = await newPay(u);
  eq((await apply(p, 'rejected')).result, 'updated', 'recusado registra');
  eq((await pay(p)).status, 'rejected', 'status recusado');
  eq((await ent(u)).plan, 'essencial', 'recusado não libera');
  eq((await apply(p, 'approved', 2990, 'mpR')).result, 'granted', 'nova tentativa aprovada concede');
  eq((await apply(p, 'rejected', 2990, 'mpZ')).result, 'noop', 'recusa tardia de outra tentativa não desfaz');
  eq((await pay(p)).status, 'approved', 'continua aprovado');
  const u2 = await newUser();
  const p2 = await newPay(u2);
  await rejects(() => apply(p2, 'approved', 100), 'valor diferente é recusado pelo banco');
  eq((await ent(u2)).plan, 'essencial', 'valor diferente não libera');
  await rejects(() => apply('00000000-0000-4000-8000-000000000000', 'approved'), 'pagamento inexistente falha');
  await rejects(() => apply(p2, 'qualquer-coisa'), 'status inválido falha');
  eq((await apply(p2, 'cancelled')).result, 'updated', 'cancelado registra');
}

// renovação antecipada, vencido, reembolso e estorno
{
  const u = await newUser();
  const p1 = await newPay(u, 2990, 'entrada');
  await apply(p1, 'approved', 2990, 'mp1');
  const p2 = await newPay(u, 4990, 'cheio');
  await apply(p2, 'approved', 4990, 'mp2');
  ok((await driftSec(u, 24)) < 60, 'renovação antecipada soma ao vencimento atual (24 meses)');
  eq((await apply(p2, 'refunded', 4990, 'mp2')).result, 'reversed', 'reembolso da renovação');
  ok((await driftSec(u, 12)) < 60, 'reembolso da renovação volta aos 12 meses');
  eq([(await ent(u)).plan, (await ent(u)).usou_preco_de_entrada], ['pro', true], 'segue Pro; entrada continua gasta (sobrou o 1º pagamento)');
  eq((await apply(p2, 'refunded', 4990, 'mp2')).result, 'noop', 'reembolso repetido não subtrai duas vezes');
  eq((await apply(p2, 'approved', 4990, 'mp2')).reason, 'already_reversed', 'aprovação tardia depois do reembolso é ignorada');
  eq((await apply(p1, 'charged_back', 2990, 'mp1')).result, 'reversed', 'estorno do primeiro pagamento');
  eq([(await ent(u)).plan, (await ent(u)).expires_at, (await ent(u)).usou_preco_de_entrada], ['essencial', null, false], 'sem pagamentos aprovados: volta ao Essencial e libera o preço de entrada');
}
{
  // vencido: conta da data do pagamento
  const u = await newUser();
  await q(`update public.entitlements set plan = 'pro', expires_at = now() - interval '10 days' where user_id = $1`, [u]);
  const p = await newPay(u, 4990, 'cheio');
  await apply(p, 'approved', 4990, 'mpV');
  ok((await driftSec(u, 12)) < 60, 'vencido: 12 meses a partir do pagamento');
  // reembolso quando o prazo anterior já tinha vencido e sobra algo ainda válido
  eq((await apply(p, 'refunded', 4990, 'mpV')).result, 'reversed', 'reembolso após vencido');
  eq((await ent(u)).plan, 'essencial', 'volta ao Essencial se o prazo reverso já passou');
}
{
  // concessão manual sem prazo e Premium vigente: o pagamento não mexe no plano
  const u = await newUser();
  await q(`update public.entitlements set plan = 'pro', expires_at = null where user_id = $1`, [u]);
  const p = await newPay(u);
  eq((await apply(p, 'approved', 2990, 'mpM')).months, 0, 'Pro sem prazo: não soma meses');
  eq([(await ent(u)).plan, (await ent(u)).expires_at], ['pro', null], 'Pro sem prazo continua sem prazo');
  eq((await apply(p, 'refunded', 2990, 'mpM')).result, 'reversed', 'reembolso de pagamento sem meses concedidos');
  eq([(await ent(u)).plan, (await ent(u)).expires_at], ['pro', null], 'reembolso não derruba concessão manual');
  const u2 = await newUser();
  await q(`update public.entitlements set plan = 'premium', expires_at = now() + interval '30 days' where user_id = $1`, [u2]);
  const p2 = await newPay(u2);
  await apply(p2, 'approved', 2990, 'mpP');
  eq((await ent(u2)).plan, 'premium', 'Premium vigente não vira Pro');
}

// permissões: o cliente não grava nem executa nada
{
  const u = await newUser();
  const other = await newUser();
  const p = await newPay(u);
  await newPay(other);
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${u}', false);`);
  eq(Number((await q(`select count(*) as n from public.payments`))[0].n), 1, 'RLS: o usuário só vê os próprios pagamentos');
  await rejects(() => q(`insert into public.payments (user_id, amount_cents, price_kind) values ($1, 100, 'entrada')`, [u]), 'cliente não cria pagamento');
  await rejects(() => q(`update public.payments set status = 'approved' where id = $1`, [p]), 'cliente não aprova pagamento');
  await rejects(() => q(`update public.entitlements set plan = 'pro' where user_id = $1`, [u]), 'cliente não muda o plano');
  await rejects(() => q(`select public.apply_payment($1, 'x', 'approved', 2990)`, [p]), 'cliente não executa apply_payment');
  await db.exec(`reset role; set role anon;`);
  await rejects(() => q(`select count(*) from public.payments`), 'anon não lê pagamentos');
  await rejects(() => q(`select public.apply_payment($1, 'x', 'approved', 2990)`, [p]), 'anon não executa apply_payment');
  await db.exec(`reset role; set role service_role;`);
  eq((await q(`select public.apply_payment($1, 'mpS', 'approved', 2990) as r`, [p]))[0].r.result, 'granted', 'service_role executa apply_payment');
  await db.exec(`reset role;`);
}

console.log(failed ? `\n${failed} teste(s) falharam, ${passed} passaram.` : `OK: ${passed} testes de cobrança passaram.`);
process.exit(failed ? 1 : 0);
