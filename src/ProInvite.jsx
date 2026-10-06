import React, { useState } from 'react';
import BackButton from './BackButton.jsx';
import WaitlistButton from './WaitlistButton.jsx';
import { useSession, signInWithGoogle } from './auth.js';
import { usePlan } from './plan.js';
import { billingEnabled, proPrice, formatBRL, startCheckout } from './billing.js';
import plans from './data/plans.json';

const fill = (s, vars) => Object.entries(vars).reduce((acc, [k, v]) => acc.replace(`{${k}}`, v), s);

// Botão de compra do Pro: pede o login (e volta ao mesmo ponto), mostra o preço que vale para a pessoa e leva ao Mercado Pago.
// O valor mostrado é só informação; quem decide o preço é o servidor (create-checkout).
export function SubscribeBlock({ t, lang, renew = false }) {
  const { signedIn } = useSession();
  const { usedEntry, loading } = usePlan();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const entry = signedIn && !loading ? !usedEntry : true; // deslogado: mostra a oferta de entrada
  const price = (lang) => formatBRL(entry ? plans.plans.pro.entryPrice : plans.plans.pro.price, lang);

  const buy = async () => {
    if (!signedIn) { signInWithGoogle(); return; }
    setBusy(true);
    setError(false);
    try { await startCheckout(); } catch { setError(true); setBusy(false); }
  };

  return (
    <div className="pro-buy">
      <p className="pro-price">
        {entry
          ? fill(t.proPriceFirst, { a: formatBRL(proPrice(false), lang), b: formatBRL(proPrice(true), lang) })
          : fill(t.proPriceFull, { a: formatBRL(proPrice(true), lang) })}
      </p>
      <p className="tl-warn">{t.proPayMethods}</p>
      <button type="button" className="ghost pro-cta" disabled={busy || (signedIn && loading)} onClick={buy}>
        {busy ? t.proSubscribeBusy : !signedIn ? t.proSubscribeLogin : renew ? t.proRenew : t.proSubscribe}
      </button>
      <p className="tl-warn">{t.proRedirectNote}</p>
      {error && <p role="alert" className="profile-err">{t.proCheckoutError}</p>}
    </div>
  );
}

// Convite ao plano Pro, no lugar do conteúdo bloqueado. Com a cobrança ligada (VITE_BILLING_ENABLED), oferece a compra;
// desligada, só o "Avise-me". `page`: embrulha o convite em uma página inteira (linha do tempo, genealogia, personagem fora do plano).
export default function ProInvite({ t, lang = 'pt', title, page = false, feature = 'pro' }) {
  const { enabled, signedIn } = useSession();
  const box = (
    <div className="pro-invite" role="note">
      <b>{t.proInviteTitle}</b>
      <p>{t.proInviteBody}</p>
      {billingEnabled ? <SubscribeBlock t={t} lang={lang} /> : (
        <>
          <p className="tl-warn">{t.proInviteNotYet}{enabled && !signedIn ? ` ${t.proInviteLogin}` : ''}</p>
          <WaitlistButton feature={feature} t={t} />
        </>
      )}
    </div>
  );
  if (!page) return box;
  return (
    <div className="page wide" role="region" aria-labelledby="pro-title">
      <div className="sheet" style={{ '--c': 'var(--line-strong)' }}>
        <div className="head">
          <div className="ttl"><h2 id="pro-title">{title}</h2></div>
          <div className="head-actions"><BackButton t={t} /></div>
        </div>
        <div className="body">{box}</div>
      </div>
    </div>
  );
}
