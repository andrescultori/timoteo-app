import { useSyncExternalStore } from 'react';
export { favKey, parseFavKey, FAV_TYPES } from './favKeys.js';

// Dados do usuário no aparelho: favoritos e posição de leitura (Fase 2A).
// A API abaixo (isFav, toggleFav, listFavs, getPosition, setPosition, subscribe) é a que os componentes usam. Na Fase 2B só o
// `backend` muda (Supabase com cache local); os componentes continuam iguais.
//
// localStorage: 'favorites' = [{ key, at }] (at = ISO), 'readingPosition' = { version, slug, chapter, at },
// 'favNoticeShown' = '1', 'continueDismissed' = o `at` da posição dispensada.
// Se o localStorage falhar (modo privado), tudo continua funcionando na sessão, sem salvar.

const K = { favs: 'favorites', pos: 'readingPosition', notice: 'favNoticeShown', dismissed: 'continueDismissed' };

const local = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* sem armazenamento: segue só na memória */ } },
};
const backend = local;

const parse = (s) => { try { return JSON.parse(s); } catch { return null; } };
const isStr = (v) => typeof v === 'string' && v.length > 0;

function load() {
  const rawFavs = parse(backend.get(K.favs));
  const seen = new Set();
  const favs = (Array.isArray(rawFavs) ? rawFavs : [])
    .filter((f) => f && isStr(f.key) && isStr(f.at) && !seen.has(f.key) && seen.add(f.key))
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  const p = parse(backend.get(K.pos));
  const position = p && isStr(p.version) && isStr(p.slug) && Number.isInteger(p.chapter) && p.chapter >= 1 && isStr(p.at)
    ? { version: p.version, slug: p.slug, chapter: p.chapter, at: p.at } : null;
  return { favs, keys: new Set(favs.map((f) => f.key)), position, noticeShown: backend.get(K.notice) === '1', dismissedAt: backend.get(K.dismissed), noticePending: false };
}

let state = load();
const listeners = new Set();
const commit = (next) => { state = { ...state, ...next }; listeners.forEach((fn) => fn()); };

export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const getState = () => state;
export const useUserData = () => useSyncExternalStore(subscribe, getState, getState);

// Outras abas: recarrega do armazenamento (o aviso em tela é só desta aba)
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === null || Object.values(K).includes(e.key)) commit({ ...load(), noticePending: state.noticePending });
  });
}

export const isFav = (key) => state.keys.has(key);
export const listFavs = () => state.favs;

// Adiciona ou remove; devolve true se o item ficou favoritado.
export function toggleFav(key) {
  let favs;
  let added;
  if (state.keys.has(key)) { favs = state.favs.filter((f) => f.key !== key); added = false; }
  else { favs = [{ key, at: new Date().toISOString() }, ...state.favs]; added = true; }
  backend.set(K.favs, JSON.stringify(favs));
  const next = { favs, keys: new Set(favs.map((f) => f.key)) };
  if (added && !state.noticeShown) { backend.set(K.notice, '1'); next.noticeShown = true; next.noticePending = true; } // aviso do aparelho: só no 1º favorito
  commit(next);
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
