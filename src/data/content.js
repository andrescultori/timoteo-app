// Ponto único de carregamento do conteúdo "de estudo" (personagens, linha do tempo, genealogia, fichas com mapa/estrutura).
// Duas origens, escolhidas no BUILD por VITE_PRO_SOURCE (vite.config.js):
//   storage → PADRÃO do `vite build`: o site público não leva o Pro (o build o tira dos JSONs); ele chega do Supabase Storage (bucket
//             privado `pro`), só para quem o banco autoriza. Personagens Pro só com nome e livros; fichas sem mapa/estrutura Pro e sem
//             posição acadêmica.
//   local   → PADRÃO do `vite dev`: tudo vem dos arquivos, como sempre. Um build de produção `local` só com ALLOW_LOCAL_PRO=1 (testes).
// Nenhuma tela importa os JSONs Pro diretamente: tudo passa por aqui, de forma assíncrona. A lógica está em contentCore.js (testada em Node).
import { useEffect, useSyncExternalStore } from 'react';
import plans from './plans.json';
import flags from './content-flags.json';
import { createContent } from './contentCore.js';

export const SOURCE = import.meta.env?.VITE_PRO_SOURCE === 'storage' ? 'storage' : 'local';
export const hasProMap = (slug) => flags.map.includes(slug);
export const hasProStructure = (slug) => flags.structure.includes(slug);

// ---- instância do app ----
const INFO = import.meta.glob('./info/*.json');
const content = createContent({
  source: SOURCE,
  ess: plans.essencial,
  flags,
  publicLoaders: {
    people: () => import('./people.json').then((m) => m.people),
    timeline: () => import('./timeline.json').then((m) => m.default),
    genealogy: () => import('./genealogia.json').then((m) => m.default),
    info: (slug) => { const f = INFO[`./info/${slug}.json`]; return f ? f().then((m) => m.default) : Promise.resolve(null); },
  },
  fetchPro: (key) => import('./proStorage.js').then((m) => m.fetchProKey(key)),
});
export const hasInfoFile = (slug) => `./info/${slug}.json` in INFO;

export const setAccess = content.setAccess;
// avisa quando o acesso (usuário, nível, pronto) muda; devolve a função para cancelar
export const onAccessChange = (fn) => { let last = content.accessId(); return content.subscribe(() => { const k = content.accessId(); if (k !== last) { last = k; fn(); } }); };
export const loadContent = content.load;
export const loadInfo = content.loadInfo;
export const getInfoNow = content.infoNow;
export const getPeople = () => content.get('people');
export const getTimeline = () => content.get('timeline');
export const getGenealogyData = () => content.get('genealogy');

// { ready, error }: `ready` quando tudo o que foi pedido já chegou para o acesso atual. Recarrega sozinho se o acesso mudar (login, logout, plano).
export function useContent(...keys) {
  useSyncExternalStore(content.subscribe, content.version, content.version);
  const ready = content.isReady(keys);
  const error = !ready && content.hasFailed(keys);
  useEffect(() => {
    if (!ready && !error && content.canLoad()) content.load(...keys).catch(() => {});
  }); // a cada render até ficar pronto (o `memo` evita cargas repetidas)
  return { ready, error };
}

// Ficha do livro: { info, error } (null enquanto carrega); recarrega quando o acesso muda.
export function useInfoContent(slug) {
  useSyncExternalStore(content.subscribe, content.version, content.version);
  const info = content.canLoad() ? content.infoNow(slug) ?? null : null;
  const error = content.infoFailed(slug);
  useEffect(() => {
    if (info === null && !error && content.canLoad()) content.loadInfo(slug).catch(() => {});
  });
  return { info, error };
}
