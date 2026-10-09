// Testes da cobrança (Fase 4). Uso: npm test
//  1) funções puras das Edge Functions (preço, x-signature, status, preferência, conferência do pagamento);
//  2) as migrations de verdade, rodadas em Postgres (PGlite) com as tabelas mínimas do Supabase simuladas:
//     soma de meses, renovação antecipada, vencido, reembolso, estorno, idempotência e permissões.
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { PRICE_CENTS, priceKind, priceCents, ITEM_TITLE, alreadyCovered } from '../supabase/functions/_shared/pricing.js';
import { buildManifest, parseSignature, hmacHex, verifySignature, mapStatus, preferenceBody } from '../supabase/functions/_shared/mp.js';
import { applyMpPayment, applyAll } from '../supabase/functions/_shared/payments.js';
import { handleReconcile, reconcileRow } from '../supabase/functions/_shared/reconcile.js';
import { secretMatches } from '../supabase/functions/_shared/http.js';
import { cleanPrefs, resolvePrefs, DEFAULTS, SIZES, SPACINGS, WIDTHS, FONTS, READ_THEMES, SITE_THEMES } from '../src/readingPrefs.js';
import { resolveSite } from '../src/siteTheme.js';
import { rpcProblem, addMonths, shortcutExpiry, toDateInput, fromDateInput, planView, downgradesPaid, barRows, cents, SEX_ORDER, AGE_ORDER } from '../src/adminData.js';
import { readColors } from '../src/readingPrefs.js';

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

