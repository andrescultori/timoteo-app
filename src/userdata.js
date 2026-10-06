import { useSyncExternalStore } from 'react';
export { favKey, parseFavKey, FAV_TYPES } from './favKeys.js';

// Dados do usuário: favoritos e posição de leitura. A API que os componentes usam (isFav, toggleFav, listFavs, getPosition,
// setPosition, subscribe, useUserData) é a mesma com ou sem conta.
//   Sem conta: tudo fica só no aparelho (localStorage), como na Fase 2A.
//   Com conta (Fase 2B): o localStorage vira CACHE e o Supabase é a fonte. No login faz-se a UNIÃO dos dados do aparelho com os da conta.
//
// localStorage: 'favorites' = [{ key, at }] (at = ISO), 'readingPosition' = { version, slug, chapter, at },
// 'favNoticeShown' = '1', 'continueDismissed' = o `at` da posição dispensada, 'syncQueue' = operações ainda não enviadas,
// 'syncAccount' = id da conta cujos dados estão no cache.
// Se o localStorage falhar (modo privado), tudo continua funcionando na sessão, sem salvar.

const K = { favs: 'favorites', pos: 'readingPosition', notice: 'favNoticeShown', dismissed: 'continueDismissed', queue: 'syncQueue', acc: 'syncAccount' };

const local = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* sem armazenamento: segue só na memória */ } },
  remove(k) { try { localStorage.removeItem(k); } catch { /* ignora */ } },
};
const backend = local;

const parse = (s) => { try { return JSON.parse(s); } catch { return null; } };
const isStr = (v) => typeof v === 'string' && v.length > 0;
const byRecent = (a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0);

function load() {
  const rawFavs = parse(backend.get(K.favs));
  const seen = new Set();
  const favs = (Array.isArray(rawFavs) ? rawFavs : [])
    .filter((f) => f && isStr(f.key) && isStr(f.at) && !seen.has(f.key) && seen.add(f.key))
    .sort(byRecent);
  const p = parse(backend.get(K.pos));
  const position = p && isStr(p.version) && isStr(p.slug) && Number.isInteger(p.chapter) && p.chapter >= 1 && isStr(p.at)
    ? { version: p.version, slug: p.slug, chapter: p.chapter, at: p.at } : null;
  return { favs, keys: new Set(favs.map((f) => f.key)), position, noticeShown: backend.get(K.notice) === '1', dismissedAt: backend.get(K.dismissed), noticePending: false };
}

let state = { ...load(), account: null };
const listeners = new Set();
const commit = (next) => { state = { ...state, ...next }; listeners.forEach((fn) => fn()); };

export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const getState = () => state;
export const useUserData = () => useSyncExternalStore(subscribe, getState, getState);

// Outras abas: recarrega do armazenamento (o aviso em tela é só desta aba)
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === null || Object.values(K).includes(e.key)) commit({ ...load(), account: state.account, noticePending: state.noticePending });
  });
}

export const isFav = (key) => state.keys.has(key);
export const listFavs = () => state.favs;

const saveFavs = (favs) => { backend.set(K.favs, JSON.stringify(favs)); return { favs, keys: new Set(favs.map((f) => f.key)) }; };

// Adiciona ou remove; devolve true se o item ficou favoritado. Grava no aparelho na hora; com conta, também enfileira o envio.
export function toggleFav(key) {
  const added = !state.keys.has(key);
  const at = new Date().toISOString();
  const next = saveFavs(added ? [{ key, at }, ...state.favs] : state.favs.filter((f) => f.key !== key));
  if (added && !state.noticeShown && !state.account) { backend.set(K.notice, '1'); next.noticeShown = true; next.noticePending = true; } // aviso do aparelho: só no 1º favorito, sem conta
  commit(next);
  if (state.account) { enqueue({ op: added ? 'add' : 'remove', key, at }); flush(); }
  return added;
}

export const getPosition = () => state.position;

