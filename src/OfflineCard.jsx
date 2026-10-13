import React from 'react';
import { VERSIONS } from './data/bible.js';
import { BOOKS, offlineSupported, useOfflineBibles, isIOS, isStandalone } from './offline.js';
import { usePlan } from './plan.js';
import { useProOffline, proOfflineNow, proOfflineCancel, proOfflineRemove, proOfflineAuto } from './data/proOffline.js';

// Bloco do conteúdo Pro (só para quem tem Pro/Premium/admin): baixa sozinho; o app lê dele primeiro, inclusive sem rede.
function ProBlock({ t, lang }) {
  const o = useProOffline();
  const { plan, isAdmin, loading } = usePlan();
  if (!o.supported || loading || !(isAdmin || plan === 'pro' || plan === 'premium')) return null;
  const mb = o.meta?.totalBytes ? Math.max(1, Math.round(o.meta.totalBytes / 1048576)) : null;
  const when = o.meta?.syncedAt ? new Date(o.meta.syncedAt).toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en-US') : null;
  return (
    <div className="off-pro">
      <h3>{t.offProTitle}</h3>
      <p className="cfg-help">{t.offProHelp}</p>
      <p className="off-state" role="status">
        {o.syncing ? `${t.offDownloading} ${o.done}/${o.total || '…'}` : when ? `${t.offDone}${mb ? ` · ≈ ${mb} MB` : ''} · ${t.offUpdated} ${when}` : t.offProNone}
      </p>
      {o.error && <p className="cfg-help off-err" role="alert">{t.offError}</p>}
      <label className="cfg-row">
        <input type="checkbox" checked={o.auto} onChange={(e) => proOfflineAuto(e.target.checked)} />
        <span><b>{t.offProAuto}</b></span>
      </label>
      <div className="off-actions">
        <button type="button" className="ghost primary" disabled={o.syncing} onClick={proOfflineNow}>{when ? t.offProUpdate : t.offDownload}</button>
        {o.syncing && <button type="button" className="ghost" onClick={proOfflineCancel}>{t.offCancel}</button>}
        {when && !o.syncing && <button type="button" className="ghost" onClick={proOfflineRemove}>{t.offRemove}</button>}
      </div>
    </div>
  );
}

// Cartão "Uso offline" das Configurações: baixa o texto bíblico (por versão, sob demanda) para abrir sem internet.
export default function OfflineCard({ t, lang }) {
  const list = VERSIONS.filter((v) => v.available).sort((a, b) => (b.lang === lang) - (a.lang === lang));
  const o = useOfflineBibles(list.map((v) => v.id));
  const ok = offlineSupported();
  const allDone = list.every((v) => (o.counts[v.id] ?? 0) >= BOOKS);
  return (
    <section className="card small cfg-offline" aria-labelledby="cfg-off">
      <h2 id="cfg-off">{t.offTitle}</h2>
      <p className="cfg-help">{t.offHelp}</p>
      {!ok && <p className="cfg-help">{t.offUnsupported}</p>}
      {ok && (
        <>
          <ul className="off-list">
            {list.map((v) => {
              const n = o.counts[v.id] ?? 0;
              const busyN = o.progress[v.id];
              const full = n >= BOOKS;
              return (
                <li key={v.id}>
                  <span className="off-name"><b>{v.label}</b><small>{v.full} · ≈ 4 MB</small></span>
                  {busyN != null ? (
                    <span className="off-state" role="status">{t.offDownloading} {busyN}/{BOOKS}</span>
                  ) : full ? (
                    <>
                      <span className="off-state ok">{t.offDone}</span>
                      <button type="button" className="ghost" disabled={o.busy} onClick={() => o.remove(v.id)} aria-label={`${t.offRemove} ${v.label}`}>{t.offRemove}</button>
                    </>
                  ) : (
                    <>
                      {n > 0 && <span className="off-state">{n}/{BOOKS}</span>}
                      <button type="button" className="ghost primary" disabled={o.busy} onClick={() => o.start(v.id)} aria-label={`${t.offDownload} ${v.label}`}>{t.offDownload}</button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="off-actions">
            {!allDone && <button type="button" className="ghost" disabled={o.busy} onClick={o.startAll}>{t.offAll}</button>}
            {o.busy && <button type="button" className="ghost" onClick={o.cancel}>{t.offCancel}</button>}
          </div>
          {o.error && <p className="cfg-help off-err" role="alert">{t.offError}</p>}
          {isIOS() && !isStandalone() && <p className="cfg-help">{t.offIosTip}</p>}
        </>
      )}
      <ProBlock t={t} lang={lang} />
    </section>
  );
}
