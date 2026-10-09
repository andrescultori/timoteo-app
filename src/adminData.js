// Funções puras da página de administração (#admin): leitura de erros das RPCs, datas, rótulos e avisos. Sem rede, testáveis.
// As regras de verdade (quem é admin, plano, papéis, ocultação de grupos pequenos) estão no banco (20261015000000_fase6_admin.sql);
// aqui só se apresenta o que as funções devolvem.

export const SEX_ORDER = ['female', 'male', 'other', 'unspecified'];
export const AGE_ORDER = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+', 'unspecified'];
export const PLAN_RANK = { essencial: 0, pro: 1, premium: 2 };

// Erro de uma RPC: 'denied' (não é admin: a página sai de cena), 'missing' (migration da Fase 6 não aplicada) ou 'other'
export function rpcProblem(error) {
  if (!error) return null;
  const msg = String(error.message ?? '');
  if (error.code === '42501' || /acesso negado/i.test(msg)) return 'denied';
  if (error.code === 'PGRST202' || error.code === '42883' || error.code === '42P01' || /could not find the function|does not exist|schema cache/i.test(msg)) return 'missing';
  return 'other';
}

// Soma `n` meses em UTC, sem transbordar o fim do mês (31 jan + 1 mês = 28 fev), como payment_extend_expiry no banco.
export function addMonths(date, n) {
  const d = new Date(date);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

// Atalho "+N meses": a partir do vencimento atual, se ainda vale; senão, de agora
export function shortcutExpiry(currentIso, months, now = new Date()) {
  const cur = currentIso ? new Date(currentIso) : null;
  return addMonths(cur && cur > now ? cur : now, months);
}

// <input type="date"> trabalha com "AAAA-MM-DD" no horário local
export const toDateInput = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
// O vencimento vale até o fim do dia escolhido (horário local)
export function fromDateInput(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Como a linha de usuário se apresenta: plano efetivo, vencido, vencimento e origem ("pago" = tem pagamento aprovado; senão "cortesia")
export function planView(u) {
  const eff = u.effective_plan ?? 'essencial';
  const expired = (u.plan === 'pro' || u.plan === 'premium') && eff === 'essencial';
  const paidish = eff !== 'essencial';
  return { plan: eff, expired, until: u.expires_at ?? null, origin: paidish ? (u.has_paid ? 'paid' : 'courtesy') : null };
}

// A mudança rebaixa o plano (ou encurta o prazo) de quem tem pagamento aprovado? Então a tela avisa em destaque.
export function downgradesPaid(u, newPlan, newExpiresIso) {
  if (!u?.has_paid) return false;
  const cur = u.effective_plan ?? 'essencial';
  if (PLAN_RANK[newPlan] < PLAN_RANK[cur]) return true;
  if (newPlan === cur && cur !== 'essencial') {
    const curExp = u.expires_at ? new Date(u.expires_at).getTime() : Infinity;
    const newExp = newExpiresIso ? new Date(newExpiresIso).getTime() : Infinity;
    return newExp < curExp;
  }
  return false;
}

// Linhas de um gráfico de barras na ordem fixa; `items` vem de admin_kpis (nunca recalculado aqui). Largura em % do maior valor.
export function barRows(items, order) {
  const max = Math.max(1, ...order.map((k) => items?.[k] ?? 0));
  const total = order.reduce((s, k) => s + (items?.[k] ?? 0), 0) || 1;
  return order.filter((k) => (items?.[k] ?? 0) > 0).map((k) => ({ key: k, n: items[k], width: Math.round((items[k] / max) * 100), pct: Math.round((items[k] / total) * 100) }));
}

export const cents = (c) => (Number(c) || 0) / 100;
