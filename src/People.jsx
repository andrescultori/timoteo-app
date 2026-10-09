import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BOOKS, bySlug } from './data/books.js';
import { people } from './data/people.json';
import timeline from './data/timeline.json';
import { psalms } from './data/psalms.json';
import { pick, range, main } from './timelineUtil.js';
import PageHead from './PageHead.jsx';
import FavButton from './FavButton.jsx';
import { favKey } from './userdata.js';
import { usePlan } from './plan.js';
import ProInvite from './ProInvite.jsx';
import { hrefs, go } from './route.js';
import { usePageTitle } from './pageTitle.js';
import { nodes as gNodes, parentOf, childrenOf, nodesOfPerson, treeOf, refsText, nodeName } from './genealogy.js';

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const byId = Object.fromEntries(people.map((p) => [p.id, p]));
const evById = Object.fromEntries(timeline.events.map((e) => [e.id, e]));

export default function People({ lang, t, focusId, onOpenBook, onOpenTimeline, onOpenMap, onSelect, onOpenTree }) {
  const [query, setQuery] = useState('');
  const [bookFilter, setBookFilter] = useState('all');
  const [sort, setSort] = useState(() => { try { return localStorage.getItem('peopleSort') === 'book' ? 'book' : 'alpha'; } catch { return 'alpha'; } });
  const chooseSort = (v) => { setSort(v); try { localStorage.setItem('peopleSort', v); } catch { /* ignora */ } };

  const bookOptions = useMemo(() => BOOKS.filter((b) => people.some((p) => p.books.some((x) => x.book === b.slug))), []);
  const list = useMemo(() => {
    const q = norm(query.trim());
    return people
      .filter((p) => bookFilter === 'all' || p.books.some((b) => b.book === bookFilter))
      .filter((p) => !q || norm(p.name.pt).includes(q) || norm(p.name.en).includes(q))
      .sort((a, b) => pick(a.name, lang).localeCompare(pick(b.name, lang), lang));
  }, [query, bookFilter, lang]);

  const plan = usePlan();
  const person = byId[focusId];
  const [proOpen, setProOpen] = useState(true);

  // Por livro: cada pessoa fica no primeiro livro em que aparece (ordem canônica); dentro dele, A–Z
  const groupsOf = (items) => {
    if (sort === 'alpha') return [{ key: 'all', title: null, items }];
    const g = new Map();
    for (const p of items) {
      const first = p.books.map((b) => bySlug[b.book]).sort((a, b) => a.n - b.n)[0];
      if (!g.has(first.slug)) g.set(first.slug, { key: first.slug, n: first.n, title: first.name[lang], items: [] });
      g.get(first.slug).items.push(p);
    }
    return [...g.values()].sort((a, b) => a.n - b.n);
  };
  // Essencial: duas seções (incluídos no plano em cima, Pro embaixo); quem tem tudo (ou enquanto o plano carrega) vê uma lista só
  const split = !plan.loading && people.some((p) => !plan.can('person', { id: p.id }));
  const sections = split
    ? [
        { key: 'in', title: t.peopleIncluded, items: list.filter((p) => plan.can('person', { id: p.id })) },
        { key: 'pro', title: t.peoplePro, items: list.filter((p) => !plan.can('person', { id: p.id })), pro: true },
      ].filter((x) => x.items.length)
    : [{ key: 'all', title: null, items: list }];
  const gate = !person ? 'open' : plan.loading ? 'wait' : plan.can('person', { id: person.id }) ? 'open' : 'locked'; // fora do plano, a página mostra o convite ao Pro
  usePageTitle([person && pick(person.name, lang), t.people], t.title);
  const choose = (id) => onSelect(id);

  return (
    <div className="page bookpage" role="region" aria-labelledby="pp-title">
      <PageHead t={t} id="pp-title" title={person ? pick(person.name, lang) : t.people} sub={person ? t.people : t.peopleSub} actions={(
        <>
          {person && <FavButton favKey={favKey.person(person.id)} t={t} />}
          <a className="ghost" href={hrefs.timeline()}>{t.timeline}</a>
        </>
      )} />
      <div className="pg-card" style={{ '--c': 'var(--s-paulo)' }}>

        {!person && (
          <>
            <div className="controls">
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.peopleSearch} aria-label={t.peopleSearch} />
              <select value={bookFilter} onChange={(e) => setBookFilter(e.target.value)} aria-label={t.peopleBook}>
                <option value="all">{t.peopleAllBooks}</option>
                {bookOptions.map((b) => <option key={b.slug} value={b.slug}>{b.name[lang]}</option>)}
              </select>
              <div className="seg" role="group" aria-label={t.peopleSort}>
                {[['alpha', t.peopleSortAlpha], ['book', t.peopleSortBook]].map(([k, label]) => (
                  <button key={k} type="button" aria-pressed={sort === k} onClick={() => chooseSort(k)}>{label}</button>
                ))}
              </div>
            </div>
            <div className="body">
              {list.length === 0 && <p className="soon">{t.noResults}</p>}
              {sections.map((sec) => {
                const open = !sec.pro || proOpen;
                const H = sec.title ? 'h4' : 'h3';
                return (
                  <section key={sec.key} className={sec.title ? 'pp-section' : undefined} aria-labelledby={sec.title ? `pp-sec-${sec.key}` : undefined}>
                    {sec.title && (
                      <h3 className="pp-section-title" id={`pp-sec-${sec.key}`}>
                        {sec.pro ? (
                          <button type="button" aria-expanded={proOpen} onClick={() => setProOpen(!proOpen)}>
                            <span className="pp-caret" aria-hidden="true">{proOpen ? '▾' : '▸'}</span>{sec.title} ({sec.items.length})
                          </button>
                        ) : <>{sec.title} ({sec.items.length})</>}
                      </h3>
                    )}
                    {open && groupsOf(sec.items).map((g) => (
                      <div key={g.key}>
                        {g.title && <H className="pp-group">{g.title}</H>}
                        <ul className="pp-list">
                          {g.items.map((p) => (
                            <li key={p.id}>
                              <button type="button" className="pp-card" onClick={() => choose(p.id)}>
                                <b>{pick(p.name, lang)}{sec.pro && <span className="pro-tag">{t.proTag}</span>}</b>
                                <span>{pick(p.summary, lang).split(/(?<=[.!?])\s/)[0]}</span>
                                <small>{p.books.length} {p.books.length === 1 ? t.peopleBookOne : t.peopleBooks}</small>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </section>
                );
              })}
              <p className="tl-scalenote">{t.peopleNote}</p>
            </div>
          </>
        )}

        {gate === 'wait' && <div className="body"><p className="soon">{t.loading}</p></div>}
        {gate === 'locked' && (
          <div className="body tl-detail">
            <button type="button" className="ghost" onClick={() => choose(null)}>← {t.peopleBack}</button>
            <ProInvite t={t} lang={lang} />
          </div>
        )}

        {gate === 'open' && person && (
          <div className="body tl-detail">
            <button type="button" className="ghost" onClick={() => choose(null)}>← {t.peopleBack}</button>
            <p className="pp-summary">{pick(person.summary, lang)}</p>
            {person.bio && <div className="pp-bio">{pick(person.bio, lang).map((para, i) => <p key={i}>{para}</p>)}</div>}
            {person.note && <p className="tl-warn">{pick(person.note, lang)}</p>}


            {plan.can('family') && nodesOfPerson(person.id).length > 0 && (
              <>
                <h4>{t.famTitle}</h4>
                {nodesOfPerson(person.id).map((nid) => {
                  const tr = treeOf(nid);
                  const up = parentOf(nid);
                  const down = childrenOf(nid);
                  const many = new Set(nodesOfPerson(person.id).map((x) => treeOf(x).id)).size > 1;
                  const branch = many ? pick(tr.title, lang) : gNodes[nid].branch ? pick(tr.branches[gNodes[nid].branch], lang) : null;
                  const chip = (id, c) => (gNodes[id].personId && gNodes[id].personId !== person.id
                    ? <button key={id} type="button" className="tl-chip" style={{ '--c': c }} onClick={() => onSelect(gNodes[id].personId)}>{nodeName(id, lang)}</button>
                    : <span key={id} className="tl-chip" style={{ '--c': c }}>{nodeName(id, lang)}</span>);
                  return (
                    <div key={nid} className="fam-row">
                      {branch && <b>{branch}</b>}
                      {up && <div className="tl-chips"><small>{t.famParent}:</small>{chip(up.from, 'var(--s-atos)')}<small>{refsText(up.refs, lang)}</small></div>}
                      {up?.motherName && <div className="tl-chips"><small>{t.famMother}:</small><span className="tl-chip" style={{ '--c': 'var(--s-atos)' }}>{pick(up.motherName, lang)}</span></div>}
                      {up?.mother && byId[up.mother] && <div className="tl-chips"><small>{t.famMother}:</small><button type="button" className="tl-chip" style={{ '--c': 'var(--s-atos)' }} onClick={() => onSelect(up.mother)}>{pick(byId[up.mother].name, lang)}</button></div>}
                      {down.length > 0 && <div className="tl-chips"><small>{t.famKids}:</small>{down.map((l) => chip(l.to, 'var(--s-atos)'))}</div>}
                      <button type="button" className="ghost" onClick={() => onOpenTree(tr.id, nid)}>{t.famTree}</button>
                    </div>
                  );
                })}
              </>
            )}

            <h4>{t.peopleInBooks}</h4>
            <ul className="pp-books">
              {person.books.map((b) => (
                <li key={b.book}>
                  <button type="button" className="tl-chip" style={{ '--c': `var(--s-${bySlug[b.book].section})` }} onClick={() => onOpenBook(b.book)}>{bySlug[b.book].name[lang]}</button>
                  <span>{pick(b.role, lang)}</span>
                </li>
              ))}
            </ul>

            {plan.can('events') && person.events?.length > 0 && (
              <>
                <h4>{t.timelineEvents}</h4>
                <div className="tl-chips">
                  {person.events.map((id) => evById[id]).sort((a, b) => main(a.dates).start - main(b.dates).start).map((e) => (
                    <button key={e.id} type="button" className="tl-chip" style={{ '--c': 'var(--s-historicos)' }} onClick={() => onOpenTimeline(e.id)}>
                      {pick(e.title, lang)} <small>{range(main(e.dates), lang)}</small>
                    </button>
                  ))}
                </div>
              </>
            )}

            {psalms.some((x) => x.hist?.people.includes(person.id)) && (
              <>
                <h4>{t.psalmsLinked}</h4>
                <div className="tl-places">
                  {psalms.filter((x) => x.hist?.people.includes(person.id)).map((x) => (
                    <button key={x.n} type="button" className="tl-place" onClick={() => go(hrefs.book('psa', 'psalms', String(x.n)))}>{t.psalm} {x.n}</button>
                  ))}
                </div>
              </>
            )}

            {person.places?.length > 0 && (
              <>
                <h4>{t.peoplePlaces}</h4>
                <div className="tl-places">
                  {person.places.map((pl) => (
                    <button key={pl.book + pl.name} type="button" className="tl-place" onClick={() => onOpenMap(pl.book, pl.name)}>
                      {lang === 'pt' ? pl.name : pl.en} ({bySlug[pl.book].ab[lang]})
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
