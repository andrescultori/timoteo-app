import React from 'react';
import { useSession } from './auth.js';
import { CONSENT } from './legal/consent.js';
import { Inline } from './legal/markdown.jsx';
import { hrefs } from './route.js';

const LINKS = { 'Termos de Uso': hrefs.terms, 'Política de Privacidade': hrefs.privacy };

// Consentimentos registrados na conta (Fase 7), só leitura: as três caixas como foram aceitas no cadastro. Os textos são os de src/legal/consent.js.
// A caixa 3 (novidades) pode ser mudada em "Seu perfil"; as outras só se desfazem excluindo a conta.
export default function ConsentSummary({ t, lang }) {
  const { signedIn, consent, legal } = useSession();
  if (!signedIn || consent !== 'ok' || !legal) return null;
  const when = legal.terms_accepted_at ? new Date(legal.terms_accepted_at).toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en-US') : null;
  const row = (id, checked, text) => (
    <li key={id} className="cfg-row consent-row">
      <input type="checkbox" checked={checked} disabled readOnly aria-label={text.replace(/\*\*|\[|\]/g, '')} />
      <span><Inline text={text} links={LINKS} /></span>
    </li>
  );
  return (
    <section className="card small cfg-consents" aria-labelledby="cfg-cons">
      <h2 id="cfg-cons">{t.cfgConsentTitle}</h2>
      {lang !== 'pt' && <p className="legal-note" role="note">{t.legalPtOnly}</p>}
      <ul className="off-list">
        {row('c1', true, CONSENT.box1)}
        {row('c2', true, CONSENT.box2)}
        {row('c3', !!legal.marketing_consent, CONSENT.box3)}
      </ul>
      <p className="cfg-help">{when ? `${t.cfgConsentSince} ${when}. ` : ''}{t.cfgConsentHelp} <a href={hrefs.profile}>{t.cfgConsentProfile}</a></p>
    </section>
  );
}
