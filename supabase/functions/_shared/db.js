// Acesso ao banco pelas Edge Functions, só com `fetch` (PostgREST). Usa a service_role do ambiente da função, que nunca
// sai do servidor. A autenticação do usuário é conferida no Auth do Supabase com o JWT recebido.
export function createDb({ url, serviceKey }) {
  const rest = async (path, init = {}) => {
    const res = await fetch(`${url}/rest/v1/${path}`, {
      ...init,
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`banco respondeu ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return res.status === 204 ? null : res.json();
  };
  const one = async (path) => (await rest(path))[0] ?? null;

  return {
    // usuário do JWT (null se inválido ou expirado)
    async getUser(jwt) {
      if (!jwt) return null;
      const res = await fetch(`${url}/auth/v1/user`, { headers: { apikey: serviceKey, Authorization: `Bearer ${jwt}` }, signal: AbortSignal.timeout(10000) });
      if (!res.ok) return null;
      const u = await res.json();
      return u?.id ? { id: u.id } : null;
    },
    getEntitlement: (userId) => one(`entitlements?user_id=eq.${userId}&select=plan,expires_at,usou_preco_de_entrada`),
    getPayment: (id) => one(`payments?id=eq.${id}&select=*`),
    recentPayments: (userId) => rest(`payments?user_id=eq.${userId}&created_at=gte.${new Date(Date.now() - 3 * 864e5).toISOString()}&select=*&order=created_at.desc&limit=5`),
    // conciliação: ver a migration 20261009000000_fase4_conciliacao.sql
    paymentsToReconcile: (limit = 200) => rest('rpc/payments_to_reconcile', { method: 'POST', body: JSON.stringify({ p_limit: limit }) }),
    userPaymentsToVerify: (userId) => rest('rpc/user_payments_to_verify', { method: 'POST', body: JSON.stringify({ p_user_id: userId }) }),
    markReconciled: (id) => rest(`payments?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ reconciled_at: new Date().toISOString() }) }),
    async countPendingSince(userId, sinceIso) {
      const rows = await rest(`payments?user_id=eq.${userId}&status=eq.pending&created_at=gte.${sinceIso}&select=id`);
      return rows.length;
    },
    async insertPayment(row) {
      const r = await rest('payments', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) });
      return r[0];
    },
    setPreference: (id, prefId) => rest(`payments?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ mp_preference_id: prefId }) }),
    cancelPayment: (id) => rest(`payments?id=eq.${id}&status=eq.pending`, { method: 'PATCH', body: JSON.stringify({ status: 'cancelled' }) }),
    applyPayment: ({ paymentId, mpPaymentId, status, amountCents }) =>
      rest('rpc/apply_payment', { method: 'POST', body: JSON.stringify({ p_payment_id: paymentId, p_mp_payment_id: mpPaymentId, p_status: status, p_amount_cents: amountCents }) }),
  };
}
