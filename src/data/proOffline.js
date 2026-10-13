// Conteúdo Pro offline (Fase 3B, PR 8): cola entre o plano (src/plan.js), o Storage (proStorage.js), o armazenamento (proStore.js) e a tela.
// Para quem tem Pro/Premium/admin: baixa o pacote Pro sozinho (a menos que a pessoa desligue) e o app passa a ler dele primeiro, inclusive sem rede.
// Apaga a cópia no logout, quando o plano deixa de valer (a janela de graça de 14 dias é a do plano guardado em src/plan.js), ou quando outra
// conta entra. Só no navegador, só com VITE_PRO_SOURCE=storage; nada disso toca o cache do texto bíblico (src/offline.js).
import { useSyncExternalStore } from 'react';
import { createProSync } from './proSyncCore.js';
import { openProStore } from './proStore.js';
import { fetchProNet, setStoredReader } from './proStorage.js';
import { invalidateContent } from './content.js';

const ENABLED = import.meta.env?.VITE_PRO_SOURCE === 'storage';
const KEY = 'proOffline'; // '0' = a pessoa desligou o download automático
const store = ENABLED && typeof window !== 'undefined' ? openProStore() : null;
const core = store ? createProSync({ store, fetchNet: fetchProNet }) : null;

let access = { userId: null, level: 'none', ready: false };
let state = { supported: !!core, auto: true, syncing: false, done: 0, total: 0, error: false, meta: null };
const listeners = new Set();
const set = (next) => { state = { ...state, ...next }; listeners.forEach((fn) => fn()); };
try { state.auto = localStorage.getItem(KEY) !== '0'; } catch { /* ignora */ }

const refreshMeta = () => core?.meta().then((meta) => set({ meta })).catch(() => {});
if (core) {
  setStoredReader((key) => (access.ready && access.level !== 'none' ? core.read(key, access) : undefined));
  refreshMeta();
}

let ctrl = null;
let timer = null;
const online = () => typeof navigator === 'undefined' || navigator.onLine !== false;

async function run() {
  if (!core || state.syncing || !access.ready || access.level === 'none' || !online()) return;
  ctrl = new AbortController();
  set({ syncing: true, error: false, done: 0, total: 0 });
  const at = access;
  try {
    const out = await core.sync(at, { signal: ctrl.signal, onProgress: (done, total) => set({ done, total }) });
    if (out.status === 'ok' && (out.downloaded || out.removed)) invalidateContent();
    if (out.status === 'denied') invalidateContent();
  } catch (e) {
    if (e?.name !== 'AbortError') set({ error: true });
  } finally { ctrl = null; set({ syncing: false }); await refreshMeta(); }
}
const schedule = (ms = 2500) => { clearTimeout(timer); timer = setTimeout(run, ms); };

// Chamado por src/plan.js a cada mudança de acesso. Apaga o que não vale mais e agenda o download automático.
let lastKey = '';
export async function setOfflineAccess(next) {
  access = next;
  const k = `${next.userId}|${next.level}|${next.ready}`;
  if (!core || !next.ready || k === lastKey) return;
  lastKey = k;
  const meta = await core.meta().catch(() => null);
  if (meta && (next.level === 'none' || meta.userId !== next.userId)) {
    ctrl?.abort();
    await core.clear().catch(() => {});
    await refreshMeta();
    invalidateContent();
  }
  if (next.level !== 'none' && state.auto) schedule();
}
if (core && typeof window !== 'undefined') window.addEventListener('online', () => { if (state.auto) schedule(1500); });

export const proOfflineNow = () => run();
export const proOfflineCancel = () => ctrl?.abort();
export async function proOfflineRemove() {
  if (!core) return;
  ctrl?.abort();
  await core.clear();
  await refreshMeta();
  invalidateContent();
}
export function proOfflineAuto(on) {
  try { on ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, '0'); } catch { /* ignora */ }
  set({ auto: on });
  if (on) schedule(300);
}

const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const useProOffline = () => useSyncExternalStore(subscribe, () => state, () => state);
