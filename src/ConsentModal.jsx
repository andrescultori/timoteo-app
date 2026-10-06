import React, { useEffect, useRef, useState } from 'react';
import { useSession, startGoogleSignIn, acceptLegalNow, dismissConsent } from './auth.js';
import { CONSENT } from './legal/consent.js';
import { Inline } from './legal/markdown.jsx';
import { hrefs } from './route.js';

const LINKS = { 'Termos de Uso': hrefs.terms, 'Política de Privacidade': hrefs.privacy };

// Consentimento (Fase 7), 3 caixas, todas desmarcadas. 1 (18+, Termos e Política) e 2 (dado sensível: convicção religiosa) são
// obrigatórias; 3 (novidades) é opcional. Deslogado: aparece ANTES do login com o Google. Logado sem aceite: conclui o cadastro e só
// então liga a sincronização. Os textos das caixas são os de docs/legal/consentimento.md (em português nos dois idiomas).
export default function ConsentModal({ t, lang }) {
  const { signedIn, legal } = useSession();
  const existing = signedIn;
  const ref = useRef(null);
  const [c1, setC1] = useState(false);
  const [c2, setC2] = useState(false);
  const [c3, setC3] = useState(existing ? !!legal?.marketing_consent : false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    const handle = () => dismissConsent();
    d?.addEventListener('close', handle);
    return () => { d?.removeEventListener('close', handle); if (d?.open) d.close(); };
  }, []);

  const ready = c1 && c2 && !busy;
  const go = async () => {
    setBusy(true);
    setError(false);
    const ok = existing ? await acceptLegalNow({ marketing: c3 }) : await startGoogleSignIn({ marketing: c3 });
    if (!ok) { setBusy(false); setError(true); } // com sucesso: o modal fecha sozinho (existing) ou a página vai ao Google
  };

  const box = (id, checked, set, text, tag) => (
    <label className="cfg-row consent-row">
      <input type="checkbox" checked={checked} onChange={(e) => set(e.target.checked)} aria-describedby={`${id}-tag`} />
      <span>
        <Inline text={text} links={LINKS} />
        <small id={`${id}-tag`}>{tag}</small>
      </span>
    </label>
  );

  return (
    <dialog ref={ref} className="modal" aria-labelledby="consent-title" onClick={(e) => { if (e.target === ref.current) ref.current.close(); }}>
      <div className="sheet" style={{ '--c': 'var(--line-strong)' }}>
        <div className="head">
          <div className="ttl"><h2 id="consent-title">{existing ? t.consentTitleExisting : t.consentTitle}</h2></div>
          <button type="button" className="ghost close" onClick={() => ref.current.close()} aria-label={t.close}>✕</button>
        </div>
        <div className="body consent">
          {existing && <p>{t.consentIntroExisting}</p>}
          {lang !== 'pt' && <p className="legal-note" role="note">{t.legalPtOnly}</p>}
          {box('c1', c1, setC1, CONSENT.box1, t.consentRequired)}
          {box('c2', c2, setC2, CONSENT.box2, t.consentRequired)}
          {box('c3', c3, setC3, CONSENT.box3, t.consentOptional)}
          <div className="consent-actions">
            <button type="button" className="ghost pro-cta" disabled={!ready} onClick={go}>{existing ? t.consentAcceptSync : t.consentContinue}</button>
            <button type="button" className="linklike" onClick={() => ref.current.close()}>{existing ? t.consentLater : t.consentSkip}</button>
          </div>
          {!existing && <p className="tl-warn">{CONSENT.footer}</p>}
          {error && <p role="alert" className="profile-err">{t.consentError}</p>}
        </div>
      </div>
    </dialog>
  );
}
