import React, { useEffect, useRef } from 'react';

export default function SettingsModal({ t, settings, canAcademic, onChange, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    const handle = () => onClose();
    d?.addEventListener('close', handle);
    return () => { d?.removeEventListener('close', handle); if (d?.open) d.close(); };
  }, []);

  return (
    <dialog ref={ref} className="modal" aria-labelledby="cfg-title" onClick={(e) => { if (e.target === ref.current) ref.current.close(); }}>
      <div className="sheet" style={{ '--c': 'var(--muted)' }}>
        <div className="head">
          <div className="ttl"><h2 id="cfg-title">{t.settings}</h2></div>
          <button type="button" className="ghost close" onClick={() => ref.current.close()} aria-label={t.close}>✕</button>
        </div>
        <div className="body">
          {!canAcademic && <p className="soon">{t.settingsNone}</p>}
          {canAcademic && (
          <label className="cfg-row">
            <input type="checkbox" checked={settings.showScholarly} onChange={(e) => onChange({ ...settings, showScholarly: e.target.checked })} />
            <span>
              <b>{t.settingsScholarly}</b>
              <small>{t.settingsScholarlyHelp}</small>
            </span>
          </label>
          )}
        </div>
      </div>
    </dialog>
  );
}
