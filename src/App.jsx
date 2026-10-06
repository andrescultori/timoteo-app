import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { BOOKS, SECTIONS, bySlug } from './data/books.js';
import { LANGS, T } from './i18n.js';
import BookModal from './BookModal.jsx';
import Logo from './Logo.jsx';
import { HeartIcon } from './icons.jsx';
import Account from './Account.jsx';
import { useSession, signInWithGoogle } from './auth.js';
import { usePlan } from './plan.js';
import ProInvite from './ProInvite.jsx';
import { VERSIONS } from './data/bible.js';
import { useUserData, dismissContinue, dismissNotice, acknowledgeNotice, setResume } from './userdata.js';
import SettingsModal from './SettingsModal.jsx';
import { SettingsContext } from './settings.js';
import { parseHash, hrefs, go } from './route.js';
import { usePageTitle } from './pageTitle.js';

// Linha do tempo só carrega quando aberta.
const Timeline = lazy(() => import('./Timeline.jsx'));
const People = lazy(() => import('./People.jsx'));
const Genealogy = lazy(() => import('./Genealogy.jsx'));
const Favorites = lazy(() => import('./Favorites.jsx'));
const Profile = lazy(() => import('./Profile.jsx'));

const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignora */ } },
};

const THEMES = ['auto', 'dark', 'light']; // preferência: segue o sistema, Pergaminho escuro ou Pergaminho claro
const THEME_LABEL = { auto: 'Auto', dark: '☾', light: '☀' };
const systemDark = () => !window.matchMedia || window.matchMedia('(prefers-color-scheme: dark)').matches;

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Botão "Entrar com Google" dos avisos do aparelho (só quando o login existe)
function SignInOffer({ t }) {
  const { enabled, signedIn } = useSession();
  if (!enabled || signedIn) return null;
  return <button type="button" className="ghost" onClick={signInWithGoogle}>{t.signInGoogle}</button>;
}

// Cartão "Continuar: João 3 (versão)" no início, a partir da última posição de leitura
function ContinueCard({ lang, t }) {
  const { position, dismissedAt, noticeShown } = useUserData();
  const { signedIn } = useSession();
  const book = position && bySlug[position.slug];
  if (!position || !book || dismissedAt === position.at) return null;
  const version = VERSIONS.find((v) => v.id === position.version);
  const go_ = (e) => {
    e.preventDefault();
    setResume(position.slug, position.version); // o leitor abre na mesma versão
    go(hrefs.book(position.slug, 'read', String(position.chapter)));
  };
  return (
    <div className="continue-card" role="region" aria-label={t.continueLabel}>
      <a href={hrefs.book(position.slug, 'read', String(position.chapter))} onClick={go_}>
        {t.continueLabel}: <b>{book.name[lang]} {position.chapter}</b>{version ? ` (${version.label})` : ''}
      </a>
      {!noticeShown && !signedIn && (
        <span className="continue-note">{t.favNotice} <button type="button" className="ghost" onClick={acknowledgeNotice}>{t.favNoticeOk}</button><SignInOffer t={t} /></span>
      )}
      <button type="button" className="ghost continue-x" onClick={dismissContinue} aria-label={t.continueDismiss} title={t.continueDismiss}>×</button>
    </div>
  );
}

// Aviso único depois do primeiro favorito: os favoritos ficam só neste aparelho
function DeviceNotice({ t }) {
  const { noticePending } = useUserData();
  const { signedIn } = useSession();
  if (!noticePending || signedIn) return null;
  return (
    <div className="fav-toast" role="status">
      <span>{t.favNotice}</span>
      <button type="button" className="ghost" onClick={dismissNotice}>{t.favNoticeOk}</button>
      <SignInOffer t={t} />
    </div>
  );
}

