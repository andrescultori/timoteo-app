// Seleção de versículos no leitor (puro, testado em scripts/test-reader-marks.mjs). A seleção é um Set de números de versículo do capítulo aberto.
import { versesToRanges, CATS } from './marksCore.js';

// Liga ou desliga um versículo; devolve um Set novo
export function toggleVerse(sel, v) {
  const next = new Set(sel);
  if (next.has(v)) next.delete(v); else next.add(v);
  return next;
}

// Seleção em intervalo (Shift + clique no computador): do âncora até `v`, só entre os versículos que existem na versão aberta
export function selectRange(sel, anchor, v, existing) {
  if (!anchor || anchor === v) return toggleVerse(sel, v);
  const [a, b] = anchor < v ? [anchor, v] : [v, anchor];
  const next = new Set(sel);
  for (const n of existing) if (n >= a && n <= b) next.add(n);
  return next;
}

export const sortedVerses = (sel) => [...new Set(sel)].sort((a, b) => a - b);

// "3.16-17" / "3.16-17, 20" (sem o nome do livro); contíguos viram intervalo
export function versesLabel(chapter, verses) {
  const r = versesToRanges(verses).map(([a, b]) => (a === b ? `${a}` : `${a}-${b}`));
  return r.length ? `${chapter}.${r.join(', ')}` : '';
}
// "João 3.16-17"
export const refLabel = (bookName, chapter, verses) => `${bookName} ${versesLabel(chapter, verses)}`.trim();

// Categoria "ativa" de uma seleção: a de TODOS os versículos selecionados (se for a mesma), senão null
export function commonCat(marks, verses) {
  if (!verses.length) return null;
  const first = marks.get(verses[0])?.cat ?? null;
  return first && verses.every((v) => (marks.get(v)?.cat ?? null) === first) ? first : null;
}

// Tocar numa categoria: se já é a de todos os selecionados, remove a marca (null); senão aplica a todos
export const nextCat = (marks, verses, catId) => (CATS.includes(catId) && commonCat(marks, verses) === catId ? null : catId);

// Quantos selecionados têm nota (só informação para a barra)
export const withNote = (marks, verses) => verses.filter((v) => marks.get(v)?.note).length;

// Toque no TEXTO do versículo (não só no número): quando ele NÃO deve selecionar. Puro (testado em scripts/test-reader-marks.mjs).
//   hasSelection: o usuário está selecionando texto (copiar); interactive: o alvo é link, botão, número ou dentro de um diálogo; originals: modo originais (só leitura).
export const tapIgnored = ({ hasSelection = false, interactive = false, originals = false, canSelect = true } = {}) => hasSelection || interactive || originals || !canSelect;
