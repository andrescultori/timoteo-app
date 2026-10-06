// Webhook do Mercado Pago (verify_jwt = false em config.toml: quem chama é o Mercado Pago, sem JWT do Supabase).
// 1) valida o x-signature; 2) consulta o pagamento na API do Mercado Pago (o corpo da notificação não vale como prova);
// 3) confere referência, valor e moeda e chama apply_payment (idempotente). Responde 200 rápido; 5xx só se vale tentar de novo.
// Secrets: MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET.
import { json } from '../_shared/http.js';
import { createDb } from '../_shared/db.js';
import { getPayment, verifySignature } from '../_shared/mp.js';
import { applyMpPayment } from '../_shared/payments.js';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const token = Deno.env.get('MP_ACCESS_TOKEN');
  const secret = Deno.env.get('MP_WEBHOOK_SECRET');
  if (!token || !secret) return json({ error: 'not_configured' }, 503);

  const q = new URL(req.url).searchParams;
  const queryId = q.get('data.id') ?? q.get('id');

  const ok = await verifySignature({
    secret,
    signatureHeader: req.headers.get('x-signature'),
    requestId: req.headers.get('x-request-id'),
    dataId: q.get('data.id'),
  });
  if (!ok) return json({ error: 'invalid_signature' }, 401);

  const body = await req.json().catch(() => null);
  const type = q.get('type') ?? q.get('topic') ?? body?.type;
  const id = queryId ?? body?.data?.id;
  if (type !== 'payment' || !id) return json({ result: 'ignored', reason: 'not_a_payment' });

  try {
    const mp = await getPayment(token, String(id));
    if (!mp) return json({ result: 'ignored', reason: 'payment_not_found' }); // ex.: notificação de teste do painel
    const db = createDb({ url: Deno.env.get('SUPABASE_URL')!, serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! });
    const out = await applyMpPayment(mp, db);
    if (out.result === 'rejected') console.error('mp-webhook: pagamento recusado pela conferência:', out.reason, 'mp_id', mp.id);
    if (out.detail?.result === 'duplicate_payment') console.error('mp-webhook: pagamento duplicado, reembolsar à mão: mp_id', mp.id);
    if (out.detail?.result === 'duplicate_entry') console.error('mp-webhook: preço de entrada pago duas vezes, reembolsar à mão: mp_id', mp.id);
    return json(out);
  } catch (e) {
    console.error('mp-webhook:', (e as Error).message);
    return json({ error: 'internal' }, 500); // o Mercado Pago tenta de novo
  }
});