// Fase 6 (ajuste, 20261016): reembolso não apaga cortesia; pagamento que não concede nada é sinalizado
{
  const admin = await newUser();
  const edited = async (user) => (await q(`select updated_by, note from public.entitlements where user_id = $1`, [user]))[0];
  // 1) pagou, o admin mudou a data à mão depois (cortesia), o pagamento é reembolsado: nada é desfeito
  const u1 = await newUser();
  const p1 = await newPay(u1);
  await apply(p1, 'approved', 2990, 'mpFX1');
  eq(await edited(u1), { updated_by: null, note: null }, 'concessão por pagamento: sem marca de edição manual');
  await q(`update public.entitlements set expires_at = now() + interval '5 years', updated_by = $2, note = 'cortesia' where user_id = $1`, [u1, admin]);
  const exp1 = (await ent(u1)).expires_at.toISOString();
  const r1 = await apply(p1, 'refunded', 2990, 'mpFX1');
  eq(r1.result, 'reversed_manual_kept', 'reembolso de plano editado à mão: resultado próprio');
  eq([(await ent(u1)).plan, (await ent(u1)).expires_at.toISOString()], ['pro', exp1], 'cortesia (data do admin) não é encurtada nem apagada');
  eq((await pay(p1)).status, 'refunded', 'o pagamento fica reembolsado');
  eq((await edited(u1)).note, 'cortesia', 'o motivo da cortesia continua');
  // cortesia que cairia no passado também não rebaixa
  const u1b = await newUser();
  const p1b = await newPay(u1b);
  await apply(p1b, 'approved', 2990, 'mpFX1b');
  await q(`update public.entitlements set expires_at = now() + interval '3 months', updated_by = $2 where user_id = $1`, [u1b, admin]);
  eq((await apply(p1b, 'refunded', 2990, 'mpFX1b')).result, 'reversed_manual_kept', 'idem, data curta');
  eq((await ent(u1b)).plan, 'pro', 'a cortesia curta não vai para Essencial por causa do reembolso');
  // 2) sem edição manual, o reembolso continua desfazendo os meses
  const u2 = await newUser();
  const p2 = await newPay(u2);
  await apply(p2, 'approved', 2990, 'mpFX2');
  eq((await apply(p2, 'refunded', 2990, 'mpFX2')).result, 'reversed', 'sem edição manual: reembolso normal');
  eq((await ent(u2)).plan, 'essencial', 'sem edição manual: volta ao Essencial');
  // 3) cortesia com data futura + pagamento: soma 12 meses à data da cortesia e passa a "vir do pagamento"; o reembolso volta à data da cortesia
  const u3 = await newUser();
  await q(`update public.entitlements set plan = 'pro', expires_at = now() + interval '2 months', updated_by = $2, note = 'amigo' where user_id = $1`, [u3, admin]);
  const exp3 = (await ent(u3)).expires_at;
  const p3 = await newPay(u3);
  eq((await apply(p3, 'approved', 2990, 'mpFX3')).result, 'granted', 'cortesia com prazo + pagamento: concede 12 meses');
  ok(Math.abs(Number((await q(`select extract(epoch from expires_at - $2::timestamptz) as d from public.entitlements where user_id = $1`, [u3, exp3]))[0].d) - 365 * 86400) < 2 * 86400, 'soma 12 meses à data da cortesia');
  eq(await edited(u3), { updated_by: null, note: null }, 'depois do pagamento, a marca de edição manual sai');
  eq((await apply(p3, 'refunded', 2990, 'mpFX3')).result, 'reversed', 'reembolso desfaz só os 12 meses do pagamento');
  eq((await ent(u3)).expires_at.toISOString(), exp3.toISOString(), 'volta à data da cortesia');
  eq((await ent(u3)).plan, 'pro', 'a cortesia continua Pro');
  // 4) cortesia sem prazo (ou Premium) + pagamento: 0 meses, plano intacto, resultado sinalizado e marca de edição mantida
  const u4 = await newUser();
  await q(`update public.entitlements set plan = 'pro', expires_at = null, updated_by = $2, note = 'amigo' where user_id = $1`, [u4, admin]);
  const p4 = await newPay(u4);
  const r4 = await apply(p4, 'approved', 2990, 'mpFX4');
  eq([r4.result, r4.months], ['already_active', 0], 'cortesia sem prazo + pagamento: já ativo, 0 meses');
  eq([(await ent(u4)).plan, (await ent(u4)).expires_at], ['pro', null], 'plano e prazo intactos');
  eq((await edited(u4)).note, 'amigo', 'a cortesia continua marcada');
  eq((await pay(p4)).status, 'approved', 'o pagamento fica registrado como aprovado (reembolsar à mão)');
  eq((await apply(p4, 'refunded', 2990, 'mpFX4')).result, 'reversed', 'reembolso desse pagamento (0 meses) não mexe no plano');
  eq([(await ent(u4)).plan, (await ent(u4)).expires_at], ['pro', null], 'a cortesia sobrevive ao reembolso');
  // conciliação e webhook: os dois casos novos vão para o log
  const logs5 = [];
  const rid = '3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
  const stubDb = { markReconciled: async () => {}, getPayment: async () => ({ id: rid, amount_cents: 2990 }), applyPayment: async () => ({ result: 'already_active' }) };
  const mpRow = { id: 4242, status: 'approved', external_reference: rid, transaction_amount: 29.9, currency_id: 'BRL' };
  await reconcileRow({ id: rid }, { search: async () => [mpRow], db: stubDb, log: (m) => logs5.push(m) });
  ok(logs5.some((m) => m.includes('reembolsar à mão') && m.includes(rid)), 'conciliação registra pagamento que não concedeu nada');
  stubDb.applyPayment = async () => ({ result: 'reversed_manual_kept' });
  logs5.length = 0;
  await reconcileRow({ id: rid }, { search: async () => [{ ...mpRow, status: 'refunded' }], db: stubDb, log: (m) => logs5.push(m) });
  ok(logs5.some((m) => m.includes('decidir à mão') && m.includes(rid)), 'conciliação registra reembolso de cortesia');
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

// Fase 7 (LGPD): accept_legal, exclusão de conta e pagamentos órfãos
{
  const as = async (uid, fn) => { // executa como `authenticated` com auth.uid() = uid (ou anônimo, uid = null)
    await db.exec(`set role ${uid === 'anon' ? 'anon' : 'authenticated'}; select set_config('request.jwt.claim.sub', '${uid && uid !== 'anon' ? uid : ''}', false);`);
    try { return await fn(); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); }
  };
  const profile = async (id) => (await q(`select terms_version, terms_accepted_at, sensitive_consent_at, sensitive_consent_version, marketing_consent, marketing_consent_at from public.profiles where id = $1`, [id]))[0];

  // accept_legal
  const u = await newUser();
  eq((await profile(u)).terms_accepted_at, null, 'novo usuário: sem aceite');
  await as(u, () => q(`select public.accept_legal('2026-10-10', true)`));
  let pf = await profile(u);
  eq([pf.terms_version, pf.sensitive_consent_version, pf.marketing_consent], ['2026-10-10', '2026-10-10', true], 'accept_legal grava versões e novidades');
  ok(pf.terms_accepted_at && Math.abs(Date.now() - pf.terms_accepted_at.getTime()) < 60000, 'data do aceite é do servidor');
  ok(pf.sensitive_consent_at && pf.marketing_consent_at, 'consentimento sensível e de novidades carimbados');
  await as(u, () => q(`select public.accept_legal('2026-10-11')`));
  pf = await profile(u);
  eq([pf.terms_version, pf.marketing_consent], ['2026-10-11', true], 'p_marketing nulo mantém a escolha de novidades');
  await as(u, () => q(`select public.accept_legal('2026-10-11', false)`));
  eq((await profile(u)).marketing_consent, false, 'p_marketing falso desliga as novidades');
  await as(null, async () => rejects(() => q(`select public.accept_legal('x')`), 'sem login não grava aceite'));
  await as(u, async () => {
    await rejects(() => q(`select public.accept_legal('')`), 'versão vazia é recusada');
    await rejects(() => q(`select public.accept_legal(null)`), 'versão nula é recusada');
    await rejects(() => q(`update public.profiles set terms_accepted_at = now() where id = $1`, [u]), 'cliente não grava terms_accepted_at direto');
    await rejects(() => q(`update public.profiles set sensitive_consent_at = now() where id = $1`, [u]), 'cliente não grava sensitive_consent_at direto');
    await rejects(() => q(`update public.profiles set terms_version = 'x' where id = $1`, [u]), 'cliente não grava terms_version direto');
    await q(`update public.profiles set name = 'Teste' where id = $1`, [u]); ok(true, 'cliente ainda edita o nome');
  });
  await as('anon', async () => rejects(() => q(`select public.accept_legal('x')`), 'anon não executa accept_legal'));
  const other = await newUser();
  await as(other, () => q(`select public.accept_legal('v-outro', false)`));
  eq((await profile(u)).terms_version, '2026-10-11', 'aceite de um usuário não mexe no de outro');

  // exclusão de conta
  const d = await newUser();
  const dOther = await newUser();
  await q(`insert into public.favorites (user_id, key) values ($1, 'book:gen'), ($1, 'person:davi'), ($2, 'book:exo')`, [d, dOther]);
  await q(`insert into public.reading_position (user_id, version, slug, chapter) values ($1, 'kjv', 'gen', 1)`, [d]);
  await q(`insert into public.waitlist (user_id, feature) values ($1, 'pro')`, [d]);
  const pApproved = await newPay(d); await apply(pApproved, 'approved', 2990, 'mpDEL1');
  const pRefunded = await newPay(d); await apply(pRefunded, 'approved', 2990, 'mpDEL2'); await apply(pRefunded, 'refunded', 2990, 'mpDEL2');
  const pPending = await newPay(d);
  const pRejected = await newPay(d); await apply(pRejected, 'rejected');
  const pCancelled = await newPay(d); await apply(pCancelled, 'cancelled');
  const dResult = (await q(`select public.delete_account_data($1) as r`, [d]))[0].r;
  eq(dResult, { deleted_payments: 2, anonymized_payments: 3 }, 'exclusão: 2 apagados (recusado e cancelado) e 3 anonimizados');
  for (const t of ['favorites', 'reading_position', 'waitlist', 'entitlements']) eq(Number((await q(`select count(*) as n from public.${t} where user_id = $1`, [d]))[0].n), 0, `exclusão apaga ${t}`);
  eq(Number((await q(`select count(*) as n from public.profiles where id = $1`, [d]))[0].n), 0, 'exclusão apaga o perfil');
  const pays = await q(`select id, status, user_id from public.payments where id in ($1, $2, $3, $4, $5)`, [pApproved, pRefunded, pPending, pRejected, pCancelled]);
  eq(pays.map((x) => x.status).sort(), ['approved', 'pending', 'refunded'], 'sobram aprovado, reembolsado e pendente');
  ok(pays.every((x) => x.user_id === null), 'os pagamentos que ficam estão anonimizados (user_id nulo)');
  eq(Number((await q(`select count(*) as n from public.favorites where user_id = $1`, [dOther]))[0].n), 1, 'exclusão não mexe nos dados de outro usuário');
  eq((await q(`select public.delete_account_data($1) as r`, [d]))[0].r, { deleted_payments: 0, anonymized_payments: 0 }, 'exclusão é idempotente');
  // o Auth apaga depois (aqui simulado): nada quebra e os pagamentos continuam
  await q(`delete from auth.users where id = $1`, [d]);
  eq(Number((await q(`select count(*) as n from public.payments where id = $1`, [pApproved]))[0].n), 1, 'apagar o usuário no Auth não apaga o pagamento');

  // FK on delete set null: apagar o usuário direto também só anonimiza
  const f = await newUser();
  const pf1 = await newPay(f); await apply(pf1, 'approved', 2990, 'mpFK1');
  await q(`delete from auth.users where id = $1`, [f]);
  eq((await q(`select user_id from public.payments where id = $1`, [pf1]))[0].user_id, null, 'FK: apagar o usuário deixa o pagamento com user_id nulo');
  eq((await pay(pf1)).status, 'approved', 'FK: o pagamento segue aprovado');

  // administradores
  const solo = await newUser();
  await q(`insert into public.app_admins (user_id) select $1 where not exists (select 1 from public.app_admins)`, [solo]);
  const soloIsOnly = Number((await q(`select count(*) as n from public.app_admins`))[0].n) === 1;
  if (soloIsOnly) {
    await rejects(() => q(`select public.delete_account_data($1)`, [solo]), 'o único administrador não pode ser excluído');
    eq(Number((await q(`select count(*) as n from public.app_admins where user_id = $1`, [solo]))[0].n), 1, 'o único admin continua admin');
  }
  const second = await newUser();
  await q(`insert into public.app_admins (user_id) values ($1)`, [second]);
  await q(`select public.delete_account_data($1)`, [second]); ok(true, 'com outro admin, um deles pode ser excluído');
  eq(Number((await q(`select count(*) as n from public.app_admins where user_id = $1`, [second]))[0].n), 0, 'o admin excluído sai da lista');
  const plain = await newUser();
  await q(`select public.delete_account_data($1)`, [plain]); ok(true, 'usuário comum é excluído mesmo havendo admin único');

  // pagamento órfão: nunca mexe em plano de ninguém
  const pro = await newUser();
  const pPro = await newPay(pro); await apply(pPro, 'approved', 2990, 'mpORF0');
  const proBefore = await ent(pro);
  const orphanPending = pPending; // ficou pendente e anônimo
  const orphanRes = await apply(orphanPending, 'approved', 2990, 'mpORF1');
  eq([orphanRes.result, (await pay(orphanPending)).status, (await pay(orphanPending)).months_granted], ['orphan', 'approved', 0], 'Pix pago depois da exclusão: aprovado, 0 meses, resultado orphan');
  eq((await apply(orphanPending, 'approved', 2990, 'mpORF1')).result, 'noop', 'órfão aprovado de novo: sem efeito');
  eq((await apply(orphanPending, 'refunded', 2990, 'mpORF1')).result, 'orphan', 'reembolso do órfão é registrado');
  eq((await pay(orphanPending)).status, 'refunded', 'órfão reembolsado');
  eq((await apply(orphanPending, 'refunded', 2990, 'mpORF1')).result, 'noop', 'reembolso do órfão repetido: sem efeito');
  const proAfter = await ent(pro);
  eq([proAfter.plan, proAfter.expires_at.toISOString(), proAfter.usou_preco_de_entrada], [proBefore.plan, proBefore.expires_at.toISOString(), proBefore.usou_preco_de_entrada], 'pagamento órfão não mexe no plano de ninguém');
  eq(Number((await q(`select count(*) as n from public.entitlements where user_id is null`))[0].n), 0, 'nenhuma linha de entitlements sem dono');
  // órfão recusado
  const orphanP2 = await newPay(await newUser()); await q(`update public.payments set user_id = null where id = $1`, [orphanP2]);
  eq((await apply(orphanP2, 'rejected')).result, 'orphan', 'órfão pendente recusado é registrado');

  // conciliação enxerga o órfão (reembolso pode chegar depois da exclusão)
  const orphanR = await newPay(await newUser(), 2990, 'cheio'); await apply(orphanR, 'approved', 2990, 'mpORF9').catch(() => {});
  await q(`update public.payments set user_id = null where id = $1`, [orphanR]);
  await q(`update public.payments set reconciled_at = null where id = $1`, [orphanR]);
  const sqlDb2 = {
    getPayment: async (id) => (await q(`select * from public.payments where id = $1`, [id]))[0] ?? null,
    applyPayment: async ({ paymentId, mpPaymentId, status, amountCents }) => (await q(`select public.apply_payment($1, $2, $3, $4) as r`, [paymentId, mpPaymentId, status, amountCents]))[0].r,
    paymentsToReconcile: async (limit) => q(`select * from public.payments_to_reconcile($1)`, [limit]),
    markReconciled: async (id) => q(`update public.payments set reconciled_at = now() where id = $1`, [id]),
  };
  const orphanRow = (await q(`select amount_cents from public.payments where id = $1`, [orphanR]))[0];
  ok((await q(`select id from public.payments_to_reconcile(200)`)).some((x) => x.id === orphanR), 'a conciliação seleciona pagamentos órfãos');
  const recLogs = [];
  const recRes = await handleReconcile(new Request('https://x/f', { method: 'POST', headers: { 'x-reconcile-secret': 'seg-ok' } }), {
    secret: 'seg-ok', db: sqlDb2, log: (m) => recLogs.push(m),
    search: async (id) => (id === orphanR ? [{ id: 'mpORF9', external_reference: orphanR, currency_id: 'BRL', transaction_amount: orphanRow.amount_cents / 100, status: 'refunded' }] : []),
  });
  eq(recRes.status, 200, 'conciliação com órfão responde 200');
  eq((await pay(orphanR)).status, 'refunded', 'conciliação aplica o reembolso do órfão');
  ok(recLogs.some((m) => m.includes('órfão') && m.includes(orphanR)), 'órfão vai para o log (só o id do pagamento)');
  ok(recLogs.every((m) => !m.includes('@')), 'log sem e-mail');

  // RLS: órfão invisível para os usuários
  await as(u, async () => eq(Number((await q(`select count(*) as n from public.payments where user_id is null`))[0].n), 0, 'RLS: pagamento órfão não aparece para o cliente'));
  eq((await q(`select * from public.user_payments_to_verify($1)`, [u])).filter((x) => x.user_id === null).length, 0, 'verify não devolve órfão');
  // permissões das funções novas
  await as(u, async () => rejects(() => q(`select public.delete_account_data($1)`, [u]), 'cliente não executa delete_account_data'));
  await as('anon', async () => rejects(() => q(`select public.delete_account_data($1)`, [u]), 'anon não executa delete_account_data'));
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


// Ajustes de leitura (visual B): validação no cliente e a tabela reading_prefs no banco
{
  eq(cleanPrefs({ size: 23, theme: 'sepia' }), { size: 23, theme: 'sepia' }, 'ajustes: valores permitidos passam');
  eq(cleanPrefs({ size: 21, spacing: 1.7, width: 660, font: 'serif', verseLines: false, theme: 'follow', siteTheme: 'light' }), {}, 'ajustes: o padrão não é guardado');
  eq(cleanPrefs({ size: 99, theme: 'neon', font: 'comic', extra: 1, verseLines: 'sim' }), {}, 'ajustes: valor ou chave inválida é descartada');
  eq(cleanPrefs({ originals: true }), { originals: true }, 'ajustes: originals ligado é guardado');
  eq(cleanPrefs({ originals: false }), {}, 'ajustes: originals desligado é o padrão');
  eq(cleanPrefs({ cantillation: true, originals: true }), { originals: true, cantillation: true }, 'ajustes: cantillation ligado é guardado');
  eq(cleanPrefs({ cantillation: 'sim' }), {}, 'ajustes: cantillation só aceita booleano');
  eq(cleanPrefs({ originals: 'sim' }), {}, 'ajustes: originals só aceita booleano');
  eq(cleanPrefs({ siteTheme: 'dark', theme: 'sepia' }), { theme: 'sepia', siteTheme: 'dark' }, 'ajustes: tema do site e da leitura são independentes');
  eq(cleanPrefs({ siteTheme: 'noite', theme: 'roxo' }), {}, 'ajustes: tema inválido usa o padrão');
  eq(cleanPrefs({ theme: 'light' }), { theme: 'light' }, 'ajustes: leitura em Claro é escolha explícita (o padrão é seguir o site)');
  eq(resolvePrefs({}).siteTheme, 'light', 'o padrão do site é Claro');
  eq(['light', 'dark', 'auto'].map((p) => resolveSite(p, true)), ['light', 'dark', 'dark'], 'tema do site: automático segue o sistema escuro');
  eq(['light', 'dark', 'auto'].map((p) => resolveSite(p, false)), ['light', 'dark', 'light'], 'tema do site: automático segue o sistema claro');
  eq(resolveSite('lixo', true), 'light', 'tema do site inválido cai em Claro');
  eq([readColors('follow', 'light').bg, readColors('follow', 'dark').bg, readColors('sepia', 'dark').bg, readColors('dark', 'light').bg], ['#f8f7f2', '#181a19', '#f1e7d0', '#181a19'], 'leitura: seguir o site, ou escolha explícita que vale em qualquer site');
  eq(cleanPrefs('x'), {}, 'ajustes: texto solto vira vazio');
  eq(cleanPrefs([1]), {}, 'ajustes: lista vira vazio');
  eq(resolvePrefs({ width: 820 }), { ...DEFAULTS, width: 820 }, 'ajustes: resolve sobre o padrão');

  const as = async (uid, fn) => {
    await db.exec(`set role ${uid === 'anon' ? 'anon' : 'authenticated'}; select set_config('request.jwt.claim.sub', '${uid && uid !== 'anon' ? uid : ''}', false);`);
    try { return await fn(); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); }
  };
  const valid = async (j) => (await q(`select public.reading_prefs_valid($1::jsonb) as v`, [JSON.stringify(j)]))[0].v;
  // o SQL aceita exatamente os valores que o cliente aceita
  for (const v of SIZES) ok(await valid({ size: v }), `SQL aceita size ${v}`);
  for (const v of SPACINGS) ok(await valid({ spacing: v }), `SQL aceita spacing ${v}`);
  for (const v of WIDTHS) ok(await valid({ width: v }), `SQL aceita width ${v}`);
  for (const v of FONTS) ok(await valid({ font: v }), `SQL aceita font ${v}`);
  for (const v of READ_THEMES) ok(await valid({ theme: v }), `SQL aceita theme ${v}`);
  for (const v of SITE_THEMES) ok(await valid({ siteTheme: v }), `SQL aceita siteTheme ${v}`);
  ok(await valid({ verseLines: true }) && await valid({ verseLines: false }) && await valid({}), 'SQL aceita verseLines e objeto vazio');
  ok(await valid({ originals: true }) && await valid({ originals: false }), 'SQL aceita originals (booleano)');
  ok(await valid({ cantillation: true }) && await valid({ cantillation: false }), 'SQL aceita cantillation (booleano)');
  for (const bad of [{ size: 20 }, { size: '21' }, { spacing: 1.5 }, { width: 700 }, { font: 'mono' }, { theme: 'x' }, { verseLines: 1 }, { originals: 'sim' }, { originals: 1 }, { cantillation: 'sim' }, { cantillation: 0 }, { siteTheme: 'follow' }, { siteTheme: 1 }, { theme: 'auto' }, { other: 1 }, [], 'x', 5]) {
    ok(!(await valid(bad)), `SQL recusa ${JSON.stringify(bad)}`);
  }
  ok(!(await valid({ size: 21, junk: 'x'.repeat(400) })), 'SQL recusa JSON grande');

  const a = await newUser();
  const b = await newUser();
  await as(a, () => q(`insert into public.reading_prefs (user_id, prefs) values ($1, '{"size":23,"theme":"sepia"}')`, [a]));
  await as(a, () => q(`update public.reading_prefs set prefs = '{"width":820}', updated_at = now() where user_id = $1`, [a]));
  eq((await as(a, () => q(`select prefs from public.reading_prefs`))).length, 1, 'dono lê a própria linha');
  eq((await as(b, () => q(`select prefs from public.reading_prefs`))).length, 0, 'outro usuário não vê a linha');
  await rejects(() => as(b, () => q(`insert into public.reading_prefs (user_id, prefs) values ($1, '{}')`, [a])), 'ninguém grava na linha de outro');
  await rejects(() => as(a, () => q(`update public.reading_prefs set prefs = '{"size":20}' where user_id = $1`, [a])), 'o banco recusa ajuste inválido');
  await rejects(() => as('anon', () => q(`select * from public.reading_prefs`)), 'anon não lê reading_prefs');
  await q(`select public.delete_account_data($1)`, [a]);
  eq(Number((await q(`select count(*) as n from public.reading_prefs where user_id = $1`, [a]))[0].n), 0, 'exclusão de conta apaga os ajustes de leitura');
}


