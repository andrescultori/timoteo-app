// Plano B do webhook: ao voltar do checkout (ou pelo botão "verificar pagamento"), consulta no Mercado Pago os pagamentos do
// PRÓPRIO usuário (em aberto e aprovados dos últimos 45 dias) e aplica o mesmo fluxo do webhook. Exige usuário logado.
// Corpo opcional: { ref: <id do pagamento> } só escolhe qual pagamento aparece no status devolvido.
// Nunca confia em dados do navegador: só lê as linhas do usuário no banco e o que o Mercado Pago responde.
import { corsHeaders, json, bearer } from '../_shared/http.js';
import { createDb } from '../_shared/db.js';
import { searchPayments } from '../_shared/mp.js';
import { applyAll } from '../_shared/payments.js';

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
    // Reconfere os pagamentos em aberto (3 dias) e os APROVADOS dos últimos 45 dias: um reembolso ou estorno cujo aviso
    // se perdeu também é aplicado aqui. Só linhas do próprio usuário (a função SQL filtra por user_id).
    const rows = await db.userPaymentsToVerify(user.id);
    await Promise.all(rows.map(async (r: { id: string }) => {
      await applyAll(await searchPayments(token, r.id), db);
      await db.markReconciled(r.id);
    }));

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
