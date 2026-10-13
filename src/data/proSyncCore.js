// Núcleo do conteúdo Pro offline (Fase 3B, PR 8): copia o pacote Pro do Storage para o aparelho e o lê de volta, sem rede nem React (testável em Node;
// ver scripts/test-pro-offline.mjs). `store`: { getMeta, setMeta, get, put, delete, clear }; `fetchNet(key)`: JSON | null (sem acesso) | lança.
// Regras: só para quem tem acesso (level pro/admin) e só para o MESMO usuário que baixou; `admin/*` só para admin; sync incremental por sha256 do
// manifest; sem acesso (plano vencido, logout, outro usuário) o que está no aparelho é apagado. A janela de graça de 14 dias é a do plano guardado
// (src/plan.js): passou dela o nível volta a `none` e o glue (proOffline.js) apaga.
const CONCURRENCY = 4;

export function createProSync({ store, fetchNet, now = Date.now }) {
  const usable = (meta, access) => !!meta && !!access?.level && access.level !== 'none' && meta.userId === access.userId;

  return {
    meta: () => store.getMeta(),
    // Valor guardado (ou undefined se não há cópia válida para este acesso).
    async read(key, access) {
      const meta = await store.getMeta();
      if (!usable(meta, access)) return undefined;
      if (key.startsWith('admin/') && access.level !== 'admin') return undefined;
      return store.get(key);
    },
    clear: async () => { await store.clear(); },
    async sync(access, { onProgress, signal } = {}) {
      if (!access?.userId || !access.level || access.level === 'none') return { status: 'denied' };
      const mf = await fetchNet('manifest.json');
      if (!mf?.files) { await store.clear(); return { status: 'denied' }; }
      let meta = await store.getMeta();
      if (meta && meta.userId !== access.userId) { await store.clear(); meta = null; }
      const files = { ...(meta?.files ?? {}) };
      const wanted = Object.entries(mf.files).filter(([k]) => access.level === 'admin' || !k.startsWith('admin/'));
      const wantedSet = new Set(wanted.map(([k]) => k));
      const todo = wanted.filter(([k, v]) => files[k]?.sha256 !== v.sha256);
      const stale = Object.keys(files).filter((k) => !wantedSet.has(k));
      let done = 0;
      let next = 0;
      const total = todo.length;
      onProgress?.(0, total);
      const worker = async () => {
        while (next < todo.length) {
          if (signal?.aborted) return;
          const [k, v] = todo[next++];
          const data = await fetchNet(k);
          if (data == null) throw new Error(`sem acesso a ${k}`);
          await store.put(k, data);
          files[k] = { sha256: v.sha256, bytes: v.bytes };
          done += 1;
          onProgress?.(done, total);
        }
      };
      const save = () => store.setMeta({ userId: access.userId, level: access.level, files, syncedAt: meta?.syncedAt ?? null });
      try {
        await Promise.all(Array.from({ length: CONCURRENCY }, worker));
      } catch (e) { await save(); throw e; }
      for (const k of stale) { await store.delete(k); delete files[k]; }
      if (signal?.aborted) { await save(); throw new DOMException('cancelado', 'AbortError'); }
      await store.setMeta({ userId: access.userId, level: access.level, files, syncedAt: now(), totalBytes: wanted.reduce((s, [, v]) => s + (v.bytes ?? 0), 0) });
      return { status: 'ok', downloaded: done, removed: stale.length, total: wanted.length };
    },
  };
}
