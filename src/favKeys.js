// Chaves de favorito (strings estáveis) e seu desmonte. Módulo puro, sem armazenamento: o `npm run check` também o usa.
//   livro: book:<slug>   capítulo: chapter:<slug>:<n>   personagem: person:<id>   lugar do mapa: place:<slug>:<nome em PT>
export const favKey = {
  book: (slug) => `book:${slug}`,
  chapter: (slug, n) => `chapter:${slug}:${n}`,
  person: (id) => `person:${id}`,
  place: (slug, namePt) => `place:${slug}:${namePt}`,
};

// Devolve { type, slug?, n?, id?, name? } ou null se a chave não tem um formato conhecido.
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
  if (type === 'place') {
    const j = rest.indexOf(':'); // o nome em PT pode conter ":"; o slug não
    return j > 0 && rest.slice(j + 1) ? { type, slug: rest.slice(0, j), name: rest.slice(j + 1) } : null;
  }
  return null;
}

export const FAV_TYPES = ['book', 'chapter', 'person', 'place'];
