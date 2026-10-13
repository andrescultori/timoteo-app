// Núcleo do carregamento do conteúdo "de estudo" (sem React nem Vite: testável em Node; ver scripts/test-content.mjs).
// A instância do app e os hooks ficam em src/data/content.js.
import { splitInfo, publicPeople, restoreScholarly } from './proSplit.js';

const EMPTY = { timeline: { blocks: [], periods: [], events: [] }, genealogy: { trees: [], nodes: {}, links: [] } };

// `publicLoaders`: { people(), timeline(), genealogy(), info(slug) }; `fetchPro(key)`: JSON | null (sem acesso) | lança (rede/servidor).
export function createContent({ source, ess, flags, publicLoaders, fetchPro }) {
  const hasProMap = (slug) => flags.map.includes(slug);
  const hasProStructure = (slug) => flags.structure.includes(slug);
  let access = { userId: null, level: 'none', ready: true }; // level: none | pro | admin
  let version = 0;
  let cache = new Map(); // chave → Promise
  let values = new Map(); // chave → valor já carregado
  let failed = new Map(); // chave → erro (não repete sozinho; muda o acesso ou recarrega a página)
  const listeners = new Set();
  const accessKey = () => `${access.userId}|${access.level}`;
  const fullKey = (key) => `${source === 'storage' ? accessKey() : '-'}|${key}`;
  const bump = () => { version += 1; listeners.forEach((fn) => fn()); };
  const memo = (key, make) => {
    const full = fullKey(key);
    if (!cache.has(full)) {
      const p = make().then(
        (v) => { if (cache.get(full) === p) { values.set(full, v); bump(); } return v; },
        (e) => { if (cache.get(full) === p) { failed.set(full, e); bump(); } throw e; },
      );
      cache.set(full, p);
    }
    return cache.get(full);
  };
  const value = (key) => values.get(fullKey(key));
  const adminBundle = () => memo('admin', async () => (access.level === 'admin' ? fetchPro('admin/scholarly.json') : null));

  const loaders = {
    people: async () => {
      if (source === 'local') return publicLoaders.people();
      const pub = publicPeople(await publicLoaders.people(), ess);
      if (access.level === 'none') return pub;
      const full = await fetchPro('people.json');
      if (!full) return pub;
      const byId = new Map(full.map((p) => [p.id, p]));
      return pub.map((p) => byId.get(p.id) ?? p);
    },
    timeline: async () => {
      if (source === 'local') return publicLoaders.timeline();
      if (access.level === 'none') return EMPTY.timeline;
      const tl = await fetchPro('timeline.json');
      if (!tl) return EMPTY.timeline;
      const sch = await adminBundle();
      return sch ? restoreScholarly(tl, sch.timeline) : tl;
    },
    genealogy: async () => {
      if (source === 'local') return publicLoaders.genealogy();
      if (access.level === 'none') return EMPTY.genealogy;
      return (await fetchPro('genealogy.json')) ?? EMPTY.genealogy;
    },
  };

  const load = (...keys) => Promise.all(keys.map((k) => { if (!loaders[k]) throw new Error(`conteúdo desconhecido: ${k}`); return memo(k, loaders[k]); }));

  // Ficha do livro. Em `storage`: parte pública (sem mapa/estrutura Pro nem posição acadêmica) + parte Pro, se o banco autorizar.
  const loadInfo = (slug) => memo(`info:${slug}`, async () => {
    const info = await publicLoaders.info(slug);
    if (!info || source === 'local') return info;
    let { rest: out } = splitInfo(slug, info, ess);
    if (access.level !== 'none' && (hasProMap(slug) || hasProStructure(slug))) out = { ...out, ...((await fetchPro(`info/${slug}.json`)) ?? {}) };
    const sch = await adminBundle();
    if (sch?.info?.[slug]) out = restoreScholarly(out, sch.info[slug]);
    return out;
  });

  return {
    load,
    loadInfo,
    canLoad: () => source === 'local' || access.ready,
    isReady: (keys) => (source === 'local' || access.ready) && keys.every((k) => values.has(fullKey(k))),
    hasFailed: (keys) => keys.some((k) => failed.has(fullKey(k))),
    get: (k) => { const v = value(k); if (v === undefined) throw new Error(`conteúdo ${k} ainda não carregado (use useContent/load)`); return v; },
    infoNow: (slug) => value(`info:${slug}`),
    infoFailed: (slug) => failed.has(fullKey(`info:${slug}`)),
    setAccess(next) {
      const before = `${accessKey()}|${access.ready}`;
      access = { ...access, ...next };
      if (source === 'storage' && `${accessKey()}|${access.ready}` !== before) { cache = new Map(); values = new Map(); failed = new Map(); bump(); }
    },
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    version: () => version,
    accessId: () => `${accessKey()}|${access.ready}`,
  };
}
