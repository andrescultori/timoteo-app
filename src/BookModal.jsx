import { usePageTitle } from './pageTitle.js';
import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { BOOKS, SECTIONS } from './data/books.js';
import { VERSIONS, loadBook } from './data/bible.js';
import { useSettings } from './settings.js';
import BackButton from './BackButton.jsx';
import FavButton from './FavButton.jsx';
import { favKey, setPosition, peekResume, getVersionPref, setVersionPref, setPrefs, useUserData } from './userdata.js';
import { usePlan } from './plan.js';
import ProInvite from './ProInvite.jsx';
import { useLinkIndex, Rich } from './linkify.jsx';
import { hrefs, sync } from './route.js';
import { sectionsAt } from './outline.js';
import { loadPeopleChapters, peopleInChapterFrom, bookHasChapters } from './peopleChapters.js';
import { resolvePrefs } from './readingPrefs.js';
import { readStyle } from './readStyle.js';
import { useResolvedSite } from './siteTheme.js';
import { useOriginals, Strip } from './Originals.jsx';

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

  const keyChapter = Number(String(info?.keyVerse ?? '').match(/^(\d+):/)?.[1]) || null;

  return (
    <div className={`page bookpage${tab === 'read' ? ' compact' : ''}`} style={{ '--c': `var(--s-${book.section})` }}>
      <BackButton t={t} />
      <header className="bk-head">
        <div className="bk-badge" aria-hidden="true">{book.ab[lang]}</div>
        <div className="bk-ttl">
          <div className="bk-chips">
            <span>{t[book.testament]}</span><span>{section[lang]}</span><span>{book.chapters} {t.chapters.toLowerCase()}</span>
          </div>
          <h1 id="book-title">{book.name[lang]}</h1>
        </div>
        <FavButton favKey={favKey.book(book.slug)} t={t} />
      </header>

      <div className="bk-tabs" role="tablist" aria-label={t.bookTabs}>
        {tabs.map((k) => (
          <button key={k} type="button" role="tab" className="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{t[k]}{locked[k] && <span className="pro-tag">{t.proTag}</span>}</button>
        ))}
      </div>

      <div className="bk-body" role="tabpanel">
        {tab === 'summary' && (
          <div className="card">
            <h2>{t.bookData}</h2>
            <dl className="facts">
              {facts.map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}
            </dl>
            {!hasInfo(book.slug) && <p className="soon">{t.soon}</p>}
          </div>
        )}
        {tab === 'sheet' && <Sheet book={book} lang={lang} t={t} info={info} error={infoError} keyChapter={keyChapter} />}
        {tab === 'map' && info?.map && locked.map && <ProInvite t={t} lang={lang} />}
        {tab === 'map' && info?.map && !locked.map && (
          <div className="card">
            <Suspense fallback={<p className="soon">{t.loading}</p>}>
              <MapView book={book} map={info.map} lang={lang} t={t} initialPlace={initialPlace} onPlaceChange={(name) => sync(hrefs.book(book.slug, 'map', name))} onOpenTimeline={onOpenTimeline} onOpenPerson={onOpenPerson} />
            </Suspense>
          </div>
        )}
        {tab === 'psalms' && book.slug === 'psa' && (
          <div className="card">
            <Suspense fallback={<p className="soon">{t.loading}</p>}>
              <PsalmsView key={initialTab === 'psalms' ? initialPlace : 'p'} lang={lang} t={t} initialN={initialPlace} onSelect={(n) => sync(hrefs.book('psa', 'psalms', String(n)))} onOpenPerson={onOpenPerson} />
            </Suspense>
          </div>
        )}
        {tab === 'structure' && info?.structure && locked.structure && <ProInvite t={t} lang={lang} />}
        {tab === 'structure' && info?.structure && !locked.structure && (
          <div className="card">
            <Suspense fallback={<p className="soon">{t.loading}</p>}>
              <StructureView book={book} structure={info.structure} lang={lang} t={t} />
            </Suspense>
          </div>
        )}
        {tab === 'read' && (
          <Reader key={initialTab === 'read' ? initialPlace : 'r'} book={book} lang={lang} t={t} info={info} keyChapter={keyChapter} initialChapter={initialTab === 'read' ? Number(initialPlace) : undefined} />
        )}
      </div>

      <nav className="foot" aria-label={t.bookNav}>
        <a className="ghost" aria-disabled={!prev} href={prev ? hrefs.book(prev.slug) : undefined}>← {prev ? prev.name[lang] : ''}</a>
        <a className="ghost" aria-disabled={!next} href={next ? hrefs.book(next.slug) : undefined}>{next ? next.name[lang] : ''} →</a>
      </nav>
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

// Personagens citados pelo nome no capítulo (people-chapters.json) com nomes de people-index.json; ambos carregam sob demanda.
// `ready` só vira true com os dois carregados; `hasBook` é falso nos livros sem dado de capítulo (ex.: Eclesiastes) e a lateral fica como era.
function useChapterPeople(book, chapter, lang) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    if (!chapter || src) return undefined;
    let alive = true;
    Promise.all([loadPeopleChapters(), import('./data/people-index.json')])
      .then(([data, idx]) => { if (alive) setSrc({ data, names: new Map((idx.default ?? idx).map((p) => [p.id, p.name])) }); })
      .catch(() => { /* sem os dados, a lateral continua com os personagens do livro */ });
    return () => { alive = false; };
  }, [!!chapter]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!chapter || !src || !bookHasChapters(src.data, book.slug)) return { ready: false, hasBook: false, people: [] };
  const people = peopleInChapterFrom(src.data, book.slug, chapter).map((id) => ({ id, name: src.names.get(id)?.[lang] })).filter((p) => p.name);
  return { ready: true, hasBook: true, people };
}

