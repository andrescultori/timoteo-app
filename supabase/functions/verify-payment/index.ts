// Plano B do webhook: ao voltar do checkout (ou pelo botão "verificar pagamento"), consulta no Mercado Pago os pagamentos do
// PRÓPRIO usuário e aplica o mesmo fluxo do webhook. Exige usuário logado. Corpo opcional: { ref: <id do pagamento> }.
// Nunca confia em dados do navegador: só lê as linhas do usuário no banco e o que o Mercado Pago responde.
import { corsHeaders, json, bearer } from '../_shared/http.js';
import { createDb } from '../_shared/db.js';
import { searchPayments } from '../_shared/mp.js';
import { applyAll, UUID } from '../_shared/payments.js';

Deno.serve(async (req: Request) => {
  const appUrl = Deno.env.get('APP_URL') ?? '';
  const cors = corsHeaders(req, appUrl);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, cors);

  const token = Deno.env.get('MP_ACCESS_TOKEN');
  if (!appUrl || !token) return json({ error: 'not_configured' }, 503, cors);
  const db = createDb({ url: Deno.env.get('SUPABASE_URL')!, serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! });

  try {
    const user = await db.getUser(bearer(req));
    if (!user) return json({ error: 'unauthorized' }, 401, cors);

    const body = await req.json().catch(() => ({}));
    let rows = await db.recentPayments(user.id);
    if (typeof body?.ref === 'string' && UUID.test(body.ref)) {
      const wanted = rows.filter((r: { id: string }) => r.id === body.ref.toLowerCase());
      if (wanted.length) rows = wanted;
    }
    // só vale consultar o que ainda não foi concluído (aprovado, reembolsado e estornado já estão resolvidos)
    const open = rows.filter((r: { status: string }) => ['pending', 'rejected', 'cancelled'].includes(r.status));
    for (const r of open) await applyAll(await searchPayments(token, r.id), db);

    const after = await db.recentPayments(user.id);
    const target = (typeof body?.ref === 'string' && after.find((r: { id: string }) => r.id === String(body.ref).toLowerCase())) || after[0] || null;
    const ent = await db.getEntitlement(user.id);
    return json({
      status: target?.status ?? 'none',
      plan: ent?.plan ?? 'essencial',
      expires_at: ent?.expires_at ?? null,
    }, 200, cors);
  } catch (e) {
    console.error('verify-payment:', (e as Error).message);
    return json({ error: 'internal' }, 500, cors);
  }
});
