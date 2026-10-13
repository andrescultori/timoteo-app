// Ponto único de carregamento do conteúdo "de estudo" (personagens, linha do tempo, genealogia, fichas).
// Hoje as fontes são arquivos do próprio pacote, carregados sob demanda (chunk separado, só quando alguém abre a tela). A Fase 3B troca
// SÓ as funções `loaders` por leitura do Supabase (Storage privado); as telas já pedem tudo por aqui, de forma assíncrona, e nenhuma
// importa mais esses JSONs estaticamente. Conteúdo público e enxuto (nomes e livros dos personagens) vem de `people-index.json`.
import { useEffect, useState } from 'react';

const loaders = {
  people: () => import('./people.json').then((m) => m.people),
  timeline: () => import('./timeline.json').then((m) => m.default),
  genealogy: () => import('./genealogia.json').then((m) => m.default),
};

const cache = {};
const pending = {};

export function loadContent(...keys) {
  return Promise.all(keys.map((k) => {
    if (k in cache) return cache[k];
    if (!loaders[k]) throw new Error(`conteúdo desconhecido: ${k}`);
    pending[k] ??= loaders[k]().then((v) => { cache[k] = v; return v; }, (e) => { delete pending[k]; throw e; });
    return pending[k];
  }));
}

const ready = (keys) => keys.every((k) => k in cache);

// `true` quando todos os conteúdos pedidos já chegaram (síncrono se já estavam em cache); `error` se alguma carga falhou.
export function useContent(...keys) {
  const [, tick] = useState(0);
  const [error, setError] = useState(false);
  const id = keys.join('|');
  useEffect(() => {
    if (ready(keys)) return undefined;
    let alive = true;
    loadContent(...keys).then(() => alive && tick((n) => n + 1), () => alive && setError(true));
    return () => { alive = false; };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  return { ready: ready(keys), error };
}

const need = (k) => { if (!(k in cache)) throw new Error(`conteúdo ${k} ainda não carregado (use useContent/loadContent)`); return cache[k]; };
export const getPeople = () => need('people');
export const getTimeline = () => need('timeline');
export const getGenealogyData = () => need('genealogy');

let byIdCache = null;
export function getPeopleById() {
  const list = getPeople();
  if (!byIdCache || byIdCache.list !== list) byIdCache = { list, map: Object.fromEntries(list.map((p) => [p.id, p])) };
  return byIdCache.map;
}
