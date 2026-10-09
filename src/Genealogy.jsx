import React, { useEffect, useMemo, useRef } from 'react';
import { hierarchy, tree as d3tree } from 'd3-hierarchy';
import { bySlug } from './data/books.js';
import { pick } from './timelineUtil.js';
import PageHead from './PageHead.jsx';
import { usePageTitle } from './pageTitle.js';
import { trees, nodes, parentOf, childrenOf, personById, refsText, nodeName } from './genealogy.js';

const W = 168; // largura do nó
const H = 30; // altura do nó
const DX = 184; // distância entre colunas
const DY = 46; // distância entre gerações
const SPLIT = 34;
const COLOR = { mt: 'var(--s-evangelhos)' };

function build(id) {
  return { id, kids: childrenOf(id).map((l) => build(l.to)) };
}

// Página da árvore genealógica: SVG vertical (d3-hierarchy), com painel de detalhe (referências, notas, página do personagem).
export default function Genealogy({ lang, t, treeId, focusNode, onOpenBook, onOpenPerson, onSelect }) {
  const tr = trees.find((x) => x.id === treeId) ?? trees[0];
  const sel = focusNode && nodes[focusNode] ? focusNode : null;
  const svgRef = useRef(null);

  const isList = tr.layout === 'list';
  const layout = useMemo(() => {
    if (isList) return null;
    const root = hierarchy(build(tr.root), (d) => d.kids);
    d3tree().nodeSize([DX, DY]).separation(() => 1)(root);
    const all = root.descendants();
    all.forEach((n) => { if (nodes[n.data.id].branch) n.y += SPLIT; }); // espaço para o título de cada ramo
    const xs = all.map((n) => n.x);
    return { all, links: root.links(), minX: Math.min(...xs) - W / 2 - 8, maxX: Math.max(...xs) + W / 2 + 8, maxY: Math.max(...all.map((n) => n.y)) + H + 12 };
  }, [tr, isList]);

  usePageTitle([sel && nodeName(sel, lang), pick(tr.title, lang), t.genealogy], t.title);
  useEffect(() => {
    if (!sel) return;
    const el = svgRef.current?.querySelector(`[data-node="${sel}"]`);
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [sel, tr]);

  const select = (id) => onSelect(tr.id, id);
  const color = (id) => COLOR[nodes[id].branch] ?? 'var(--muted)';
  const branchStart = {};
  for (const n of layout?.all ?? []) { const b = nodes[n.data.id].branch; if (b && !branchStart[b]) branchStart[b] = n; }

  const link = sel ? parentOf(sel) : null;
  const kids = sel ? childrenOf(sel) : [];
  const person = sel && nodes[sel].personId ? personById[nodes[sel].personId] : null;
  const motherOf = (l) => (l?.mother && personById[l.mother] ? pick(personById[l.mother].name, lang) : l?.motherName ? pick(l.motherName, lang) : null);
  const renderItem = (id) => {
    const l = parentOf(id);
    const mom = motherOf(l);
    const on = id === sel;
    return (
      <li key={id}>
        <button type="button" data-node={id} className={`gn-item${on ? ' on' : ''}`} aria-pressed={on} onClick={() => select(id)}>
          {nodeName(id, lang)}{mom && <small> · {mom}</small>}{nodes[id].note && <i className="gn-dot-i" aria-hidden="true" />}
        </button>
        {childrenOf(id).length > 0 && <ul className="gn-list">{childrenOf(id).map((k) => renderItem(k.to))}</ul>}
      </li>
    );
  };
  const branchName = (id) => { const b = nodes[id].branch; return b ? pick(tr.branches[b], lang) : null; };

  return (
    <div className="page bookpage" role="region" aria-labelledby="gn-title">
      <PageHead t={t} id="gn-title" title={pick(tr.title, lang)} sub={t.genealogy} actions={<a className="ghost" href="#person">{t.people}</a>} />
      <div className="card pg-card" style={{ '--c': 'var(--s-atos)' }}>
        <div className="body">
          {trees.length > 1 && (
            <div className="tl-chips" role="group" aria-label={t.genealogy}>
              {trees.map((x) => (
                <button key={x.id} type="button" className="tl-chip" aria-pressed={x.id === tr.id} style={{ '--c': 'var(--s-atos)' }} onClick={() => onSelect(x.id)}>{pick(x.title, lang)}</button>
              ))}
            </div>
          )}
          <p className="pp-summary">{pick(tr.intro, lang)}</p>
          <p className="tl-warn">{pick(tr.note, lang)}</p>
          <div className="gn-wrap">
            <div className="gn-tree">
              {isList && <ul className="gn-list gn-root" ref={svgRef}>{renderItem(tr.root)}</ul>}
              {!isList && <svg ref={svgRef} className="gn-svg" viewBox={`${layout.minX} -34 ${layout.maxX - layout.minX} ${layout.maxY + 34}`} role="group" aria-label={pick(tr.title, lang)}>
                {layout.links.map((l) => (
                  <path key={l.target.data.id} className="gn-link" stroke={color(l.target.data.id)} style={{ '--c': color(l.target.data.id) }}
                    d={`M${l.source.x},${l.source.y + H} V${(l.source.y + H + l.target.y) / 2} H${l.target.x} V${l.target.y}`} />
                ))}
                {Object.entries(branchStart).map(([b, n]) => (
                  <text key={b} className="gn-branch" x={n.x} y={n.y - 7} textAnchor="middle">{pick(tr.branches[b], lang)}</text>
                ))}
                {layout.all.map((n) => {
                  const id = n.data.id;
                  const on = id === sel;
                  return (
                    <g key={id} data-node={id} className={`gn-node${on ? ' on' : ''}`} transform={`translate(${n.x - W / 2},${n.y})`}
                      role="button" tabIndex={0} aria-pressed={on} aria-label={nodeName(id, lang)}
                      onClick={() => select(id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(id); } }}>
                      <rect width={W} height={H} rx="6" stroke={color(id)} style={{ '--c': color(id) }} />
                      <text x={W / 2} y={H / 2 + 5} textAnchor="middle">{nodeName(id, lang)}</text>
                      {nodes[id].note && <circle className="gn-dot" cx={W - 8} cy={8} r="3.5" />}
                    </g>
                  );
                })}
              </svg>}
            </div>

            <aside className="gn-panel" aria-live="polite">
              {!sel && <p className="tl-warn">{t.treeHint}</p>}
              {sel && (
                <div className="tl-detail">
                  <h3>{nodeName(sel, lang)}</h3>
                  {branchName(sel) && <p className="tl-warn">{branchName(sel)}</p>}
                  {person && <button type="button" className="ghost" onClick={() => onOpenPerson(person.id)}>{t.treePersonPage}</button>}
                  {link && (
                    <>
                      <h4>{t.treeParent}</h4>
                      <p>
                        <button type="button" className="tl-chip" style={{ '--c': color(link.from) }} onClick={() => select(link.from)}>{nodeName(link.from, lang)}</button>
                        {' '}<small>{refsText(link.refs, lang)}</small>
                      </p>
                      {link.mother && personById[link.mother] && (
                        <p>{t.treeMother}: <button type="button" className="tl-chip" style={{ '--c': 'var(--s-atos)' }} onClick={() => onOpenPerson(link.mother)}>{pick(personById[link.mother].name, lang)}</button></p>
                      )}
                      {link.motherName && <p>{t.treeMother}: {pick(link.motherName, lang)}</p>}
                      {link.note && <p className="tl-warn">{pick(link.note, lang)}</p>}
                    </>
                  )}
                  {kids.length > 0 && (
                    <>
                      <h4>{t.treeChildren}</h4>
                      <div className="tl-chips">
                        {kids.map((k) => (
                          <button key={k.to} type="button" className="tl-chip" style={{ '--c': color(k.to) }} onClick={() => select(k.to)}>{nodeName(k.to, lang)}</button>
                        ))}
                      </div>
                    </>
                  )}
                  {nodes[sel].note && <p className="tl-warn gn-note">{pick(nodes[sel].note, lang)}</p>}
                  {link && (
                    <>
                      <h4>{t.treeRead}</h4>
                      <div className="tl-chips">
                        {[...new Set(link.refs.map((r) => r.book))].map((b) => (
                          <button key={b} type="button" className="tl-chip" style={{ '--c': `var(--s-${bySlug[b].section})` }} onClick={() => onOpenBook(b)}>{bySlug[b].name[lang]}</button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
