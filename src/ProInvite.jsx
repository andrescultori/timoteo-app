import React, { useState } from 'react';
import PageHead from './PageHead.jsx';
import WaitlistButton from './WaitlistButton.jsx';
import { useSession, signInWithGoogle, openConsent } from './auth.js';
import billingCfg from './data/billing.json';
import { hrefs } from './route.js';
import { usePlan, refreshPlan } from './plan.js';
import { billingEnabled, formatBRL, formatDate, startCheckout, isLaunch, planPrice, regularPrice, annualSaving, promoEndsAt, PERIODS } from './billing.js';
import plans from './data/plans.json';

const fill = (s, vars) => Object.entries(vars).reduce((acc, [k, v]) => acc.replace(`{${k}}`, v), s);

// Compra do Pro: escolha do período (anual já marcado, "melhor opção"), preço que vale hoje e botão. O valor mostrado é só
// informação; quem decide o preço é o servidor (create-checkout), pela data em que o checkout é criado.
export function SubscribeBlock({ t, lang, renew = false }) {
  const { signedIn } = useSession();
  const { loading } = usePlan();
  const [period, setPeriod] = useState('anual');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [needTerms, setNeedTerms] = useState(false);
  const launch = isLaunch();
  const saving = annualSaving('pro');
  const months = (p) => plans.periods[p].months;

  const buy = async () => {
    if (!signedIn) { signInWithGoogle(); return; }
    setBusy(true);
    setError(false);
    setNeedTerms(false);
    try { await startCheckout(period); } catch (e) { if (e?.message === 'terms_required') setNeedTerms(true); else if (e?.message === 'already_active') refreshPlan(); /* o plano já vale: busca de novo e o convite some */ else setError(true); setBusy(false); }
  };

  return (
    <div className="pro-buy">
      {launch && <p className="pro-launch"><b>{fill(t.proLaunchTag, { d: formatDate(promoEndsAt, lang) })}</b></p>}
      <div className="pro-periods" role="radiogroup" aria-label={t.proPeriodLegend}>
        {PERIODS.map((p) => (
          <label key={p} className={`pro-period${period === p ? ' on' : ''}`}>
            <input type="radio" name="pro-period" value={p} checked={period === p} onChange={() => setPeriod(p)} />
            <span className="pro-period-body">
              <span className="pro-period-name">{t[`proPeriod_${p}`]}{p === 'anual' && <em className="pro-best">{t.proBest}</em>}</span>
              <span className="pro-period-price">
                {launch && <s>{formatBRL(regularPrice('pro', p), lang)}</s>} <b>{formatBRL(planPrice('pro', p), lang)}</b>{' '}
                <small>{fill(t[`proPeriodFor_${p}`], { n: months(p) })}</small>
              </span>
              {p === 'anual' && <small className="pro-saving">{fill(t.proSaving, { v: formatBRL(saving.value, lang), p: saving.percent })}</small>}
            </span>
          </label>
        ))}
      </div>
      <p className="tl-warn">{t.proPayMethods}</p>
      <button type="button" className="ghost pro-cta" disabled={busy || (signedIn && loading)} onClick={buy}>
        {busy ? t.proSubscribeBusy : !signedIn ? t.proSubscribeLogin : renew ? t.proRenew : t.proSubscribe}
      </button>
      <p className="tl-warn">{t.proRedirectNote}</p>
      <p className="tl-warn">{t.buyAccept} <a href={hrefs.terms}>{t.termsLink}</a>. {t.buyRefund.replace('{n}', billingCfg.refundDays)}</p>
      {needTerms && (
        <p role="alert" className="profile-err">{t.buyNeedTerms}{' '}
          <button type="button" className="linklike" onClick={openConsent}>{t.buyAcceptBtn}</button>
        </p>
      )}
      {error && <p role="alert" className="profile-err">{t.proCheckoutError}</p>}
      <div className="pro-premium">
        <b>{t.premiumSoonTitle}</b> <span>{t.premiumSoonBody}</span>
        <WaitlistButton feature="premium" t={t} />
      </div>
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
    <div className="page bookpage" role="region" aria-labelledby="pro-title">
      <PageHead t={t} id="pro-title" title={title} />
      <div className="pg-card" style={{ '--c': 'var(--line-strong)' }}>
        <div className="body">{box}</div>
      </div>
    </div>
  );
}
