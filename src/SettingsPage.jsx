import React from 'react';
import BackButton from './BackButton.jsx';
import { usePageTitle } from './pageTitle.js';

// Página de Configurações (#settings). Os ajustes de leitura entram na PR seguinte; hoje só o cartão "Estudo".
export default function SettingsPage({ t, settings, canAcademic, onChange }) {
  usePageTitle([t.settings], t.title);
  return (
    <div className="page bookpage" style={{ '--c': 'var(--muted)' }}>
      <BackButton t={t} />
      <h1 id="cfg-title">{t.settings}</h1>
      <section className="card" aria-labelledby="cfg-study">
        <h2 id="cfg-study">{t.settingsStudy}</h2>
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
      </section>
    </div>
  );
}
