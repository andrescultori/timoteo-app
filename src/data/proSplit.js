// Separação do conteúdo Pro e da posição acadêmica (funções puras, sem rede e sem fs). Usadas pelo app (src/data/content.js) e pelos
// scripts (scripts/pro-lib.mjs, `npm run check` e `npm test`). A mesma regra monta o pacote Pro e o "pacote público" no navegador.

const clone = (o) => JSON.parse(JSON.stringify(o));
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// Remove (1) toda propriedade `scholarly` e (2) todo item de lista com `view: 'scholarly'` (leituras da aba Estrutura).
// Devolve { doc, extras }; cada extra guarda o caminho e o valor para restaurar exatamente (itens, pela posição original).
export function stripScholarly(input) {
  const doc = clone(input);
  const extras = [];
  (function walk(node, pth) {
    if (Array.isArray(node)) {
      const keep = [];
      node.forEach((v, i) => {
        if (isObj(v) && v.view === 'scholarly') extras.push({ path: pth, index: i, value: v });
        else keep.push(v);
      });
      node.length = 0;
      node.push(...keep);
      node.forEach((v, i) => walk(v, [...pth, i]));
    } else if (isObj(node)) {
      for (const k of Object.keys(node)) {
        if (k === 'scholarly') { extras.push({ path: pth, key: k, value: node[k] }); delete node[k]; } else walk(node[k], [...pth, k]);
      }
    }
  })(doc, []);
  return { doc, extras };
}

const at = (doc, pth) => pth.reduce((n, k) => n[k], doc);
export function restoreScholarly(input, extras) {
  const doc = clone(input);
  for (const e of extras.filter((x) => 'key' in x)) at(doc, e.path)[e.key] = clone(e.value);
  for (const e of extras.filter((x) => 'index' in x).sort((a, b) => a.index - b.index)) at(doc, e.path).splice(e.index, 0, clone(e.value));
  return doc;
}

// Ficha: separa o que é Pro (`map` e `structure`, menos os do Essencial) da parte pública (sem posição acadêmica).
// `ess` = plans.json → essencial ({ mapBooks, structureBooks, characters }). Devolve { rest, part, extras }.
export function splitInfo(slug, info, ess) {
  const { doc, extras } = stripScholarly(info);
  const rest = { ...doc };
  const part = {};
  if ('map' in rest && !ess.mapBooks.includes(slug)) { part.map = rest.map; delete rest.map; }
  if ('structure' in rest && !ess.structureBooks.includes(slug)) { part.structure = rest.structure; delete rest.structure; }
  return { rest, part, extras };
}

// Personagem reduzido ao que o Essencial vê de um personagem Pro bloqueado: nome e livros (sem papel, resumo, bio, eventos nem lugares).
export const litePerson = (p) => ({ id: p.id, name: p.name, books: p.books.map((b) => ({ book: b.book })) });
// Lista pública: os do Essencial completos, os demais reduzidos.
export const publicPeople = (people, ess) => people.map((p) => (ess.characters.includes(p.id) ? p : litePerson(p)));
