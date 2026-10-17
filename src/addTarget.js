import { useSyncExternalStore } from 'react';
// Estudo de destino do leitor ("Adicionando a: <estudo>"): guardado em sessionStorage (só nesta aba, some ao fechar). Tudo em try/catch.
// Puro o bastante para testar em Node: o armazenamento é injetável (scripts/test-richtext.mjs).
const KEY = 'studyAddTarget';
const listeners = new Set();
let mem = null; // reserva quando o sessionStorage não existe

const store = () => { try { return globalThis.sessionStorage ?? null; } catch { return null; } };
export function getAddTarget() {
  try {
    const s = store();
    const raw = s ? s.getItem(KEY) : mem;
    return typeof raw === 'string' && /^[0-9a-f-]{36}$/i.test(raw) ? raw.toLowerCase() : null;
  } catch { return null; }
}
export function setAddTarget(id) {
  try { const s = store(); if (s) s.setItem(KEY, id); else mem = id; } catch { mem = id; }
  listeners.forEach((f) => f());
}
export function clearAddTarget() {
  try { const s = store(); if (s) s.removeItem(KEY); } catch { /* ignora */ }
  mem = null;
  listeners.forEach((f) => f());
}
export const subscribeAddTarget = (f) => { listeners.add(f); return () => listeners.delete(f); };

// Onde "Ir ao texto" abre o leitor: o texto-base do estudo (1º item de passagem ou capítulo), senão a última posição de leitura, senão Gênesis 1.
export function readerSpot(study, describeItem, position) {
  for (const it of study?.items ?? []) {
    const d = describeItem(it.k, study.template);
    if (d.kind === 'passage' || d.kind === 'chapter') return { slug: d.slug, chapter: d.chapter };
  }
  if (position?.slug && position?.chapter) return { slug: position.slug, chapter: position.chapter };
  return { slug: 'gen', chapter: 1 };
}

export const useAddTarget = () => useSyncExternalStore(subscribeAddTarget, getAddTarget, getAddTarget);
