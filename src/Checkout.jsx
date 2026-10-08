import React, { useEffect, useRef, useState } from 'react';
import BackButton from './BackButton.jsx';
import { useSession, signInWithGoogle } from './auth.js';
import { refreshPlan } from './plan.js';
import { verifyPayment, checkoutRef, billingEnabled } from './billing.js';
import { usePageTitle } from './pageTitle.js';
import { go, hrefs } from './route.js';

const POLL_MS = 10000;
const MAX_POLLS = 12; // Pix: confere sozinho por até ~2 minutos; depois, só pelo botão

// Volta do Mercado Pago. A URL não prova nada: a página pergunta ao servidor (verify-payment), que consulta o Mercado Pago.
// Estados: checking | approved | pending | rejected | none | error. Pix pendente nunca libera o Pro.
export default function Checkout({ lang, t }) {
  const { status: auth, signedIn, enabled } = useSession();
  usePageTitle([t.checkoutTitle], t.title);
  const [state, setState] = useState(billingEnabled ? 'checking' : 'none');
  const [until, setUntil] = useState(null);
  const [polls, setPolls] = useState(0);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const check = async () => {
    setState((s) => (s === 'approved' || s === 'pending' ? s : 'checking'));
    try {
      const r = await verifyPayment(checkoutRef.get());
      if (!alive.current) return 'error';
      if (r.status === 'approved') { setUntil(r.expires_at); setState('approved'); refreshPlan(); checkoutRef.clear(); return 'approved'; }
      const s = r.status === 'rejected' || r.status === 'cancelled' ? 'rejected' : r.status === 'pending' ? 'pending' : 'none';
      setState(s);
      return s;
    } catch { if (alive.current) setState('error'); return 'error'; }
  };

  // confere ao entrar (com a sessão pronta) e, enquanto estiver pendente, de tempos em tempos
  useEffect(() => {
    if (!billingEnabled || !signedIn) return undefined;
    let timer;
    const loop = async (n) => {
      const s = await check();
      setPolls(n + 1);
      if (s === 'pending' && n + 1 < MAX_POLLS && alive.current) timer = setTimeout(() => loop(n + 1), POLL_MS);
    };
    loop(0);
    return () => clearTimeout(timer);
  }, [signedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  const wait = enabled && auth === 'loading';
  return (
    <div className="page wide" role="region" aria-labelledby="co-title">
      <div className="sheet" style={{ '--c': 'var(--accent-2)' }}>
        <div className="head">
          <div className="ttl"><h1 id="co-title">{t.checkoutTitle}</h1></div>
          <div className="head-actions"><BackButton t={t} /></div>
        </div>
        <div className="body">
          <div className="pro-invite" role="status" aria-live="polite">
            {wait && <p>{t.checkoutChecking}</p>}
            {!wait && !signedIn && (
              <>
                <p>{t.checkoutNeedLogin}</p>
                {enabled && <button type="button" className="ghost" onClick={signInWithGoogle}>{t.signInGoogle}</button>}
              </>
            )}
            {signedIn && state === 'checking' && <p>{t.checkoutChecking}</p>}
            {signedIn && state === 'approved' && (
              <>
                <b>{t.checkoutApproved}</b>
                {until && <p>{t.checkoutValidUntil} {new Date(until).toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en-US')}.</p>}
                <button type="button" className="ghost" onClick={() => go(hrefs.home)}>{t.checkoutHome}</button>
              </>
            )}
            {signedIn && state === 'pending' && (
              <>
                <p>{t.checkoutPending}</p>
                {polls >= MAX_POLLS && <p className="tl-warn">{t.checkoutLater}</p>}
                <button type="button" className="ghost" onClick={check}>{t.checkoutRecheck}</button>
              </>
            )}
            {signedIn && state === 'rejected' && (
              <>
                <p>{t.checkoutRejected}</p>
                <button type="button" className="ghost" onClick={() => go(hrefs.profile)}>{t.checkoutTryAgain}</button>
              </>
            )}
            {signedIn && state === 'none' && (
              <>
                <p>{t.checkoutNone}</p>
                <button type="button" className="ghost" onClick={() => go(hrefs.home)}>{t.checkoutHome}</button>
              </>
            )}
            {signedIn && state === 'error' && (
              <>
                <p role="alert" className="profile-err">{t.checkoutError}</p>
                <button type="button" className="ghost" onClick={check}>{t.checkoutRecheck}</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