export default function App() {
  const [lang, setLang] = useState(() => store.get('lang', navigator.language?.startsWith('en') ? 'en' : 'pt'));
  // 'light' (ou 'parchment', como o Pergaminho claro se chamava antes) = claro; qualquer outro valor (auto, escuro antigo, inválido) = escuro
  // preferência guardada: auto | dark | light ('parchment', o nome antigo do Pergaminho claro, vira light; valor inválido vira auto)
  const [theme, setTheme] = useState(() => { const v = store.get('theme', 'auto'); return v === 'parchment' ? 'light' : THEMES.includes(v) ? v : 'auto'; });
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [route, setRoute] = useState(parseHash);
  const [settings, setSettings] = useState(() => ({ showScholarly: store.get('showScholarly', '1') !== '0' }));
  const plan = usePlan();
  // A posição acadêmica é oculta para todos e visível só para o administrador (can('academic')); o interruptor das Configurações vale só para ele
  const effectiveSettings = { ...settings, showScholarly: plan.can('academic') && settings.showScholarly };
  const [showSettings, setShowSettings] = useState(false);
  const t = T[lang];

  // Livro, linha do tempo e personagens ajustam o título com o detalhe (aba, evento, pessoa); aqui fica o da grade.
  usePageTitle([], t.title, route.kind === 'home');
  useEffect(() => { store.set('showScholarly', settings.showScholarly ? '1' : '0'); }, [settings]);
  useEffect(() => { document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en'; store.set('lang', lang); }, [lang]);
  // O CSS só conhece data-theme = dark | light; no modo auto o valor é o do sistema e acompanha a troca dele
  useEffect(() => {
    store.set('theme', theme);
    const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    const apply = () => {
      const resolved = theme === 'auto' ? (systemDark() ? 'dark' : 'light') : theme;
      document.documentElement.setAttribute('data-theme', resolved);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'light' ? '#fbf9f3' : '#17130e');
    };
    apply();
    if (theme !== 'auto' || !mq) return undefined;
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
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

  const toggleTheme = () => setTheme((x) => THEMES[(THEMES.indexOf(x) + 1) % THEMES.length]);
  const themeName = { auto: t.themeAuto, dark: t.themeDark, light: t.themeLight }[theme];

  const groups = useMemo(() => {
    const q = norm(query.trim());
    return SECTIONS.map((s) => ({
      ...s,
      books: BOOKS.filter((b) => b.section === s.id
        && (filter === 'all' || b.testament === filter)
        && (!q || norm(b.name.pt).includes(q) || norm(b.name.en).includes(q) || norm(b.ab.pt).includes(q) || norm(b.ab.en).includes(q))),
    })).filter((g) => g.books.length);
  }, [filter, query]);


  return (
    <SettingsContext.Provider value={effectiveSettings}>
      <header className="top">
        <div className="brand">
          <h1>
            <a className="homelink" href={hrefs.home} aria-label={t.home} title={t.home}>
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v9.5h13V10" /><path d="M10 19.5v-5h4v5" /></svg>
            </a>
            <a className="logo" href={hrefs.home} aria-hidden="true" tabIndex={-1}><Logo size={36} /></a>
            <a href={hrefs.home}><span className="wordmark">{t.title.split(' ')[0]}</span></a>
          </h1>
          <p>{t.subtitle}</p>
        </div>
        <div className="tools">
          <div className="seg" role="group" aria-label="Idioma / Language">
            {LANGS.map((l) => (
              <button key={l.id} type="button" aria-pressed={lang === l.id} onClick={() => setLang(l.id)}>{l.label}</button>
            ))}
          </div>
          <a className="ghost fav-link" href={hrefs.favorites} aria-label={t.favorites} title={t.favorites}><HeartIcon size={18} /></a>
          <button type="button" className="ghost" onClick={() => setShowSettings(true)} aria-label={t.settings} title={t.settings}>⚙</button>
          <button type="button" className="ghost" onClick={toggleTheme} aria-label={`${t.toggleTheme}: ${themeName}`} title={`${t.toggleTheme}: ${themeName}`}>{THEME_LABEL[theme]}</button>
          <Account t={t} />
        </div>
      </header>

      {route.kind === 'home' && (
      <main>
        <ContinueCard lang={lang} t={t} />
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

      {route.kind === 'timeline' && plan.loading && <p className="soon page-wait">{t.loading}</p>}
      {route.kind === 'timeline' && !plan.loading && !plan.can('timeline') && <ProInvite t={t} page title={t.timeline} />}
      {route.kind === 'timeline' && !plan.loading && plan.can('timeline') && (
        <Suspense fallback={<p className="soon page-wait">{t.loading}</p>}>
          <Timeline lang={lang} t={t} focusId={route.id} onOpenBook={open} onOpenMap={openMap} onOpenPerson={openPerson} />
        </Suspense>
      )}
      {route.kind === 'profile' && (
        <Suspense fallback={<p className="soon page-wait">{t.loading}</p>}>
          <Profile lang={lang} t={t} />
        </Suspense>
      )}
      {route.kind === 'favorites' && (
        <Suspense fallback={<p className="soon page-wait">{t.loading}</p>}>
          <Favorites lang={lang} t={t} />
        </Suspense>
      )}
      {route.kind === 'tree' && plan.loading && <p className="soon page-wait">{t.loading}</p>}
      {route.kind === 'tree' && !plan.loading && !plan.can('genealogy') && <ProInvite t={t} page title={t.genealogy} />}
      {route.kind === 'tree' && !plan.loading && plan.can('genealogy') && (
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
      <DeviceNotice t={t} />
      {showSettings && <SettingsModal t={t} settings={settings} canAcademic={plan.can('academic')} onChange={setSettings} onClose={() => setShowSettings(false)} />}
    </SettingsContext.Provider>
  );
}
