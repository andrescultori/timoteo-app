import { useSyncExternalStore } from 'react';
import { connectAccount, disconnectAccount } from './userdata.js';
import { LEGAL_VERSION, isDraft } from './legal/version.js';

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
// consent (Fase 7): 'unknown' | 'checking' | 'ok' | 'needed' | 'error'. Só com 'ok' os favoritos e a posição de leitura sincronizam
// com a conta (connectAccount); antes disso o app fica em modo local. consentOpen = modal de consentimento aberto.
let state = { status: authEnabled ? 'out' : 'off', user: null, error: null, consent: 'unknown', consentOpen: false, legal: null };
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
  return { enabled: authEnabled, status: s.status, user: s.user, name: nameOf(s.user), error: s.error, signedIn: s.status === 'in', consent: s.consent, consentOpen: s.consentOpen, legal: s.legal };
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
    afterSession(client, session.user);
  } else {
    set({ status: 'out', user: null });
  }
}

// ---- Fase 7: aceite dos Termos e consentimento sensível antes de sincronizar ----------------------------------------------------
const PENDING_KEY = 'legalPending';
const DISMISS_KEY = 'consentDismissed';
const ss = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* ignora */ } },
  remove(k) { try { sessionStorage.removeItem(k); } catch { /* ignora */ } },
};
const readPending = () => { try { const p = JSON.parse(ss.get(PENDING_KEY)); return p && typeof p.version === 'string' ? p : null; } catch { return null; } };

const consentOk = (p) => !!p?.terms_accepted_at && !!p?.sensitive_consent_at && (isDraft || p.terms_version === LEGAL_VERSION);

// Depois do login: grava o aceite pendente (RPC accept_legal, a data é do servidor), confere o perfil e só então liga a sincronização.
let gate = { userId: null, promise: null };
function afterSession(client, user) {
  if (gate.userId === user.id && gate.promise) return gate.promise;
  const promise = (async () => {
    set({ consent: 'checking' });
    try {
      const pending = readPending();
      if (pending) {
        const { error } = await client.rpc('accept_legal', { p_version: pending.version, p_marketing: pending.marketing });
        if (error) throw error;
        ss.remove(PENDING_KEY);
      }
      const { data, error } = await client.from('profiles').select('terms_version,terms_accepted_at,sensitive_consent_at,marketing_consent').eq('id', user.id).maybeSingle();
      if (error) throw error;
      if (consentOk(data)) { set({ consent: 'ok', legal: data }); connectAccount(client, user.id); }
      else set({ consent: 'needed', legal: data ?? null, consentOpen: ss.get(DISMISS_KEY) !== '1' }); // modo local até aceitar
    } catch {
      set({ consent: 'error' }); // sem rede ou erro: não sincroniza; tenta de novo no próximo carregamento
    }
  })();
  gate = { userId: user.id, promise };
  return promise;
}

// Abre o consentimento (deslogado: antes do login; logado sem aceite: para concluir o cadastro)
export const openConsent = () => { ss.remove(DISMISS_KEY); set({ consentOpen: true, error: null }); };
export function dismissConsent() { if (state.status === 'in') ss.set(DISMISS_KEY, '1'); set({ consentOpen: false }); }

// Logado sem aceite: grava o aceite agora e liga a sincronização. Devolve true se deu certo.
export async function acceptLegalNow({ marketing }) {
  try {
    const client = await getClient();
    const { error } = await client.rpc('accept_legal', { p_version: LEGAL_VERSION, p_marketing: marketing });
    if (error) throw error;
    gate = { userId: null, promise: null };
    ss.remove(DISMISS_KEY);
    set({ consentOpen: false });
    if (state.user) await afterSession(client, state.user);
    return true;
  } catch { return false; }
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
        if (event === 'SIGNED_OUT') { disconnectAccount(); gate = { userId: null, promise: null }; set({ status: 'out', user: null, consent: 'unknown', consentOpen: false, legal: null }); }
        else if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED')) {
          set({ status: 'in', user: session.user });
          if (event === 'SIGNED_IN') afterSession(client, session.user);
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

// Entrar: antes de ir ao Google, mostra o consentimento (3 caixas). A tela chama startGoogleSignIn depois do "Continuar".
export function signInWithGoogle() { openConsent(); return true; }

export async function startGoogleSignIn({ marketing }) {
  try {
    const client = await getClient();
    if (!client) return false;
    // as escolhas esperam a volta do OAuth e só então viram o aceite no banco (accept_legal)
    ss.set(PENDING_KEY, JSON.stringify({ version: LEGAL_VERSION, marketing: !!marketing, at: new Date().toISOString() }));
    try { sessionStorage.setItem(RETURN_KEY, window.location.hash); } catch { /* ignora */ }
    set({ error: null, consentOpen: false });
    // As rotas são por hash: o retorno é a origem + caminho, sem hash; a rota é restaurada por cleanReturnUrl()
    const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + window.location.pathname } });
    if (error) throw error;
    return true;
  } catch {
    ss.remove(PENDING_KEY);
    set({ error: 'auth' });
    return false;
  }
}

// Exclusão da conta (Fase 7): a Edge Function apaga os dados e o usuário no Auth; aqui limpa o que ficou neste aparelho.
// Erros: 'email_mismatch' | 'last_admin' | 'internal'.
export async function deleteAccount(email) {
  const client = await getClient();
  const { error } = await client.functions.invoke('delete-account', { body: { email } });
  if (error) {
    let code = '';
    try { code = (await error.context.json())?.error ?? ''; } catch { /* sem corpo legível */ }
    throw new Error(code === 'email_mismatch' || code === 'last_admin' ? code : 'internal');
  }
  await disconnectAccount(); // limpa o cache da conta neste aparelho (os favoritos do modo local, que nunca subiram, ficam)
  try { await client.auth.signOut({ scope: 'local' }); } catch { /* o usuário já não existe no servidor */ }
  try { localStorage.removeItem('planCache'); } catch { /* ignora */ }
  gate = { userId: null, promise: null };
  set({ status: 'out', user: null, consent: 'unknown', consentOpen: false, legal: null });
}

export async function signOut() {
  try {
    const client = await getClient();
    await disconnectAccount({ flush: true }); // envia o que falta e limpa o cache da conta neste aparelho
    await client?.auth.signOut();
  } catch { /* mesmo com erro de rede, a sessão local é encerrada abaixo */ }
  gate = { userId: null, promise: null };
  set({ status: 'out', user: null, consent: 'unknown', consentOpen: false, legal: null });
}
