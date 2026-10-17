import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import PageHead from './PageHead.jsx';
import ProInvite from './ProInvite.jsx';
import { NoteEditor } from './NoteText.jsx';
import { setAddTarget, readerSpot } from './addTarget.js';
import StudyIncluded from './StudyIncluded.jsx';
import { useIncludeDeps } from './useIncludeDeps.js';
import { INCLUDABLE } from './studyInclude.js';
import { BOOKS, SECTIONS, bySlug } from './data/books.js';
import people from './data/people-index.json'; // só id e nome (público); o conteúdo Pro de personagem não é carregado aqui
import { usePageTitle } from './pageTitle.js';
import { usePlan } from './plan.js';
import { useUserData, getPosition, getMark, getStudy, saveStudy, deleteStudy } from './userdata.js';
import { favKey } from './favKeys.js';
import { go, hrefs } from './route.js';
import { pick } from './timelineUtil.js';
import { refLabel } from './verseSelect.js';
import { pickVersion, useBookTexts } from './verseText.js';
import { VERSIONS } from './data/bible.js';
import { loadPeopleChapters } from './peopleChapters.js';
import { useContent, getTimeline, loadInfo, useInfoContent, hasInfoFile, hasProMap } from './data/content.js';
import { addItem, removeItem, moveItem, setItemNote, renameStudy, CTX_KEY, setItemInc, setContextIncluded, describeItem, newNoteId, blockKey, passageVerses, LIMITS } from './studiesCore.js';
import { buildContext, baseOf } from './studyContext.js';
import { EventName, labelOf, KIND_KEY } from './studyLabels.jsx';
import { fill, tplLabel, StudiesLimitNotice, useStudyQuota } from './studiesUi.jsx';


// Aplica uma edição ao estudo MAIS RECENTE (não ao que a tela renderizou), para campos com atraso não pisarem uns nos outros
const EMPTY_STUDY = { items: [], template: null };
const StudyPrint = lazy(() => import('./StudyPrint.jsx')); // só carrega ao exportar (Pro)

const edit = (id, fn) => { const cur = getStudy(id); if (!cur) return null; const r = fn(cur); if (r.study) saveStudy(r.study); return r; };

// Campo que grava depois de uma pausa na digitação e ao sair (nunca perde o último texto)
function useAutosave(initial, commit, delay = 600) {
  const [value, setValue] = useState(initial);
  const pending = useRef(null);
  const timer = useRef(null);
  const commitRef = useRef(commit);
  commitRef.current = commit;
  const flush = () => { clearTimeout(timer.current); if (pending.current !== null) { const v = pending.current; pending.current = null; commitRef.current(v); } };
  const change = (v) => { setValue(v); pending.current = v; clearTimeout(timer.current); timer.current = setTimeout(flush, delay); };
  useEffect(() => flush, []); // eslint-disable-line react-hooks/exhaustive-deps
  return [value, change, flush];
}

function NoteField({ initial, onCommit, label, placeholder, t, max = LIMITS.noteMax }) {
  const [v, change, flush] = useAutosave(initial ?? '', onCommit);
  return <NoteEditor value={v} onChange={change} onBlur={flush} label={label} placeholder={placeholder} max={max} t={t} />;
}

