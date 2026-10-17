// Rotas por hash: parte pura (sem navegador), usada por route.js e testada em Node (scripts/test-reader-marks.mjs). Formatos em route.js.
const TABS = ['summary', 'map', 'psalms', 'structure', 'read'];
const TAB_ALIAS = { sheet: 'summary' }; // endereços antigos (#joh/sheet) abrem a aba única

// `isBook(slug)`: o slug existe? (route.js passa os livros do app; os testes passam uma lista)
export function parseHash(hash, isBook) {
  const parts = hash.replace(/^#\/?/, '').split('/').map((x) => { try { return decodeURIComponent(x); } catch { return x; } });
  const [a, b, c, d] = parts;
  if (a === 'timeline') return { kind: 'timeline', id: b || null };
  if (a === 'person') return { kind: 'person', id: b || null };
  if (a === 'favorites') return { kind: 'favorites', tab: b === 'verses' ? 'verses' : b === 'items' ? 'items' : null }; // null = a tela escolhe (Versículos se há marcações)
  if (a === 'studies') return { kind: 'studies', id: b || null };
  if (a === 'settings') return { kind: 'settings', view: b === 'reading' ? 'reading' : 'main' };
  if (a === 'profile') return { kind: 'profile' };
  if (a === 'admin') return { kind: 'admin' };
  if (a === 'checkout') return { kind: 'checkout' };
  if (a === 'terms') return { kind: 'terms' };
  if (a === 'privacy') return { kind: 'privacy' };
  if (a === 'tree') return { kind: 'tree', id: b || null, node: c || null };
  if (isBook(a)) {
    const verse = /^\d{1,3}$/.test(d ?? '') && Number(d) >= 1 && Number(d) <= 176 ? Number(d) : null; // #joh/read/3/16: capítulo 3, versículo 16 em foco
    return { kind: 'book', slug: a, tab: TABS.includes(b) ? b : TAB_ALIAS[b] ?? 'summary', place: c || null, verse: b === 'read' ? verse : null };
  }
  return { kind: 'home' };
}

export const hrefs = {
  home: '#',
  book: (slug, tab, place, verse) => `#${slug}${tab && tab !== 'summary' ? `/${tab}${place ? `/${encodeURIComponent(place)}${tab === 'read' && verse ? `/${verse}` : ''}` : ''}` : ''}`,
  timeline: (id) => (id ? `#timeline/${id}` : '#timeline'),
  person: (id) => (id ? `#person/${id}` : '#person'),
  favorites: '#favorites',
  favoritesVerses: '#favorites/verses',
  studies: (id) => (id ? `#studies/${id}` : '#studies'),
  settings: '#settings',
  readingSettings: '#settings/reading',
  profile: '#profile',
  admin: '#admin',
  checkout: '#checkout/retorno',
  terms: '#terms',
  privacy: '#privacy',
  tree: (id = 'adao-jesus', node) => `#tree/${id}${node ? `/${node}` : ''}`,
};

