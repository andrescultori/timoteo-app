import React, { useEffect, useMemo, useState } from 'react';
import { BOOKS, bySlug } from './data/books.js';
import { VERSIONS, loadBook } from './data/bible.js';
import { useUserData, markVerses, getVersionPref } from './userdata.js';
import { hrefs } from './route.js';
import { refLabel } from './verseSelect.js';
import { CatDot, NoteDialog, CategoryDialog, useCategories, PencilIcon } from './marksUi.jsx';

const STEP = 100; // renderiza por blocos: acima de ~100 marcações aparece "Mostrar mais"
const order = (m) => BOOKS.findIndex((b) => b.slug === m.b);

// Versão do texto na lista: a preferida do idioma (a mesma do leitor) ou a primeira disponível
function pickVersion(lang) {
  const inLang = VERSIONS.filter((v) => v.available && v.lang === lang);
  return (inLang.find((v) => v.id === getVersionPref(lang)) ?? inLang[0] ?? VERSIONS[0]).id;
}

// Texto dos livros que aparecem na lista (carregado sob demanda, um por livro). slug → dados | 'erro'
function useBookTexts(slugs, version) {
  const [texts, setTexts] = useState({});
  const need = slugs.filter((s) => !(`${version}/${s}` in texts)).join(',');
  useEffect(() => {
    let alive = true;
    need.split(',').filter(Boolean).forEach((slug) => {
      const key = `${version}/${slug}`;
      loadBook(version, bySlug[slug].n).then((d) => alive && setTexts((x) => ({ ...x, [key]: d }))).catch(() => alive && setTexts((x) => ({ ...x, [key]: 'erro' })));
    });
    return () => { alive = false; };
  }, [need, version]);
  return texts;
}

// Aba "Versículos" de #favorites: marcações agrupadas pelo filtro de categoria (Todas + 6), com texto, nota e ações.
export default function FavVerses({ t, lang }) {
  const { marks } = useUserData();
  const cats = useCategories(lang);
  const [cat, setCat] = useState('all'); // all | c1..c6 | none (só anotação)
  const [shown, setShown] = useState(STEP);
  const [editing, setEditing] = useState(null);
  const [renaming, setRenaming] = useState(false);
  const version = pickVersion(lang);
  const sorted = useMemo(() => [...marks].sort((a, b) => order(a) - order(b) || a.c - b.c || a.v - b.v), [marks]);
  const counts = useMemo(() => {
    const c = { all: sorted.length, none: 0 };
    for (const m of sorted) { if (m.cat) c[m.cat] = (c[m.cat] ?? 0) + 1; else c.none += 1; }
    return c;
  }, [sorted]);
  const list = useMemo(() => sorted.filter((m) => cat === 'all' || (cat === 'none' ? !m.cat : m.cat === cat)), [sorted, cat]);
  const visible = list.slice(0, shown);
  const texts = useBookTexts([...new Set(visible.map((m) => m.b))].filter((s) => bySlug[s]), version);
  useEffect(() => { setShown(STEP); }, [cat]);

  const filters = [['all', t.fvAll, null], ...cats.map((c) => [c.id, c.name, c.id])];
  if (counts.none) filters.push(['none', t.noteNoCat, null]);

  if (!sorted.length) return <div className="fv-empty"><p>{t.fvEmpty}</p><button type="button" className="linklike" onClick={() => setRenaming(true)}>{t.fvRename}</button>{renaming && <CategoryDialog t={t} lang={lang} onClose={() => setRenaming(false)} />}</div>;

  return (
    <div>
      <p className="fv-rename"><b>{t.fvTotal.replace('{n}', sorted.length)}</b> · <button type="button" className="linklike" onClick={() => setRenaming(true)}>{t.fvRename}</button></p>
      <div className="fv-wrap">
        <div className="fv-filter" role="group" aria-label={t.fvFilter}>
          {filters.map(([id, label, dot]) => (
            <button key={id} type="button" aria-pressed={cat === id} onClick={() => setCat(id)}>
              {dot && <CatDot id={dot} />}<span>{label}</span><span className="fv-count">{counts[id] ?? 0}</span>
            </button>
          ))}
        </div>
        <div>
          {list.length === 0 && <p className="fv-empty">{t.fvEmptyFilter}</p>}
          <ul className="fv-list">
            {visible.map((m) => {
              const b = bySlug[m.b];
              if (!b) return null;
              const data = texts[`${version}/${m.b}`];
              const text = Array.isArray(data) ? data[m.c - 1]?.[m.v - 1] : undefined; // undefined = ainda carregando ou sem texto; null = ausente na versão
              const c = cats.find((x) => x.id === m.cat);
              const label = refLabel(b.name[lang], m.c, [m.v]);
              return (
                <li key={`${m.b}:${m.c}:${m.v}`} className="fv-item">
                  <div className="fv-ref">
                    <a href={hrefs.book(m.b, 'read', String(m.c), m.v)}>{label}</a>
                    {c && <span className="fv-chip"><CatDot id={c.id} />{c.name}</span>}
                  </div>
                  {data === 'erro' ? <p className="fv-text"><em>{t.fvTextOffline}</em></p>
                    : data === undefined ? <p className="fv-text"><em>{t.fvLoadingText}</em></p>
                      : text ? <p className="fv-text">{text}</p> : <p className="fv-text"><em>{t.fvMissing}</em></p>}
                  {m.note && <p className="fv-note">{m.note}</p>}
                  <div className="fv-actions">
                    <a className="ghost" href={hrefs.book(m.b, 'read', String(m.c), m.v)}>{t.fvOpen}</a>
                    <button type="button" className="ghost" onClick={() => setEditing(m)}><PencilIcon /> {m.note ? t.fvNoteEdit : t.fvNoteAdd}</button>
                    <select aria-label={`${t.fvChangeCat}: ${label}`} value={m.cat ?? ''} onChange={(e) => markVerses(m.b, m.c, [m.v], { cat: e.target.value || null })}>
                      <option value="">{t.noteNoCat}</option>
                      {cats.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                    </select>
                  </div>
                </li>
              );
            })}
          </ul>
          {list.length > shown && <p><button type="button" className="ghost" onClick={() => setShown(shown + STEP)}>{t.fvMore.replace('{n}', list.length - shown)}</button></p>}
        </div>
      </div>
      {editing && (
        <NoteDialog key={`${editing.b}:${editing.c}:${editing.v}`} t={t} cats={cats} refText={refLabel(bySlug[editing.b].name[lang], editing.c, [editing.v])} mark={editing} onClose={() => setEditing(null)}
          onSave={({ cat: nc, note }) => markVerses(editing.b, editing.c, [editing.v], { cat: nc, note })} />
      )}
      {renaming && <CategoryDialog t={t} lang={lang} onClose={() => setRenaming(false)} />}
    </div>
  );
}