function Item({ study, index, d, lab, last, t, lang, texts, version, can, ctxDeps, incReady }) {
  const item = study.items[index];
  const isBlock = d.kind === 'block';
  const [noteOpen, setNoteOpen] = useState(isBlock || !!item.note);
  const name = lab?.text ?? item.k;
  const ask = isBlock && !d.free ? t[`tplAsk_${study.template}_${d.id.replace(/-/g, '_')}`] : isBlock ? t.studyNoteFreePh : t.studyNotePh;
  const verses = d.kind === 'passage' ? passageVerses(texts[`${version}/${d.slug}`], d.chapter, d.v1, d.v2) : null;
  const loadState = d.kind === 'passage' ? texts[`${version}/${d.slug}`] : null;
  const kind = KIND_KEY[d.kind];
  return (
    <li className={`st-item st-${d.kind}`}>
      <div className="st-item-head">
        {kind && <span className="fv-chip">{t[kind]}</span>}
        {isBlock ? <b>{name}</b> : lab && !lab.href ? <b>{lab.text}</b> : lab ? (
          <a href={lab.href}>{lab.event && can('timeline') ? <EventName id={d.id} t={t} lang={lang} /> : lab.text}</a>
        ) : <span><code>{item.k}</code></span>}
        {d.kind === 'person' && !can('person', { id: d.id }) && <span className="pro-tag">{t.proTag}</span>}
        <span className="st-actions">
          {!isBlock && <button type="button" className="ghost" aria-expanded={noteOpen} aria-label={fill(t.studyNoteOf, { name })} onClick={() => setNoteOpen(!noteOpen)}>{noteOpen ? t.studyNoteHide : t.studyNoteEdit}</button>}
          <button type="button" className="ghost" disabled={index === 0} aria-label={fill(t.studyMoveUp, { name })} onClick={() => edit(study.id, (s) => moveItem(s, index, -1))}>↑<span className="sr-only"> {t.studyUp}</span></button>
          <button type="button" className="ghost" disabled={last} aria-label={fill(t.studyMoveDown, { name })} onClick={() => edit(study.id, (s) => moveItem(s, index, 1))}>↓<span className="sr-only"> {t.studyDown}</span></button>
          <button type="button" className="ghost" aria-label={fill(t.studyRemoveItem, { name })} onClick={() => edit(study.id, (s) => removeItem(s, index))}>{t.studyRemove}</button>
        </span>
      </div>
      {verses && (
        <div className="st-verses" lang={lang}>
          {loadState === undefined ? <p className="soon">{t.studyTextLoading}</p>
            : loadState === 'erro' ? <p className="soon">{t.studyTextOffline}</p>
              : verses.map((v) => { const m = getMark(d.slug, d.chapter, v.n); return <p key={v.n}><sup>{v.n}</sup> {v.text == null ? <em>{t.studyTextMissing}</em> : <span className="vs" data-cat={m?.cat ?? undefined} style={{ '--r-fg': 'var(--fg)' }}>{v.text}</span>}{m?.note && <span className="st-marknote"> ({t.studyMarkNote}: {m.note})</span>}</p>; })}
        </div>
      )}
      {INCLUDABLE.has(d.kind) && (
        <div className="inc-row">
          <label className="inc-switch">
            <input type="checkbox" role="switch" checked={!!item.inc} onChange={(e) => edit(study.id, (s2) => setItemInc(s2, index, e.target.checked))} aria-describedby={`inc-h-${index}`} />
            <span>{t.incSwitch}</span>
          </label>
          <span id={`inc-h-${index}`} className="st-meta">{t.incSwitchHelp}</span>
          {item.inc && <StudyIncluded d={d} ctxDeps={ctxDeps} ready={incReady} />}
        </div>
      )}
      {noteOpen && <NoteField t={t} initial={item.note} label={fill(t.studyNoteOf, { name })} placeholder={ask} onCommit={(v) => edit(study.id, (s) => setItemNote(s, index, v))} />}
    </li>
  );
}

// Eventos da linha do tempo (só quando o plano permite: pede o conteúdo Pro)
function EventPicker({ value, onChange, t, lang }) {
  const { ready } = useContent('timeline');
  const events = ready ? [...(getTimeline()?.events ?? [])].sort((a, b) => pick(a.title, lang).localeCompare(pick(b.title, lang), lang)) : [];
  if (!ready) return <p className="soon">{t.ctxLoading}</p>;
  return (
    <label>{t.studyEvent}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {events.map((e) => <option key={e.id} value={e.id}>{pick(e.title, lang)}</option>)}
      </select>
    </label>
  );
}

