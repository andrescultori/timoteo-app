import React, { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { bySlug } from './data/books.js';
import { VERSIONS } from './data/bible.js';
import { getCategories, getMark } from './userdata.js';
import { MARK_COLORS } from './readingPrefs.js';
import { describeItem, passageVerses } from './studiesCore.js';
import { pickVersion, useBookTexts } from './verseText.js';
import { pick } from './timelineUtil.js';
import { EventName, labelOf, peopleById } from './studyLabels.jsx';
import { tplLabel } from './studiesUi.jsx';
import NoteText from './NoteText.jsx';

const LIGHT = MARK_COLORS.light;
// Tokens do tema claro, fixos: a folha não segue o tema do site nem o da leitura
const SHEET_VARS = {
  '--fg': '#1b1f1c', '--r-fg': '#1b1f1c', '--muted': '#4f5852', '--line': '#c9cfca', '--line-strong': '#7D867F', '--panel': '#ffffff', '--panel-2': '#f4f5f2', '--bg': '#f8f7f2',
  '--accent': '#0f2d24', '--accent-fill': '#0f2d24', '--on-accent': '#f8f7f2',
  ...Object.fromEntries(LIGHT.fill.map((c, i) => [`--mk${i + 1}`, c])),
  ...Object.fromEntries(LIGHT.ink.map((c, i) => [`--mk${i + 1}i`, c])),
};

// Folha de impressão do estudo (Pro): visualização na tela e, em @media print, só a folha (A4, margem de 20 mm). "Salvar como PDF" é o do navegador:
// sem servidor, sem biblioteca, funciona offline. Todo o conteúdo vem do aparelho (estudo, marcações, texto da versão ativa).
export default function StudyPrint({ study, t, lang, can, onClose }) {
  const printBtn = useRef(null);
  const version = pickVersion(lang);
  const ver = VERSIONS.find((v) => v.id === version);
  const items = useMemo(() => study.items.map((it) => ({ it, d: describeItem(it.k, study.template) })), [study]);
  const slugs = useMemo(() => [...new Set(items.filter((x) => x.d.kind === 'passage' && bySlug[x.d.slug]).map((x) => x.d.slug))], [items]);
  const texts = useBookTexts(slugs, version);
  const ready = slugs.every((s) => texts[`${version}/${s}`] !== undefined);
  const failed = slugs.some((s) => texts[`${version}/${s}`] === 'erro');
  const cats = getCategories(lang);
  const used = new Set();
  const date = new Date().toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });

  useEffect(() => {
    document.documentElement.classList.add('has-print');
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } };
    document.addEventListener('keydown', onKey);
    printBtn.current?.focus();
    return () => { document.documentElement.classList.remove('has-print'); document.removeEventListener('keydown', onKey); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (ready) printBtn.current?.focus(); }, [ready]); // o botão só habilita com o texto carregado

  const body = items.map(({ it, d }) => {
    const lab = labelOf(d, t, lang, study);
    if (d.kind === 'block') {
      const ask = !d.free ? t[`tplAsk_${study.template}_${d.id.replace(/-/g, '_')}`] : null;
      return (
        <section key={it.k} className="sp-item">
          <h3>{d.free ? t.studyNoteFree : tplLabel(t, study.template, d.id)}</h3>
          {it.note ? <NoteText className="sp-note" text={it.note} /> : ask && <p className="sp-ask">{ask}</p>}
        </section>
      );
    }
    if (d.kind === 'passage') {
      const data = texts[`${version}/${d.slug}`];
      const verses = Array.isArray(data) ? passageVerses(data, d.chapter, d.v1, d.v2) : [];
      return (
        <section key={it.k} className="sp-item">
          <h3>{lab ? lab.text : it.k} <span className="sp-ver">{ver?.label}</span></h3>
          <div className="sp-verses">
            {verses.map((v) => {
              const m = getMark(d.slug, d.chapter, v.n);
              if (m?.cat) used.add(m.cat);
              return (
                <p key={v.n}><sup>{v.n}</sup> {v.text == null ? <em>{t.studyTextMissing}</em> : <span className="vs" data-cat={m?.cat ?? undefined}>{v.text}</span>}{m?.note && <span className="sp-mnote"> [{m.note}]</span>}</p>
              );
            })}
            {data === 'erro' && <p><em>{t.studyTextOffline}</em></p>}
          </div>
          {it.note && <NoteText className="sp-note" text={it.note} />}
        </section>
      );
    }
    const kindKey = { chapter: 'studyKindChapter', book: 'studyKindBook', person: 'studyKindPerson', event: 'studyKindEvent', place: 'studyKindPlace' }[d.kind];
    const books = d.kind === 'person' ? (peopleById[d.id]?.books ?? []).map((s) => bySlug[s]?.ab[lang]).filter(Boolean) : [];
    return (
      <section key={it.k} className="sp-item">
        <h3><span className="sp-kind">{kindKey ? t[kindKey] : ''}</span> {d.kind === 'event' ? (can('timeline') ? <EventName id={d.id} t={t} lang={lang} /> : t.studyEventName) : lab ? lab.text : it.k}</h3>
        {books.length > 0 && <p className="sp-refs">{books.join(' · ')}</p>}
        {it.note && <NoteText className="sp-note" text={it.note} />}
      </section>
    );
  });
  const legend = cats.filter((c) => used.has(c.id));

  return createPortal(
    <div className="sp-root" style={SHEET_VARS} role="dialog" aria-modal="true" aria-label={t.studyPrintTitle}>
      <div className="sp-bar">
        <button type="button" className="ghost primary" ref={printBtn} disabled={!ready} onClick={() => window.print()}>{ready ? t.studyPrintGo : t.studyTextLoading}</button>
        <button type="button" className="ghost" onClick={onClose}>{t.addClose}</button>
        <p>{failed ? t.studyPrintOffline : t.studyPrintHelp}</p>
      </div>
      <article className="sp-sheet" lang={lang}>
        <header className="sp-head">
          <p>{study.template ? t[`tplName_${study.template}`] : t.tplBlank} · {date}</p>
          <h1>{study.title}</h1>
        </header>
        {body}
        {legend.length > 0 && (
          <section className="sp-legend" aria-label={t.studyPrintLegend}>
            <h4>{t.studyPrintLegend}</h4>
            <ul>{legend.map((c) => <li key={c.id}><span className="vs" data-cat={c.id}>{c.name}</span></li>)}</ul>
          </section>
        )}
        <footer className="sp-foot">
          <p>{t.studyPrintMade}</p>
          {items.some((x) => x.d.kind === 'passage') && ver && (
            <p>{pick(ver.credit, lang)} {pick(ver.license, lang)}{ver.licenseUrl ? ` (${ver.licenseUrl})` : ''}.</p>
          )}
        </footer>
      </article>
    </div>,
    document.body,
  );
}
