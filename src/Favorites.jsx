import React, { useEffect, useMemo, useState } from 'react';
import { bySlug } from './data/books.js';
import { people } from './data/people.json';
import BackButton from './BackButton.jsx';
import { HeartIcon } from './icons.jsx';
import { hrefs } from './route.js';
import { usePageTitle } from './pageTitle.js';
import { pick } from './timelineUtil.js';
import { useUserData, toggleFav, parseFavKey, FAV_TYPES } from './userdata.js';
import { useSession, signInWithGoogle } from './auth.js';
import { usePlan } from './plan.js';

// Os lugares do mapa não têm id: para saber se o favorito ainda existe, carrega a ficha do livro (uma vez por livro).
const INFO = import.meta.glob('./data/info/*.json');
const peopleById = Object.fromEntries(people.map((p) => [p.id, p]));

function usePlaceBooks(slugs) {
  const [maps, setMaps] = useState({}); // slug -> lista de lugares | null (sem ficha ou erro)
  const need = slugs.filter((s) => !(s in maps)).join(',');
  useEffect(() => {
    let alive = true;
    need.split(',').filter(Boolean).forEach((slug) => {
      const load = INFO[`./data/info/${slug}.json`];
      const done = (places) => alive && setMaps((m) => (slug in m ? m : { ...m, [slug]: places }));
      if (!load) done(null);
      else load().then((m) => done(m.default?.map?.places ?? [])).catch(() => done(null));
    });
    return () => { alive = false; };
  }, [need]);
  return maps;
}

// Resolve uma chave guardada em { label, href } ou null (destino que não existe mais nos dados)
function resolve(key, lang, maps, can) {
  const k = parseFavKey(key);
  if (!k) return null;
  if (k.type === 'book') { const b = bySlug[k.slug]; return b && { label: b.name[lang], href: hrefs.book(b.slug) }; }
  if (k.type === 'chapter') {
    const b = bySlug[k.slug];
    return b && k.n >= 1 && k.n <= b.chapters ? { label: `${b.name[lang]} ${k.n}`, href: hrefs.book(b.slug, 'read', String(k.n)) } : null;
  }
  if (k.type === 'person') { const p = peopleById[k.id]; return p && { label: pick(p.name, lang), href: hrefs.person(p.id), pro: !can('person', { id: p.id }) }; }
  const b = bySlug[k.slug];
  const places = maps[k.slug];
  if (!b || places === undefined) return b ? 'loading' : null;
  const pl = places?.find((x) => x.name?.pt === k.name);
  return pl ? { label: `${pick(pl.name, lang)} (${b.ab[lang]})`, href: hrefs.book(b.slug, 'map', pl.name.pt), pro: !can('map', { slug: b.slug }) } : null;
}

export default function Favorites({ lang, t }) {
  const { favs } = useUserData();
  const { enabled, signedIn } = useSession();
  const { can } = usePlan();
  usePageTitle([t.favorites], t.title);
  const placeSlugs = useMemo(() => [...new Set(favs.map((f) => parseFavKey(f.key)).filter((k) => k?.type === 'place' && bySlug[k.slug]).map((k) => k.slug))], [favs]);
  const maps = usePlaceBooks(placeSlugs);

  const groups = FAV_TYPES.map((type) => ({
    type,
    items: favs.filter((f) => (parseFavKey(f.key)?.type ?? 'other') === type),
  }));
  const unknown = favs.filter((f) => !parseFavKey(f.key));
  const typeTitle = { book: t.favTypeBook, chapter: t.favTypeChapter, person: t.favTypePerson, place: t.favTypePlace };

  return (
    <div className="page wide" role="region" aria-labelledby="fav-title">
      <div className="sheet" style={{ '--c': 'var(--s-evangelhos)' }}>
        <div className="head">
          <div className="ttl">
            <h2 id="fav-title">{t.favorites}</h2>
            <p>{t.favSub}</p>
          </div>
          <div className="head-actions"><BackButton t={t} /></div>
        </div>
        <div className="body">
          {!signedIn && (
            <p className="fav-device" role="note">{t.favNotice} {enabled && <button type="button" className="ghost" onClick={signInWithGoogle}>{t.signInGoogle}</button>}</p>
          )}
          {favs.length === 0 && <p className="soon">{t.favEmpty} <HeartIcon size={16} /></p>}
          {[...groups, { type: 'other', items: unknown }].filter((g) => g.items.length).map((g) => (
            <section key={g.type} className="fav-group">
              <h3 className="pp-group">{typeTitle[g.type] ?? t.favTypeOther} <span>{g.items.length}</span></h3>
              <ul className="fav-list">
                {g.items.map((f) => {
                  const r = resolve(f.key, lang, maps, can);
                  return (
                    <li key={f.key} className={r && r !== 'loading' ? 'fav-item' : 'fav-item fav-missing'}>
                      {r === 'loading' ? <span>{t.loading}</span>
                        : r ? <span><a href={r.href}>{r.label}</a>{r.pro && <span className="pro-tag">{t.proTag}</span>}</span>
                          : <span><code>{f.key}</code> <em>({t.favNotFound})</em></span>}
                      <button type="button" className="ghost fav-remove" aria-label={`${t.favRemove}: ${r && r !== 'loading' ? r.label : f.key}`} onClick={() => toggleFav(f.key)}>{t.favRemoveShort}</button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
