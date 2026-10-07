import React, { useEffect, useRef, useState } from 'react';
import { useSession, signInWithGoogle, signOut, openConsent } from './auth.js';
import { hrefs } from './route.js';
import { usePlan } from './plan.js';

// Botão de conta do cabeçalho: "Entrar" (Google) quando deslogado; logado, o nome (com PRO ou PREMIUM ao lado, se tiver o plano) e um menu pequeno
// com Favoritos, Perfil, Configurações e Sair. Não aparece sem Supabase.
export default function Account({ t, onSettings }) {
  const { enabled, status, name, error, consent } = useSession();
  const pending = consent === 'needed'; // sem o aceite dos Termos: favoritos só neste aparelho
  const { plan } = usePlan(); // plano efetivo: Pro ou Premium vencido já conta como Essencial
  const badge = plan === 'pro' ? 'PRO' : plan === 'premium' ? 'PREMIUM' : null;
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  if (!enabled) return null;
  if (status === 'loading') return <button type="button" className="ghost" disabled aria-label={t.signIn}>…</button>;
  if (status !== 'in') {
    return (
      <>
        <button type="button" className="ghost acct-in" onClick={signInWithGoogle} title={t.signInGoogle}>{t.signIn}</button>
        {error && <span className="acct-err" role="alert">{t.authError}</span>}
      </>
    );
  }
  const first = (name || '').split(' ')[0] || t.account;
  return (
    <div className="acct" ref={box}>
      <button type="button" className="ghost acct-name" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} title={name} aria-label={badge ? `${name || first} (${badge})` : undefined}>
        {pending && <span className="acct-dot" role="img" aria-label={t.consentPendingHint} title={t.consentPendingHint} />}<span className="acct-first">{first}</span>{badge && <span className="acct-plan" aria-hidden="true">{badge}</span>}
      </button>
      {open && (
        <div className="acct-menu" role="menu">
          {pending && <button type="button" role="menuitem" onClick={() => { setOpen(false); openConsent(); }}>{t.consentPending}</button>}
          <a role="menuitem" href={hrefs.favorites} onClick={() => setOpen(false)}>{t.favorites}</a>
          <a role="menuitem" href={hrefs.profile} onClick={() => setOpen(false)}>{t.profile}</a>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onSettings?.(); }}>{t.settings}</button>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); signOut(); }}>{t.signOut}</button>
        </div>
      )}
    </div>
  );
}
