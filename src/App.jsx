import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { BOOKS, SECTIONS, bySlug } from './data/books.js';
import { LANGS, T } from './i18n.js';
import BookModal from './BookModal.jsx';
import Logo from './Logo.jsx';
import Account from './Account.jsx';
import ConsentModal from './ConsentModal.jsx';
import { useSession, signInWithGoogle } from './auth.js';
import { usePlan } from './plan.js';
import ProInvite from './ProInvite.jsx';
import { VERSIONS } from './data/bible.js';
import { useUserData, dismissContinue, dismissNotice, acknowledgeNotice, setResume } from './userdata.js';
import { SettingsContext } from './settings.js';
import { parseHash, hrefs, go } from './route.js';
import { usePageTitle } from './pageTitle.js';
import { useApplySiteTheme } from './siteTheme.js';

// Linha do tempo só carrega quando aberta.
const Timeline = lazy(() => import('./Timeline.jsx'));
const People = lazy(() => import('./People.jsx'));
const Genealogy = lazy(() => import('./Genealogy.jsx'));
const Favorites = lazy(() => import('./Favorites.jsx'));
const Profile = lazy(() => import('./Profile.jsx'));
const Checkout = lazy(() => import('./Checkout.jsx'));
const Legal = lazy(() => import('./Legal.jsx'));
const SettingsPage = lazy(() => import('./SettingsPage.jsx'));