// Sincronização dos ajustes de leitura (src/userdata.js, com um cliente Supabase de mentira)
{
  const U = await import('../src/userdata.js');
  const sent = [];
  let remotePrefs = null; // { prefs, updated_at } ou 'missing' (tabela não existe)
  const client = {
    from: (table) => ({
      select: () => {
        const res = table === 'reading_prefs'
          ? (remotePrefs === 'missing' ? { data: null, error: { message: 'relation does not exist' } } : { data: remotePrefs, error: null })
          : { data: table === 'favorites' ? [] : null, error: null };
        return Object.assign(Promise.resolve(res), { maybeSingle: () => Promise.resolve(res) });
      },
      upsert: (row) => { sent.push([table, row]); return Promise.resolve({ error: null }); },
    }),
  };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  U.setPrefs({ size: 26 });
  eq(U.getPrefs(), { size: 26 }, 'sem conta: ajuste fica no aparelho');
  U.setPrefs({ size: 21, theme: 'sepia' });
  eq(U.getPrefs(), { theme: 'sepia' }, 'voltar ao padrão tira a chave');
  U.resetPrefs();
  eq(U.getPrefs(), {}, 'restaurar padrão limpa tudo');
  eq(sent.length, 0, 'sem conta nada é enviado');

  // login: a conta é mais nova que o aparelho => vale a da conta
  U.setPrefs({ width: 540 });
  remotePrefs = { prefs: { theme: 'dark', size: 23 }, updated_at: new Date(Date.now() + 60000).toISOString() };
  await U.connectAccount(client, 'u-1');
  eq(U.getPrefs(), { size: 23, theme: 'dark' }, 'login: ajustes mais recentes da conta vencem');
  eq(sent.filter(([t]) => t === 'reading_prefs').length, 0, 'login: nada sobe quando a conta é mais nova');

  // com conta: alteração sobe (com atraso curto, várias viram uma)
  U.setPrefs({ spacing: 2 }); U.setPrefs({ spacing: 1.45 });
  await wait(1700);
  const up = sent.filter(([t]) => t === 'reading_prefs');
  eq(up.length, 1, 'com conta: cliques seguidos viram uma gravação');
  eq(up[0][1].prefs, { size: 23, spacing: 1.45, theme: 'dark' }, 'com conta: sobe o estado final');
  await U.disconnectAccount();
  eq(U.getPrefs(), {}, 'logout: cache de ajustes é limpo');

  // aparelho mais novo que a conta => sobe
  sent.length = 0;
  remotePrefs = { prefs: { size: 17 }, updated_at: new Date(Date.now() - 600000).toISOString() };
  U.setPrefs({ font: 'sans' });
  await U.connectAccount(client, 'u-2');
  await wait(50);
  eq(sent.filter(([t]) => t === 'reading_prefs').map(([, r]) => r.prefs), [{ font: 'sans' }], 'login: ajustes do aparelho mais novos sobem para a conta');
  await U.disconnectAccount();

  // tabela ainda não criada: não quebra nada e não envia
  sent.length = 0;
  remotePrefs = 'missing';
  await U.connectAccount(client, 'u-3');
  U.setPrefs({ size: 30 });
  await wait(1700);
  eq(U.getPrefs(), { size: 30 }, 'sem a tabela: o ajuste vale no aparelho');
  eq(sent.filter(([t]) => t === 'reading_prefs').length, 0, 'sem a tabela: nada é enviado');
  await U.disconnectAccount();
}

