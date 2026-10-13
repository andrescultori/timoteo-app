// Texto bíblico offline (Fase 3B, PR 7). O service worker (vite.config.js) responde `/bible/<versão>/<n>.json` pelo cache `bible-text-v1`; aqui o
// usuário escolhe versões para baixar de uma vez (ou remover). Só texto público: o Pro offline é outra etapa e nunca passa por este cache.
import { useCallback, useEffect, useState } from 'react';

export const BIBLE_CACHE = 'bible-text-v1';
export const BOOKS = 66;
const CONCURRENCY = 4;

export const offlineSupported = () => typeof caches !== 'undefined' && typeof navigator !== 'undefined' && 'serviceWorker' in navigator;

// Quantos livros de cada versão estão no cache (puro: recebe as URLs guardadas).
export function countByVersion(urls, ids) {
  const out = Object.fromEntries(ids.map((id) => [id, new Set()]));
  for (const u of urls) {
    const m = /\/bible\/([^/]+)\/(\d+)\.json(?:$|\?)/.exec(u);
    if (m && out[m[1]]) out[m[1]].add(Number(m[2]));
  }
  return Object.fromEntries(ids.map((id) => [id, out[id].size]));
}

export async function readCounts(ids, store = typeof caches !== 'undefined' ? caches : null) {
  if (!store) return Object.fromEntries(ids.map((id) => [id, 0]));
  const c = await store.open(BIBLE_CACHE);
  return countByVersion((await c.keys()).map((r) => r.url), ids);
}

// Baixa os 66 livros de uma versão. `onProgress(feitos)`; `signal` cancela. Os que já estão no cache não são baixados de novo.
export async function downloadVersion(id, { base = '', onProgress, signal, store = caches, fetcher = fetch } = {}) {
  const c = await store.open(BIBLE_CACHE);
  let done = 0;
  let next = 1;
  const worker = async () => {
    while (next <= BOOKS) {
      if (signal?.aborted) return;
      const n = next++;
      const url = `${base}bible/${id}/${n}.json`;
      if (!(await c.match(url))) {
        const r = await fetcher(url, signal ? { signal } : undefined);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        await c.put(url, r.clone());
      }
      done += 1;
      onProgress?.(done);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  if (signal?.aborted) throw new DOMException('cancelado', 'AbortError');
}

export async function removeVersion(id, store = caches) {
  const c = await store.open(BIBLE_CACHE);
  for (const r of await c.keys()) if (new RegExp(`/bible/${id}/\\d+\\.json`).test(r.url)) await c.delete(r);
}

// Pede ao navegador que não apague o armazenamento sozinho (o iOS e o Android podem recusar).
export async function askPersist() {
  try { return (await navigator.storage?.persist?.()) ?? false; } catch { return false; }
}

export const isIOS = () => typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent);
export const isStandalone = () => typeof window !== 'undefined' && (window.navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true);

// Estado do cartão: { counts, progress: {id: feitos}, error, start(id), startAll(), cancel(), remove(id) }
export function useOfflineBibles(ids) {
  const key = ids.join(',');
  const [counts, setCounts] = useState({});
  const [progress, setProgress] = useState({});
  const [error, setError] = useState(null);
  const [ctrl, setCtrl] = useState(null);
  const refresh = useCallback(() => readCounts(key.split(',')).then(setCounts).catch(() => {}), [key]);
  useEffect(() => { if (offlineSupported()) refresh(); }, [refresh]);

  const run = async (list) => {
    const ac = new AbortController();
    setCtrl(ac);
    setError(null);
    askPersist();
    try {
      for (const id of list) {
        if (ac.signal.aborted) break;
        setProgress((p) => ({ ...p, [id]: 0 }));
        try { await downloadVersion(id, { base: import.meta.env.BASE_URL, signal: ac.signal, onProgress: (n) => setProgress((p) => ({ ...p, [id]: n })) }); }
        finally { setProgress((p) => { const { [id]: _, ...rest } = p; return rest; }); await refresh(); }
      }
    } catch (e) {
      if (e?.name !== 'AbortError') setError(e?.message || 'erro');
    } finally { setCtrl(null); }
  };
  return {
    counts, progress, error, busy: !!ctrl,
    start: (id) => run([id]),
    startAll: () => run(ids.filter((id) => (counts[id] ?? 0) < BOOKS)),
    cancel: () => ctrl?.abort(),
    remove: async (id) => { await removeVersion(id); await refresh(); },
  };
}
