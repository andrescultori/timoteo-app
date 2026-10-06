// Fluxo comum do webhook e do verify-payment: um pagamento (como o Mercado Pago o devolve na API, nunca o corpo da notificação)
// vira uma chamada a `apply_payment`. Toda conferência acontece aqui: referência, moeda e valor.
import { CURRENCY } from './pricing.js';
import { mapStatus } from './mp.js';

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// `db`: { getPayment(id) -> linha de payments | null, applyPayment({ paymentId, mpPaymentId, status, amountCents }) -> jsonb }
export async function applyMpPayment(mp, db) {
  const ref = mp?.external_reference;
  if (typeof ref !== 'string' || !UUID.test(ref)) return { result: 'ignored', reason: 'no_reference' };
  const row = await db.getPayment(ref.toLowerCase());
  if (!row) return { result: 'ignored', reason: 'unknown_reference' };
  if (mp.currency_id !== CURRENCY) return { result: 'rejected', reason: 'currency' };
  const cents = Math.round(Number(mp.transaction_amount) * 100);
  if (!Number.isFinite(cents) || cents !== row.amount_cents) return { result: 'rejected', reason: 'amount' };
  if (mp.id == null) return { result: 'ignored', reason: 'no_id' };
  const status = mapStatus(mp.status);
  const detail = await db.applyPayment({ paymentId: row.id, mpPaymentId: String(mp.id), status, amountCents: cents });
  return { result: 'applied', status, detail };
}

// Vários pagamentos do mesmo checkout (tentativas): os aprovados primeiro, para um reembolso ou recusa de outra tentativa
// nunca ser lido antes da aprovação.
export async function applyAll(list, db) {
  const rank = (p) => (p.status === 'approved' ? 0 : p.status === 'refunded' || p.status === 'charged_back' ? 2 : 1);
  const out = [];
  for (const mp of [...list].sort((a, b) => rank(a) - rank(b))) out.push(await applyMpPayment(mp, db));
  return out;
}
