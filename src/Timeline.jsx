import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BOOKS, bySlug } from './data/books.js';
import data from './data/timeline.json';
import { people } from './data/people.json';
import { pick, range, views, main } from './timelineUtil.js';
import { useSettings } from './settings.js';
import BackButton from './BackButton.jsx';
import { hrefs } from './route.js';
import { usePageTitle } from './pageTitle.js';

const MIN_W = 132; // largura mínima de um período na faixa, em px (cabe o título)
const UNDATED_W = 132;

function Dates({ dates, t, lang }) {
  const { showScholarly } = useSettings();
  const all = views(dates);
  const vs = showScholarly ? all : all.slice(0, 1);
  if (all.length === 1) {
    const d = vs[0][1];
    return <p className="tl-dates"><b>{range(d, lang)}</b>{d.note && <span> {pick(d.note, lang)}</span>}</p>;
  }
  return (
    <div className="tl-views">
      {vs.map(([k, d]) => (
        <p key={k} className="tl-dates"><i>{t[k]}</i><b>{range(d, lang)}</b>{d.note && <span> {pick(d.note, lang)}</span>}</p>
      ))}
    </div>
  );
}

export default function Timeline({ lang, t, focusId, onClose, onOpenBook, onOpenMap, onOpenPerson }) {
  const { showScholarly } = useSettings();
  const focused = data.events.find((e) => e.id === focusId);
  usePageTitle([focused && pick(focused.title, lang), t.timeline], t.title);
  const [sel, setSel] = useState(focused?.period ?? data.periods[0].id);
  const period = data.periods.find((p) => p.id === sel);
  const events = useMemo(() => data.events.filter((e) => e.period === sel), [sel]);
  const refs = useRef({});

  // vindo de um link (ou do voltar do navegador): abre o período do evento e leva o evento para a vista
  useEffect(() => {
    const ev = data.events.find((e) => e.id === focusId);
    if (!ev) return;
    setSel(ev.period);
    requestAnimationFrame(() => refs.current[focusId]?.scrollIntoView({ block: 'center' }));
  }, [focusId]);

  // escala por bloco: cada bloco tem seus px por ano; períodos curtos ganham largura mínima
  const layout = useMemo(() => data.blocks.map((b) => {
    const ps = data.periods.filter((p) => p.block === b.id).map((p) => {
      const d = p.dates ? main(p.dates) : null;
      const span = d ? Math.abs(d.end - d.start) : 0;
      return { p, d, w: d ? Math.max(MIN_W, Math.round(span * b.ppy)) : UNDATED_W };
    });
    return { b, ps };
  }), []);

  const placed = useMemo(() => new Set(data.periods.flatMap((p) => p.books)), []);
  const unplaced = BOOKS.filter((b) => !placed.has(b.slug));
  const order = (slugs) => [...slugs].sort((a, b) => bySlug[a].n - bySlug[b].n);

  // ao escolher um período, volta o detalhe ao topo
  const choose = (id) => setSel(id);

  return (
    <div className="page wide" role="region" aria-labelledby="tl-title">
      <div className="sheet" style={{ '--c': 'var(--s-historicos)' }}>
        <div className="head">
          <div className="ttl">
            <h1 id="tl-title">{t.timeline}</h1>
            <p>{t.timelineSub}</p>
          </div>
          <div className="head-actions">
            <a className="ghost" href={hrefs.person()}>{t.people}</a>
            <BackButton t={t} />
          </div>
        </div>

        <div className="tl-strip" role="group" aria-label={t.timelineStrip}>
          {layout.map(({ b, ps }) => (
            <div key={b.id} className="tl-block">
              <div className="tl-blabel">{pick(b.title, lang)}</div>
              <div className="tl-row">
                {ps.map(({ p, d, w }) => {
                  const sec = bySlug[p.books[0]]?.section;
                  const evs = data.events.filter((e) => e.period === p.id);
                  return (
                    <button key={p.id} type="button" className="tl-period" aria-pressed={sel === p.id} onClick={() => choose(p.id)}
                      style={{ width: w, '--c': sec ? `var(--s-${sec})` : 'var(--muted)' }}>
                      <b>{pick(p.title, lang)}</b>
                      <span>{d ? range(p.dates.traditional ?? p.dates, lang).replace(/^c\. /, '') : t.undated}</span>
                      {evs.map((e) => {
                        const m = main(e.dates);
                        const x = d ? Math.min(1, Math.max(0, (m.start - d.start) / (d.end - d.start))) : 0;
                        return <i key={e.id} className="tl-dot" style={{ left: `${6 + x * (w - 12)}px` }} aria-hidden="true" />;
                      })}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <p className="tl-scalenote">{t.timelineScale}</p>

        <div className="body tl-detail">
          <h3>{pick(period.title, lang)}</h3>
          <p>{pick(period.summary, lang)}</p>
          {period.dates && <Dates dates={period.dates} t={t} lang={lang} />}
          {period.uncertain && showScholarly && <p className="tl-warn">{t.timelineUncertain}</p>}

          {period.books.length > 0 && (
            <>
              <h4>{t.timelineBooks}</h4>
              <div className="tl-chips">
                {order(period.books).map((s) => (
                  <button key={s} type="button" className="tl-chip" style={{ '--c': `var(--s-${bySlug[s].section})` }} onClick={() => onOpenBook(s)} title={bySlug[s].name[lang]}>
                    {bySlug[s].name[lang]}
                  </button>
                ))}
              </div>
            </>
          )}

          {events.length > 0 && (
            <>
              <h4>{t.timelineEvents}</h4>
              <ol className="tl-events">
                {events.map((e) => (
                  <li key={e.id} id={`ev-${e.id}`} className={e.id === focusId ? 'tl-focus' : undefined} ref={(el) => { refs.current[e.id] = el; }}>
                    <p className="tl-etitle"><b>{pick(e.title, lang)}</b>{e.attested && <abbr className="tl-att" title={t.timelineAttested}> ◆</abbr>}{e.uncertain && <span className="tl-q" title={t.timelineUncertain}> ?</span>}</p>
                    <Dates dates={e.dates} t={t} lang={lang} />
                    <p>{pick(e.note, lang)}</p>
                    {e.ref && <small>{bySlug[e.ref.book].ab[lang]} {e.ref.ref}</small>}
                    {people.some((p) => p.events?.includes(e.id)) && (
                      <div className="tl-places">
                        <small>{t.peopleOnTimeline}:</small>
                        {people.filter((p) => p.events?.includes(e.id)).map((p) => (
                          <button key={p.id} type="button" className="tl-place" onClick={() => onOpenPerson(p.id)}>{pick(p.name, lang)}</button>
                        ))}
                      </div>
                    )}
                    {e.places?.length > 0 && (
                      <div className="tl-places">
                        {e.places.map((pl) => (
                          <button key={pl.book + pl.name} type="button" className="tl-place" onClick={() => onOpenMap(pl.book, pl.name)}>
                            {t.timelineOnMap}: {lang === 'pt' ? pl.name : pl.en} ({bySlug[pl.book].ab[lang]})
                          </button>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
              <p className="tl-legend"><span className="tl-att">◆</span> {t.timelineAttested}</p>
            </>
          )}
          {events.length === 0 && period.books.length === 0 && null}

          {sel === data.periods[data.periods.length - 1].id && unplaced.length > 0 && (
            <details className="tl-unplaced">
              <summary>{t.timelineUnplaced} ({unplaced.length})</summary>
              <p>{t.timelineUnplacedNote}</p>
              <p>{unplaced.map((b) => b.name[lang]).join(', ')}.</p>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
