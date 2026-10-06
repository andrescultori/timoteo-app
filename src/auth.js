import { useSyncExternalStore } from 'react';
import { connectAccount, disconnectAccount } from './userdata.js';

// Login opcional com Google (Supabase). O app nunca exige conta. O cliente do Supabase só é carregado (import dinâmico) quando
// há uma sessão guardada no aparelho ou uma volta de login (?code=) ou quando a pessoa clica em Entrar: quem só lê não
// baixa a biblioteca nem faz nenhuma chamada ao banco.

export const authEnabled = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);

let clientPromise = null;
export function getClient() {
  if (!authEnabled) return Promise.resolve(null);
  clientPromise ??= import('./supabase.js').then((m) => m.supabase);
  return clientPromise;
}

// status: 'off' (sem variáveis) | 'loading' (restaurando a sessão) | 'out' | 'in'
let state = { status: authEnabled ? 'out' : 'off', user: null, error: null };
const listeners = new Set();
const set = (next) => { state = { ...state, ...next }; listeners.forEach((fn) => fn()); };
const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const get = () => state;
// para outros módulos (plano) acompanharem a sessão sem React
export const subscribeAuth = (fn) => subscribe(() => fn(state));
export const getAuthState = get;

const nameOf = (user) => user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || '';

export function useSession() {
  const s = useSyncExternalStore(subscribe, get, get);
  return { enabled: authEnabled, status: s.status, user: s.user, name: nameOf(s.user), error: s.error, signedIn: s.status === 'in' };
}

const RETURN_KEY = 'authReturnHash';
export const hasStoredSession = () => {
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) return true;
    }
  } catch { /* sem localStorage */ }
  return false;
};
const params = () => new URLSearchParams(window.location.search);

// Depois da volta do OAuth (PKCE) o endereço traz ?code=...: limpa o código e devolve a pessoa à rota em que estava (o hash).
function cleanReturnUrl() {
  const q = params();
  if (!q.has('code') && !q.has('error') && !q.has('error_description')) return;
  ['code', 'error', 'error_code', 'error_description'].forEach((p) => q.delete(p));
  let saved = null;
  try { saved = sessionStorage.getItem(RETURN_KEY); sessionStorage.removeItem(RETURN_KEY); } catch { /* ignora */ }
  const search = q.toString();
  const hash = saved ?? window.location.hash;
  window.history.replaceState(window.history.state, '', window.location.pathname + (search ? `?${search}` : '') + hash);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

function applySession(client, session) {
  if (session?.user) {
    set({ status: 'in', user: session.user, error: null });
    connectAccount(client, session.user.id);
  } else {
    set({ status: 'out', user: null });
  }
}

let started = false;
async function start() {
  if (started || !authEnabled) return;
  started = true;
  const returning = params().has('code');
  if (!returning && !hasStoredSession()) return; // ninguém logado: não carrega a biblioteca
  set({ status: 'loading' });
  try {
    const client = await getClient();
    client.auth.onAuthStateChange((event, session) => {
      // não aguardar chamadas ao Supabase dentro deste callback (risco de travar): adia para o próximo ciclo
      setTimeout(() => {
        if (event === 'SIGNED_OUT') { disconnectAccount(); set({ status: 'out', user: null }); }
        else if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED')) {
          set({ status: 'in', user: session.user });
          if (event === 'SIGNED_IN') connectAccount(client, session.user.id);
        }
      }, 0);
    });
    const { data, error } = await client.auth.getSession(); // aguarda a troca do ?code= por sessão
    cleanReturnUrl();
    if (error) set({ status: 'out', user: null, error: 'auth' });
    else applySession(client, data.session);
  } catch {
    cleanReturnUrl();
    set({ status: 'out', user: null, error: 'auth' });
  }
}
if (typeof window !== 'undefined') start();

export async function signInWithGoogle() {
  try {
    const client = await getClient();
    if (!client) return false;
    try { sessionStorage.setItem(RETURN_KEY, window.location.hash); } catch { /* ignora */ }
    set({ error: null });
    // As rotas são por hash: o retorno é a origem + caminho, sem hash; a rota é restaurada por cleanReturnUrl()
    const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + window.location.pathname } });
    if (error) throw error;
    return true;
  } catch {
    set({ error: 'auth' });
    return false;
  }
}

export async function signOut() {
  try {
    const client = await getClient();
    await disconnectAccount({ flush: true }); // envia o que falta e limpa o cache da conta neste aparelho
    await client?.auth.signOut();
  } catch { /* mesmo com erro de rede, a sessão local é encerrada abaixo */ }
  set({ status: 'out', user: null });
}
