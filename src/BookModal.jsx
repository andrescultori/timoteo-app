import { usePageTitle } from './pageTitle.js';
import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { BOOKS, SECTIONS } from './data/books.js';
import { VERSIONS, loadBook } from './data/bible.js';
import { useSettings } from './settings.js';
import BackButton from './BackButton.jsx';
import Icon from './icons.jsx';
import FavButton from './FavButton.jsx';
import { favKey, setPosition, peekResume, getVersionPref, setVersionPref } from './userdata.js';
import { usePlan } from './plan.js';
import ProInvite from './ProInvite.jsx';
import { useLinkIndex, Rich } from './linkify.jsx';
import { hrefs, sync } from './route.js';

// Fichas carregadas sob demanda: cada src/data/info/<slug>.json vira um chunk separado.
const INFO = import.meta.glob('./data/info/*.json');
const hasInfo = (slug) => `./data/info/${slug}.json` in INFO;

// Mapa (d3-geo + costa) só carrega quando a aba é aberta.
const MapView = lazy(() => import('./MapView.jsx'));
const PsalmsView = lazy(() => import('./PsalmsView.jsx'));
const StructureView = lazy(() => import('./StructureView.jsx'));

function useInfo(slug) {
  const [state, setState] = useState({ info: null, error: false });
  useEffect(() => {
    let alive = true;
    setState({ info: null, error: false });
    const load = INFO[`./data/info/${slug}.json`];
    if (load) load().then((m) => alive && setState({ info: m.default, error: false })).catch(() => alive && setState({ info: null, error: true }));
    return () => { alive = false; };
  }, [slug]);
  return state;
}

export default function BookModal({ book, lang, t, initialTab, initialPlace, onNavigate, onOpenTimeline, onOpenPerson }) {
  const [tab, setTabState] = useState(initialTab ?? 'summary');
  // a aba e o lugar ficam no link (compartilhável), sem criar entrada no histórico
  const setTab = (k) => { setTabState(k); sync(hrefs.book(book.slug, k)); };
  // o endereço mudou por navegação (link, voltar): acompanha a aba
  useEffect(() => { setTabState(initialTab ?? 'summary'); }, [initialTab, initialPlace]);
  usePageTitle([book.name[lang], tab !== 'summary' && t[tab] !== book.name[lang] && t[tab]], t.title);
  const section = SECTIONS.find((s) => s.id === book.section);
  const prev = BOOKS[book.n - 2];
  const next = BOOKS[book.n];
  const { info, error: infoError } = useInfo(book.slug);
  const plan = usePlan();
  const locked = { map: !plan.loading && !plan.can('map', { slug: book.slug }), structure: !plan.loading && !plan.can('structure', { slug: book.slug }) };
  const tabs = ['summary', 'sheet', ...(info?.map ? ['map'] : []), ...(book.slug === 'psa' ? ['psalms'] : []), ...(info?.structure ? ['structure'] : []), 'read'];

  const facts = [
    [t.testament, t[book.testament]],
    [t.section, section[lang]],
    [t.chapters, book.chapters],
    [t.verses, book.verses.toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US')],
    [t.position, `${book.n} ${t.of} 66`],
  ];

  return (
    <div className="page" style={{ '--c': `var(--s-${book.section})` }} role="region" aria-labelledby="book-title">
      <div className="sheet">
        <div className="head">
          <div className="badge"><span>{book.n}</span><b>{book.ab[lang]}</b></div>
          <div className="ttl">
            <h1 id="book-title">{book.name[lang]}</h1>
            <p>{section[lang]}</p>
          </div>
          <FavButton favKey={favKey.book(book.slug)} t={t} />
          <BackButton t={t} />
        </div>

        <div className="seg tabs" role="tablist">
          {tabs.map((k) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} aria-pressed={tab === k} onClick={() => setTab(k)}>{t[k]}{locked[k] && <span className="pro-tag">{t.proTag}</span>}</button>
          ))}
        </div>

        <div className="body">
          {tab === 'summary' && (
            <>
              <dl className="facts">
                {facts.map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}
              </dl>
              {!hasInfo(book.slug) && <p className="soon">{t.soon}</p>}
            </>
          )}
          {tab === 'sheet' && <Sheet book={book} lang={lang} t={t} info={info} error={infoError} />}
          {tab === 'map' && info?.map && locked.map && <ProInvite t={t} lang={lang} />}
          {tab === 'map' && info?.map && !locked.map && (
            <Suspense fallback={<p className="soon">{t.loading}</p>}>
              <MapView book={book} map={info.map} lang={lang} t={t} initialPlace={initialPlace} onPlaceChange={(name) => sync(hrefs.book(book.slug, 'map', name))} onOpenTimeline={onOpenTimeline} onOpenPerson={onOpenPerson} />
            </Suspense>
          )}
          {tab === 'psalms' && book.slug === 'psa' && (
            <Suspense fallback={<p className="soon">{t.loading}</p>}>
              <PsalmsView key={initialTab === 'psalms' ? initialPlace : 'p'} lang={lang} t={t} initialN={initialPlace} onSelect={(n) => sync(hrefs.book('psa', 'psalms', String(n)))} onOpenPerson={onOpenPerson} />
            </Suspense>
          )}
          {tab === 'structure' && info?.structure && locked.structure && <ProInvite t={t} lang={lang} />}
          {tab === 'structure' && info?.structure && !locked.structure && (
            <Suspense fallback={<p className="soon">{t.loading}</p>}>
              <StructureView book={book} structure={info.structure} lang={lang} t={t} />
            </Suspense>
          )}
          {tab === 'read' && <Reader key={initialTab === 'read' ? initialPlace : 'r'} book={book} lang={lang} t={t} initialChapter={initialTab === 'read' ? Number(initialPlace) : undefined} />}
        </div>

        <div className="foot">
          <button type="button" className="ghost" disabled={!prev} onClick={() => prev && onNavigate(prev.slug)}>← {prev ? prev.name[lang] : ''}</button>
          <button type="button" className="ghost" disabled={!next} onClick={() => next && onNavigate(next.slug)}>{next ? next.name[lang] : ''} →</button>
        </div>
      </div>
    </div>
  );
}