// Formulário "Adicionar item": passagem, personagem, lugar do mapa ou nota livre
function AddItem({ study, t, lang, can, onDone }) {
  const [kind, setKind] = useState('passage');
  const [slug, setSlug] = useState('gen');
  const [chapter, setChapter] = useState('1');
  const [v1, setV1] = useState('1');
  const [v2, setV2] = useState('');
  const [pid, setPid] = useState('');
  const [eid, setEid] = useState('');
  const [places, setPlaces] = useState(null); // null = carregando | [] sem mapa | 'locked'
  const [place, setPlace] = useState('');
  const [err, setErr] = useState(null);
  const allowed = useMemo(() => people.filter((p) => can('person', { id: p.id })).sort((a, b) => pick(a.name, lang).localeCompare(pick(b.name, lang), lang)), [can, lang]);
  const book = bySlug[slug];

  useEffect(() => {
    if (kind !== 'place') return undefined;
    let alive = true;
    setPlaces(null);
    setPlace('');
    if (hasProMap(slug) && !can('map', { slug })) { setPlaces('locked'); return undefined; }
    if (!hasInfoFile(slug)) { setPlaces([]); return undefined; }
    loadInfo(slug).then((info) => alive && setPlaces(info?.map?.places ?? [])).catch(() => alive && setPlaces([]));
    return () => { alive = false; };
  }, [kind, slug]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = (e) => {
    e.preventDefault();
    let k = null;
    if (kind === 'passage') {
      const c = Number(chapter); const a = Number(v1); const b = v2 === '' ? a : Number(v2);
      if (!Number.isInteger(c) || c < 1 || c > book.chapters || !Number.isInteger(a) || !Number.isInteger(b) || a < 1 || b < a || b > 176) { setErr('studyErrInvalid'); return; }
      k = favKey.ref(slug, c, a, b);
    } else if (kind === 'person') {
      if (!pid) { setErr('studyErrPick'); return; }
      k = favKey.person(pid);
    } else if (kind === 'place') {
      if (!place) { setErr('studyErrPick'); return; }
      k = favKey.place(slug, place);
    } else if (kind === 'event') {
      if (!eid) { setErr('studyErrPick'); return; }
      k = favKey.event(eid);
    } else if (kind === 'chapter') {
      const c = Number(chapter);
      if (!Number.isInteger(c) || c < 1 || c > book.chapters) { setErr('studyErrInvalid'); return; }
      k = favKey.chapter(slug, c);
    } else k = favKey.book(slug);
    const r = addItem(study, k);
    if (r.error) { setErr(r.error === 'full' ? 'studyErrFull' : r.error === 'duplicate' ? 'studyErrDup' : 'studyErrInvalid'); return; }
    saveStudy(r.study);
    setErr(null);
    onDone();
  };
  const bookSelect = (
    <label>{t.studyBook}
      <select value={slug} onChange={(e) => { setSlug(e.target.value); setChapter('1'); }}>
        {BOOKS.map((b) => <option key={b.slug} value={b.slug}>{b.name[lang]}</option>)}
      </select>
    </label>
  );
  return (
    <form className="st-form st-add" onSubmit={submit}>
      <label>{t.studyAddKind}
        <select value={kind} onChange={(e) => { setKind(e.target.value); setErr(null); }}>
          <option value="passage">{t.studyAddPassage}</option>
          <option value="person">{t.studyAddPerson}</option>
          <option value="place">{t.studyAddPlace}</option>
          <option value="event">{t.studyAddEvent}</option>
          <option value="chapter">{t.studyAddChapter}</option>
          <option value="book">{t.studyAddBook}</option>
        </select>
      </label>
      {kind === 'passage' && (
        <div className="st-row">
          {bookSelect}
          <label>{t.studyChapter}<input type="number" inputMode="numeric" min={1} max={book.chapters} value={chapter} onChange={(e) => setChapter(e.target.value)} /></label>
          <label>{t.studyVerseFrom}<input type="number" inputMode="numeric" min={1} max={176} value={v1} onChange={(e) => setV1(e.target.value)} /></label>
          <label>{t.studyVerseTo}<input type="number" inputMode="numeric" min={1} max={176} value={v2} onChange={(e) => setV2(e.target.value)} /></label>
        </div>
      )}
      {kind === 'passage' && (
        <p><button type="button" className="ghost" onClick={() => { const sp = readerSpot(study, describeItem, getPosition()); setAddTarget(study.id); go(hrefs.book(sp.slug, 'read', String(sp.chapter))); }}>{t.studyGoText}</button></p>
      )}
      {kind === 'chapter' && (
        <div className="st-row">
          {bookSelect}
          <label>{t.studyChapter}<input type="number" inputMode="numeric" min={1} max={book.chapters} value={chapter} onChange={(e) => setChapter(e.target.value)} /></label>
        </div>
      )}
      {kind === 'book' && <div className="st-row">{bookSelect}</div>}
      {kind === 'event' && (can('timeline') ? <EventPicker value={eid} onChange={setEid} t={t} lang={lang} /> : <p className="soon">{t.studyEventLocked}</p>)}
      {kind === 'person' && (
        <label>{t.studyPerson}
          <select value={pid} onChange={(e) => setPid(e.target.value)}>
            <option value="">—</option>
            {allowed.map((p) => <option key={p.id} value={p.id}>{pick(p.name, lang)}</option>)}
          </select>
        </label>
      )}
      {kind === 'place' && (
        <div className="st-row">
          {bookSelect}
          {places === null ? <p className="soon">{t.studyPlaceLoading}</p>
            : places === 'locked' ? <p className="soon">{t.studyPlaceLocked}</p>
              : places.length === 0 ? <p className="soon">{t.studyPlaceNone}</p>
                : (
                  <label>{t.studyPlace}
                    <select value={place} onChange={(e) => setPlace(e.target.value)}>
                      <option value="">—</option>
                      {places.map((p) => <option key={p.name.pt} value={p.name.pt}>{pick(p.name, lang)}</option>)}
                    </select>
                  </label>
                )}
        </div>
      )}
      {err && <p className="mark-limit" role="alert">{t[err]}</p>}
      <div className="mark-actions">
        <button type="submit" className="ghost">{t.studyAddBtn}</button>
        <button type="button" className="ghost" onClick={() => onDone(false)}>{t.studyAddCancel}</button>
      </div>
    </form>
  );
}

// Painel Contexto: o que o app já sabe do texto-base. Pro e acadêmico só chegam a quem o plano libera (ver studyContext.js).
function ContextPanel({ study, t, lang, plan }) {
  const wantsTimeline = plan.can('timeline') && study.items.some((i) => i.k.startsWith('event:')); // só quem tem evento no estudo precisa da linha do tempo aqui
  const { ready: tlReady } = useContent(...(wantsTimeline ? ['timeline'] : []));
  const bases = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const it of study.items) {
      const b = baseOf(it.k, wantsTimeline && tlReady ? getTimeline() : null);
      if (!b || !bySlug[b.slug]) continue;
      const id = `${b.slug}:${b.chapter ?? ''}`;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({ id, ...b });
    }
    return out;
  }, [study.items, plan, wantsTimeline, tlReady]);
  const [sel, setSel] = useState(0);
  const base = bases[Math.min(sel, bases.length - 1)];
  const [wide, setWide] = useState(() => typeof matchMedia === 'function' && matchMedia('(min-width: 960px)').matches);
  return (
    <details className="st-ctx" open={wide} onToggle={(e) => setWide(e.currentTarget.open)}>
      <summary aria-label={t.ctxToggle}>{t.ctxTitle}</summary>
      <label className="inc-switch"><input type="checkbox" role="switch" checked={study.items.some((i) => i.k === CTX_KEY && i.inc)} onChange={(e) => edit(study.id, (s2) => setContextIncluded(s2, e.target.checked))} /><span>{t.incCtxSwitch}</span></label>
      {!base ? <p className="soon">{t.ctxEmpty}</p> : (
        <>
          {bases.length > 1 && (
            <label>{t.ctxBase}
              <select value={Math.min(sel, bases.length - 1)} onChange={(e) => setSel(Number(e.target.value))}>
                {bases.map((b, i) => <option key={b.id} value={i}>{bySlug[b.slug].name[lang]}{b.chapter ? ` ${b.chapter}` : ''}</option>)}
              </select>
            </label>
          )}
          <ContextBody key={base.id} base={base} t={t} lang={lang} plan={plan} />
        </>
      )}
    </details>
  );
}

