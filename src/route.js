import { bySlug } from './data/books.js';

// Rotas por hash, para o botão voltar do navegador e os links compartilháveis funcionarem sem biblioteca:
//   #                       início (grade)
//   #joh  #joh/read         livro (e aba: summary | sheet | map | read)
//   #2ki/map/Laquis         livro, aba Mapa, lugar selecionado (nome em PT)
//   #psa/psalms/51  #psa/read/23   Salmos: aba da tabela com o salmo selecionado; leitor no capítulo
//   #timeline  #timeline/exodo     linha do tempo (e evento em foco)
//   #person  #person/davi          personagens (e pessoa)
//   #favorites                     meus favoritos
//   #profile                       meu perfil (conta)
//   #terms  #privacy               Termos de Uso e Política de Privacidade
//   #checkout/retorno              volta do pagamento no Mercado Pago (o servidor confere; a URL não libera nada)
//   #tree/adao-jesus  #tree/adao-jesus/mt-salomao   genealogia (árvore e nó em foco)
const TABS = ['summary', 'sheet', 'map', 'psalms', 'structure', 'read'];

export function parseHash(hash = location.hash) {
  const parts = hash.replace(/^#\/?/, '').split('/').map((x) => { try { return decodeURIComponent(x); } catch { return x; } });
  const [a, b, c] = parts;
  if (a === 'timeline') return { kind: 'timeline', id: b || null };
  if (a === 'person') return { kind: 'person', id: b || null };
  if (a === 'favorites') return { kind: 'favorites' };
  if (a === 'profile') return { kind: 'profile' };
  if (a === 'checkout') return { kind: 'checkout' };
  if (a === 'terms') return { kind: 'terms' };
  if (a === 'privacy') return { kind: 'privacy' };
  if (a === 'tree') return { kind: 'tree', id: b || null, node: c || null };
  if (bySlug[a]) return { kind: 'book', slug: a, tab: TABS.includes(b) ? b : 'summary', place: c || null };
  return { kind: 'home' };
}

export const hrefs = {
  home: '#',
  book: (slug, tab, place) => `#${slug}${tab && tab !== 'summary' ? `/${tab}${place ? `/${encodeURIComponent(place)}` : ''}` : ''}`,
  timeline: (id) => (id ? `#timeline/${id}` : '#timeline'),
  person: (id) => (id ? `#person/${id}` : '#person'),
  favorites: '#favorites',
  profile: '#profile',
  checkout: '#checkout/retorno',
  terms: '#terms',
  privacy: '#privacy',
  tree: (id = 'adao-jesus', node) => `#tree/${id}${node ? `/${node}` : ''}`,
};

// Volta do Mercado Pago: o back_url é `<app>/?checkout=success|pending|failure` (mais o que o Mercado Pago acrescentar).
// Vira a rota #checkout/retorno e guarda só a referência do pagamento (id nosso, validado de novo no servidor). O status da URL é ignorado.
try {
  const q = new URLSearchParams(location.search);
  if (q.has('checkout')) {
    const ref = q.get('external_reference');
    if (ref && /^[0-9a-f-]{36}$/i.test(ref)) sessionStorage.setItem('checkoutRef', ref.toLowerCase());
    history.replaceState(null, '', `${location.pathname}#checkout/retorno`);
  }
} catch { /* sem sessionStorage ou history: segue sem a referência */ }

// Navegar adiciona uma entrada ao histórico (o botão voltar funciona). Trocar o hash pela mesma rota não faz nada.
// Posição na pilha de navegação do app (guardada em history.state): serve para o botão Voltar saber se há para onde voltar.
let idx = history.state?.i ?? 0;
history.replaceState({ ...history.state, i: idx }, '');
window.addEventListener('hashchange', () => {
  if (history.state?.i == null) { idx += 1; history.replaceState({ ...history.state, i: idx }, ''); } else idx = history.state.i;
});
export const canGoBack = () => idx > 0;
// Voltar à página anterior do app; sem histórico (link aberto direto), vai para o início.
export const goBack = () => { if (idx > 0) history.back(); else location.hash = '#'; };

export const go = (hash) => { if (location.hash !== hash && !(hash === '#' && !location.hash)) location.hash = hash; };
// Ajuste dentro da mesma página (troca de aba, lugar selecionado): atualiza o link sem criar entrada no histórico.
export const sync = (hash) => { history.replaceState({ i: idx }, '', hash === '#' ? location.pathname + location.search : hash); };
