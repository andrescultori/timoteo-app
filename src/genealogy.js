import { bySlug } from './data/books.js';
import { pick } from './timelineUtil.js';
import { getGenealogyData, getPeople } from './data/content.js';

// Genealogia: nós e ligações pai → filho (cada ligação com referências bíblicas). Usada pela página da árvore e pelo bloco "Família" do personagem.
// Os dados chegam por src/data/content.js (assíncrono): chame `genealogy()` só depois de `useContent('genealogy', 'people')` estar pronto.
// "Gn 5:3 · Lc 3:38"
export const refsText = (refs, lang) => refs.map((r) => `${bySlug[r.book].ab[lang]} ${r.ref}`).join(' · ');

let memo = null;
export function genealogy() {
  const g = getGenealogyData();
  const people = getPeople();
  if (memo && memo.g === g && memo.people === people) return memo.api;
  const { trees, nodes } = g;
  const personById = Object.fromEntries(people.map((p) => [p.id, p]));
  const parentLink = {};
  const childLinks = {};
  for (const l of g.links) {
    parentLink[l.to] = l;
    (childLinks[l.from] ??= []).push(l);
  }
  const parentOf = (id) => parentLink[id] ?? null;
  const childrenOf = (id) => childLinks[id] ?? [];
  const nodesOfPerson = (personId) => Object.keys(nodes).filter((id) => nodes[id].personId === personId);
  const hasAncestor = (id, root) => {
    for (let l = parentLink[id]; l; l = parentLink[l.from]) if (l.from === root) return true;
    return false;
  };
  const treeOf = (nodeId) => trees.find((tr) => nodeId === tr.root || hasAncestor(nodeId, tr.root)) ?? trees[0];
  const nodeName = (id, lang) => pick(nodes[id].name, lang);
  const api = { trees, nodes, personById, parentOf, childrenOf, nodesOfPerson, treeOf, nodeName, refsText };
  memo = { g, people, api };
  return api;
}
