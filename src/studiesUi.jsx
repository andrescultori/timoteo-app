import React, { useState } from 'react';
import { useDialog } from './marksUi.jsx';
import { usePlan } from './plan.js';
import plans from './data/plans.json';
import { TEMPLATES, newStudy, addKeys, studyQuota } from './studiesCore.js';
import { useUserData, saveStudy, newStudyId, dismissStudiesLimit } from './userdata.js';
import { hrefs } from './route.js';
import ProInvite from './ProInvite.jsx';

export const fill = (s, vars) => Object.entries(vars).reduce((acc, [k, v]) => acc.replace(`{${k}}`, v), s);
export const tplLabel = (t, tpl, id) => t[`tplBlock_${tpl}_${id.replace(/-/g, '_')}`] ?? id;

// Cota de estudos para a interface: { pro, quota: {ok, reason}, count, max }. Pro/Premium/admin sem limite de plano; o banco tem a palavra final.
export function useStudyQuota() {
  const { studies } = useUserData();
  const p = usePlan();
  const pro = p.can('studies', { count: Infinity }); // sem limite de plano (Pro, Premium e admin); o Essencial só cria enquanto count < limite
  const essencialMax = plans.essencial.studyLimit;
  const max = plans.limits.studiesMax;
  return { pro, loading: p.loading, count: studies.length, essencialMax, max, quota: studyQuota({ count: studies.length, pro, essencialMax, max }) };
}

// Aviso quando o banco recusou a criação (23514): o estudo fica no aparelho, nada trava
export function StudiesLimitNotice({ t, ud, q }) {
  if (!ud.studiesLimit) return null;
  const msg = ud.studiesLimit === 'plan' ? fill(t.studiesLimitPlan, { n: q.essencialMax }) : fill(t.studiesLimitMax, { n: q.max });
  return <p className="mark-limit" role="alert">{msg} <button type="button" className="linklike" onClick={dismissStudiesLimit}>{t.addClose}</button></p>;
}

// Limite atingido: a mensagem do motivo e, no limite do plano, o convite ao Pro (com "Avise-me")
export function StudyLimitInvite({ t, lang, q }) {
  return (
    <div>
      <p className="mark-limit" role="alert">{q.quota.reason === 'plan' ? fill(t.studiesLimitPlan, { n: q.essencialMax }) : fill(t.studiesLimitMax, { n: q.max })}</p>
      {q.quota.reason === 'plan' && <ProInvite t={t} lang={lang} />}
    </div>
  );
}

// Escolha de modelo: [valor, rótulo]
export const templateOptions = (t) => [['', t.tplBlank], ...Object.keys(TEMPLATES).map((k) => [k, t[`tplName_${k}`]])];

// Cria um estudo (com ou sem modelo) respeitando a cota. Devolve { ok, study } ou { ok:false, error }.
export function createStudy({ title, template, quota }) {
  if (!quota.ok) return { ok: false, error: quota.reason };
  const s = newStudy({ id: newStudyId(), title, template: template || null });
  if (!s) return { ok: false, error: 'invalid' };
  const r = saveStudy(s);
  return r.ok ? { ok: true, study: r.study } : { ok: false, error: r.error };
}

// "Adicionar ao estudo": escolhe um estudo existente ou cria um novo e acrescenta as chaves (referências, nunca o texto bíblico).
export function AddToStudy({ t, lang, keys, suggest, onClose }) {
  const ref = useDialog(onClose);
  const ud = useUserData();
  const q = useStudyQuota();
  const [creating, setCreating] = useState(ud.studies.length === 0);
  const [title, setTitle] = useState(suggest ?? '');
  const [template, setTemplate] = useState('');
  const [result, setResult] = useState(null); // { id, title, added, skipped, full }
  const [err, setErr] = useState(null);

  const finish = (study, base) => {
    const r = addKeys(base ?? study, keys);
    if (r.added) saveStudy(r.study);
    setResult({ id: study.id, title: study.title, added: r.added, skipped: r.skipped, full: r.full });
  };
  const create = (e) => {
    e.preventDefault();
    const c = createStudy({ title: title.trim() || suggest || t.studiesUntitled, template, quota: q.quota });
    if (!c.ok) { setErr(c.error); return; }
    finish(c.study);
  };

  return (
    <dialog ref={ref} className="modal note-modal" aria-labelledby="add-st-title" onClick={(e) => { if (e.target === ref.current) ref.current.close(); }}>
      <div className="sheet" style={{ '--c': 'var(--line-strong)' }}>
        <h2 id="add-st-title">{t.addTitle}</h2>
        {result ? (
          <div role="status">
            <p>{result.added === 0 ? (result.full ? fill(t.addFull, { s: result.title }) : fill(t.addDup, { s: result.title }))
              : result.added === 1 ? fill(t.addDone1, { s: result.title }) : fill(t.addDoneN, { s: result.title, n: result.added })}</p>
            {result.added > 0 && result.skipped > 0 && <p className="soon">{result.full ? fill(t.addFull, { s: result.title }) : fill(t.addDup, { s: result.title })}</p>}
            <div className="mark-actions">
              <a className="ghost" href={hrefs.studies(result.id)} onClick={() => ref.current.close()}>{t.addOpen}</a>
              <button type="button" className="ghost" onClick={() => ref.current.close()}>{t.addClose}</button>
            </div>
          </div>
        ) : (
          <>
            {!creating && ud.studies.length > 0 && (
              <ul className="st-pick">
                {ud.studies.map((s) => (
                  <li key={s.id}><button type="button" className="ghost" onClick={() => finish(s)}>{s.title}</button></li>
                ))}
              </ul>
            )}
            {!creating && (q.quota.ok
              ? <p><button type="button" className="ghost" onClick={() => setCreating(true)}>{t.addNew}</button></p>
              : <StudyLimitInvite t={t} lang={lang} q={q} />)}
            {creating && (
              q.quota.ok ? (
                <form onSubmit={create} className="st-form">
                  {ud.studies.length === 0 && <p className="soon">{t.addNoStudies}</p>}
                  <label>{t.addNewTitle}<input type="text" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} /></label>
                  <label>{t.addTemplate}
                    <select value={template} onChange={(e) => setTemplate(e.target.value)}>
                      {templateOptions(t).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </label>
                  {err && <p className="mark-limit" role="alert">{err === 'plan' ? fill(t.studiesLimitPlan, { n: q.essencialMax }) : t.studiesLimitMax.replace('{n}', q.max)}</p>}
                  <div className="mark-actions">
                    <button type="submit" className="ghost">{t.addCreate}</button>
                    {ud.studies.length > 0 && <button type="button" className="ghost" onClick={() => setCreating(false)}>{t.studiesCancel}</button>}
                  </div>
                </form>
              ) : <StudyLimitInvite t={t} lang={lang} q={q} />
            )}
            <div className="mark-actions"><button type="button" className="ghost" onClick={() => ref.current.close()}>{t.addClose}</button></div>
          </>
        )}
      </div>
    </dialog>
  );
}

// Botão que abre o AddToStudy (usado na ficha do livro e no personagem)
export function AddToStudyButton({ t, lang, keys, suggest, className = 'ghost' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>{t.addButton}</button>
      {open && <AddToStudy t={t} lang={lang} keys={keys} suggest={suggest} onClose={() => setOpen(false)} />}
    </>
  );
}
