import React, { useEffect, useRef, useState } from 'react';
import { useSession, getClient, deleteAccount } from './auth.js';
import { usePlan } from './plan.js';
import { DELETE_TEXT } from './legal/consent.js';
import { Inline } from './legal/markdown.jsx';
import { LEGAL_VERSION } from './legal/version.js';
import billing from './data/billing.json';
import { go, hrefs } from './route.js';

const day = (d, lang) => new Date(d).toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en-US');

// Bloco "Seus dados" do perfil (LGPD): baixar uma cópia (montada no navegador, só com o que o RLS já permite ler) e excluir a conta.
export default function YourData({ t, lang }) {
  const { user, legal } = useSession();
  const live = usePlan();
  const [dl, setDl] = useState('idle'); // idle | busy | error
  const [open, setOpen] = useState(false);

  const download = async () => {
    setDl('busy');
    try {
      const c = await getClient();
      const one = async (q) => { const { data, error } = await q; if (error) throw error; return data; };
      const [profile, entitlement, favorites, position, waitlist, payments] = await Promise.all([
        one(c.from('profiles').select('*').eq('id', user.id).maybeSingle()),
        one(c.from('entitlements').select('*').eq('user_id', user.id).maybeSingle()),
        one(c.from('favorites').select('key,created_at').eq('user_id', user.id)),
        one(c.from('reading_position').select('*').eq('user_id', user.id).maybeSingle()),
        one(c.from('waitlist').select('feature,created_at').eq('user_id', user.id)),
        one(c.from('payments').select('id,plan,amount_cents,price_kind,status,created_at,approved_at,months_granted').eq('user_id', user.id)),
      ]);
      const now = new Date();
      const out = {
        _sobre: t.dataExportNote.replace('{d}', now.toISOString()),
        exportado_em: now.toISOString(),
        conta: { id: user.id, email: user.email },
        perfil: profile, plano: entitlement, favoritos: favorites, posicao_de_leitura: position, avise_me: waitlist, pagamentos: payments,
      };
      const url = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `timoteo-meus-dados-${now.toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setDl('idle');
    } catch { setDl('error'); }
  };

  return (
    <section className="profile-data" aria-labelledby="pf-data">
      <h3 id="pf-data">{t.dataTitle}</h3>
      <p className="tl-warn">
        {legal?.terms_accepted_at
          ? t.dataTermsOn.replace('{d}', day(legal.terms_accepted_at, lang)).replace('{v}', legal.terms_version ?? LEGAL_VERSION)
          : t.dataTermsNone}
      </p>
      <button type="button" className="ghost" disabled={dl === 'busy'} onClick={download}>{dl === 'busy' ? t.dataDownloadBusy : t.dataDownload}</button>
      {dl === 'error' && <p role="alert" className="profile-err">{t.dataDownloadError}</p>}
      <button type="button" className="ghost danger" onClick={() => setOpen(true)}>{t.dataDelete}</button>
      {open && <DeleteDialog t={t} lang={lang} user={user} plan={live} onClose={() => setOpen(false)} />}
    </section>
  );
}

function DeleteDialog({ t, lang, user, plan, onClose }) {
  const ref = useRef(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const contact = (billing.refundContact || '').trim();
  const matches = !!user?.email && typed.trim().toLowerCase() === user.email.toLowerCase();
  const proActive = plan.plan === 'pro' || plan.plan === 'premium';

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    const handle = () => onClose();
    d?.addEventListener('close', handle);
    return () => { d?.removeEventListener('close', handle); if (d?.open) d.close(); };
  }, []);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteAccount(typed.trim());
      go(hrefs.home);
    } catch (e) { setError(e.message); setBusy(false); }
  };

  const proText = DELETE_TEXT.pro.replace('{data}', plan.expiresAt ? day(plan.expiresAt, lang) : '—').replace('{email}', contact || '[e-mail]');
  return (
    <dialog ref={ref} className="modal" aria-labelledby="del-title" onClick={(e) => { if (e.target === ref.current) ref.current.close(); }}>
      <div className="sheet" style={{ '--c': 'var(--danger)' }}>
        <div className="head">
          <div className="ttl"><h2 id="del-title">{t.deleteTitle}</h2></div>
          <button type="button" className="ghost close" onClick={() => ref.current.close()} aria-label={t.close}>✕</button>
        </div>
        <div className="body delete-box">
          {lang !== 'pt' && <p className="legal-note" role="note">{t.legalPtOnly}</p>}
          <p>{DELETE_TEXT.base}</p>
          {proActive && <p><Inline text={proText} /></p>}
          <p>{DELETE_TEXT.confirm}</p>
          <label>{t.deleteEmailLabel}
            <input type="email" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="none" spellCheck="false" />
          </label>
          {error && <p role="alert" className="profile-err">{error === 'email_mismatch' ? t.deleteMismatch : error === 'last_admin' ? t.deleteLastAdmin : t.deleteError}</p>}
          <div className="profile-actions">
            <button type="button" className="ghost danger" disabled={!matches || busy} onClick={confirm}>{busy ? t.deleteBusy : t.deleteConfirmBtn}</button>
            <button type="button" className="ghost" onClick={() => ref.current.close()}>{t.deleteCancel}</button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
