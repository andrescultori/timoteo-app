import React, { useEffect, useRef, useState } from 'react';
import { useSession, signInWithGoogle, signOut } from './auth.js';
import { hrefs } from './route.js';

// Botão de conta do cabeçalho: "Entrar" (Google) quando deslogado; logado, o nome com um menu pequeno. Não aparece sem Supabase.
export default function Account({ t }) {
  const { enabled, status, name, error } = useSession();
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
      <button type="button" className="ghost acct-name" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} title={name}>{first}</button>
      {open && (
        <div className="acct-menu" role="menu">
          <a role="menuitem" href={hrefs.favorites} onClick={() => setOpen(false)}>{t.favorites}</a>
          <a role="menuitem" href={hrefs.profile} onClick={() => setOpen(false)}>{t.profile}</a>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); signOut(); }}>{t.signOut}</button>
        </div>
      )}
    </div>
  );
}
