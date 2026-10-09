// Preço e duração do plano Pro (a única fonte para as Edge Functions). O servidor decide o valor; o navegador nunca envia preço.
// O `npm run check` confere que estes valores batem com src/data/plans.json (price e entryPrice).
export const CURRENCY = 'BRL';
export const PRO_MONTHS = 12;
export const PRICE_CENTS = { entrada: 2990, cheio: 4990 };
export const ITEM_TITLE = 'Timóteo App Pro, 12 meses';
export const MAX_INSTALLMENTS = 12;

// `usou`: o usuário já teve um pagamento aprovado (entitlements.usou_preco_de_entrada)
export const priceKind = (usou) => (usou ? 'cheio' : 'entrada');
export const priceCents = (usou) => PRICE_CENTS[priceKind(usou)];

// Quem já tem direito sem prazo (concessão manual) ou Premium vigente não compra o Pro: o pagamento entraria com 0 meses
// (apply_payment devolve already_active). Pro com vencimento pode renovar. `ent`: linha de entitlements ({ plan, expires_at }) ou null.
export function alreadyCovered(ent, now = new Date()) {
  if (!ent || (ent.plan !== 'pro' && ent.plan !== 'premium')) return false;
  const exp = ent.expires_at ? new Date(ent.expires_at) : null;
  const active = !exp || exp > now;
  return active && (!exp || ent.plan === 'premium');
}
