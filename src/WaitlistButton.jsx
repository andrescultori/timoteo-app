import React, { useEffect, useState } from 'react';
import { useSession, signInWithGoogle, getClient } from './auth.js';

// "Avise-me" reutilizável para os recursos "em breve". Deslogado, pede o login e volta (e registra o interesse ao voltar);
// logado, grava em `waitlist` e mostra "Você será avisado". Sem Supabase configurado, não aparece.
const KEY = 'waitlistIntent';
const intent = {
  get() { try { return sessionStorage.getItem(KEY); } catch { return null; } },
  set(v) { try { sessionStorage.setItem(KEY, v); } catch { /* ignora */ } },
  clear() { try { sessionStorage.removeItem(KEY); } catch { /* ignora */ } },
};

export default function WaitlistButton({ feature, t, className = '' }) {
  const { enabled, signedIn, user } = useSession();
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const join = async () => {
    setBusy(true);
    try {
      const client = await getClient();
      const { error } = await client.from('waitlist').upsert({ user_id: user.id, feature }, { onConflict: 'user_id,feature', ignoreDuplicates: true });
      if (!error) setDone(true);
    } finally { setBusy(false); intent.clear(); }
  };

  // já está na lista? e, se a pessoa acabou de voltar do login clicando aqui, registra
  useEffect(() => {
    if (!signedIn) { setDone(false); return undefined; }
    let alive = true;
    (async () => {
      const client = await getClient();
      const { data } = await client.from('waitlist').select('id').eq('user_id', user.id).eq('feature', feature).maybeSingle();
      if (!alive) return;
      if (data) { setDone(true); intent.clear(); } else if (intent.get() === feature) join();
    })().catch(() => {});
    return () => { alive = false; };
  }, [signedIn, user?.id, feature]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!enabled) return null;
  if (done) return <span className={`waitlist-done ${className}`} role="status">{t.waitlistDone}</span>;
  return (
    <button type="button" className={`ghost ${className}`} disabled={busy} onClick={() => (signedIn ? join() : (intent.set(feature), signInWithGoogle()))}>{t.waitlistAsk}</button>
  );
}
