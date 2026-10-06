import React, { useEffect, useState } from 'react';
import BackButton from './BackButton.jsx';
import { useSession, signInWithGoogle, getClient } from './auth.js';
import { usePageTitle } from './pageTitle.js';

const SEX = ['female', 'male', 'other'];
const AGE = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
const PLAN_KEY = { essencial: 'planEssencial', pro: 'planPro', premium: 'planPremium' };

// "Meu perfil": nome (vem do Google, editável), campos opcionais e consentimento de novidades (desmarcado por padrão).
// Nada aqui bloqueia o uso do app; o plano é só leitura.
export default function Profile({ lang, t }) {
  const { enabled, status, user, name: googleName } = useSession();
  usePageTitle([t.profile], t.title);
  const [form, setForm] = useState(null); // null enquanto carrega
  const [plan, setPlan] = useState({ plan: 'essencial', expires_at: null });
  const [consentAt, setConsentAt] = useState(null);
  const [msg, setMsg] = useState(null); // 'saved' | 'error'
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status !== 'in') { setForm(null); return undefined; }
    let alive = true;
    (async () => {
      try {
        const c = await getClient();
        const [p, e] = await Promise.all([
          c.from('profiles').select('name,sex,age_band,city_state,marketing_consent,marketing_consent_at').eq('id', user.id).maybeSingle(),
          c.from('entitlements').select('plan,expires_at').eq('user_id', user.id).maybeSingle(),
        ]);
        if (!alive) return;
        if (e.data) setPlan(e.data);
        const d = p.data;
        setConsentAt(d?.marketing_consent_at ?? null);
        setForm({ name: d?.name || googleName || '', sex: d?.sex || '', age_band: d?.age_band || '', city_state: d?.city_state || '', marketing_consent: !!d?.marketing_consent });
        if (p.error || !d) setMsg('error');
      } catch { if (alive) { setForm({ name: googleName || '', sex: '', age_band: '', city_state: '', marketing_consent: false }); setMsg('error'); } }
    })();
    return () => { alive = false; };
  }, [status, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const planLabel = t[PLAN_KEY[plan.plan]] ?? t.planEssencial;
  const until = plan.expires_at ? new Date(plan.expires_at).toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en-US') : null;

  return (
    <div className="page wide" role="region" aria-labelledby="pf-title">
      <div className="sheet" style={{ '--c': 'var(--s-paulo)' }}>
        <div className="head">
          <div className="ttl">
            <h2 id="pf-title">{t.profile}</h2>
            <p>{t.profileSub}</p>
          </div>
          <div className="head-actions"><BackButton t={t} /></div>
        </div>
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
              <p className="profile-plan"><b>{planLabel}</b>{until ? ` (${t.planUntil} ${until})` : ''}</p>
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
        </div>
      </div>
    </div>
  );
}
