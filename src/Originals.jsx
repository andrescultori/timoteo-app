import React, { useEffect, useState } from 'react';
import { loadInterlinear, loadLexicon } from './data/interlinear.js';

// Carrega os originais do livro (e o léxico) só quando `enabled` (Pro e recurso ligado).
export function useOriginals(n, enabled) {
  const [state, setState] = useState({ data: null, lex: null, error: false });
  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    Promise.all([loadInterlinear(n), loadLexicon(n)])
      .then(([data, lex]) => alive && setState({ data, lex, error: false }))
      .catch(() => alive && setState({ data: null, lex: null, error: true }));
    return () => { alive = false; };
  }, [n, enabled]);
  return enabled ? state : { data: null, lex: null, error: false };
}

// Faixa de palavras de um versículo: original (hebraico em RTL), transliteração do lema, Strong e glosa.
// No hebraico a glosa é a do léxico (do dicionário); no grego é a da Berean (do contexto), quando a fonte a traz.
export function Strip({ words, lang, lex, label }) {
  const he = lang === 'he';
  return (
    <div className="ostrip" dir={he ? 'rtl' : 'ltr'} role="group" aria-label={label}>
      {words.map(([text, strong, , gloss], i) => {
        const e = strong ? lex?.e[strong] : null;
        const g = gloss ?? (he ? e?.[2] : null);
        return (
          <div className="ow" key={i}>
            <span className="ow-t" lang={he ? 'he' : 'grc'}>{text}</span>
            {e?.[1] && <span className="ow-x" lang="en" dir="ltr">{e[1]}</span>}
            {strong && <span className="ow-s" dir="ltr">{strong.replace(/[a-z]$/, '')}</span>}
            {g && <span className="ow-g" lang="en" dir="ltr">{g}</span>}
          </div>
        );
      })}
    </div>
  );
}
