import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { BOOKS, SECTIONS, bySlug } from './data/books.js';
import { LANGS, T } from './i18n.js';
import BookModal from './BookModal.jsx';
import Logo from './Logo.jsx';
import SettingsModal from './SettingsModal.jsx';
import { SettingsContext } from './settings.js';
import { parseHash, hrefs, go } from './route.js';
import { usePageTitle } from './pageTitle.js';

// Linha do tempo só carrega quando aberta.
const Timeline = lazy(() => import('./Timeline.jsx'));
const People = lazy(() => import('./People.jsx'));
const Genealogy = lazy(() => import('./Genealogy.jsx'));

const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignora */ } },
};

const THEMES = ['auto', 'dark', 'light', 'parchment'];
const THEME_LABEL = { auto: 'Auto', dark: '☾', light: '☀', parchment: '📜' };

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function App() {
  const [lang, setLang] = useState(() => store.get('lang', navigator.language?.startsWith('en') ? 'en' : 'pt'));
  const [theme, setTheme] = useState(() => { const v = store.get('theme', 'auto'); return THEMES.includes(v) ? v : 'auto'; }); // auto | dark | light | parchment
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [route, setRoute] = useState(parseHash);
  const [settings, setSettings] = useState(() => ({ showScholarly: store.get('showScholarly', '1') !== '0' }));
  const [showSettings, setShowSettings] = useState(false);
  const t = T[lang];

  // Livro, linha do tempo e personagens ajustam o título com o detalhe (aba, evento, pessoa); aqui fica o da grade.
  usePageTitle([], t.title, route.kind === 'home');
  useEffect(() => { store.set('showScholarly', settings.showScholarly ? '1' : '0'); }, [settings]);
  useEffect(() => { document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en'; store.set('lang', lang); }, [lang]);
  useEffect(() => {
    const r = document.documentElement;
    if (theme === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', theme);
    store.set('theme', theme);
    // As fontes do Pergaminho só são pedidas na primeira vez que o tema é ativado
    if (theme === 'parchment' && !document.getElementById('parchment-fonts')) {
      const link = document.createElement('link');
      link.id = 'parchment-fonts';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&display=swap';
      document.head.appendChild(link);
    }
  }, [theme]);
  // A rota vem do hash. Ao sair da grade guardamos a rolagem para voltar ao mesmo ponto; páginas novas abrem no topo.
  const homeScroll = useRef(0);
  const routeRef = useRef(route);
  routeRef.current = route;
  useEffect(() => {
    const onHash = () => {
      if (routeRef.current.kind === 'home') homeScroll.current = window.scrollY;
      setRoute(parseHash());
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const pageKey = route.kind === 'book' ? route.slug : route.kind;
  useEffect(() => {
    window.scrollTo(0, route.kind === 'home' ? homeScroll.current : 0);
  }, [pageKey]);

  const open = (slug) => go(hrefs.book(slug));
  const openMap = (slug, place) => go(hrefs.book(slug, 'map', place));
  const openTimeline = (id = null) => go(hrefs.timeline(id));
  const openPerson = (id = null) => go(hrefs.person(id));
  const openTree = (id, node) => go(hrefs.tree(id, node));

  const groups = useMemo(() => {
    const q = norm(query.trim());
    return SECTIONS.map((s) => ({
      ...s,
      books: BOOKS.filter((b) => b.section === s.id
        && (filter === 'all' || b.testament === filter)
        && (!q || norm(b.name.pt).includes(q) || norm(b.name.en).includes(q) || norm(b.ab.pt).includes(q) || norm(b.ab.en).includes(q))),
    })).filter((g) => g.books.length);
  }, [filter, query]);

  const cycleTheme = () => setTheme((x) => THEMES[(THEMES.indexOf(x) + 1) % THEMES.length]);
  const themeName = { auto: t.themeAuto, dark: t.themeDark, light: t.themeLight, parchment: t.themeParchment }[theme];

  return (
    <SettingsContext.Provider value={settings}>
      <header className="top">
        <div className="brand">
          <h1>
            <a className="homelink" href={hrefs.home} aria-label={t.home} title={t.home}>
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v9.5h13V10" /><path d="M10 19.5v-5h4v5" /></svg>
            </a>
            {theme === 'parchment' && <a className="logo" href={hrefs.home} aria-hidden="true" tabIndex={-1}><Logo size={36} /></a>}
            <a href={hrefs.home}>{theme === 'parchment' ? <span className="wordmark">{t.title.split(' ')[0]}</span> : t.title}</a>
          </h1>
          <p>{t.subtitle}</p>
        </div>
        <div className="tools">
          <div className="seg" role="group" aria-label="Idioma / Language">
            {LANGS.map((l) => (
              <button key={l.id} type="button" aria-pressed={lang === l.id} onClick={() => setLang(l.id)}>{l.label}</button>
            ))}
          </div>
          <button type="button" className="ghost" onClick={() => setShowSettings(true)} aria-label={t.settings} title={t.settings}>⚙</button>
          <button type="button" className="ghost" onClick={cycleTheme} aria-label={`${t.toggleTheme}: ${themeName}`} title={`${t.toggleTheme}: ${themeName}`}>
            {THEME_LABEL[theme]}
          </button>
        </div>
      </header>

      {route.kind === 'home' && (
      <main>
        <div className="controls">
          <div className="seg" role="group">
            {['all', 'at', 'nt'].map((f) => (
              <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>{t[f]}</button>
            ))}
          </div>
          <button type="button" className="ghost" onClick={() => openTimeline()}>{t.timeline}</button>
          <button type="button" className="ghost" onClick={() => openPerson()}>{t.people}</button>
          <button type="button" className="ghost" onClick={() => openTree()}>{t.genealogy}</button>
          <input type="search" id="q" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.search} aria-label={t.search} />
        </div>

        {groups.length === 0 && <p className="empty">{t.noResults}</p>}
        {groups.map((g) => (
          <section key={g.id} className="group" style={{ '--c': `var(--s-${g.id})` }}>
            <h2><i aria-hidden="true" />{g[lang]}<span>{g.books.length}</span></h2>
            <div className="tiles">
              {g.books.map((b) => (
                <button key={b.slug} type="button" className="tile" onClick={() => open(b.slug)} aria-label={b.name[lang]}>
                  <span className="num">{b.n}</span>
                  <span className="ab">{b.ab[lang]}</span>
                  <span className="nm">{b.name[lang]}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </main>
      )}

      {route.kind === 'timeline' && (
        <Suspense fallback={<p className="soon page-wait">{t.loading}</p>}>
          <Timeline lang={lang} t={t} focusId={route.id} onOpenBook={open} onOpenMap={openMap} onOpenPerson={openPerson} />
        </Suspense>
      )}
      {route.kind === 'tree' && (
        <Suspense fallback={<p className="soon page-wait">{t.loading}</p>}>
          <Genealogy lang={lang} t={t} treeId={route.id} focusNode={route.node} onOpenBook={open} onOpenPerson={openPerson} onSelect={openTree} />
        </Suspense>
      )}
      {route.kind === 'person' && (
        <Suspense fallback={<p className="soon page-wait">{t.loading}</p>}>
          <People lang={lang} t={t} focusId={route.id} onOpenBook={open} onOpenTimeline={openTimeline} onOpenMap={openMap} onSelect={openPerson} onOpenTree={openTree} />
        </Suspense>
      )}
      {route.kind === 'book' && (
        <BookModal key={route.slug} book={bySlug[route.slug]} lang={lang} t={t} initialTab={route.tab} initialPlace={route.place} onNavigate={open} onOpenTimeline={openTimeline} onOpenPerson={openPerson} />
      )}
      <footer className="assinatura">
        {t.madeBy}{' '}
        <a href="https://github.com/andrescultori" target="_blank" rel="noopener noreferrer">André Scultori</a>
        {' · © 2026 · '}
        <a href="https://github.com/andrescultori/timoteo-app" target="_blank" rel="noopener noreferrer">GitHub</a>
      </footer>
      {showSettings && <SettingsModal t={t} settings={settings} onChange={setSettings} onClose={() => setShowSettings(false)} />}
    </SettingsContext.Provider>
  );
}
