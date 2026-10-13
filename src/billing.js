import plans from './data/plans.json';
import { authEnabled, getClient } from './auth.js';

// Cobrança do Pro (Fase 4). O app só pede ao servidor: quem decide preço, cria o pagamento e concede o plano são as Edge
// Functions (`create-checkout`, `verify-payment`) e o webhook. Nada aqui libera plano a partir de dados do navegador.
// Desligada por padrão: só liga com VITE_BILLING_ENABLED=true (depois da migration, das funções e dos secrets).
export const billingEnabled = authEnabled && import.meta.env.VITE_BILLING_ENABLED === 'true';

// Preços exibidos (política de 13/10/2026): lançamento até `promoEndsAt` (inclusive), depois o preço normal. É só informação:
// quem decide o valor cobrado é a Edge Function create-checkout, pela data em que o checkout é criado.
export const PERIODS = Object.keys(plans.periods);
export const promoEndsAt = new Date(plans.promoEndsAt);
export const isLaunch = (now = new Date()) => new Date(now).getTime() <= promoEndsAt.getTime();
export const planPrice = (plan, period, now = new Date()) => plans.plans[plan].prices[period][isLaunch(now) ? 'launch' : 'regular'];
export const regularPrice = (plan, period) => plans.plans[plan].prices[period].regular;
// quanto o anual economiza em relação a 12 mensais ao preço vigente, em reais e em %
export function annualSaving(plan, now = new Date()) {
  const twelve = Math.round(planPrice(plan, 'mensal', now) * 12 * 100);
  const year = Math.round(planPrice(plan, 'anual', now) * 100);
  return { value: (twelve - year) / 100, percent: Math.round(((twelve - year) / twelve) * 100) };
}
export const formatDate = (d, lang = 'pt') => new Date(d).toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en-US', { timeZone: 'America/Sao_Paulo' });
export const formatBRL = (v, lang = 'pt') => new Intl.NumberFormat(lang === 'pt' ? 'pt-BR' : 'en-US', { style: 'currency', currency: 'BRL' }).format(v);

const REF_KEY = 'checkoutRef';
export const checkoutRef = {
  get() { try { return sessionStorage.getItem(REF_KEY); } catch { return null; } },
  clear() { try { sessionStorage.removeItem(REF_KEY); } catch { /* ignora */ } },
};

const MP_HOST = /(^|\.)mercadopago\.(com|com\.br)$/;

// Cria o checkout no servidor e leva a pessoa ao Mercado Pago (nenhum dado de cartão passa por aqui).
export async function startCheckout(period) {
  const client = await getClient();
  const { data, error } = await client.functions.invoke('create-checkout', { body: { plan: 'pro', period } });
  if (error) {
    let code = '';
    try { code = (await error.context.json())?.error ?? ''; } catch { /* sem corpo legível */ }
    throw new Error(code === 'terms_required' || code === 'already_active' ? code : 'checkout_unavailable'); // sem aceite dos Termos o servidor recusa (403); plano já ativo sem prazo (409)
  }
  if (!data?.url) throw new Error('checkout_unavailable');
  const u = new URL(data.url);
  if (u.protocol !== 'https:' || !MP_HOST.test(u.hostname)) throw new Error('checkout_unavailable'); // só segue para o Mercado Pago
  window.location.assign(u.href);
}

// Pede ao servidor para conferir no Mercado Pago os pagamentos da pessoa. Devolve { status, plan, expires_at }.
export async function verifyPayment(ref) {
  const client = await getClient();
  const { data, error } = await client.functions.invoke('verify-payment', { body: ref ? { ref } : {} });
  if (error || !data) throw new Error('verify_failed');
  return data;
}

export async function listPayments(userId) {
  const client = await getClient();
  const list = (cols) => client.from('payments').select(cols).eq('user_id', userId).order('created_at', { ascending: false }).limit(20);
  let { data, error } = await list('id,amount_cents,price_kind,status,created_at,approved_at,months');
  if (error) ({ data, error } = await list('id,amount_cents,price_kind,status,created_at,approved_at')); // migration 20261017 ainda não aplicada: sem o período
  if (error) throw error;
  return data ?? [];
}
