// Cria o pagamento pendente e a preferência do Checkout Pro (Mercado Pago). Exige usuário logado.
// O preço é decidido aqui, pelo banco (entrada ou cheio); o corpo da requisição não tem nenhum valor.
// Secrets: MP_ACCESS_TOKEN, APP_URL. Do ambiente: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
import { corsHeaders, json, bearer } from '../_shared/http.js';
import { createDb } from '../_shared/db.js';
import { createPreference, preferenceBody } from '../_shared/mp.js';
import { priceKind, PRICE_CENTS } from '../_shared/pricing.js';

const MAX_PENDING_PER_HOUR = 10;

Deno.serve(async (req: Request) => {
  const appUrl = Deno.env.get('APP_URL') ?? '';
  const cors = corsHeaders(req, appUrl);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, cors);

  const url = Deno.env.get('SUPABASE_URL')!;
  const token = Deno.env.get('MP_ACCESS_TOKEN');
  if (!appUrl || !token) return json({ error: 'not_configured' }, 503, cors);
  const db = createDb({ url, serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! });

  try {
    const user = await db.getUser(bearer(req));
    if (!user) return json({ error: 'unauthorized' }, 401, cors);

    // só quem aceitou os Termos (18+) compra: sem aceite, o app abre o consentimento
    const terms = await db.getProfileTerms(user.id);
    if (!terms?.terms_accepted_at) return json({ error: 'terms_required' }, 403, cors);

    const ent = await db.getEntitlement(user.id);
    const kind = priceKind(ent?.usou_preco_de_entrada === true);
    const cents = PRICE_CENTS[kind];

    // trava simples contra checkouts em excesso (cada um é uma linha e uma preferência no Mercado Pago)
    if ((await db.countPendingSince(user.id, new Date(Date.now() - 3600e3).toISOString())) >= MAX_PENDING_PER_HOUR) {
      return json({ error: 'too_many_requests' }, 429, cors);
    }

    const row = await db.insertPayment({ user_id: user.id, plan: 'pro', amount_cents: cents, price_kind: kind });
    try {
      const pref = await createPreference(token, preferenceBody({
        paymentId: row.id, cents, appUrl, notificationUrl: `${url}/functions/v1/mp-webhook`,
      }), row.id);
      if (!pref?.id || !pref?.init_point) throw new Error('resposta sem init_point');
      await db.setPreference(row.id, pref.id);
      return json({ url: pref.init_point, price_kind: kind, amount_cents: cents }, 200, cors);
    } catch (e) {
      await db.cancelPayment(row.id).catch(() => {});
      console.error('create-checkout: preferência falhou:', (e as Error).message);
      return json({ error: 'checkout_unavailable' }, 502, cors);
    }
  } catch (e) {
    console.error('create-checkout:', (e as Error).message);
    return json({ error: 'internal' }, 500, cors);
  }
});
