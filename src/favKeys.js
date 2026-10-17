// Chaves de favorito (strings estáveis) e seu desmonte. Módulo puro, sem armazenamento: o `npm run check` também o usa.
//   livro: book:<slug>   capítulo: chapter:<slug>:<n>   personagem: person:<id>   lugar do mapa: place:<slug>:<nome em PT>
// Itens de estudo (preparação de estudos; NÃO são favoritos): mais as chaves
//   passagem: ref:<slug>:<cap>:<v1>[-<v2>]   versículo: verse:<slug>:<cap>:<v>   evento da linha do tempo: event:<id>
// O formato é o mesmo aceito pelo banco (study_items_valid em supabase/migrations/20261020000000_estudos_marcacoes.sql).
export const favKey = {
  book: (slug) => `book:${slug}`,
  chapter: (slug, n) => `chapter:${slug}:${n}`,
  person: (id) => `person:${id}`,
  place: (slug, namePt) => `place:${slug}:${namePt}`,
  ref: (slug, chapter, v1, v2) => (v2 && v2 !== v1 ? `ref:${slug}:${chapter}:${v1}-${v2}` : `ref:${slug}:${chapter}:${v1}`),
  verse: (slug, chapter, v) => `verse:${slug}:${chapter}:${v}`,
  event: (id) => `event:${id}`,
};

// Devolve { type, slug?, n?, id?, name?, v1?, v2?, v? } ou null se a chave não tem um formato conhecido.
export function parseFavKey(key) {
  if (typeof key !== 'string') return null;
  const i = key.indexOf(':');
  if (i < 1) return null;
  const type = key.slice(0, i);
  const rest = key.slice(i + 1);
  if (type === 'book') return rest ? { type, slug: rest } : null;
  if (type === 'person') return rest ? { type, id: rest } : null;
  if (type === 'chapter') {
    const m = /^([^:]+):(\d+)$/.exec(rest);
    return m ? { type, slug: m[1], n: Number(m[2]) } : null;
  }
  if (type === 'ref') {
    const m = /^([^:]+):(\d+):(\d+)(?:-(\d+))?$/.exec(rest);
    return m ? { type, slug: m[1], n: Number(m[2]), v1: Number(m[3]), v2: m[4] ? Number(m[4]) : Number(m[3]) } : null;
  }
  if (type === 'verse') {
    const m = /^([^:]+):(\d+):(\d+)$/.exec(rest);
    return m ? { type, slug: m[1], n: Number(m[2]), v: Number(m[3]) } : null;
  }
  if (type === 'event') return rest ? { type, id: rest } : null;
  if (type === 'place') {
    const j = rest.indexOf(':'); // o nome em PT pode conter ":"; o slug não
    return j > 0 && rest.slice(j + 1) ? { type, slug: rest.slice(0, j), name: rest.slice(j + 1) } : null;
  }
  return null;
}

// Tipos que aparecem em Favoritos (as marcações de versículo têm tabela própria; ref, verse e event só existem como itens de estudo)
export const FAV_TYPES = ['book', 'chapter', 'person', 'place'];
export const ITEM_TYPES = ['ref', 'verse', 'event', 'book', 'chapter', 'person', 'place'];