// Lateral da Ficha e do Ler: versículo-chave, personagens e esboço. Com `chapter` (no leitor), os personagens são os citados
// no capítulo (com "Ver todos do livro" para a lista da ficha; volta ao padrão ao trocar de capítulo) e a(s) seção(ões) do esboço
// que contêm o capítulo ficam em negrito e destacadas.
function Aside({ book, lang, t, info, keyChapter, chapter }) {
  const here = chapter ? sectionsAt(info.outline, chapter) : [];
  const ref = (r) => `${book.ab[lang]} ${r}`;
  const { can } = usePlan();
  const inChapter = useChapterPeople(book, chapter, lang);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => { setShowAll(false); }, [chapter, book.slug]);
  const byChapter = inChapter.ready && !showAll;
  return (
    <aside className="bk-side" aria-label={chapter ? t.bookCharacters : t.sheet}>
      <section className="bk-key">
        <h2>{t.keyVerse}</h2>
        <span className="bk-keyref">{ref(info.keyVerse)}</span>
        {keyChapter && <a href={hrefs.book(book.slug, 'read', String(keyChapter))}>{t.readChapter.replace('{n}', keyChapter)}</a>}
      </section>
      <section className="card small">
        <h2>{!chapter ? t.characters : byChapter ? t.charsInChapter : t.bookCharacters}</h2>
        {byChapter ? (
          <div aria-live="polite">
            {inChapter.people.length ? (
              <div className="chips">
                {inChapter.people.map((p) => (
                  <span key={p.id} className="chip"><span>{can('person', { id: p.id }) ? <a className="plink" href={hrefs.person(p.id)}>{p.name}</a> : p.name}</span></span>
                ))}
              </div>
            ) : <p className="side-note">{t.noCharsInChapter}</p>}
          </div>
        ) : (
          <div className="chips">
            {info.characters.map((c, i) => (<span key={i} className="chip"><span><CharName c={c} lang={lang} /></span></span>))}
          </div>
        )}
        {inChapter.hasBook && <button type="button" className="linklike side-link" onClick={() => setShowAll(!showAll)}>{showAll ? t.seeOnlyChapter : t.seeAllBook}</button>}
        {chapter && !byChapter && <a className="side-link" href={hrefs.book(book.slug, 'sheet')}>{t.seeSheet}</a>}
      </section>
      <section className="card small">
        <h2>{t.outline}</h2>
        <ol className="outline">{info.outline.map((o, i) => (
          <li key={i} className={here.includes(i) ? 'here' : undefined} aria-current={here.includes(i) ? 'location' : undefined}><span>{ref(o.ref)}</span> {pick(o.title, lang)}</li>
        ))}</ol>
        {chapter && here.length > 0 && <p className="side-note">{t.hereNow.replace('{n}', chapter)}</p>}
      </section>
    </aside>
  );
}