function ContextBody({ base, t, lang, plan }) {
  const { slug, chapter } = base;
  const b = bySlug[slug];
  const { info } = useInfoContent(slug);
  const [pc, setPc] = useState(null);
  useEffect(() => { let alive = true; loadPeopleChapters().then((d) => alive && setPc(d)).catch(() => {}); return () => { alive = false; }; }, []);
  const canEvents = plan.can('events');
  const { ready } = useContent(...(canEvents ? ['timeline'] : []));
  const ctx = buildContext({
    slug, chapter, lang, book: b, info, peopleChapters: pc, peopleIndex: people,
    timeline: canEvents && ready ? getTimeline() : null, can: plan.can, plan: plan.plan, scholarly: plan.can('academic'), hasMap: !!info?.map || hasProMap(slug),
  });
  const f = ctx.ficha;
  return (
    <div className="st-ctx-body">
      <h3>{b.name[lang]}{chapter ? ` ${chapter}` : ''}</h3>
      <p className="st-meta">{t[b.testament]} · {SECTIONS.find((x) => x.id === b.section)?.[lang]}</p>
      {!info ? <p className="soon">{t.ctxLoading}</p> : f && (
        <dl className="st-dl">
          {f.author?.traditional && <><dt>{t.ctxAuthor}</dt><dd>{f.author.traditional}</dd></>}
          {f.author?.scholarly && <><dt>{t.ctxAuthorScholarly}</dt><dd>{f.author.scholarly}</dd></>}
          {f.date?.traditional && <><dt>{t.ctxDate}</dt><dd>{f.date.traditional}</dd></>}
          {f.date?.scholarly && <><dt>{t.ctxAuthorScholarly}</dt><dd>{f.date.scholarly}</dd></>}
          {f.theme && <><dt>{t.ctxTheme}</dt><dd>{f.theme}</dd></>}
          {f.keyVerse && <><dt>{t.ctxKeyVerse}</dt><dd>{f.keyVerse}</dd></>}
        </dl>
      )}
      {ctx.outline.length > 0 && (
        <section><h4>{t.ctxOutline}</h4><ul>{ctx.outline.map((o) => <li key={o.ref}>{o.title} <span className="st-meta">({o.ref})</span></li>)}</ul></section>
      )}
      <section>
        <h4>{t.ctxCharacters}</h4>
        {ctx.characters.status === 'ok' ? (
          <ul className="st-chips">{ctx.characters.items.map((c) => <li key={c.id ?? c.name}>{c.id && c.link ? <a href={hrefs.person(c.id)}>{c.name}</a> : <span>{c.name}</span>}{c.pro && <span className="pro-tag">{t.proTag}</span>}</li>)}</ul>
        ) : <p className="soon">{t.ctxNoneHere}</p>}
      </section>
      <section>
        <h4>{t.ctxEvents}</h4>
        {ctx.events.status === 'locked' ? <p className="soon">{t.ctxLockedEvents}</p>
          : ctx.events.status === 'ok' ? <ul>{ctx.events.items.map((e) => <li key={e.id}><a href={hrefs.timeline(e.id)}>{e.title}</a> <span className="st-meta">({e.ref})</span></li>)}</ul>
            : <p className="soon">{ready ? t.ctxNoneHere : t.ctxLoading}</p>}
      </section>
      {ctx.places.status !== 'none' && (
        <section>
          <h4>{t.ctxPlaces}</h4>
          {ctx.places.status === 'locked' ? <p className="soon">{t.ctxLockedPlaces}</p>
            : ctx.places.status === 'ok' ? <ul>{ctx.places.items.map((p) => <li key={p.namePt}><a href={hrefs.book(slug, 'map', p.namePt)}>{p.name}</a> <span className="st-meta">({p.ref}{p.uncertain ? ` · ${t.ctxUncertain}` : ''})</span></li>)}</ul>
              : <p className="soon">{t.ctxNoneHere}</p>}
        </section>
      )}
      <p className="st-meta">{t.ctxNote} <a href={hrefs.book(slug)}>{t.ctxOpenBook}</a></p>
    </div>
  );
}

