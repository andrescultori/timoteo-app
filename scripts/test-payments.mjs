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
import { handleReconcile } from '../supabase/functions/_shared/reconcile.js';
import { secretMatches } from '../supabase/functions/_shared/http.js';

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
// 2) SQL (migrations reais em PGlite) e conciliação
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

// preço de entrada pago duas vezes
{
  const u = await newUser();
  const p1 = await newPay(u, 2990, 'entrada');
  const p2 = await newPay(u, 2990, 'entrada');
  eq((await apply(p1, 'approved', 2990, 'mpE1')).result, 'granted', 'entrada: o primeiro aprovado concede');
  const before = (await ent(u)).expires_at.toISOString();
  const r2 = await apply(p2, 'approved', 2990, 'mpE2');
  eq(r2.result, 'duplicate_entry', 'entrada: o segundo aprovado é duplicado');
  eq((await pay(p2)), { status: 'approved', months_granted: 0, mp_payment_id: 'mpE2' }, 'entrada duplicada fica registrada como aprovada com 0 meses');
  eq((await ent(u)).expires_at.toISOString(), before, 'entrada duplicada não muda o vencimento');
  ok((await driftSec(u, 12)) < 60, 'entrada duplicada: continua com 12 meses, não 24');
  eq((await apply(p2, 'approved', 2990, 'mpE2')).result, 'noop', 'entrada duplicada repetida pelo webhook: sem efeito');
  // reembolso do duplicado: não mexe no plano
  eq((await apply(p2, 'refunded', 2990, 'mpE2')).result, 'reversed', 'reembolso do duplicado é registrado');
  eq((await ent(u)).expires_at.toISOString(), before, 'reembolso do duplicado não tira meses');
  eq([(await ent(u)).plan, (await ent(u)).usou_preco_de_entrada], ['pro', true], 'reembolso do duplicado: segue Pro e entrada gasta');
  // reembolso do primeiro: volta ao Essencial e libera a entrada
  eq((await apply(p1, 'refunded', 2990, 'mpE1')).result, 'reversed', 'reembolso do primeiro');
  eq([(await ent(u)).plan, (await ent(u)).expires_at, (await ent(u)).usou_preco_de_entrada], ['essencial', null, false], 'depois do reembolso: Essencial e preço de entrada disponível de novo');
  // e uma nova compra a preço de entrada volta a valer
  const p3 = await newPay(u, 2990, 'entrada');
  eq((await apply(p3, 'approved', 2990, 'mpE3')).result, 'granted', 'nova entrada depois do reembolso concede');
  ok((await driftSec(u, 12)) < 60, 'nova entrada: 12 meses');
}
{
  // entrada duplicada seguida de renovação a preço cheio: o cheio soma normalmente
  const u = await newUser();
  const p1 = await newPay(u, 2990, 'entrada');
  const p2 = await newPay(u, 2990, 'entrada');
  await apply(p1, 'approved', 2990, 'mpF1');
  await apply(p2, 'approved', 2990, 'mpF2');
  const p3 = await newPay(u, 4990, 'cheio');
  eq((await apply(p3, 'approved', 4990, 'mpF3')).result, 'granted', 'preço cheio depois do duplicado concede');
  ok((await driftSec(u, 24)) < 60, 'entrada + cheio = 24 meses');
}
{
  // duas aprovações disparadas juntas. O PGlite tem uma conexão só (as chamadas entram em fila), então isto cobre o resultado;
  // a concorrência real (duas sessões, a segunda esperando o bloqueio de `entitlements`) foi conferida em Postgres 16 com psql.
  const u = await newUser();
  const p1 = await newPay(u, 2990, 'entrada');
  const p2 = await newPay(u, 2990, 'entrada');
  const results = await Promise.all([apply(p1, 'approved', 2990, 'mpC1'), apply(p2, 'approved', 2990, 'mpC2')]);
  eq(results.map((r) => r.result).sort(), ['duplicate_entry', 'granted'], 'aprovações simultâneas: uma concede, a outra é duplicada');
  ok((await driftSec(u, 12)) < 60, 'aprovações simultâneas: 12 meses, não 24');
}

