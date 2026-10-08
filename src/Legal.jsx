import React, { useEffect, useState } from 'react';
import BackButton from './BackButton.jsx';
import { Markdown } from './legal/markdown.jsx';
import { LEGAL_VERSION, isDraft } from './legal/version.js';
import billing from './data/billing.json';
import { usePageTitle } from './pageTitle.js';

// Páginas #terms e #privacy: mostram os textos de docs/legal/ (rascunho do André; Claude não altera o conteúdo).
// O e-mail que aparece nos textos é trocado, só na tela, pelo contato único de src/data/billing.json (refundContact).
// Textos jurídicos só em português por ora; na interface em inglês aparece um aviso.
const TEXT_EMAIL = 'amscultori@gmail.com';
const loaders = {
  terms: () => import('../docs/legal/termos-de-uso.md?raw'),
  privacy: () => import('../docs/legal/politica-de-privacidade.md?raw'),
};

export default function Legal({ kind, lang, t }) {
  const [text, setText] = useState(null);
  const [failed, setFailed] = useState(false);
  const title = kind === 'terms' ? t.termsLink : t.privacyLink;
  usePageTitle([title], t.title);

  useEffect(() => {
    let alive = true;
    setText(null);
    setFailed(false);
    loaders[kind]().then((m) => { if (alive) setText(m.default); }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [kind]);

  const contact = (billing.refundContact || '').trim();
  const shown = text ? (contact && contact !== TEXT_EMAIL ? text.split(TEXT_EMAIL).join(contact) : text) : null;

  return (
    <div className="page wide" role="region" aria-labelledby="legal-title">
      <div className="sheet" style={{ '--c': 'var(--line-strong)' }}>
        <div className="head">
          <div className="ttl">
            <h1 id="legal-title">{title}</h1>
            <p>{t.legalVersion}: {LEGAL_VERSION}</p>
          </div>
          <div className="head-actions"><BackButton t={t} /></div>
        </div>
        <div className="body legal">
          {isDraft && <p className="legal-draft" role="note"><b>{t.legalDraft}</b></p>}
          {lang !== 'pt' && <p className="legal-note" role="note">{t.legalPtOnly}</p>}
          {!shown && !failed && <p className="soon">{t.loading}</p>}
          {failed && <p role="alert" className="profile-err">{t.legalLoadError}</p>}
          {shown && <Markdown text={shown} />}
        </div>
      </div>
    </div>
  );
}
