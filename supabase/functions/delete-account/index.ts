// Exclusão da conta (LGPD). Exige usuário logado e o e-mail da conta digitado no corpo: { email }.
// 1) delete_account_data (apaga os dados pessoais e anonimiza os pagamentos; recusa o único admin) e 2) apaga o usuário no Auth.
// Idempotente: se o passo 2 falhar, repetir funciona. NÃO cancela nem reembolsa o Pro (reembolso é pelo painel do Mercado Pago,
// regra dos 7 dias dos Termos). Sem log com e-mail ou nome. Do ambiente: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. Secret: APP_URL (CORS).
import { corsHeaders, json, bearer } from '../_shared/http.js';
import { createDb } from '../_shared/db.js';

Deno.serve(async (req: Request) => {
  const appUrl = Deno.env.get('APP_URL') ?? '';
  const cors = corsHeaders(req, appUrl);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, cors);
  if (!appUrl) return json({ error: 'not_configured' }, 503, cors);

  try {
    const db = createDb({ url: Deno.env.get('SUPABASE_URL')!, serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! });
    const user = await db.getUser(bearer(req));
    if (!user) return json({ error: 'unauthorized' }, 401, cors);

    const body = await req.json().catch(() => ({}));
    const typed = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!user.email || typed !== user.email.trim().toLowerCase()) return json({ error: 'email_mismatch' }, 400, cors);

    try {
      await db.deleteAccountData(user.id);
    } catch (e) {
      if (String((e as Error).message).includes('último administrador')) return json({ error: 'last_admin' }, 409, cors);
      throw e;
    }
    await db.deleteAuthUser(user.id);
    return json({ deleted: true }, 200, cors);
  } catch (e) {
    console.error('delete-account:', (e as Error).message.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[e-mail]'));
    return json({ error: 'internal' }, 500, cors);
  }
});