// conciliação: reembolso e estorno que o webhook não avisou
{
  // pagamentos dos testes anteriores saem da janela de 45 dias, para o resumo contar só os destes testes
  await q(`update public.payments set approved_at = now() - interval '100 days', created_at = now() - interval '100 days' where true`);

  const sqlDb = {
    getPayment: async (id) => (await q(`select * from public.payments where id = $1`, [id]))[0] ?? null,
    applyPayment: async ({ paymentId, mpPaymentId, status, amountCents }) => (await q(`select public.apply_payment($1, $2, $3, $4) as r`, [paymentId, mpPaymentId, status, amountCents]))[0].r,
    paymentsToReconcile: async (limit) => q(`select * from public.payments_to_reconcile($1)`, [limit]),
    markReconciled: async (id) => q(`update public.payments set reconciled_at = now() where id = $1`, [id]),
  };
  const mpStore = {};
  const logs = [];
  const mpPay = (id, mpId, o = {}) => ({ id: mpId, external_reference: id, currency_id: 'BRL', transaction_amount: 29.9, status: 'approved', ...o });
  const run = async ({ secret = 'seg-ok', method = 'POST', limit, search } = {}) => {
    const res = await handleReconcile(
      new Request('https://x/f', { method, headers: secret == null ? {} : { 'x-reconcile-secret': secret } }),
      { secret: 'seg-ok', db: sqlDb, search: search ?? (async (id) => mpStore[id] ?? []), log: (m) => logs.push(m), ...(limit ? { limit } : {}) },
    );
    return { status: res.status, body: await res.json() };
  };
  const reconciled = async (id) => (await q(`select reconciled_at is not null as r from public.payments where id = $1`, [id]))[0].r;

  // segredo
  eq((await run({ secret: null })).status, 401, 'conciliação sem segredo: 401');
  eq((await run({ secret: 'errado' })).status, 401, 'conciliação com segredo errado: 401');
  eq((await run({ secret: 'seg-ok', method: 'GET' })).status, 405, 'conciliação só aceita POST');
  eq((await run()).body, { read: 0, changed: 0, errors: 0 }, 'sem pagamentos na janela: nada lido');
  ok(await secretMatches('abc', 'abc'), 'segredo igual confere');
  ok(!(await secretMatches('abc', 'abcd')), 'segredo de tamanho diferente não confere');
  ok(!(await secretMatches('', 'abc')) && !(await secretMatches('abc', '')) && !(await secretMatches(null, undefined)), 'segredo vazio nunca confere');

  // aprovado → reembolsado: o plano volta e o preço de entrada é liberado
  const u = await newUser();
  const p = await newPay(u);
  await apply(p, 'approved', 2990, 'mpR1');
  eq((await ent(u)).plan, 'pro', 'conciliação: começa Pro');
  mpStore[p] = [mpPay(p, 'mpR1', { status: 'refunded', status_detail: 'refunded' })];
  logs.length = 0;
  let r = await run();
  eq([r.status, r.body], [200, { read: 1, changed: 1, errors: 0 }], 'conciliação aplica o reembolso (resumo sem dados pessoais)');
  eq([(await ent(u)).plan, (await ent(u)).expires_at, (await ent(u)).usou_preco_de_entrada], ['essencial', null, false], 'reembolso conciliado: Essencial e preço de entrada liberado');
  eq((await pay(p)).status, 'refunded', 'pagamento marcado como reembolsado');
  ok(await reconciled(p), 'reconciled_at preenchido');
  ok(logs.some((m) => m.includes('reembolso aplicado') && m.includes(p)), 'reembolso aplicado vai para o log');
  ok(logs.every((m) => !m.includes('@')), 'o log não leva e-mail');
  // idempotência: rodar de novo (reembolsado sai da janela; e, se voltasse, não subtrai de novo)
  eq((await run()).body, { read: 0, changed: 0, errors: 0 }, 'segunda execução: nada mais a reconferir');
  eq((await apply(p, 'refunded', 2990, 'mpR1')).result, 'noop', 'aplicar o reembolso de novo não subtrai duas vezes');

  // estorno
  const u2 = await newUser();
  const p2 = await newPay(u2);
  await apply(p2, 'approved', 2990, 'mpR2');
  mpStore[p2] = [mpPay(p2, 'mpR2', { status: 'charged_back', status_detail: 'charged_back' })];
  logs.length = 0;
  r = await run();
  eq(r.body, { read: 1, changed: 1, errors: 0 }, 'conciliação aplica o estorno');
  eq([(await ent(u2)).plan, (await pay(p2)).status], ['essencial', 'charged_back'], 'estorno conciliado: Essencial');
  ok(logs.some((m) => m.includes('estorno aplicado')), 'estorno aplicado vai para o log');

  // aprovado que continua aprovado: nada muda, mas é marcado como reconferido
  const u3 = await newUser();
  const p3 = await newPay(u3);
  await apply(p3, 'approved', 2990, 'mpR3');
  const before = (await ent(u3)).expires_at.toISOString();
  mpStore[p3] = [mpPay(p3, 'mpR3')];
  r = await run();
  eq(r.body, { read: 1, changed: 0, errors: 0 }, 'aprovado que segue aprovado: nada muda');
  eq([(await ent(u3)).plan, (await ent(u3)).expires_at.toISOString()], ['pro', before], 'plano e vencimento intactos');
  ok(await reconciled(p3), 'aprovado reconferido fica marcado');
  eq((await run()).body.read, 1, 'aprovado segue na janela (45 dias) e é reconferido nos dias seguintes');

  // reembolso parcial: não desfaz meses, só avisa no log
  mpStore[p3] = [mpPay(p3, 'mpR3', { status_detail: 'partially_refunded', transaction_amount_refunded: 10 })];
  logs.length = 0;
  r = await run();
  eq(r.body.changed, 0, 'reembolso parcial não muda nada');
  eq([(await ent(u3)).plan, (await ent(u3)).expires_at.toISOString()], ['pro', before], 'reembolso parcial não desfaz meses');
  ok(logs.some((m) => m.includes('reembolso parcial') && m.includes(p3)), 'reembolso parcial é registrado no log');
  mpStore[p3] = [mpPay(p3, 'mpR3')];

  // webhook perdido para um pagamento pendente (Pix pago): a conciliação aplica
  const u4 = await newUser();
  const p4 = await newPay(u4);
  mpStore[p4] = [mpPay(p4, 'mpR4')];
  r = await run();
  eq((await ent(u4)).plan, 'pro', 'pendente que foi pago: a conciliação concede');
  ok(r.body.changed >= 1, 'conciliação conta a mudança');
  // valor ou moeda diferentes nunca concedem
  const u5 = await newUser();
  const p5 = await newPay(u5);
  mpStore[p5] = [mpPay(p5, 'mpR5', { transaction_amount: 1 })];
  logs.length = 0;
  await run();
  eq((await ent(u5)).plan, 'essencial', 'valor diferente na conciliação não concede');
  ok(logs.some((m) => m.includes('amount')), 'conferência recusada vai para o log');

  // duplicidade vista na conciliação vai para o log
  const u6 = await newUser();
  const pa = await newPay(u6);
  const pb = await newPay(u6);
  mpStore[pa] = [mpPay(pa, 'mpD1')];
  await run();
  mpStore[pb] = [mpPay(pb, 'mpD2')];
  logs.length = 0;
  await run();
  ok(logs.some((m) => m.includes('duplicate_entry')), 'duplicate_entry visto na conciliação vai para o log');
  eq((await pay(pb)).months_granted, 0, 'duplicado sem meses');

  // erro numa linha: as outras seguem, a execução devolve 500 e a linha com erro não é marcada
  const u7 = await newUser();
  const p7 = await newPay(u7);
  await apply(p7, 'approved', 2990, 'mpE7');
  const u8 = await newUser();
  const p8 = await newPay(u8);
  await apply(p8, 'approved', 2990, 'mpE8');
  await q(`update public.payments set reconciled_at = null where id in ($1, $2)`, [p7, p8]);
  logs.length = 0;
  r = await run({ search: async (id) => { if (id === p7) throw new Error('Mercado Pago respondeu 503'); return mpStore[id] ?? []; } });
  eq(r.status, 500, 'erro em uma linha: a execução falha (o agendamento avisa)');
  ok(r.body.errors === 1 && !(await reconciled(p7)) && (await reconciled(p8)), 'só a linha com erro fica sem marca; as outras seguem');
  ok(logs.some((m) => m.includes('falha ao reconferir')), 'falha vai para o log');
  await q(`update public.payments set approved_at = now() - interval '100 days' where id in ($1, $2)`, [p7, p8]);

  // janelas e ordem das funções de seleção
  await q(`update public.payments set approved_at = now() - interval '100 days' where status = 'approved'`);
  const us = await newUser();
  const mk = async (status, ageDays, extra = '') => (await q(
    `insert into public.payments (user_id, amount_cents, price_kind, status, created_at, approved_at, mp_payment_id) values ($1, 2990, 'cheio', $2, now() - make_interval(days => $3), ${status === 'approved' ? `now() - make_interval(days => $3)` : 'null'}, ${status === 'approved' ? `'w' || gen_random_uuid()::text` : 'null'}) returning id`, [us, status, ageDays]))[0].id;
  const wApproved44 = await mk('approved', 44);
  const wApproved46 = await mk('approved', 46);
  const wPending2 = await mk('pending', 2);
  const wPending4 = await mk('pending', 4);
  await mk('rejected', 1);
  await mk('refunded', 1);
  const sel = new Set((await q(`select id from public.payments_to_reconcile(200) where user_id = $1`, [us])).map((x) => x.id));
  ok(sel.has(wApproved44) && sel.has(wPending2), 'janela: aprovado de 44 dias e pendente de 2 dias entram');
  ok(!sel.has(wApproved46) && !sel.has(wPending4), 'janela: aprovado de 46 dias e pendente de 4 dias saem');
  eq(sel.size, 2, 'janela: recusado e reembolsado não entram');
  const mine = new Set((await q(`select id from public.user_payments_to_verify($1)`, [us])).map((x) => x.id));
  ok(mine.has(wApproved44) && mine.has(wPending2), 'verify: aprovado de 44 dias e pendente de 2 dias entram');
  ok(!mine.has(wApproved46) && !mine.has(wPending4), 'verify: aprovado de 46 dias e pendente de 4 dias saem');
  eq(mine.size, 3, 'verify: inclui também o recusado dos últimos 3 dias (3 linhas), mas não o reembolsado');
  eq((await q(`select id from public.user_payments_to_verify($1)`, [await newUser()])).length, 0, 'verify: outro usuário não vê as linhas deste');
  await q(`update public.payments set status = 'refunded' where user_id = $1`, [us]);

  // teto de 200 por execução e ordem "reconferido há mais tempo primeiro"
  const ul = await newUser();
  await q(`insert into public.payments (user_id, amount_cents, price_kind, status, approved_at, mp_payment_id)
           select $1, 2990, 'cheio', 'approved', now(), 'lim' || n from generate_series(1, 205) n`, [ul]);
  r = await run({ limit: 1000 });
  eq(r.body, { read: 200, changed: 0, errors: 0 }, 'teto: no máximo 200 por execução, mesmo pedindo mais');
  eq(Number((await q(`select count(*) as n from public.payments where user_id = $1 and reconciled_at is not null`, [ul]))[0].n), 200, 'teto: 200 foram marcadas');
  r = await run({ limit: 1000 });
  eq(r.body.read, 200, 'teto: segunda execução também lê 200');
  eq(Number((await q(`select count(*) as n from public.payments where user_id = $1 and reconciled_at is not null`, [ul]))[0].n), 205, 'as 5 que ficaram de fora vêm primeiro na execução seguinte');
  await q(`update public.payments set approved_at = now() - interval '100 days' where user_id = $1`, [ul]);
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
  await rejects(() => q(`select * from public.payments_to_reconcile(10)`), 'cliente não executa payments_to_reconcile');
  await rejects(() => q(`select * from public.user_payments_to_verify($1)`, [other]), 'cliente não executa user_payments_to_verify');
  await rejects(() => q(`update public.payments set reconciled_at = now() where id = $1`, [p]), 'cliente não grava reconciled_at');
  await db.exec(`reset role; set role anon;`);
  await rejects(() => q(`select count(*) from public.payments`), 'anon não lê pagamentos');
  await rejects(() => q(`select public.apply_payment($1, 'x', 'approved', 2990)`, [p]), 'anon não executa apply_payment');
  await db.exec(`reset role; set role service_role;`);
  eq((await q(`select public.apply_payment($1, 'mpS', 'approved', 2990) as r`, [p]))[0].r.result, 'granted', 'service_role executa apply_payment');
  await db.exec(`reset role;`);
}

console.log(failed ? `\n${failed} teste(s) falharam, ${passed} passaram.` : `OK: ${passed} testes de cobrança passaram.`);
process.exit(failed ? 1 : 0);
