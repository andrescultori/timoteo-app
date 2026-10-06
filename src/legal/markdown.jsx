import React from 'react';

// Renderizador mínimo de markdown para os textos legais (sem dependência): títulos (#, ##, ###), parágrafos, listas (- ), tabelas (|),
// citação (>), linha (---), **negrito** e [texto](url). `vars` troca marcas {nome} no texto antes de desenhar (não usado hoje).
const inline = (text, key) => {
  const out = [];
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) out.push(<strong key={`${key}-${i}`}>{inline(m[1], `${key}-${i}`)}</strong>);
    else out.push(<a key={`${key}-${i}`} href={m[3]} {...(/^https?:/.test(m[3]) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{m[2]}</a>);
    last = m.index + m[0].length;
    i += 1;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
};

const cells = (line) => line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());

export function Markdown({ text }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;
  let k = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i += 1; continue; }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) { const Tag = `h${h[1].length + 1}`; blocks.push(<Tag key={k++}>{inline(h[2], `h${k}`)}</Tag>); i += 1; continue; }
    if (/^---+\s*$/.test(line)) { blocks.push(<hr key={k++} />); i += 1; continue; }
    if (/^>/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, '')); i += 1; }
      blocks.push(<blockquote key={k++}>{inline(buf.join(' '), `q${k}`)}</blockquote>);
      continue;
    }
    if (/^\s*\|/.test(line) && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] ?? '')) {
      const head = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) { rows.push(cells(lines[i])); i += 1; }
      blocks.push(
        <div className="legal-table" key={k++}>
          <table>
            <thead><tr>{head.map((c, j) => <th key={j}>{inline(c, `th${k}${j}`)}</th>)}</tr></thead>
            <tbody>{rows.map((r, a) => <tr key={a}>{r.map((c, j) => <td key={j}>{inline(c, `td${k}${a}${j}`)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^\s*(-|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items = [];
      while (i < lines.length && /^\s*(-|\d+\.)\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*(-|\d+\.)\s+/, '')); i += 1; }
      const List = ordered ? 'ol' : 'ul';
      blocks.push(<List key={k++}>{items.map((t, j) => <li key={j}>{inline(t, `li${k}${j}`)}</li>)}</List>);
      continue;
    }
    const buf = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|>|---+\s*$|\s*\|)/.test(lines[i]) && !/^\s*(-|\d+\.)\s+/.test(lines[i])) { buf.push(lines[i]); i += 1; }
    blocks.push(<p key={k++}>{inline(buf.join(' '), `p${k}`)}</p>);
  }
  return <>{blocks}</>;
}

// Só o texto inline (negrito e links), para as caixas de consentimento. Os colchetes sem URL ([Termos de Uso]) viram links mapeados.
export function Inline({ text, links = {} }) {
  const out = [];
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) out.push(<strong key={i}>{m[1]}</strong>);
    else if (links[m[2]]) out.push(<a key={i} href={links[m[2]]} target="_blank" rel="noopener noreferrer">{m[2]}</a>);
    else out.push(`[${m[2]}]`);
    last = m.index + m[0].length;
    i += 1;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}