// Retomar a leitura pelo cartão "Continuar": o leitor abre na versão gravada, mesmo que ela não seja do idioma da interface.
// Vale até o leitor gravar a posição (setPosition limpa).
let resume = null;
export const setResume = (slug, version) => { resume = { slug, version }; };
export const peekResume = (slug) => (resume && resume.slug === slug ? resume.version : null);

// Grava a última posição de leitura (versão, livro, capítulo). Reabrir o mesmo capítulo só atualiza se o cartão estava dispensado.
export function setPosition({ version, slug, chapter }) {
  resume = null;
  const cur = state.position;
  if (cur && cur.version === version && cur.slug === slug && cur.chapter === chapter && state.dismissedAt !== cur.at) return;
  const position = { version, slug, chapter, at: new Date().toISOString() };
  backend.set(K.pos, JSON.stringify(position));
  commit({ position });
  schedulePosition();
}

export const continueVisible = () => !!state.position && state.dismissedAt !== state.position.at;
export function dismissContinue() {
  if (!state.position) return;
  backend.set(K.dismissed, state.position.at);
  commit({ dismissedAt: state.position.at });
}

// Aviso "ficam só neste aparelho": o toast some com "Entendi"; já foi marcado como mostrado no 1º favorito
export const dismissNotice = () => commit({ noticePending: false });
export function acknowledgeNotice() { backend.set(K.notice, '1'); commit({ noticeShown: true, noticePending: false }); }

// Versão preferida do leitor por idioma (a escolha é lembrada entre livros e visitas)
export const getVersionPref = (lang) => backend.get(`ver:${lang}`);
export const setVersionPref = (lang, id) => backend.set(`ver:${lang}`, id);

// =====================================================================================================================
// Conta (Supabase). Só é usada quando há sessão; sem sessão nada abaixo faz chamada de rede.
// =====================================================================================================================

let account = null; // { client, userId }
let connecting = null; // { userId, promise }
let queue = (() => { const q = parse(backend.get(K.queue)); return Array.isArray(q) ? q.filter((o) => o && isStr(o.key) && (o.op === 'add' || o.op === 'remove')) : []; })();
const saveQueue = () => backend.set(K.queue, JSON.stringify(queue));
// Só a última operação de cada chave importa
const enqueue = (op) => { queue = [...queue.filter((o) => o.key !== op.key), op]; saveQueue(); };

// Fila simples: envia na ordem; se falhar (rede), para e tenta de novo no próximo carregamento, ao voltar a rede ou no próximo favorito.
let flushing = null;
function flush() {
  if (!account) return Promise.resolve();
  if (flushing) return flushing;
  const { client, userId } = account;
  flushing = (async () => {
    while (queue.length && account?.userId === userId) {
      const op = queue[0];
      try {
        const { error } = op.op === 'add'
          ? await client.from('favorites').upsert({ user_id: userId, key: op.key, created_at: op.at }, { onConflict: 'user_id,key' })
          : await client.from('favorites').delete().eq('user_id', userId).eq('key', op.key);
        if (error) throw error;
        queue = queue.filter((o) => o !== op);
        saveQueue();
      } catch { break; }
    }
  })().finally(() => { flushing = null; });
  return flushing;
}

// Posição de leitura: no máximo uma gravação a cada ~10 s (a primeira vai logo); quando a aba fica oculta, envia o que falta.
const POS_MIN_MS = 10000;
let posTimer = null;
let posDirty = false;
let lastPosSent = 0;
async function sendPosition() {
  clearTimeout(posTimer);
  posTimer = null;
  if (!account || !posDirty || !state.position) return;
  posDirty = false;
  lastPosSent = Date.now();
  const p = state.position;
  try {
    const { error } = await account.client.from('reading_position').upsert({ user_id: account.userId, version: p.version, slug: p.slug, chapter: p.chapter, updated_at: p.at });
    if (error) throw error;
  } catch { posDirty = true; } // o próximo setPosition ou carregamento reenvia (a união no login compara as datas)
}
function schedulePosition() {
  if (!account) return;
  posDirty = true;
  if (posTimer) return;
  posTimer = setTimeout(sendPosition, Math.max(0, POS_MIN_MS - (Date.now() - lastPosSent)));
}
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { sendPosition(); flush(); } });
  window.addEventListener('online', () => { flush(); if (posDirty) schedulePosition(); });
}

