import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

// Aviso do service worker (PWA): "versão nova" (o usuário escolhe quando recarregar, para não perder a leitura) e "pronto para abrir sem internet".
// Só aparece quando há algo a dizer; no `vite dev` o service worker fica desligado.
export default function UpdatePrompt({ t }) {
  const { needRefresh: [needRefresh, setNeedRefresh], offlineReady: [offlineReady, setOfflineReady], updateServiceWorker } = useRegisterSW();
  if (!needRefresh && !offlineReady) return null;
  const close = () => { setNeedRefresh(false); setOfflineReady(false); };
  return (
    <div className="pwa-toast" role="status" aria-live="polite">
      <span>{needRefresh ? t.updateReady : t.offlineReady}</span>
      {needRefresh && <button type="button" className="pwa-go" onClick={() => updateServiceWorker(true)}>{t.updateNow}</button>}
      <button type="button" className="pwa-close" onClick={close}>{needRefresh ? t.updateLater : t.offlineClose}</button>
    </div>
  );
}
