// Mercado Pago (Checkout Pro): preferência, consulta de pagamento e validação do x-signature. Só `fetch` e Web Crypto
// (funciona no Deno das Edge Functions e no Node dos testes). Nada aqui lê segredo do ambiente: o token vem por parâmetro.
import { CURRENCY, ITEM_TITLE, MAX_INSTALLMENTS } from './pricing.js';

const API = 'https://api.mercadopago.com';
const TIMEOUT_MS = 10000; // o webhook precisa responder em até 22 s

// ---- assinatura do webhook (x-signature) -------------------------------------------------------------------------------
// manifest: "id:<data.id da URL, em minúsculas se alfanumérico>;request-id:<x-request-id>;ts:<ts do x-signature>;"
// (partes ausentes saem do manifest). HMAC-SHA256 em hexadecimal, com a "assinatura secreta" do painel como chave.
export function buildManifest({ dataId, requestId, ts }) {
  let m = '';
  if (dataId) m += `id:${/^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId};`;
  if (requestId) m += `request-id:${requestId};`;
  if (ts) m += `ts:${ts};`;
  return m;
}

export function parseSignature(header) {
  const out = {};
  for (const part of String(header ?? '').split(',')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return { ts: out.ts ?? null, v1: out.v1 ?? null };
}

const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export async function hmacHex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
}

// comparação sem atalho por tamanho de prefixo
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifySignature({ secret, signatureHeader, requestId, dataId }) {
  if (!secret) return false;
  const { ts, v1 } = parseSignature(signatureHeader);
  if (!ts || !v1) return false;
  const expected = await hmacHex(secret, buildManifest({ dataId, requestId, ts }));
  return safeEqual(expected, v1.toLowerCase());
}

// ---- status ------------------------------------------------------------------------------------------------------------
// status do Mercado Pago → status do nosso `payments`. Tudo que está "em andamento" (pending, in_process, authorized,
// in_mediation) vira `pending`: nunca libera nada e não desfaz o que já foi concedido.
export function mapStatus(mpStatus) {
  switch (mpStatus) {
    case 'approved': return 'approved';
    case 'rejected': return 'rejected';
    case 'cancelled': return 'cancelled';
    case 'refunded': return 'refunded';
    case 'charged_back': return 'charged_back';
    default: return 'pending';
  }
}

// ---- preferência de checkout -------------------------------------------------------------------------------------------
export function preferenceBody({ paymentId, cents, appUrl, notificationUrl }) {
  const base = appUrl.replace(/\/+$/, '');
  const back = (k) => `${base}/?checkout=${k}`;
  return {
    items: [{ id: 'timoteo-pro-12m', title: ITEM_TITLE, quantity: 1, unit_price: cents / 100, currency_id: CURRENCY }],
    external_reference: paymentId,
    notification_url: notificationUrl,
    back_urls: { success: back('success'), pending: back('pending'), failure: back('failure') },
    auto_return: 'approved',
    payment_methods: {
      excluded_payment_types: [{ id: 'ticket' }], // sem boleto
      installments: MAX_INSTALLMENTS,
    },
  };
}

async function call(token, path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Mercado Pago respondeu ${res.status}`);
  return res.json();
}

export const createPreference = (token, body, idempotencyKey) =>
  call(token, '/checkout/preferences', { method: 'POST', body: JSON.stringify(body), headers: { 'X-Idempotency-Key': idempotencyKey } });

// null se o pagamento não existe (ex.: notificação de teste do painel)
export const getPayment = (token, id) => call(token, `/v1/payments/${encodeURIComponent(id)}`);

export async function searchPayments(token, externalReference) {
  const q = new URLSearchParams({ external_reference: externalReference, sort: 'date_created', criteria: 'desc', limit: '20' });
  const data = await call(token, `/v1/payments/search?${q}`);
  return data?.results ?? [];
}
