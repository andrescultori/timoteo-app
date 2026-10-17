import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useUserData, setCategories, resetCategories } from './userdata.js';
import { useSession } from './auth.js';
import { CATS, LIMITS, DEFAULT_CATEGORY_NAMES, categoryList } from './marksCore.js';
import { commonCat } from './verseSelect.js';

// Peças da interface de marcação de versículos (leitor, Favoritos e Configurações). A cor de cada categoria vem dos tokens --mk1..6 e o traço
// do sublinhado de [data-cat] (src/styles.css); o nome é do usuário (padrão em marksCore.js).

// As 6 categorias com o nome do usuário (ou o de partida): [{ id, name, custom }]
export function useCategories(lang) {
  const { categories } = useUserData();
  return useMemo(() => categoryList(categories, lang), [categories, lang]);
}

// Bolinha com a cor e o traço da categoria (o traço é o sinal além da cor)
export const CatDot = ({ id }) => (<span className="mk-dot" data-cat={id} aria-hidden="true"><i /><u /></span>);

export const PencilIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 013 3L8 19l-4 1z" /><path d="M14 7l3 3" /></svg>
);

// <dialog> modal aberto ao montar; fecha com Esc, clique fora ou onClose
function useDialog(onClose) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    const handle = () => onClose();
    d?.addEventListener('close', handle);
    return () => { d?.removeEventListener('close', handle); if (d?.open) d.close(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return ref;
}

// Barra inferior com os versículos selecionados (position: fixed, respeita a área segura do iPhone)
export function MarkBar({ t, cats, label, count, marks, verses, onCat, onClear, onNote, canAddStudy = false, onAddStudy, limitHit, onDismissLimit, n }) {
  const active = commonCat(marks, verses);
  const many = verses.length !== 1;
  return (
    <div className="mark-bar">
      <div className="mark-bar-in" role="toolbar" aria-label={t.markBarLabel}>
        <div className="mark-bar-top">
          <b aria-live="polite">{count === 1 ? t.markCount1 : t.markCountN.replace('{n}', count)} · {label}</b>
          <button type="button" className="ghost" onClick={onClear}>{t.markClear}</button>
        </div>
        {limitHit && <p className="mark-limit" role="alert">{t.marksLimit.replace('{n}', n)} <button type="button" className="linklike" onClick={onDismissLimit}>{t.catClose}</button></p>}
        <div className="mark-grid">
          {cats.map((c) => (
            <button key={c.id} type="button" className="mk-cat" aria-pressed={active === c.id} onClick={() => onCat(c.id)} title={c.name}>
              <CatDot id={c.id} /><span className="mk-name">{c.name}</span>
            </button>
          ))}
        </div>
        <div className="mark-actions">
          <button type="button" className="ghost" disabled={many} title={many ? t.markNoteMany : undefined} onClick={onNote}>{t.markNote}</button>
          <button type="button" className="ghost" disabled={!canAddStudy} title={canAddStudy ? undefined : t.markSoon} onClick={onAddStudy}>{t.markAddStudy}</button>
        </div>
      </div>
    </div>
  );
}

// Anotação de UM versículo (bottom sheet no celular). Grava a nota e, se o usuário trocar, a categoria.
export function NoteDialog({ t, cats, refText, mark, onSave, onClose }) {
  const ref = useDialog(onClose);
  const { signedIn, consent } = useSession();
  const [text, setText] = useState(mark?.note ?? '');
  const [cat, setCat] = useState(mark?.cat ?? null);
  const [pick, setPick] = useState(false);
  const count = Array.from(text).length;
  const current = cats.find((c) => c.id === cat);
  return (
    <dialog ref={ref} className="modal note-modal" aria-labelledby="note-title" onClick={(e) => { if (e.target === ref.current) ref.current.close(); }}>
      <form className="sheet" style={{ '--c': 'var(--line-strong)' }} method="dialog" onSubmit={(e) => { e.preventDefault(); onSave({ cat, note: text.trim() || null }); ref.current.close(); }}>
        <div className="head"><div className="ttl"><h2 id="note-title">{t.noteTitle.replace('{ref}', refText)}</h2></div></div>
        <div className="note-cat">
          {current ? <span className="fv-chip"><CatDot id={current.id} />{current.name}</span> : <span className="fv-chip">{t.noteNoCat}</span>}
          <button type="button" className="linklike" aria-expanded={pick} onClick={() => setPick(!pick)}>{t.noteChange}</button>
        </div>
        {pick && (
          <div className="note-cats" role="group" aria-label={t.noteChange}>
            <button type="button" className="mk-cat" aria-pressed={cat === null} onClick={() => setCat(null)}><span className="mk-name">{t.noteNoCat}</span></button>
            {cats.map((c) => (
              <button key={c.id} type="button" className="mk-cat" aria-pressed={cat === c.id} onClick={() => setCat(c.id)}><CatDot id={c.id} /><span className="mk-name">{c.name}</span></button>
            ))}
          </div>
        )}
        <label className="bk-label" htmlFor="note-text">{t.noteLabel}</label>
        <textarea id="note-text" value={text} maxLength={LIMITS.noteMax} autoFocus onChange={(e) => setText(e.target.value)} />
        <p className="note-count" aria-live="polite">{t.noteCount.replace('{n}', count)}</p>
        {!(signedIn && consent === 'ok') && <p className="note-where">{t.noteLocal}</p>}
        <div className="note-actions">
          <button type="button" className="ghost" onClick={() => ref.current.close()}>{t.noteCancel}</button>
          <button type="submit" className="ghost primary">{t.noteSave}</button>
        </div>
      </form>
    </dialog>
  );
}

// Renomear as 6 categorias (nome de 1 a 30 caracteres; cores e traços são fixos). Só guarda o que difere do nome de partida.
export function CategoryEditor({ t, lang }) {
  const cats = useCategories(lang);
  const defaults = DEFAULT_CATEGORY_NAMES[lang] ?? DEFAULT_CATEGORY_NAMES.pt;
  const [names, setNames] = useState(() => cats.map((c) => c.name));
  const [saved, setSaved] = useState(false);
  const save = (e) => {
    e.preventDefault();
    setCategories(CATS.map((id, i) => ({ id, name: names[i].trim() })).filter((c, i) => c.name && c.name !== defaults[i]));
    setSaved(true);
  };
  return (
    <form className="cat-edit" onSubmit={save}>
      {CATS.map((id, i) => (
        <div className="cat-row" key={id}>
          <CatDot id={id} />
          <input type="text" value={names[i]} maxLength={LIMITS.nameMax} aria-label={t.catName.replace('{n}', i + 1)} onChange={(e) => { setSaved(false); setNames(names.map((x, j) => (j === i ? e.target.value : x))); }} />
        </div>
      ))}
      <div className="note-actions">
        <button type="button" className="ghost" onClick={() => { resetCategories(); setNames([...defaults]); setSaved(false); }}>{t.catReset}</button>
        <button type="submit" className="ghost primary">{t.catSave}</button>
      </div>
      {saved && <p className="cfg-help" role="status">{t.catSaved}</p>}
    </form>
  );
}

export function CategoryDialog({ t, lang, onClose }) {
  const ref = useDialog(onClose);
  return (
    <dialog ref={ref} className="modal note-modal" aria-labelledby="cat-title" onClick={(e) => { if (e.target === ref.current) ref.current.close(); }}>
      <div className="sheet" style={{ '--c': 'var(--line-strong)' }}>
        <div className="head">
          <div className="ttl"><h2 id="cat-title">{t.catEditTitle}</h2></div>
          <button type="button" className="ghost close" onClick={() => ref.current.close()} aria-label={t.catClose}>✕</button>
        </div>
        <CategoryEditor t={t} lang={lang} />
      </div>
    </dialog>
  );
}