function clearCache() {
  [K.favs, K.pos, K.queue, K.acc, K.dismissed].forEach(backend.remove);
  queue = [];
  clearTimeout(posTimer);
  posTimer = null;
  posDirty = false;
  commit({ favs: [], keys: new Set(), position: null, dismissedAt: null, noticePending: false });
}

const older = (a, b) => (a < b ? a : b);

// Login (e abertura do app já logado): UNIÃO dos favoritos do aparelho com os da conta, sem duplicar por chave (vale o created_at mais
// antigo); a posição de leitura mais recente vence. Depois disso a conta é a fonte e o aparelho é o cache.
export function connectAccount(client, userId) {
  if (connecting && connecting.userId === userId) return connecting.promise;
  const promise = (async () => {
    // O cache é de outra conta (logout que não terminou)? Não mistura: descarta.
    const cachedFor = backend.get(K.acc);
    if (cachedFor && cachedFor !== userId) clearCache();
    account = { client, userId };
    commit({ account: userId, noticePending: false });
    try {
      const [fr, pr] = await Promise.all([
        client.from('favorites').select('key,created_at'),
        client.from('reading_position').select('version,slug,chapter,updated_at').maybeSingle(),
      ]);
      if (fr.error || pr.error) throw fr.error || pr.error;

      const remote = new Map(fr.data.map((r) => [r.key, new Date(r.created_at).toISOString()]));
      const merged = new Map(remote);
      const toUpload = [];
      for (const f of state.favs) {
        const r = remote.get(f.key);
        if (r === undefined || f.at < r) { merged.set(f.key, r === undefined ? f.at : older(f.at, r)); toUpload.push({ user_id: userId, key: f.key, created_at: merged.get(f.key) }); }
      }
      // operações pendentes (feitas offline) valem sobre a união: remoção não ressuscita, adição entra
      for (const o of queue) { if (o.op === 'remove') merged.delete(o.key); else if (!merged.has(o.key)) merged.set(o.key, o.at); }
      const pendingRemoves = new Set(queue.filter((o) => o.op === 'remove').map((o) => o.key));
      const upload = toUpload.filter((r) => !pendingRemoves.has(r.key));
      for (let i = 0; i < upload.length; i += 100) {
        const { error } = await client.from('favorites').upsert(upload.slice(i, i + 100), { onConflict: 'user_id,key' });
        if (error) throw error;
      }
      const favs = [...merged].map(([key, at]) => ({ key, at })).sort(byRecent);

      // posição: a mais recente vence
      let position = state.position;
      const rp = pr.data;
      const remotePos = rp && isStr(rp.slug) && isStr(rp.version) && Number.isInteger(rp.chapter)
        ? { version: rp.version, slug: rp.slug, chapter: rp.chapter, at: new Date(rp.updated_at).toISOString() } : null;
      if (remotePos && (!position || remotePos.at > position.at)) { position = remotePos; backend.set(K.pos, JSON.stringify(position)); }
      else if (position && (!remotePos || position.at > remotePos.at)) posDirty = true; // a do aparelho é mais recente: sobe para a conta

      backend.set(K.acc, userId);
      commit({ ...saveFavs(favs), position });
      if (posDirty) sendPosition();
      flush();
    } catch {
      // Sem rede ou erro: segue com o cache e tenta de novo no próximo carregamento (a união ainda não foi feita)
    }
  })();
  connecting = { userId, promise };
  return promise;
}

// Logout: envia o que falta e limpa o cache da conta neste aparelho, para os dados não passarem de uma pessoa para outra.
export async function disconnectAccount({ flush: send = false } = {}) {
  if (send && account) {
    await Promise.race([Promise.all([flush(), sendPosition()]), new Promise((r) => setTimeout(r, 4000))]).catch(() => {});
  }
  account = null;
  connecting = null;
  commit({ account: null });
  if (send || backend.get(K.acc)) clearCache();
}
