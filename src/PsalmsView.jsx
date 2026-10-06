import React, { useState } from 'react';
import { bySlug } from './data/books.js';
import { psalms } from './data/psalms.json';
import { people } from './data/people.json';
import { useSettings } from './settings.js';
import { usePlan } from './plan.js';
import { hrefs, go } from './route.js';

const L = (pt, en) => ({ pt, en });
const BOOKS = [
  { id: 1, name: L('Livro I', 'Book I'), range: '1–41' }, { id: 2, name: L('Livro II', 'Book II'), range: '42–72' },
  { id: 3, name: L('Livro III', 'Book III'), range: '73–89' }, { id: 4, name: L('Livro IV', 'Book IV'), range: '90–106' },
  { id: 5, name: L('Livro V', 'Book V'), range: '107–150' },
];
const AUTHORS = [
  { id: 'david', name: L('Davi', 'David') }, { id: 'asaph', name: L('Asafe', 'Asaph') }, { id: 'korah', name: L('Filhos de Corá', 'Sons of Korah') },
  { id: 'solomon', name: L('Salomão', 'Solomon') }, { id: 'moses', name: L('Moisés', 'Moses') }, { id: 'heman', name: L('Hemã', 'Heman') },
  { id: 'ethan', name: L('Etã', 'Ethan') }, { id: 'none', name: L('Sem nome no título', 'No name in the title') },
];
const GENRES = [
  { id: 'hino', name: L('Hino de louvor', 'Hymn of praise') }, { id: 'lamento-ind', name: L('Lamento individual', 'Individual lament') },
  { id: 'lamento-col', name: L('Lamento coletivo', 'Communal lament') }, { id: 'confianca', name: L('Confiança', 'Trust') },
  { id: 'acao-gracas', name: L('Ação de graças', 'Thanksgiving') }, { id: 'real', name: L('Real', 'Royal') },
  { id: 'sapiencial', name: L('Sapiencial', 'Wisdom') }, { id: 'historico', name: L('Histórico', 'Historical') }, { id: 'liturgia', name: L('Liturgia', 'Liturgy') },
];
const COLORS = ['lei', 'historicos', 'poesia', 'profMaiores', 'profMenores', 'evangelhos', 'atos', 'paulo', 'outras'];
const pick = (v, lang) => (v && typeof v === 'object' ? v[lang] ?? v.en : v);

const MODES = {
  book: { cats: BOOKS, of: (p) => [p.book] },
  author: { cats: AUTHORS, of: (p) => (p.by.length ? p.by : ['none']) },
  genre: { cats: GENRES, of: (p) => [p.genre] },
};

export default function PsalmsView({ lang, t, initialN, onSelect, onOpenPerson }) {
  const { showScholarly } = useSettings();
  const { can } = usePlan();
  const [mode, setMode] = useState('book');
  const [cat, setCat] = useState(null);
  const [n, setN] = useState(initialN && psalms[initialN - 1] ? Number(initialN) : null);
  const m = showScholarly || mode !== 'genre' ? mode : 'book'; // o gênero é uma classificação acadêmica
  const { cats, of } = MODES[m];
  const colorOf = (p) => { const i = cats.findIndex((c) => of(p).includes(c.id)); return `var(--s-${COLORS[i % COLORS.length]})`; };
  const on = (p) => !cat || of(p).includes(cat);
  const p = n ? psalms[n - 1] : null;
  const choose = (k) => { setN(k); onSelect?.(k); };

  return (
    <div className="psalms">
      <div className="row">
        <div className="seg" role="group" aria-label={t.psalmsColor}>
          {[['book', t.psalmsByBook], ['author', t.psalmsByAuthor], ...(showScholarly ? [['genre', t.psalmsByGenre]] : [])].map(([k, label]) => (
            <button key={k} type="button" aria-pressed={m === k} onClick={() => { setMode(k); setCat(null); }}>{label}</button>
          ))}
        </div>
      </div>

      <div className="tl-chips ps-legend">
        {cats.map((c, i) => {
          const count = psalms.filter((x) => of(x).includes(c.id)).length;
          return (
            <button key={c.id} type="button" className="tl-chip" aria-pressed={cat === c.id} style={{ '--c': `var(--s-${COLORS[i % COLORS.length]})` }} onClick={() => setCat(cat === c.id ? null : c.id)}>
              {pick(c.name, lang)}{c.range ? ` (${c.range})` : ''} <small>{count}</small>
            </button>
          );
        })}
      </div>

      <div className="ps-grid" role="group" aria-label={t.psalms}>
        {psalms.map((x) => (
          <button key={x.n} type="button" className="ps-tile" aria-pressed={n === x.n} aria-label={`${t.psalm} ${x.n}`}
            style={{ '--c': colorOf(x), opacity: on(x) ? 1 : 0.25 }} onClick={() => choose(x.n)}>
            {x.n}
          </button>
        ))}
      </div>
      <p className="tl-scalenote">{showScholarly ? t.psalmsNote : t.psalmsNoteShort}</p>

      {p && (
        <div className="ps-detail">
          <h3>{t.psalm} {p.n}</h3>
          <dl className="facts">
            <div><dt>{t.psalmsByBook}</dt><dd>{pick(BOOKS[p.book - 1].name, lang)} ({BOOKS[p.book - 1].range}){p.n === 41 || p.n === 72 || p.n === 89 || p.n === 106 ? ` · ${t.psalmsDoxology}` : ''}</dd></div>
            <div><dt>{t.psalmsByAuthor}</dt><dd>{p.by.length ? p.by.map((a) => pick(AUTHORS.find((x) => x.id === a).name, lang)).join(' / ') : pick(AUTHORS[7].name, lang)}</dd></div>
            {p.pilgrim && <div><dt>{t.psalmsTitle}</dt><dd>{t.psalmsPilgrim}</dd></div>}
            {showScholarly && <div><dt>{t.psalmsByGenre}</dt><dd>{pick(GENRES.find((g) => g.id === p.genre).name, lang)}{p.mixed ? ` · ${t.psalmsMixed}` : ''}</dd></div>}
          </dl>

          {p.hist && (
            <section>
              <h4>{t.psalmsHist}</h4>
              <p>{pick(p.hist.text, lang)}</p>
              {p.hist.ref && <p className="tl-scalenote">{bySlug[p.hist.ref.book].ab[lang]} {p.hist.ref.ref}</p>}
              <p>{showScholarly && <b>{t.traditional}. </b>}{t.psalmsHistTrad}</p>
              {showScholarly && <p><b>{t.scholarly}.</b> {t.psalmsHistSch}</p>}
              <div className="tl-places">
                {p.hist.people.map((id) => (can('person', { id })
                  ? <button key={id} type="button" className="tl-place" onClick={() => onOpenPerson(id)}>{pick(people.find((x) => x.id === id).name, lang)}</button>
                  : <span key={id} className="tl-place">{pick(people.find((x) => x.id === id).name, lang)}</span>))}
                {can('timeline') && <button type="button" className="tl-place" onClick={() => go(hrefs.timeline('davi'))}>{t.timeline}</button>}
              </div>
            </section>
          )}

          <p><button type="button" className="ghost" onClick={() => go(hrefs.book('psa', 'read', String(p.n)))}>{t.psalmsRead} {p.n}</button></p>
        </div>
      )}
    </div>
  );
}
