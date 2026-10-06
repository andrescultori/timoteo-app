import { useSyncExternalStore } from 'react';
import plans from './data/plans.json';
import { createCan, effectivePlan } from './planRules.js';
import { subscribeAuth, getAuthState, getClient, hasStoredSession } from './auth.js';

// Plano efetivo do usuário (somente leitura no cliente; nada de gravar plano por aqui).
//   sem login = essencial; com login, lê `entitlements` (a RLS já limita à própria linha) e chama `is_admin()`.
//   pro e premium só valem com expires_at nulo ou futuro. Falha de rede cai em essencial, sem erro na tela.
//   Um cache local curto evita o "pisca" na abertura; o plano é sempre buscado de novo e o cache é substituído.
export const can = createCan(plans);

const CACHE = 'planCache';
const MAX_AGE = 24 * 60 * 60 * 1000;
const read = () => { try { return JSON.parse(localStorage.getItem(CACHE)); } catch { return null; } };
const write = (v) => { try { v ? localStorage.setItem(CACHE, JSON.stringify(v)) : localStorage.removeItem(CACHE); } catch { /* ignora */ } };

const OFF = { plan: 'essencial', isAdmin: false, loading: false, userId: null, usedEntry: false, expiresAt: null };
let state = OFF;
const listeners = new Set();
const set = (next) => { state = { ...state, ...next }; listeners.forEach((fn) => fn()); };

// "Carregando" enquanto há sessão guardada e o plano ainda não chegou; com cache recente do mesmo aparelho, já mostra o plano guardado.
function fromCache() {
  const c = read();
  if (c && Date.now() - c.at < MAX_AGE) return { plan: effectivePlan(c.plan, c.expires_at), isAdmin: !!c.isAdmin, loading: false, userId: c.userId, usedEntry: !!c.usedEntry, expiresAt: c.expires_at ?? null };
  return null;
}
if (typeof window !== 'undefined' && hasStoredSession()) state = fromCache() ?? { ...OFF, loading: true };

let fetchingFor = null;
async function load(userId) {
  if (fetchingFor === userId) return;
  fetchingFor = userId;
  const cached = fromCache();
  if (state.userId === userId && !state.loading) { /* atualização: mantém o que já aparece até a resposta chegar */ } else if (cached && cached.userId === userId) set(cached); else set({ plan: 'essencial', isAdmin: false, loading: true, userId });
  try {
    const client = await getClient();
    // `usou_preco_de_entrada` vem da migration da Fase 4; se ela ainda não foi aplicada, repete sem a coluna (o plano não pode cair por isso)
    const readEnt = async () => {
      const full = await client.from('entitlements').select('plan,expires_at,usou_preco_de_entrada').eq('user_id', userId).maybeSingle();
      return full.error ? client.from('entitlements').select('plan,expires_at').eq('user_id', userId).maybeSingle() : full;
    };
    const [e, a] = await Promise.all([
      readEnt(),
      client.rpc('is_admin'),
    ]);
    const row = e.error ? null : e.data;
    const isAdmin = a.error ? false : a.data === true;
    if (e.error && a.error) throw e.error; // sem rede: segue com o que havia (cache ou essencial)
    set({ plan: effectivePlan(row?.plan, row?.expires_at), isAdmin, loading: false, userId, usedEntry: !!row?.usou_preco_de_entrada, expiresAt: row?.expires_at ?? null });
    write({ userId, plan: row?.plan ?? 'essencial', expires_at: row?.expires_at ?? null, usedEntry: !!row?.usou_preco_de_entrada, isAdmin, at: Date.now() });
  } catch {
    set({ loading: false, userId });
  } finally { fetchingFor = null; }
}

if (typeof window !== 'undefined') {
  const onAuth = (s) => {
    if (s.status === 'in' && s.user) { if (state.userId !== s.user.id || state.loading) load(s.user.id); }
    else if (s.status === 'out') { if (state.userId || state.plan !== 'essencial' || state.loading) { write(null); set(OFF); } }
    else if (s.status === 'off') set(OFF);
  };
  subscribeAuth(onAuth);
  onAuth(getAuthState());
}

// Busca o plano de novo agora (depois de um pagamento confirmado pelo servidor)
export function refreshPlan() {
  if (state.userId) { fetchingFor = null; load(state.userId); }
}

const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const get = () => state;

// { plan, isAdmin, loading } + can(feature, extra) já com o plano do usuário
export function usePlan() {
  const s = useSyncExternalStore(subscribe, get, get);
  return { plan: s.plan, isAdmin: s.isAdmin, loading: s.loading, usedEntry: s.usedEntry, expiresAt: s.expiresAt, can: (feature, extra) => can(feature, { plan: s.plan, isAdmin: s.isAdmin, ...extra }) };
}