function Sheet({ book, lang, t, info, error, keyChapter }) {
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
  const field = (label, body) => (<div className="bk-field"><span className="bk-label">{label}</span>{body}</div>);
  const card = (title, body) => (<section className="card"><h2>{title}</h2>{body}</section>);

  return (
    <div className="bk-cols sheetinfo">
      <div className="bk-main">
        <section className="card">
          <h2>{t.bookData}</h2>
          <div className="bk-fields">
            {field(t.author, view(info.author))}
            {field(t.date, view(info.date))}
            {field(t.place, <p>{rich(info.place)}</p>)}
            {field(t.recipients, <p>{rich(info.recipients)}</p>)}
          </div>
        </section>
        {card(t.theme, <p>{rich(info.theme)}</p>)}
        {card(t.historicalContext, <p>{rich(info.historicalContext)}</p>)}
        {card(t.characterRoles, <ul>{info.characters.map((c, i) => (<li key={i}><b><CharName c={c} lang={lang} /></b>: {rich(c.role)}</li>))}</ul>)}
        {card(t.connections, <p>{rich(info.connections)}</p>)}
        <p className="note">{t.sheetNote}</p>
      </div>
      <Aside book={book} lang={lang} t={t} info={info} keyChapter={keyChapter} />
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

function Reader({ book, lang, t, info, keyChapter, initialChapter }) {
  const versions = VERSIONS.filter((v) => v.available && (!v.books || v.books.includes(book.n)));
  const [version, setVersion] = useState(() => { const r = peekResume(book.slug); return versions.some((v) => v.id === r) ? r : pickVersion(versions, lang); });
  const [chapter, setChapter] = useState(initialChapter >= 1 && initialChapter <= book.chapters ? initialChapter : 1);
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const top = useRef(null);
  const prefs = resolvePrefs(useUserData().prefs);
  const site = useResolvedSite();
  // Originais em hebraico e grego (Pro): quem não tem o plano vê o botão, mas ele só abre o convite e nada é carregado
  const plan = usePlan();
  const canOriginals = !plan.loading && plan.can('originals');
  const [invite, setInvite] = useState(false);
  const showOrig = canOriginals && prefs.originals;
  const orig = useOriginals(book.n, showOrig);
  const toggleOriginals = () => { if (canOriginals) setPrefs({ originals: !prefs.originals }); else setInvite((x) => !x); };
  const first = useRef(true);

  useEffect(() => {
    let alive = true;
    setData(null); setError(false);
    loadBook(version, book.n).then((d) => alive && setData(d)).catch(() => alive && setError(true));
    return () => { alive = false; };
  }, [version, book.n]);

  // "Continuar de onde parei": grava a posição ao abrir um capítulo no leitor (não ao só abrir a ficha)
  useEffect(() => { setPosition({ version, slug: book.slug, chapter }); }, [version, book.slug, chapter]);
  // ao trocar de capítulo, volta ao topo da leitura (não na abertura da aba)
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    top.current?.scrollIntoView({ block: 'start' });
  }, [chapter]);

  const current = versions.find((v) => v.id === version);
  const groups = [lang, ...Object.keys(LANG_NAME).filter((l) => l !== lang)]
    .map((l) => [l, versions.filter((v) => v.lang === l)]).filter(([, vs]) => vs.length);
  const verses = data?.[chapter - 1];

  const choose = (id) => {
    setVersion(id);
    writePref(versions.find((v) => v.id === id).lang, id);
  };
  const arrow = (d) => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>);
  const prevBtn = (<button type="button" className="ghost icon-btn" aria-label={t.prevChapter} title={t.prevChapter} disabled={chapter <= 1} onClick={() => setChapter(chapter - 1)}>{arrow('M15 5l-7 7 7 7')}</button>);
  const nextBtn = (<button type="button" className="ghost icon-btn" aria-label={t.nextChapter} title={t.nextChapter} disabled={chapter >= book.chapters} onClick={() => setChapter(chapter + 1)}>{arrow('M9 5l7 7-7 7')}</button>);

  return (
    <div className="bk-cols reader">
      <div className="bk-main reader-card" ref={top}>
        <div className="reader-bar">
          <span className="pair">
            <label htmlFor="chap">{t.chapter}</label>
            <select id="chap" value={chapter} onChange={(e) => setChapter(Number(e.target.value))}>
              {Array.from({ length: book.chapters }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
            </select>
          </span>
          <span className="pair">
            <label htmlFor="ver">{t.version}</label>
            <select id="ver" value={version} onChange={(e) => choose(e.target.value)} title={current.full}>
              {groups.map(([l, vs]) => (
                <optgroup key={l} label={LANG_NAME[l]}>
                  {vs.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
                </optgroup>
              ))}
            </select>
          </span>
          <span className="bar-end">
            <button type="button" role="switch" aria-checked={showOrig} className="ghost orig-switch" onClick={toggleOriginals} title={t.originalsHelp}>
              <span className="orig-aleph" aria-hidden="true">א</span>{t.originals}{!canOriginals && !plan.loading && <span className="pro-tag">{t.proTag}</span>}
            </button>
            {prevBtn}{nextBtn}
            <a className="ghost" href={hrefs.settings} aria-label={t.readSettingsLabel}><span className="aa" aria-hidden="true">Aa</span>{t.readSettings}</a>
          </span>
        </div>
        {invite && !canOriginals && <div className="orig-invite"><ProInvite t={t} lang={lang} feature="originals" /></div>}
        {showOrig && orig.error && <p className="soon">{t.loadError}</p>}
        {error && <p className="soon">{t.loadError}</p>}
        {!error && !verses && <p className="soon">{t.loading}</p>}
        <article className="reader-text" style={readStyle(prefs, site)}>
          <div className="chap-title">
            <h2>{book.name[lang]} {chapter}</h2>
            <FavButton favKey={favKey.chapter(book.slug, chapter)} t={t} />
          </div>
          {verses && !(showOrig && orig.data) && (
            // O número vem da posição: versículo que a versão não tem é null e fica sem texto, sem deslocar os seguintes.
            <div className={`text${prefs.verseLines ? ' lines' : ''}`} lang={current.lang}>
              <p>{verses.map((v, i) => (v === null ? null : <span key={i}><sup>{i + 1}</sup>{v} </span>))}</p>
            </div>
          )}
          {verses && showOrig && orig.data && (
            // Com os originais ligados, cada versículo vira um bloco: texto da versão e, abaixo, a faixa de palavras do original (numeração da KJV).
            <div className="text orig" lang={current.lang}>
              {orig.data.t?.[chapter] && (
                <div className="overse"><p className="otitle">{t.psalmTitle}</p><Strip words={orig.data.t[chapter]} lang={orig.data.lang} lex={orig.lex} label={t.psalmTitle} cantillation={prefs.cantillation} /></div>
              )}
              {verses.map((v, i) => {
                const words = orig.data.w[chapter - 1]?.[i] ?? [];
                if (v === null && !words.length) return null;
                return (
                  <div className="overse" key={i}>
                    {v !== null && <p className="vtext"><sup>{i + 1}</sup>{v}</p>}
                    {words.length > 0 && <Strip words={words} lang={orig.data.lang} lex={orig.lex} label={`${t.originals} ${i + 1}`} cantillation={prefs.cantillation} />}
                  </div>
                );
              })}
            </div>
          )}
        </article>
        <div className="reader-foot">
          <span className="chapof">{t.chapterOf.replace('{n}', chapter).replace('{m}', book.chapters)}</span>
          <span className="bar-end">{prevBtn}{nextBtn}</span>
        </div>
        <div className="credit">
          <p>
            {pick(current.credit, lang)} {pick(current.license, lang)}
            {current.licenseUrl && <> (<a href={current.licenseUrl} target="_blank" rel="noreferrer">{t.verLicense}</a>)</>}.
            {current.sourceUrl && <> <a href={current.sourceUrl} target="_blank" rel="noreferrer">{t.verSource}</a>.</>}
          </p>
          {current.note && <p>{pick(current.note, lang)}</p>}
          {showOrig && orig.data && <p>{orig.data.lang === 'he' ? t.originalsCreditHe : t.originalsCreditGrc} {t.originalsNote}</p>}
        </div>
      </div>
      {info && <Aside book={book} lang={lang} t={t} info={info} keyChapter={keyChapter} chapter={chapter} />}
    </div>
  );
}
