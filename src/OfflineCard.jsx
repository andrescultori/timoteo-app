import React from 'react';
import { VERSIONS } from './data/bible.js';
import { BOOKS, offlineSupported, useOfflineBibles, isIOS, isStandalone } from './offline.js';

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
    </section>
  );
}