const pick = (v, lang) => (v && typeof v === 'object' ? v[lang] ?? v.en : v);

// Nome do personagem da ficha. Com `ids` (ids de src/data/people.json), cada nome vira link para a página da pessoa.
// "Adão e Eva" + ids [adao, eva] liga cada parte; com um só id, liga o nome inteiro; id null deixa a parte sem link.
function CharName({ c, lang }) {
  const { can } = usePlan();
  const link = (id) => (can('person', { id }) ? id : null); // fora do plano, o nome vira texto comum
  const name = pick(c.name, lang);
  const ids = (c.ids ?? []).map((id) => (id ? link(id) : id));
  if (!ids.length) return name;
  if (ids.length === 1) return ids[0] ? <a className="plink" href={hrefs.person(ids[0])}>{name}</a> : name;
  const parts = name.split(lang === 'pt' ? /( e |, )/ : /( and |, )/);
  const names = parts.filter((_, i) => i % 2 === 0);
  if (names.length !== ids.length) return name;
  return parts.map((x, i) => {
    if (i % 2) return x;
    const id = ids[i / 2];
    return id ? <a key={i} className="plink" href={hrefs.person(id)}>{x}</a> : x;
  });
}

function Sheet({ book, lang, t, info, error }) {
  const { showScholarly } = useSettings();
  const index = useLinkIndex(book, info, lang);
  if (!hasInfo(book.slug)) return <p className="soon">{t.soon}</p>;
  if (error) return <p className="soon">{t.loadError}</p>;
  if (!info) return <p className="soon">{t.loading}</p>;

  const ref = (r) => `${book.ab[lang]} ${r}`;
  const rich = (v) => <Rich text={pick(v, lang)} index={index} />;
  const view = (pair) => (
    <>
      <p>{showScholarly && <b>{t.traditional}. </b>}{rich(pair.traditional)}</p>
      {showScholarly && <p><b>{t.scholarly}.</b> {rich(pair.scholarly)}</p>}
    </>
  );
  const head = (icon, label) => <h3><Icon name={icon} />{label}</h3>;
  const text = (icon, label, v) => (<section>{head(icon, label)}<p>{rich(v)}</p></section>);

  return (
    <div className="sheetinfo">
      <section>{head('author', t.author)}{view(info.author)}</section>
      <section>{head('date', t.date)}{view(info.date)}</section>
      {text('place', t.place, info.place)}
      {text('recipients', t.recipients, info.recipients)}
      <section>{head('keyVerse', t.keyVerse)}<p>{ref(info.keyVerse)}</p></section>
      {text('theme', t.theme, info.theme)}
      {text('historicalContext', t.historicalContext, info.historicalContext)}
      <section>
        {head('characters', t.characters)}
        <ul>{info.characters.map((c, i) => (<li key={i}><b><CharName c={c} lang={lang} /></b>: {rich(c.role)}</li>))}</ul>
      </section>
      <section>
        {head('outline', t.outline)}
        <ol className="outline">{info.outline.map((o, i) => (<li key={i}><span>{ref(o.ref)}</span> {pick(o.title, lang)}</li>))}</ol>
      </section>
      {text('connections', t.connections, info.connections)}
      <p className="note">{t.sheetNote}</p>
    </div>
  );
}