export default function StudyPage({ lang, t, id }) {
  const ud = useUserData();
  const study = ud.studies.find((s) => s.id === id) ?? null;
  const plan = usePlan();
  const q = useStudyQuota();
  const [adding, setAdding] = useState(null); // null | 'top' | 'bottom': onde o formulário de item está aberto
  const [confirming, setConfirming] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [invite, setInvite] = useState(false);
  const exportBtn = useRef(null);
  const canExport = plan.can('study-export');
  usePageTitle([study?.title ?? t.studiesTitle, t.studiesTitle], t.title);
  const version = pickVersion(lang);
  const slugs = useMemo(() => [...new Set((study?.items ?? []).map((i) => describeItem(i.k, study.template)).filter((d) => d.kind === 'passage' && bySlug[d.slug]).map((d) => d.slug))], [study]);
  const texts = useBookTexts(slugs, version);
  const { ready: incReady, deps: incDeps } = useIncludeDeps(study ?? EMPTY_STUDY, plan.can, `${plan.plan}|${plan.isAdmin}`);
  const [title, changeTitle, flushTitle] = useAutosave(study?.title ?? '', (v) => { if (v.trim()) edit(id, (s) => renameStudy(s, v)); });

  if (!study) {
    return (
      <div className="page bookpage" role="region" aria-labelledby="st-title">
        <PageHead t={t} id="st-title" title={t.studiesTitle} />
        <div className="pg-card" style={{ '--c': 'var(--s-evangelhos)' }}><div className="body"><p className="soon">{t.studyNotFound}</p><p><a className="ghost" href={hrefs.studies()}>{t.studyBack}</a></p></div></div>
      </div>
    );
  }
  const ctxDeps = { lang, t, can: plan.can, plan: plan.plan, books: bySlug, study, peopleIndex: people, ...incDeps };
  const full = study.items.length >= LIMITS.itemsMax;
  const addNote = () => { const r = addItem(study, blockKey(newNoteId())); if (r.study) saveStudy(r.study); };
  const addBar = (where) => (
    <div className="st-addbar">
      <button type="button" className="ghost" aria-expanded={adding === where} onClick={() => setAdding(adding === where ? null : where)} disabled={full}>{t.studyAdd}</button>
      <button type="button" className="ghost" onClick={addNote} disabled={full}>{t.studyAddNoteBtn}</button>
    </div>
  );
  const addForm = (where) => adding === where && <AddItem study={study} t={t} lang={lang} can={plan.can} onDone={() => setAdding(null)} />;
  const vName = VERSIONS.find((v) => v.id === version)?.label ?? version;
  return (
    <div className="page bookpage" role="region" aria-labelledby="st-title">
      <PageHead t={t} id="st-title" title={study.title} sub={study.template ? t[`tplName_${study.template}`] : t.tplBlank} actions={(
        <>
          <a className="ghost" href={hrefs.studies()}>{t.studyBack}</a>
          <button type="button" className="ghost" ref={exportBtn} aria-label={t.studyExportAria} aria-expanded={!canExport ? invite : undefined} onClick={() => (canExport ? setPrinting(true) : setInvite(!invite))}>{t.studyExport}{!canExport && <span className="pro-tag">{t.proTag}</span>}</button>
        </>
      )} />
      <div className="pg-card" style={{ '--c': 'var(--s-evangelhos)' }}>
        <div className="body st-layout">
          <div className="st-main">
            <StudiesLimitNotice t={t} ud={ud} q={q} />
            {invite && !canExport && <ProInvite t={t} lang={lang} />}
            <label className="st-title-field">{t.studyTitleLabel}
              <input type="text" value={title} maxLength={LIMITS.titleMax} onChange={(e) => changeTitle(e.target.value)} onBlur={flushTitle} />
            </label>
            {addBar('top')}
            {addForm('top')}
            {study.items.length === 0 && <p className="soon">{t.studyEmpty}</p>}
            <ol className="st-items" aria-label={t.studyItemsList}>
              {study.items.map((it, i) => {
                const d = describeItem(it.k, study.template);
                return <Item key={it.k} study={study} index={i} d={d} lab={labelOf(d, t, lang, study)} last={i === study.items.length - 1} t={t} lang={lang} texts={texts} version={version} can={plan.can} ctxDeps={ctxDeps} incReady={incReady} />;
              })}
            </ol>
            {study.items.some((it) => describeItem(it.k).kind === 'passage') && <p className="st-meta">{fill(t.studyVersion, { v: vName })}</p>}
            {addBar('bottom')}
            {addForm('bottom')}
            <div className="st-danger">
              {confirming ? (
                <div role="alertdialog" aria-label={t.studyDelete}>
                  <p>{fill(t.studyDeleteAsk, { title: study.title })}</p>
                  <button type="button" className="ghost" onClick={() => { deleteStudy(id); go(hrefs.studies()); }}>{t.studyDeleteYes}</button>{' '}
                  <button type="button" className="ghost" onClick={() => setConfirming(false)}>{t.studiesCancel}</button>
                </div>
              ) : <button type="button" className="linklike" onClick={() => setConfirming(true)}>{t.studyDelete}</button>}
            </div>
          </div>
          <aside className="st-aside" aria-label={t.ctxTitle}>
            <ContextPanel study={study} t={t} lang={lang} plan={plan} />
          </aside>
        </div>
      </div>
      {printing && canExport && (
        <Suspense fallback={null}>
          <StudyPrint study={study} t={t} lang={lang} can={plan.can} planName={plan.plan} onClose={() => { setPrinting(false); setTimeout(() => exportBtn.current?.focus(), 0); }} />
        </Suspense>
      )}
    </div>
  );
}
