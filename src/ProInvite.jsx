import React from 'react';
import BackButton from './BackButton.jsx';
import WaitlistButton from './WaitlistButton.jsx';
import { useSession } from './auth.js';

// Convite ao plano Pro, no lugar do conteúdo bloqueado. Honesto: a cobrança ainda não existe (Fase 4), então só oferece o "Avise-me".
// `page`: embrulha o convite em uma página inteira (linha do tempo, genealogia, personagem fora do plano), com o título e o Voltar.
export default function ProInvite({ t, title, page = false, feature = 'pro' }) {
  const { enabled, signedIn } = useSession();
  const box = (
    <div className="pro-invite" role="note">
      <b>{t.proInviteTitle}</b>
      <p>{t.proInviteBody}</p>
      <p className="tl-warn">{t.proInviteNotYet}{enabled && !signedIn ? ` ${t.proInviteLogin}` : ''}</p>
      <WaitlistButton feature={feature} t={t} />
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