// Página de administração: funções puras (src/adminData.js)
{
  eq(rpcProblem(null), null, 'sem erro');
  eq(rpcProblem({ code: '42501', message: 'acesso negado' }), 'denied', 'acesso negado (42501)');
  eq(rpcProblem({ message: 'Acesso negado' }), 'denied', 'acesso negado pelo texto');
  eq(rpcProblem({ code: 'PGRST202', message: 'Could not find the function public.admin_kpis(p_min) in the schema cache' }), 'missing', 'função inexistente: migration não aplicada');
  eq(rpcProblem({ code: '42883', message: 'function does not exist' }), 'missing', 'função inexistente no Postgres');
  eq(rpcProblem({ code: '08006', message: 'falha de rede' }), 'other', 'outro erro');
  const iso = (d) => d.toISOString();
  eq(iso(addMonths('2026-10-08T12:00:00Z', 12)), '2027-10-08T12:00:00.000Z', '+12 meses');
  eq(iso(addMonths('2027-01-31T00:00:00Z', 1)), '2027-02-28T00:00:00.000Z', 'fim de mês não transborda');
  eq(iso(addMonths('2028-01-31T00:00:00Z', 1)), '2028-02-29T00:00:00.000Z', 'fevereiro bissexto');
  const now = new Date('2026-10-10T12:00:00Z');
  eq(iso(shortcutExpiry('2027-01-10T12:00:00Z', 3, now)), '2027-04-10T12:00:00.000Z', 'atalho soma ao vencimento que ainda vale');
  eq(iso(shortcutExpiry('2026-01-10T12:00:00Z', 3, now)), '2027-01-10T12:00:00.000Z', 'vencido: soma a partir de agora');
  eq(iso(shortcutExpiry(null, 1, now)), '2026-11-10T12:00:00.000Z', 'sem vencimento: soma a partir de agora');
  eq(toDateInput(new Date(2026, 9, 5, 15)), '2026-10-05', 'data para o campo date (local)');
  const f = fromDateInput('2026-10-05');
  eq([f.getFullYear(), f.getMonth(), f.getDate(), f.getHours(), f.getMinutes()], [2026, 9, 5, 23, 59], 'o vencimento vale até o fim do dia');
  eq([fromDateInput(''), fromDateInput('xx'), fromDateInput(null)], [null, null, null], 'data inválida vira nulo');
  eq(planView({ plan: 'pro', effective_plan: 'pro', expires_at: null, has_paid: false }), { plan: 'pro', expired: false, until: null, origin: 'courtesy' }, 'Pro sem pagamento = cortesia');
  eq(planView({ plan: 'pro', effective_plan: 'pro', expires_at: '2027-01-01', has_paid: true }).origin, 'paid', 'Pro com pagamento = pago');
  eq(planView({ plan: 'pro', effective_plan: 'essencial', expires_at: '2025-01-01', has_paid: true }), { plan: 'essencial', expired: true, until: '2025-01-01', origin: null }, 'Pro vencido: vencido e sem origem');
  eq(planView({ plan: 'essencial', effective_plan: 'essencial', expires_at: null, has_paid: false }).expired, false, 'Essencial não é "vencido"');
  const paid = { has_paid: true, effective_plan: 'pro', expires_at: '2027-06-01T00:00:00Z' };
  eq(downgradesPaid(paid, 'essencial', null), true, 'pago → Essencial rebaixa');
  eq(downgradesPaid(paid, 'pro', '2027-01-01T00:00:00Z'), true, 'pago: prazo menor rebaixa');
  eq(downgradesPaid(paid, 'pro', null), false, 'pago: sem vencimento não rebaixa');
  eq(downgradesPaid(paid, 'premium', null), false, 'pago → Premium não rebaixa');
  eq(downgradesPaid({ ...paid, has_paid: false }, 'essencial', null), false, 'sem pagamento: nunca avisa');
  eq(downgradesPaid({ has_paid: true, effective_plan: 'essencial', expires_at: null }, 'essencial', null), false, 'pago já no Essencial: nada a rebaixar');
  const rows = barRows({ female: 6, male: 3, other: 0, unspecified: 1 }, SEX_ORDER);
  eq(rows.map((r) => [r.key, r.n, r.width, r.pct]), [['female', 6, 100, 60], ['male', 3, 50, 30], ['unspecified', 1, 17, 10]], 'barras: ordem fixa, sem grupos vazios, largura relativa ao maior');
  eq(AGE_ORDER, ['18-24', '25-34', '35-44', '45-54', '55-64', '65+', 'unspecified'], 'faixas etárias em ordem fixa');
  eq(barRows(undefined, AGE_ORDER), [], 'sem dados: sem barras');
  eq([cents(4189000), cents(null)], [41890, 0], 'centavos em reais');
}

