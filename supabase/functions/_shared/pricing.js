// Preços e períodos (a única fonte para as Edge Functions). O servidor decide o valor; o navegador nunca envia preço.
// O `npm run check` confere que estes valores batem com src/data/plans.json (periods, promoEndsAt e available do Premium).
//
// Política (13/10/2026): Pro e Premium em dois períodos, mensal (1 mês, pagamento avulso) e anual (12 meses). Há um preço de
// lançamento e um preço normal; o que vale é decidido pela DATA em que o checkout é criado (`PROMO_ENDS_AT`, inclusive).
// Não existe mais "preço de entrada no 1º pagamento do usuário" (entitlements.usou_preco_de_entrada não é mais usado).
export const CURRENCY = 'BRL';
// Fim do preço de lançamento: instante absoluto, COM offset (sem offset o resultado dependeria do fuso da máquina).
export const PROMO_ENDS_AT = '2027-01-13T23:59:59-03:00';
// O Premium tem preço definido, mas ainda NÃO é vendido: create-checkout recusa enquanto isto for false.
export const PREMIUM_ON_SALE = false;

export const PERIODS = { mensal: { months: 1 }, anual: { months: 12 } };
export const PRICE_CENTS = {
  pro: { mensal: { launch: 390, regular: 490 }, anual: { launch: 3990, regular: 4990 } },
  premium: { mensal: { launch: 690, regular: 990 }, anual: { launch: 6990, regular: 9900 } },
};
// Parcelas máximas no cartão (os juros do parcelamento ficam por conta de quem compra)
export const MAX_INSTALLMENTS = { mensal: 1, anual: 10 };

export const isLaunch = (now = new Date()) => new Date(now).getTime() <= Date.parse(PROMO_ENDS_AT);
// `price_kind` do registro em `payments`: 'entrada' = preço de lançamento, 'cheio' = preço normal (os valores antigos do CHECK)
export const priceKindAt = (now = new Date()) => (isLaunch(now) ? 'entrada' : 'cheio');

export const planOnSale = (plan) => plan === 'pro' || (plan === 'premium' && PREMIUM_ON_SALE);

// Pedido de compra validado: { plan, period, months, cents, price_kind, installments, itemId, title } ou null (plano ou período inválido
// ou plano não vendido). Aceita só valores da lista; nada vem do navegador além do nome do período.
export function orderFor(plan, period, now = new Date()) {
  if (!Object.hasOwn(PRICE_CENTS, plan) || !planOnSale(plan)) return null;
  if (typeof period !== 'string' || !Object.hasOwn(PERIODS, period)) return null;
  const kind = priceKindAt(now);
  const { months } = PERIODS[period];
  const name = plan === 'pro' ? 'Pro' : 'Premium';
  return {
    plan,
    period,
    months,
    cents: PRICE_CENTS[plan][period][kind === 'entrada' ? 'launch' : 'regular'],
    price_kind: kind,
    installments: MAX_INSTALLMENTS[period],
    itemId: `timoteo-${plan}-${months}m`,
    title: `Timóteo App ${name}, ${period === 'mensal' ? 'mensal (1 mês)' : 'anual (12 meses)'}`,
  };
}

// Quem já tem direito sem prazo (concessão manual) ou Premium vigente não compra o Pro: o pagamento entraria com 0 meses
// (apply_payment devolve already_active). Pro com vencimento pode renovar. `ent`: linha de entitlements ({ plan, expires_at }) ou null.
export function alreadyCovered(ent, now = new Date()) {
  if (!ent || (ent.plan !== 'pro' && ent.plan !== 'premium')) return false;
  const exp = ent.expires_at ? new Date(ent.expires_at) : null;
  const active = !exp || exp > now;
  return active && (!exp || ent.plan === 'premium');
}
