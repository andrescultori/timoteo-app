// Personagens citados pelo nome em cada capítulo (aba Ler: "Personagens neste capítulo"). Dados em people-chapters.json,
// gerado por scripts/build-people-chapters.mjs; formato em docs/formatos-de-dados.md. Carregado sob demanda (fora do bundle inicial).
// Linha de dado: { personId: { livro: [[capítulo, ocorrências, 1º versículo], ...] } } (1º versículo 0 = título de salmo; ocorrências 0 = incluído à mão).

let loading = null;
export function loadPeopleChapters() {
  loading ??= import('./data/people-chapters.json').then((m) => m.default ?? m);
  return loading;
}

// Índice invertido livro → capítulo → [[id, ocorrências, 1º versículo]], montado uma vez por conjunto de dados
const cache = new WeakMap();
function byChapter(data) {
  let idx = cache.get(data);
  if (idx) return idx;
  idx = {};
  for (const [id, books] of Object.entries(data)) {
    for (const [book, rows] of Object.entries(books)) {
      const b = (idx[book] ??= {});
      for (const [ch, n, first] of rows) (b[ch] ??= []).push([id, n, first]);
    }
  }
  for (const b of Object.values(idx)) {
    for (const list of Object.values(b)) list.sort((x, y) => y[1] - x[1] || x[2] - y[2] || (x[0] < y[0] ? -1 : 1)); // mais citados, depois o que aparece antes
  }
  cache.set(data, idx);
  return idx;
}

// Versão síncrona, para quem já tem os dados (testes, componentes que carregaram com loadPeopleChapters)
export function peopleInChapterFrom(data, book, chapter, limit) {
  const ids = (byChapter(data)[book]?.[chapter] ?? []).map((x) => x[0]);
  return limit ? ids.slice(0, limit) : ids;
}
// O livro tem algum dado de capítulo? (Eclesiastes, Cantares, Lamentações e 2 João não têm)
export const bookHasChapters = (data, book) => Boolean(byChapter(data)[book]);
export function chaptersOfPersonFrom(data, id, book) {
  return (data[id]?.[book] ?? []).map((r) => r[0]);
}

// ids dos personagens citados no capítulo, mais citados primeiro (empate: o que aparece antes; depois id)
export async function peopleInChapter(book, chapter, limit) {
  return peopleInChapterFrom(await loadPeopleChapters(), book, chapter, limit);
}
// capítulos do livro em que o personagem é citado
export async function chaptersOfPerson(id, book) {
  return chaptersOfPersonFrom(await loadPeopleChapters(), id, book);
}
