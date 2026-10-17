import React from 'react';
import { includeFor } from './studyInclude.js';
import ProInvite from './ProInvite.jsx';

// Desenha os nós de studyInclude.js. Na tela, conteúdo fora do plano vira o convite ao Pro (nunca dado Pro); no PDF, uma linha avisando.
export function IncludedNodes({ nodes, t, lang, print = false }) {
  return (
    <div className={print ? 'inc inc-print' : 'inc'}>
      {nodes.map((n, i) => {
        if (n.type === 'locked') return print ? <p key={i} className="sp-locked">{t.incLockedPrint}</p> : <ProInvite key={i} t={t} lang={lang} />;
        if (n.type === 'h') return <h5 key={i} className="inc-h">{n.text}</h5>;
        if (n.type === 'p') return <p key={i}>{n.text}</p>;
        if (n.type === 'dl') return <dl key={i} className="st-dl">{n.rows.map(([k, v], j) => <React.Fragment key={j}><dt>{k}</dt><dd>{v}</dd></React.Fragment>)}</dl>;
        if (n.type === 'list') return <ul key={i}>{n.items.map((it, j) => <li key={j}>{it.href && !print ? <a href={it.href}>{it.text}</a> : it.text}</li>)}</ul>;
        return null;
      })}
    </div>
  );
}

// Conteúdo incluído de um item (d = describeItem). `ctxDeps`: tudo que includeFor precisa (lang, can, t, books, plan, study, peopleIndex + deps carregados)
export default function StudyIncluded({ d, ctxDeps, ready, print = false }) {
  const { t, lang } = ctxDeps;
  if (!ready) return <p className="soon">{t.incLoading}</p>;
  const r = includeFor(d, ctxDeps);
  if (r.status === 'loading') return <p className="soon">{t.incLoading}</p>;
  return <IncludedNodes nodes={r.nodes} t={t} lang={lang} print={print} />;
}
