import React, { useState } from 'react';
import PageHead from './PageHead.jsx';
import StudyPage from './StudyPage.jsx';
import { usePageTitle } from './pageTitle.js';
import { useUserData } from './userdata.js';
import { useSession, signInWithGoogle } from './auth.js';
import { TEMPLATES, relativeTime } from './studiesCore.js';
import { go, hrefs } from './route.js';
import { useStudyQuota, StudiesLimitNotice, StudyLimitInvite, createStudy, fill } from './studiesUi.jsx';

// #studies (lista) e #studies/<id> (estudo). Os estudos vivem no aparelho primeiro e vão para a conta em segundo plano (userdata.js).
export default function Studies({ lang, t, id }) {
  return id ? <StudyPage lang={lang} t={t} id={id} /> : <StudyList lang={lang} t={t} />;
}

function StudyList({ lang, t }) {
  const ud = useUserData();
  const { studies } = ud;
  const q = useStudyQuota();
  const { enabled, signedIn } = useSession();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [error, setError] = useState(null);
  usePageTitle([t.studiesTitle], t.title);

  const open = (r) => { if (r.ok) go(hrefs.studies(r.study.id)); else setError(r.error); };
  const submit = (e) => {
    e.preventDefault();
    open(createStudy({ title: title.trim() || t.studiesUntitled, template: null, quota: q.quota }));
  };
  const fromTemplate = (tpl) => open(createStudy({ title: t[`tplName_${tpl}`], template: tpl, quota: q.quota }));
  const blocked = !q.quota.ok;
  const count = studies.length;

  return (
    <div className="page bookpage" role="region" aria-labelledby="st-title">
      <PageHead t={t} id="st-title" title={t.studiesTitle} sub={t.studiesSub} actions={<a className="ghost" href={hrefs.favorites}>{t.favorites}</a>} />
      <div className="pg-card" style={{ '--c': 'var(--s-evangelhos)' }}>
        <div className="body">
          {!signedIn && (
            <p className="fav-device" role="note"><b>{t.studiesDevice}.</b> {t.studiesDeviceHelp} {enabled && <button type="button" className="ghost" onClick={signInWithGoogle}>{t.signInGoogle}</button>}</p>
          )}
          <StudiesLimitNotice t={t} ud={ud} q={q} />
          <div className="st-panel">
            {!q.loading && (
              <div className="st-quota">
                {q.pro ? <b>{count === 1 ? t.studiesCount1 : fill(t.studiesCountN, { n: count })}</b> : (
                  <>
                    <b>{fill(t.studiesQuota, { n: Math.min(count, q.essencialMax), max: q.essencialMax })}</b>
                    <div className="st-bar" role="progressbar" aria-valuemin={0} aria-valuemax={q.essencialMax} aria-valuenow={Math.min(count, q.essencialMax)} aria-label={fill(t.studiesQuota, { n: Math.min(count, q.essencialMax), max: q.essencialMax })}>
                      <i style={{ width: `${Math.min(100, (count / q.essencialMax) * 100)}%` }} />
                    </div>
                  </>
                )}
              </div>
            )}
            {blocked ? <StudyLimitInvite t={t} lang={lang} q={q} /> : !creating ? (
              <button type="button" className="st-new st-primary" onClick={() => setCreating(true)}>+ {t.studiesNew}</button>
            ) : (
              <form className="st-form" onSubmit={submit}>
                <label>{t.studiesNewLabel}<input type="text" autoFocus value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} /></label>
                <div className="mark-actions">
                  <button type="submit" className="st-new st-primary">{t.studiesCreate}</button>
                  <button type="button" className="ghost" onClick={() => setCreating(false)}>{t.studiesCancel}</button>
                </div>
              </form>
            )}
          </div>
          {error && blocked === false && <p className="mark-limit" role="alert">{t.studiesLimitMax.replace('{n}', q.max)}</p>}

          {count === 0 && <p className="soon">{t.studiesEmpty}</p>}
          {count > 0 && (
            <section aria-label={t.studiesList}>
              <ul className="st-list">
                {studies.map((s) => (
                  <li key={s.id}>
                    <a className="st-card" href={hrefs.studies(s.id)}>
                      <b>{s.title}</b>
                      {s.template && <span className="fv-chip">{t[`tplName_${s.template}`]}</span>}
                      <span className="st-meta">{s.items.length === 1 ? t.studiesItems1 : fill(t.studiesItemsN, { n: s.items.length })} · {fill(t.studiesEdited, { when: relativeTime(s.at, Date.now(), lang) })}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {!blocked && (
            <section className="st-templates" aria-labelledby="st-tpl">
              <h3 className="st-h" id="st-tpl">{t.studiesFromTemplate}</h3>
              <ul className="st-tpl-list">
                {Object.keys(TEMPLATES).map((k) => (
                  <li key={k}><button type="button" className="st-tpl" onClick={() => fromTemplate(k)}><b>{t[`tplName_${k}`]}</b><span>{t[`tplDesc_${k}`]}</span></button></li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