// Fase 6: painel de administração (20261015)
{
  const as = async (uid, fn) => {
    await db.exec(`set role ${uid === 'anon' ? 'anon' : 'authenticated'}; select set_config('request.jwt.claim.sub', '${uid && uid !== 'anon' ? uid : ''}', false);`);
    try { return await fn(); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); }
  };
  const denied = async (fn, msg) => { try { await fn(); ok(false, `${msg} (não lançou erro)`); } catch (e) { ok(/acesso negado/.test(e.message), `${msg} (erro: ${e.message})`); } };
  const failsWith = async (fn, re, msg) => { try { await fn(); ok(false, `${msg} (não lançou erro)`); } catch (e) { ok(re.test(e.message), `${msg} (erro: ${e.message})`); } };
  const adminId = await newUser();
  await q(`insert into public.app_admins (user_id) values ($1)`, [adminId]);
  const common = await newUser();
  const target = await newUser();
  const kpis = () => as(adminId, async () => (await q(`select public.admin_kpis(5) as k`))[0].k);
  const srt = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1))); // jsonb não guarda a ordem das chaves
  const audit = async (u) => (await q(`select action, details from public.admin_audit where target_user = $1 order by id`, [u]));

  // 1) quem não é admin é recusado em todas as funções; anônimo nem executa
  await as(common, async () => {
    await denied(() => q(`select public.admin_kpis(5)`), 'não-admin: admin_kpis');
    await denied(() => q(`select * from public.admin_search_users('', 20, 0)`), 'não-admin: admin_search_users');
    await denied(() => q(`select public.admin_set_plan($1, 'pro', null, null)`, [target]), 'não-admin: admin_set_plan');
    await denied(() => q(`select public.admin_set_role($1, 'editor', true)`, [target]), 'não-admin: admin_set_role');
    await denied(() => q(`select * from public.admin_recent_changes(30)`), 'não-admin: admin_recent_changes');
    eq((await q(`select * from public.user_roles`)).length, 0, 'não-admin: user_roles só mostra os próprios papéis (nenhum)');
    await rejects(() => q(`select * from public.admin_audit`), 'cliente não lê admin_audit');
    await rejects(() => q(`insert into public.user_roles (user_id, role) values ($1, 'editor')`, [common]), 'cliente não grava user_roles');
    await rejects(() => q(`update public.entitlements set plan = 'pro' where user_id = $1`, [common]), 'cliente não grava entitlements');
  });
  await as('anon', async () => {
    await rejects(() => q(`select public.admin_kpis(5)`), 'anon não executa admin_kpis');
    await rejects(() => q(`select public.admin_set_plan($1, 'pro', null, null)`, [target]), 'anon não executa admin_set_plan');
  });
  eq((await q(`select count(*)::int as n from public.admin_audit`))[0].n, 0, 'nenhuma tentativa recusada deixou registro');

  // 2) admin_set_plan
  const before = await kpis();
  await as(adminId, () => q(`select public.admin_set_plan($1, 'pro', null, 'cortesia, amigo')`, [target]));
  let e1 = (await q(`select plan, expires_at, note, updated_by from public.entitlements where user_id = $1`, [target]))[0];
  eq([e1.plan, e1.expires_at, e1.note, e1.updated_by], ['pro', null, 'cortesia, amigo', adminId], 'Pro sem vencimento: plano, motivo e quem mudou');
  const k1 = await kpis();
  eq([k1.plan.pro - before.plan.pro, k1.plan.pro_cortesia - before.plan.pro_cortesia, k1.plan.pro_pago - before.plan.pro_pago], [1, 1, 0], 'sem pagamento aprovado: conta como cortesia');
  await as(adminId, () => q(`select public.admin_set_plan($1, 'pro', now() + interval '30 days', null)`, [target]));
  e1 = (await q(`select expires_at, note from public.entitlements where user_id = $1`, [target]))[0];
  ok(e1.expires_at && e1.note === null, 'Pro com data futura: grava a data e o motivo some se vier vazio');
  await as(adminId, () => q(`select public.admin_set_plan($1, 'essencial', now() + interval '30 days', 'x')`, [target]));
  e1 = (await q(`select plan, expires_at from public.entitlements where user_id = $1`, [target]))[0];
  eq([e1.plan, e1.expires_at], ['essencial', null], 'Essencial zera o vencimento');
  await as(adminId, async () => {
    await failsWith(() => q(`select public.admin_set_plan($1, 'pro', now() - interval '1 day', null)`, [target]), /data futura/, 'vencimento passado é recusado');
    await failsWith(() => q(`select public.admin_set_plan($1, 'ouro', null, null)`, [target]), /plano inválido/, 'plano inválido é recusado');
    await failsWith(() => q(`select public.admin_set_plan('00000000-0000-4000-8000-000000000000', 'pro', null, null)`), /não encontrado/, 'usuário inexistente é recusado');
    await failsWith(() => q(`select public.admin_set_plan($1, 'pro', null, $2)`, [target, 'x'.repeat(301)]), /300|longo|check/i, 'motivo acima de 300 caracteres é recusado');
  });
  eq((await audit(target)).map((a) => a.action), ['set_plan', 'set_plan', 'set_plan'], 'cada mudança de plano é registrada (e as recusadas não)');
  eq(srt((await audit(target))[0].details), srt({ from_plan: 'essencial', from_expires_at: null, to_plan: 'pro', to_expires_at: null, note: 'cortesia, amigo' }), 'o registro guarda o antes, o depois e o motivo');
  // com pagamento aprovado: conta como pago
  const paidUser = await newUser();
  await apply(await newPay(paidUser), 'approved', 2990, 'mpAdm1');
  const k2 = await kpis();
  eq([k2.plan.pro_pago - k1.plan.pro_pago >= 1, k2.payments.aprovados - before.payments.aprovados], [true, 1], 'pagamento aprovado entra em pro_pago e em aprovados');
  eq(k2.payments.aprovado_centavos - before.payments.aprovado_centavos, 2990, 'valor aprovado em centavos');

  // 3) papéis
  const roleOf = async (u) => (await q(`select role from public.user_roles where user_id = $1 order by role`, [u])).map((r) => r.role);
  eq(srt((await as(adminId, () => q(`select public.admin_set_role($1, 'editor', true) as r`, [target])))[0].r), srt({ role: 'editor', granted: true, changed: true }), 'conceder editor');
  eq((await as(adminId, () => q(`select public.admin_set_role($1, 'editor', true) as r`, [target])))[0].r.changed, false, 'conceder de novo não muda nada');
  await as(adminId, () => q(`select public.admin_set_role($1, 'revisor', true)`, [target]));
  eq(await roleOf(target), ['editor', 'revisor'], 'dois papéis');
  eq((await audit(target)).filter((a) => a.action === 'grant_role').length, 2, 'repetir a concessão não gera registro novo');
  await as(adminId, async () => {
    await failsWith(() => q(`select public.admin_set_role($1, 'admin', true)`, [target]), /papel inválido/, 'admin não é concedido por aqui');
    await failsWith(() => q(`select public.admin_set_role($1, null, true)`, [target]), /papel inválido/, 'papel nulo é recusado');
    await failsWith(() => q(`select public.admin_set_role('00000000-0000-4000-8000-000000000000', 'editor', true)`), /não encontrado/, 'papel para usuário inexistente');
  });
  eq((await as(adminId, () => q(`select public.admin_set_role($1, 'editor', false) as r`, [target])))[0].r.changed, true, 'retirar editor');
  eq((await as(adminId, () => q(`select public.admin_set_role($1, 'editor', false) as r`, [target])))[0].r.changed, false, 'retirar de novo não muda');
  eq(await roleOf(target), ['revisor'], 'sobra só o revisor');
  eq((await kpis()).roles.revisor >= 1, true, 'KPI de papéis conta o revisor');
  await as(target, async () => eq((await q(`select role from public.user_roles`)).map((r) => r.role), ['revisor'], 'o próprio usuário lê só os seus papéis'));

  // 4) busca: sem sexo, idade ou cidade; "%" e "_" são texto
  const special = (await q(`insert into auth.users (email, raw_user_meta_data) values ('ana%teste_x@t.com', '{"full_name":"Ana 100% Teste"}') returning id`))[0].id;
  await q(`update public.profiles set sex = 'female', age_band = '25-34', city_state = 'Maringá, PR' where id = $1`, [special]);
  const search = (qs, limit = 20, offset = 0) => as(adminId, () => q(`select * from public.admin_search_users($1, $2, $3)`, [qs, limit, offset]));
  const hit = await search('ana%teste');
  eq(hit.map((r) => r.id), [special], '"%" na busca é texto, não curinga');
  eq((await search('%')).map((r) => r.id), [special], 'só "%" acha só quem tem "%" no e-mail ou nome');
  eq((await search('teste_x')).map((r) => r.id), [special], '"_" na busca é texto');
  eq((await search('100% teste')).map((r) => r.id), [special], 'busca por nome, sem diferenciar maiúsculas');
  eq(Object.keys(hit[0]).sort(), ['created_at', 'effective_plan', 'email', 'expires_at', 'has_paid', 'id', 'is_admin', 'name', 'note', 'plan', 'roles'].sort(), 'a busca nunca devolve sexo, idade nem cidade');
  ok(!JSON.stringify(hit).includes('Maringá') && !JSON.stringify(hit).includes('25-34'), 'nenhum dado demográfico no resultado');
  const all = await search('', 50);
  ok(all.length >= 20 && all[0].created_at >= all[all.length - 1].created_at, 'vazio = mais recentes primeiro');
  const pg1 = await search('', 5, 0), pg2 = await search('', 5, 5);
  ok(pg1.length === 5 && pg2.length === 5 && !pg1.some((r) => pg2.some((x) => x.id === r.id)), 'paginação sem repetir usuários');
  eq((await search('', 500)).length <= 50, true, 'o limite máximo é 50');
  eq((await search(adminId.slice(0, 8) + 'x')).length, 0, 'busca sem resultado');
  const adm = (await search((await q(`select email from public.profiles where id = $1`, [adminId]))[0].email)).find((r) => r.id === adminId);
  eq([adm.is_admin, adm.roles], [true, []], 'selo de admin');
  const tgt = (await search((await q(`select email from public.profiles where id = $1`, [target]))[0].email)).find((r) => r.id === target);
  eq([tgt.roles, tgt.plan, tgt.effective_plan], [['revisor'], 'essencial', 'essencial'], 'papéis e plano na linha');

  // plano vencido: efetivo Essencial, mas o plano guardado aparece, e conta em "vencidos"
  const exp = await newUser();
  await q(`update public.entitlements set plan = 'pro', expires_at = now() - interval '1 day' where user_id = $1`, [exp]);
  const er = (await search((await q(`select email from public.profiles where id = $1`, [exp]))[0].email))[0];
  eq([er.plan, er.effective_plan], ['pro', 'essencial'], 'vencido: plano guardado Pro, efetivo Essencial');
  ok((await kpis()).plan.vencidos >= 1, 'KPI conta vencidos');

  // 5) sexo e faixa etária: grupo pequeno some inteiro; grupo grande aparece
  await q(`update public.profiles set sex = 'female', age_band = '25-34'`);
  let kk = await kpis();
  eq([kk.sex.hidden, kk.age.hidden, Object.keys(kk.sex.items), Object.keys(kk.age.items)], [false, false, ['female'], ['25-34']], 'grupos grandes aparecem');
  eq(kk.sex.items.female, kk.total_users, 'a soma do gráfico é o total de usuários');
  await q(`update public.profiles set sex = 'male', age_band = '65+' where id in ($1, $2)`, [common, target]);
  kk = await kpis();
  eq([kk.sex.hidden, kk.age.hidden], [true, true], 'um grupo com menos de 5 pessoas esconde o gráfico inteiro');
  eq([kk.sex.items, kk.age.items, kk.sex.min], [undefined, undefined, 5], 'oculto: nenhum número sai (só hidden e min)');
  eq(Object.keys(kk.sex).sort(), ['hidden', 'min'], 'oculto: só hidden e min');
  const wide = await as(adminId, async () => (await q(`select public.admin_kpis(1) as k`))[0].k);
  eq(wide.sex.min, 2, 'p_min nunca cai abaixo de 2');
  eq(wide.sex.hidden, false, 'com o mínimo em 2, grupos de 2 pessoas já aparecem');
  await q(`update public.profiles set sex = null, age_band = null`);
  kk = await kpis();
  eq([kk.sex.hidden, kk.age.hidden], [false, false], 'Não informado também é um grupo (grande) e aparece');
  eq([Object.keys(kk.sex.items), kk.sex.items.unspecified === kk.total_users], [['unspecified'], true], 'chave "unspecified" para quem não informou');
  eq(typeof kk.marketing_consent, 'number', 'consentimento de novidades é só uma contagem');

  // 6) exclusão de conta: limpa user_roles e o detalhe do registro; o rastro fica sem dado
  const gone = await newUser();
  await as(adminId, async () => {
    await q(`select public.admin_set_plan($1, 'pro', null, 'dado que não deve sobrar')`, [gone]);
    await q(`select public.admin_set_role($1, 'editor', true)`, [gone]);
  });
  eq((await audit(gone)).length, 2, 'registro antes da exclusão');
  await q(`select public.delete_account_data($1)`, [gone]);
  eq((await roleOf(gone)).length, 0, 'user_roles do excluído some');
  const left = await audit(gone);
  eq([left.length, left.every((a) => JSON.stringify(a.details) === '{}')], [2, true], 'o rastro fica, sem o detalhe (motivo, planos)');
  const recent = await as(adminId, () => q(`select * from public.admin_recent_changes(100)`));
  ok(recent.length >= 2 && recent[0].at >= recent[recent.length - 1].at, 'histórico: mais recentes primeiro');
  const goneRows = recent.filter((r) => JSON.stringify(r.details) === '{}');
  ok(goneRows.length >= 2 && goneRows.every((r) => r.target_email === null), 'histórico de conta excluída: sem e-mail do alvo');
  ok(recent.some((r) => r.admin_email && r.target_email), 'histórico traz quem mudou e em quem');
  eq((await as(adminId, () => q(`select * from public.admin_recent_changes(1)`))).length, 1, 'p_limit respeitado');

  // 7) cortesia sem prazo e pagamento: o plano não muda
  const friend = await newUser();
  await as(adminId, () => q(`select public.admin_set_plan($1, 'pro', null, 'cortesia')`, [friend]));
  const fp = await newPay(friend);
  eq((await apply(fp, 'approved', 2990, 'mpAdm2')).months, 0, 'cortesia sem prazo: pagamento não soma meses');
  eq([(await ent(friend)).plan, (await ent(friend)).expires_at], ['pro', null], 'cortesia sem prazo continua igual depois do pagamento');
  await as(adminId, () => q(`select public.admin_set_plan($1, 'essencial', null, 'rebaixado')`, [friend]));
  eq([(await ent(friend)).plan, (await q(`select exists(select 1 from public.payments where user_id = $1 and status = 'approved') as p`, [friend]))[0].p], ['essencial', true], 'rebaixar quem tem pagamento aprovado funciona (a tela avisa)');
}

console.log(failed ? `\n${failed} teste(s) falharam, ${passed} passaram.` : `OK: ${passed} testes de cobrança passaram.`);
process.exit(failed ? 1 : 0);
