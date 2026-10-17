// Formatação simples das notas do estudo (puro, testado em scripts/test-richtext.mjs). Sem HTML e sem biblioteca: o texto vira uma árvore de nós
// que a interface desenha com elementos do React (o React escapa todo texto; nunca há dangerouslySetInnerHTML).
// Sintaxe: linha começando com "# " = título 1; "## " = título 2; **negrito**; *itálico*; ++sublinhado++.
// Regra: o par precisa fechar NA MESMA LINHA e ter conteúdo; marcador aberto, vazio ou fora de lugar é texto puro.
// Blocos: { type: 'h1' | 'h2' | 'p', lines: [nós[]] } (título tem uma linha; parágrafo junta linhas seguidas); nó: { t: 'text', v } | { t: 'b' | 'i' | 'u', c: nós[] }.

const MARKS = [['**', 'b'], ['++', 'u'], ['*', 'i']]; // "**" antes de "*"

export function parseInline(line) {
  const out = [];
  let buf = '';
  const flush = () => { if (buf) { out.push({ t: 'text', v: buf }); buf = ''; } };
  let i = 0;
  while (i < line.length) {
    let hit = null;
    for (const [mark, t] of MARKS) {
      if (!line.startsWith(mark, i)) continue;
      const close = line.indexOf(mark, i + mark.length);
      // precisa fechar na linha, ter conteúdo e não começar/terminar em espaço (evita "2 * 3 * 4" virar itálico)
      if (close > i + mark.length) {
        const inner = line.slice(i + mark.length, close);
        if (inner.trim() && !/^\s/.test(inner) && !/\s$/.test(inner)) { hit = { mark, t, inner, end: close + mark.length }; break; }
      }
    }
    if (hit) { flush(); out.push({ t: hit.t, c: parseInline(hit.inner) }); i = hit.end; } else { buf += line[i]; i += 1; }
  }
  flush();
  return out;
}

export function parseNote(text) {
  const blocks = [];
  let para = null;
  for (const raw of String(text ?? '').replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.replace(/\s+$/, '');
    const h = /^(#{1,2}) (\S.*)$/.exec(line);
    if (h) { para = null; blocks.push({ type: h[1].length === 1 ? 'h1' : 'h2', lines: [parseInline(h[2])] }); continue; }
    if (!line.trim()) { para = null; continue; }
    if (!para) { para = { type: 'p', lines: [] }; blocks.push(para); }
    para.lines.push(parseInline(line));
  }
  return blocks;
}

// Texto sem marcação (para resumo, contagem e busca)
export function plainText(text) {
  const flat = (nodes) => nodes.map((n) => (n.t === 'text' ? n.v : flat(n.c))).join('');
  return parseNote(text).map((b) => b.lines.map(flat).join('\n')).join('\n');
}

// ---- edição: aplica um formato à seleção do textarea (puro; devolve o novo texto e a nova seleção) ----
const WRAP = { b: '**', i: '*', u: '++' };
export function applyFormat(value, start, end, kind) {
  const s = Math.max(0, Math.min(start, end));
  const e = Math.min(value.length, Math.max(start, end));
  if (kind === 'h1' || kind === 'h2') {
    const prefix = kind === 'h1' ? '# ' : '## ';
    const ls = value.lastIndexOf('\n', s - 1) + 1;
    const le0 = value.indexOf('\n', e);
    const le = le0 === -1 ? value.length : le0;
    const lines = value.slice(ls, le).split('\n').map((l) => {
      const bare = l.replace(/^#{1,2} /, '');
      return l.startsWith(prefix) ? bare : prefix + bare; // o mesmo título tira; outro troca
    });
    const block = lines.join('\n');
    return { value: value.slice(0, ls) + block + value.slice(le), start: ls, end: ls + block.length };
  }
  const m = WRAP[kind];
  if (!m) return { value, start: s, end: e };
  const sel = value.slice(s, e);
  // já está marcado (a seleção inclui os marcadores ou eles a cercam): tira
  if (sel.length >= m.length * 2 && sel.startsWith(m) && sel.endsWith(m)) { const inner = sel.slice(m.length, sel.length - m.length); return { value: value.slice(0, s) + inner + value.slice(e), start: s, end: s + inner.length }; }
  if (value.slice(s - m.length, s) === m && value.slice(e, e + m.length) === m) return { value: value.slice(0, s - m.length) + sel + value.slice(e + m.length), start: s - m.length, end: e - m.length };
  return { value: value.slice(0, s) + m + sel + m + value.slice(e), start: s + m.length, end: e + m.length };
}
