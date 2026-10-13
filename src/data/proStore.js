// Armazenamento do conteúdo Pro offline: IndexedDB (banco `timoteo-pro`; `files` = chave → JSON, `meta` = um registro). Sem IndexedDB (ou erro)
// devolve null e o recurso fica indisponível. Nunca usado sem login Pro: quem limpa é src/data/proOffline.js.
const DB = 'timoteo-pro';
const req = (r) => new Promise((ok, no) => { r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });

export function openProStore() {
  if (typeof indexedDB === 'undefined') return null;
  let dbp = null;
  const db = () => dbp ??= new Promise((ok, no) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('files'); r.result.createObjectStore('meta'); };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => { dbp = null; no(r.error); };
  });
  const tx = async (name, mode, fn) => { const d = await db(); const t = d.transaction(name, mode); const out = await fn(t.objectStore(name)); await new Promise((ok, no) => { t.oncomplete = ok; t.onerror = () => no(t.error); t.onabort = () => no(t.error); }); return out; };
  return {
    getMeta: () => tx('meta', 'readonly', (s) => req(s.get('meta'))).then((v) => v ?? null),
    setMeta: (v) => tx('meta', 'readwrite', (s) => { s.put(v, 'meta'); }),
    get: (k) => tx('files', 'readonly', (s) => req(s.get(k))),
    put: (k, v) => tx('files', 'readwrite', (s) => { s.put(v, k); }),
    delete: (k) => tx('files', 'readwrite', (s) => { s.delete(k); }),
    clear: async () => { await tx('files', 'readwrite', (s) => { s.clear(); }); await tx('meta', 'readwrite', (s) => { s.clear(); }); },
  };
}
