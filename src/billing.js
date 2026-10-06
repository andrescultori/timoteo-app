import plans from './data/plans.json';
import { authEnabled, getClient } from './auth.js';

// Cobrança do Pro (Fase 4). O app só pede ao servidor: quem decide preço, cria o pagamento e concede o plano são as Edge
// Functions (`create-checkout`, `verify-payment`) e o webhook. Nada aqui libera plano a partir de dados do navegador.
// Desligada por padrão: só liga com VITE_BILLING_ENABLED=true (depois da migration, das funções e dos secrets).
export const billingEnabled = authEnabled && import.meta.env.VITE_BILLING_ENABLED === 'true';

const pro = plans.plans.pro;
// preço que vale para quem está logado: entrada no primeiro pagamento, cheio depois (a Edge Function decide de verdade)
export const proPrice = (usedEntry) => (usedEntry ? pro.price : pro.entryPrice);
export const formatBRL = (v, lang = 'pt') => new Intl.NumberFormat(lang === 'pt' ? 'pt-BR' : 'en-US', { style: 'currency', currency: 'BRL' }).format(v);

const REF_KEY = 'checkoutRef';
export const checkoutRef = {
  get() { try { return sessionStorage.getItem(REF_KEY); } catch { return null; } },
  clear() { try { sessionStorage.removeItem(REF_KEY); } catch { /* ignora */ } },
};

const MP_HOST = /(^|\.)mercadopago\.(com|com\.br)$/;

// Cria o checkout no servidor e leva a pessoa ao Mercado Pago (nenhum dado de cartão passa por aqui).
export async function startCheckout() {
  const client = await getClient();
  const { data, error } = await client.functions.invoke('create-checkout', { body: {} });
  if (error || !data?.url) throw new Error('checkout_unavailable');
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
  const { data, error } = await client.from('payments').select('id,amount_cents,price_kind,status,created_at,approved_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(20);
  if (error) throw error;
  return data ?? [];
}
