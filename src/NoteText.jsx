import React, { useMemo, useRef, useState } from 'react';
import { parseNote, applyFormat } from './richText.js';

// Desenha uma nota formatada (ver richText.js). Só elementos do React: o texto é sempre escapado e nunca há HTML cru.
function Inline({ nodes }) {
  return nodes.map((n, i) => {
    if (n.t === 'text') return <React.Fragment key={i}>{n.v}</React.Fragment>;
    const C = n.t === 'b' ? 'strong' : n.t === 'i' ? 'em' : 'u';
    return <C key={i}><Inline nodes={n.c} /></C>;
  });
}

export default function NoteText({ text, className = '' }) {
  const blocks = useMemo(() => parseNote(text), [text]);
  if (!blocks.length) return null;
  return (
    <div className={`rt ${className}`.trim()}>
      {blocks.map((b, i) => {
        if (b.type === 'h1') return <h4 key={i} className="rt-h1"><Inline nodes={b.lines[0]} /></h4>;
        if (b.type === 'h2') return <h5 key={i} className="rt-h2"><Inline nodes={b.lines[0]} /></h5>;
        return <p key={i}>{b.lines.map((l, j) => <React.Fragment key={j}>{j > 0 && <br />}<Inline nodes={l} /></React.Fragment>)}</p>;
      })}
    </div>
  );
}

const BUTTONS = [['h1', 'H1', 'rtH1'], ['h2', 'H2', 'rtH2'], ['b', 'N', 'rtBold'], ['i', 'I', 'rtItalic'], ['u', 'S', 'rtUnderline']];
const KEYS = { b: 'b', i: 'i', u: 'u' };

// Editor de nota: barra de formatação sobre o textarea (16px) e aba "Pré-visualizar". Atalhos Ctrl/Cmd+B, I e U.
export function NoteEditor({ value, onChange, onBlur, label, placeholder, max, t }) {
  const ref = useRef(null);
  const [preview, setPreview] = useState(false);
  const fmt = (kind) => {
    const el = ref.current;
    if (!el) return;
    const r = applyFormat(el.value, el.selectionStart, el.selectionEnd, kind);
    if (r.value.length > max) return; // o limite conta a marcação
    onChange(r.value);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(r.start, r.end); });
  };
  const onKey = (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const kind = Object.keys(KEYS).find((k) => KEYS[k] === e.key.toLowerCase());
    if (kind) { e.preventDefault(); fmt(kind); }
  };
  return (
    <div className="rt-editor">
      <div className="rt-bar">
        <div role="toolbar" aria-label={t.rtToolbar} className="rt-tools">
          {BUTTONS.map(([k, txt, key]) => (
            <button key={k} type="button" className={`rt-btn rt-${k}`} aria-label={t[key]} title={t[key]} disabled={preview} onMouseDown={(e) => e.preventDefault()} onClick={() => fmt(k)}>{txt}</button>
          ))}
        </div>
        <div role="tablist" aria-label={t.rtMode} className="rt-modes">
          <button type="button" role="tab" aria-selected={!preview} onClick={() => setPreview(false)}>{t.rtEdit}</button>
          <button type="button" role="tab" aria-selected={preview} onClick={() => setPreview(true)}>{t.rtPreview}</button>
        </div>
      </div>
      {preview
        ? <div className="rt-preview" aria-label={t.rtPreview}>{value.trim() ? <NoteText text={value} /> : <p className="soon">{t.rtEmpty}</p>}</div>
        : <textarea ref={ref} className="st-note" aria-label={label} placeholder={placeholder} value={value} maxLength={max} rows={4} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} onKeyDown={onKey} />}
      <p className="st-meta rt-count" aria-live="off">{value.length} / {max}</p>
    </div>
  );
}