const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignora */ } },
};

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
    <div className="continue-card" role="region" aria-label={t.continueTitle}>
      <div className="continue-main">
        <span className="continue-kicker">{t.continueTitle}</span>
        <span className="continue-title">{book.name[lang]} {position.chapter}{version ? ` · ${version.label}` : ''}</span>
      </div>
      <div className="continue-actions">
        <a className="continue-go" href={hrefs.book(position.slug, 'read', String(position.chapter))} onClick={go_}>{t.continueLabel}</a>
        <button type="button" className="ghost continue-x" onClick={dismissContinue} aria-label={t.continueDismiss} title={t.continueDismiss}>×</button>
      </div>
      {!noticeShown && !signedIn && (
        <span className="continue-note">{t.favNotice} <button type="button" className="ghost" onClick={acknowledgeNotice}>{t.favNoticeOk}</button><SignInOffer t={t} /></span>
      )}
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
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [route, setRoute] = useState(parseHash);
  const [settings, setSettings] = useState(() => ({ showScholarly: store.get('showScholarly', '1') !== '0' }));
  const plan = usePlan();
  const session = useSession();
  // A posição acadêmica é oculta para todos e visível só para o administrador (can('academic')); o interruptor das Configurações vale só para ele
  const effectiveSettings = { ...settings, showScholarly: plan.can('academic') && settings.showScholarly };
  const t = T[lang];
  useApplySiteTheme();

  // Livro, linha do tempo e personagens ajustam o título com o detalhe (aba, evento, pessoa); aqui fica o da grade.
  usePageTitle([], t.title, route.kind === 'home');
  useEffect(() => { store.set('showScholarly', settings.showScholarly ? '1' : '0'); }, [settings]);
  useEffect(() => { document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en'; store.set('lang', lang); }, [lang]);
  // A rota vem do hash. Ao sair da grade guardamos a rolagem para voltar ao mesmo ponto; páginas novas abrem no topo.
  const homeScroll = useRef(0);
  const peopleListScroll = useRef(0); // a lista de personagens também volta ao ponto em que estava, quando se volta de um personagem
  const routeRef = useRef(route);
  routeRef.current = route;
  useEffect(() => {
    const onHash = () => {
      const next = parseHash();
      const prev = routeRef.current;
      if (prev.kind === 'home') homeScroll.current = window.scrollY;
      if (prev.kind === 'person' && !prev.id) peopleListScroll.current = next.kind === 'person' && next.id ? window.scrollY : 0;
      else if (next.kind === 'person' && !next.id && prev.kind !== 'person') peopleListScroll.current = 0; // chegou à lista vindo de outra página: topo
      setRoute(next);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  // cada personagem é uma página nova (abre no topo); a lista, a grade e o resto seguem a regra acima
  const pageKey = route.kind === 'book' ? route.slug : route.kind === 'person' ? `person/${route.id ?? ''}` : route.kind;
  useEffect(() => {
    const listaDePersonagens = route.kind === 'person' && !route.id;
    window.scrollTo(0, route.kind === 'home' ? homeScroll.current : listaDePersonagens ? peopleListScroll.current : 0);
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


  const navKind = route.kind === 'book' ? 'home' : route.kind;
  const nav = [
    ['home', hrefs.home, t.navBooks],
    ['timeline', hrefs.timeline(), t.timeline],
    ['person', hrefs.person(), t.people],
    ['tree', hrefs.tree(), t.genealogy],
    ['favorites', hrefs.favorites, t.navFavorites],
  ];

  return (
    <SettingsContext.Provider value={effectiveSettings}>
      <header className="topbar">
        <div className="topbar-in">
          <a className="brand" href={hrefs.home} aria-label={t.home} title={t.home}>
            <span className="logo"><Logo size={40} /></span>
            <span className="wordmark">{t.title}</span>
          </a>
          <nav className="mainnav" aria-label={t.navMain}>
            {nav.map(([k, href, label]) => (
              <a key={k} href={href} aria-current={navKind === k ? 'page' : undefined}>{label}</a>
            ))}
          </nav>
          <div className="tools">
            <div className="seg" role="group" aria-label="Idioma / Language">
              {LANGS.map((l) => (
                <button key={l.id} type="button" aria-pressed={lang === l.id} onClick={() => setLang(l.id)}>{l.label}</button>
              ))}
            </div>
            <Account t={t} />
          </div>
        </div>
      </header>

      {route.kind === 'home' && (
      <main>
        <div className="hero">
          <div className="hero-text">
            <h1>{t.homeTitle}</h1>
            <p>{t.homeLead}</p>
          </div>
          <div className="hero-tools">
            <label className="search">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></svg>
              <input type="search" id="q" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.search} aria-label={t.searchLabel} />
            </label>
            <div className="pills" role="group" aria-label={t.filterLabel}>
              {['all', 'at', 'nt'].map((f) => (
                <button key={f} type="button" className="pill" aria-pressed={filter === f} onClick={() => setFilter(f)}>{t[f]}</button>
              ))}
            </div>
          </div>
        </div>
        <ContinueCard lang={lang} t={t} />

        {groups.length === 0 && <p className="empty">{t.noResults}</p>}
        <div className="groups">
        {groups.map((g) => (
          <section key={g.id} className="group" style={{ '--c': `var(--s-${g.id})` }}>
            <h2>{g[lang]}<span>{g.books.length} {g.books.length === 1 ? t.bookOne : t.bookMany}</span></h2>
            <div className="tiles">
              {g.books.map((b) => (
                <a key={b.slug} className="tile" href={hrefs.book(b.slug)} aria-label={b.name[lang]}>
                  <span className="ab">{b.ab[lang]}</span>
                  <span className="nm">{b.name[lang]}</span>
                </a>
              ))}
            </div>
          </section>
        ))}
        </div>
      </main>
      )}

      {route.kind === 'timeline' && plan.loading && <p className="soon page-wait">{t.loading}</p>}
      {route.kind === 'timeline' && !plan.loading && !plan.can('timeline') && <ProInvite t={t} lang={lang} page title={t.timeline} />}
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
      {route.kind === 'checkout' && (
        <Suspense fallback={<p className="soon page-wait">{t.loading}</p>}>
          <Checkout lang={lang} t={t} />
        </Suspense>
      )}
      {(route.kind === 'terms' || route.kind === 'privacy') && (
        <Suspense fallback={<p className="soon page-wait">{t.loading}</p>}>
          <Legal kind={route.kind} lang={lang} t={t} />
        </Suspense>
      )}
      {route.kind === 'settings' && (
        <Suspense fallback={<p className="soon page-wait">{t.loading}</p>}>
          <SettingsPage t={t} lang={lang} settings={settings} canAcademic={plan.can('academic')} onChange={setSettings} />
        </Suspense>
      )}
      {route.kind === 'favorites' && (
        <Suspense fallback={<p className="soon page-wait">{t.loading}</p>}>
          <Favorites lang={lang} t={t} />
        </Suspense>
      )}
      {route.kind === 'tree' && plan.loading && <p className="soon page-wait">{t.loading}</p>}
      {route.kind === 'tree' && !plan.loading && !plan.can('genealogy') && <ProInvite t={t} lang={lang} page title={t.genealogy} />}
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
        <div className="assinatura-in">
          <span className="assinatura-txt">
            {t.madeBy}{' '}
            <a href="https://github.com/andrescultori" target="_blank" rel="noopener noreferrer">André Scultori</a>
            {' · © 2026 · '}
            <a href="https://github.com/andrescultori/timoteo-app" target="_blank" rel="noopener noreferrer">GitHub</a>
          </span>
          <span>
            <a href={hrefs.terms}>{t.termsLink}</a>
            <a href={hrefs.privacy}>{t.privacyLink}</a>
          </span>
        </div>
      </footer>
      <DeviceNotice t={t} />
      {session.consentOpen && <ConsentModal t={t} lang={lang} />}
    </SettingsContext.Provider>
  );
}