const LANG_NAME = { pt: 'Português', en: 'English' };

// Versão preferida por idioma, lembrada entre livros e visitas (localStorage pode falhar; o leitor funciona sem ele).
const readPref = getVersionPref;
const writePref = setVersionPref;

// Prioriza o idioma da interface: preferida salva, senão a primeira versão desse idioma.
function pickVersion(versions, lang) {
  const inLang = versions.filter((v) => v.lang === lang);
  return (inLang.find((v) => v.id === readPref(lang)) ?? inLang[0] ?? versions[0]).id;
}

function Reader({ book, lang, t, initialChapter }) {
  const versions = VERSIONS.filter((v) => v.available && (!v.books || v.books.includes(book.n)));
  const [version, setVersion] = useState(() => { const r = peekResume(book.slug); return versions.some((v) => v.id === r) ? r : pickVersion(versions, lang); });
  const [chapter, setChapter] = useState(initialChapter >= 1 && initialChapter <= book.chapters ? initialChapter : 1);
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    setData(null); setError(false);
    loadBook(version, book.n).then((d) => alive && setData(d)).catch(() => alive && setError(true));
    return () => { alive = false; };
  }, [version, book.n]);

  // "Continuar de onde parei": grava a posição ao abrir um capítulo no leitor (não ao só abrir a ficha)
  useEffect(() => { setPosition({ version, slug: book.slug, chapter }); }, [version, book.slug, chapter]);

  const current = versions.find((v) => v.id === version);
  const groups = [lang, ...Object.keys(LANG_NAME).filter((l) => l !== lang)]
    .map((l) => [l, versions.filter((v) => v.lang === l)]).filter(([, vs]) => vs.length);
  const verses = data?.[chapter - 1];

  const choose = (id) => {
    setVersion(id);
    writePref(versions.find((v) => v.id === id).lang, id);
  };

  return (
    <div className="reader">
      <div className="row">
        <label htmlFor="ver">{t.version}</label>
        <select id="ver" value={version} onChange={(e) => choose(e.target.value)} title={current.full}>
          {groups.map(([l, vs]) => (
            <optgroup key={l} label={LANG_NAME[l]}>
              {vs.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
            </optgroup>
          ))}
        </select>
        <span className="pair">
          <label htmlFor="chap">{t.chapter}</label>
          <select id="chap" value={chapter} onChange={(e) => setChapter(Number(e.target.value))}>
            {Array.from({ length: book.chapters }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
          </select>
        </span>
      </div>
      {error && <p className="soon">{t.loadError}</p>}
      {!error && !verses && <p className="soon">{t.loading}</p>}
      <div className="chap-title">
        <h3>{book.name[lang]} {chapter}</h3>
        <FavButton favKey={favKey.chapter(book.slug, chapter)} t={t} />
      </div>
      {verses && (
        // O número vem da posição: versículo que a versão não tem é null e fica sem texto, sem deslocar os seguintes.
        <div className="text" lang={current.lang}>
          {verses.map((v, i) => (v === null ? null : <p key={i}><sup>{i + 1}</sup>{v}</p>))}
        </div>
      )}
      {verses && (
        <div className="row pager">
          <button type="button" className="ghost" disabled={chapter <= 1} onClick={() => setChapter(chapter - 1)}>←</button>
          <span>{book.name[lang]} {chapter}</span>
          <button type="button" className="ghost" disabled={chapter >= book.chapters} onClick={() => setChapter(chapter + 1)}>→</button>
        </div>
      )}
      <div className="credit">
        <p>
          {pick(current.credit, lang)} {pick(current.license, lang)}
          {current.licenseUrl && <> (<a href={current.licenseUrl} target="_blank" rel="noreferrer">{t.verLicense}</a>)</>}.
          {current.sourceUrl && <> <a href={current.sourceUrl} target="_blank" rel="noreferrer">{t.verSource}</a>.</>}
        </p>
        {current.note && <p>{pick(current.note, lang)}</p>}
      </div>
    </div>
  );
}
