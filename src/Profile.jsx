import React, { useEffect, useState } from 'react';
import PageHead from './PageHead.jsx';
import { useSession, signInWithGoogle, getClient } from './auth.js';
import { usePageTitle } from './pageTitle.js';
import { usePlan, refreshPlan } from './plan.js';
import { SubscribeBlock } from './ProInvite.jsx';
import { billingEnabled, listPayments, verifyPayment, formatBRL } from './billing.js';
import billing from './data/billing.json';
import YourData from './YourData.jsx';

const SEX = ['female', 'male', 'other'];
const AGE = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
const PLAN_KEY = { essencial: 'planEssencial', pro: 'planPro', premium: 'planPremium' };

// "Meu perfil": nome (vem do Google, editável), campos opcionais e consentimento de novidades (desmarcado por padrão).
// Nada aqui bloqueia o uso do app; o plano é só leitura.
export default function Profile({ lang, t }) {
  const { enabled, status, user, name: googleName } = useSession();
  usePageTitle([t.profile], t.title);
  const [form, setForm] = useState(null); // null enquanto carrega
  const [consentAt, setConsentAt] = useState(null);
  const [msg, setMsg] = useState(null); // 'saved' | 'error'
  const [busy, setBusy] = useState(false);
  const livePlan = usePlan();
  const [payments, setPayments] = useState(null); // null enquanto carrega; [] sem pagamentos; false se a tabela ainda não existe
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (status !== 'in') { setForm(null); return undefined; }
    let alive = true;
    (async () => {
      try {
        const c = await getClient();
        const p = await c.from('profiles').select('name,sex,age_band,city_state,marketing_consent,marketing_consent_at').eq('id', user.id).maybeSingle();
        if (!alive) return;
        const d = p.data;
        setConsentAt(d?.marketing_consent_at ?? null);
        setForm({ name: d?.name || googleName || '', sex: d?.sex || '', age_band: d?.age_band || '', city_state: d?.city_state || '', marketing_consent: !!d?.marketing_consent });
        if (p.error || !d) setMsg('error');
      } catch { if (alive) { setForm({ name: googleName || '', sex: '', age_band: '', city_state: '', marketing_consent: false }); setMsg('error'); } }
    })();
    return () => { alive = false; };
  }, [status, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadPayments = () => listPayments(user.id).then(setPayments).catch(() => setPayments(false));
  useEffect(() => { if (status === 'in' && billingEnabled) loadPayments(); }, [status, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const checkPayment = async () => {
    setChecking(true);
    try { await verifyPayment(); refreshPlan(); await loadPayments(); } catch { /* o histórico segue como estava */ } finally { setChecking(false); }
  };

  const set = (k) => (e) => { setMsg(null); setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }); };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const c = await getClient();
      const { error } = await c.from('profiles').update({
        name: form.name.trim() || null, sex: form.sex || null, age_band: form.age_band || null,
        city_state: form.city_state.trim() || null, marketing_consent: form.marketing_consent,
      }).eq('id', user.id);
      if (error) throw error;
      const { data } = await c.from('profiles').select('marketing_consent_at').eq('id', user.id).maybeSingle();
      setConsentAt(data?.marketing_consent_at ?? null); // a data do consentimento é gravada pelo servidor
      setMsg('saved');
    } catch { setMsg('error'); } finally { setBusy(false); }
  };

  return (
    <div className="page bookpage" role="region" aria-labelledby="pf-title">
      <PageHead t={t} id="pf-title" title={t.profile} sub={t.profileSub} />
      <div className="pg-card" style={{ '--c': 'var(--s-paulo)' }}>
        <div className="body">
          {(!enabled || status === 'out' || status === 'off') && (
            <div className="profile-out">
              <p>{t.profileSignedOut}</p>
              {enabled && <button type="button" className="ghost" onClick={signInWithGoogle}>{t.signInGoogle}</button>}
            </div>
          )}
          {enabled && status === 'loading' && <p className="soon">{t.loading}</p>}
          {status === 'in' && !form && <p className="soon">{t.loading}</p>}
          {status === 'in' && form && (
            <form className="profile-form" onSubmit={save}>
              <p className="profile-plan"><b>{t[PLAN_KEY[livePlan.plan]] ?? t.planEssencial}</b>{livePlan.plan !== 'essencial' && livePlan.expiresAt ? ` (${t.planUntil} ${new Date(livePlan.expiresAt).toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en-US')})` : ''}</p>
              <label>{t.profileName}
                <input type="text" value={form.name} maxLength={120} onChange={set('name')} autoComplete="name" />
              </label>
              <p className="tl-warn">{t.profileOptional}</p>
              <label>{t.profileSex}
                <select value={form.sex} onChange={set('sex')}>
                  <option value="">—</option>
                  {SEX.map((s) => <option key={s} value={s}>{t[`sex_${s}`]}</option>)}
                </select>
              </label>
              <label>{t.profileAge}
                <select value={form.age_band} onChange={set('age_band')}>
                  <option value="">—</option>
                  {AGE.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </label>
              <label>{t.profileCity}
                <input type="text" value={form.city_state} maxLength={120} onChange={set('city_state')} placeholder={t.profileCityHint} autoComplete="address-level2" />
              </label>
              <label className="cfg-row profile-consent">
                <input type="checkbox" checked={form.marketing_consent} onChange={set('marketing_consent')} />
                <span>{t.marketingLabel}
                  <small>{t.marketingHelp}{form.marketing_consent && consentAt ? ` ${t.marketingSince} ${new Date(consentAt).toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en-US')}.` : ''}</small>
                </span>
              </label>
              <div className="profile-actions">
                <button type="submit" className="ghost profile-save" disabled={busy}>{t.profileSave}</button>
                {msg === 'saved' && <span role="status">{t.profileSaved}</span>}
                {msg === 'error' && <span role="alert" className="profile-err">{t.profileError}</span>}
              </div>
              <p className="tl-warn">{user?.email}</p>
            </form>
          )}
          {status === 'in' && form && <YourData t={t} lang={lang} />}
          {status === 'in' && billingEnabled && (
            <section className="profile-pay" aria-labelledby="pf-pay">
              <h3 id="pf-pay">{t.payTitle}</h3>
              {livePlan.plan === 'essencial' && <SubscribeBlock t={t} lang={lang} />}
              {livePlan.plan === 'pro' && livePlan.expiresAt && <SubscribeBlock t={t} lang={lang} renew />}
              <p className="tl-warn">{t.refundPolicy.replace('{n}', billing.refundDays)}{billing.refundContact.trim() ? ` ${t.refundContact.replace('{c}', billing.refundContact.trim())}` : ''}</p>
              <h4>{t.payHistory}</h4>
              {payments === null && <p className="soon">{t.loading}</p>}
              {payments && payments.length === 0 && <p className="tl-warn">{t.payNone}</p>}
              {payments && payments.length > 0 && (
                <ul className="pay-list">
                  {payments.map((p) => (
                    <li key={p.id}>
                      <span>{new Date(p.created_at).toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en-US')}</span>
                      <span>{formatBRL(p.amount_cents / 100, lang)} <small>({t[`payKind_${p.price_kind}`]})</small></span>
                      <b>{t[`payStatus_${p.status}`] ?? p.status}</b>
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" className="ghost" disabled={checking} onClick={checkPayment}>{t.payCheck}</button>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
