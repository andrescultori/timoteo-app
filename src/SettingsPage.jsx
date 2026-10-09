import React, { useEffect, useState } from 'react';
import BackButton from './BackButton.jsx';
import { usePageTitle } from './pageTitle.js';
import { useUserData, setPrefs, resetPrefs, getVersionPref } from './userdata.js';
import { useSession, signInWithGoogle } from './auth.js';
import { VERSIONS, loadBook } from './data/bible.js';
import { SIZES, SPACINGS, WIDTHS, FONTS, READ_THEMES, READ_COLORS, resolvePrefs } from './readingPrefs.js';
import { readStyle } from './readStyle.js';

// Grupo de opções excludentes (botões com aria-pressed, 44px)
function Options({ label, items, value, onPick }) {
  return (
    <div className="cfg-group" role="group" aria-label={label}>
      <span className="bk-label" aria-hidden="true">{label}</span>
      <div className="cfg-opts">
        {items.map(([v, text, style]) => (
          <button key={String(v)} type="button" className="opt" style={style} aria-pressed={value === v} onClick={() => onPick(v)}>{text}</button>
        ))}
      </div>
    </div>
  );
}

// Versículos 16–17 de João 3 na versão preferida do idioma, para a pré-visualização
function usePreview(lang) {
  const [state, setState] = useState(null);
  useEffect(() => {
    let alive = true;
    const inLang = VERSIONS.filter((v) => v.available && v.lang === lang && (!v.books || v.books.includes(43)));
    const v = inLang.find((x) => x.id === getVersionPref(lang)) ?? inLang[0] ?? VERSIONS[0];
    loadBook(v.id, 43).then((d) => alive && setState({ version: v, verses: [[16, d[2][15]], [17, d[2][16]]].filter(([, t]) => t) })).catch(() => {});
    return () => { alive = false; };
  }, [lang]);
  return state;
}

// Página de Configurações (#settings): ajustes de leitura (com pré-visualização ao vivo), onde ficam salvos e o cartão "Estudo" (admin).
export default function SettingsPage({ t, lang, settings, canAcademic, onChange }) {
  usePageTitle([t.settings], t.title);
  const { prefs } = useUserData();
  const p = resolvePrefs(prefs);
  const { enabled, signedIn, consent } = useSession();
  const preview = usePreview(lang);
  const synced = signedIn && consent === 'ok';
  const si = SIZES.indexOf(p.size);
  const colors = READ_COLORS[p.theme];
  const step = (d) => setPrefs({ size: SIZES[Math.min(SIZES.length - 1, Math.max(0, si + d))] });

  return (
    <div className="page bookpage" style={{ '--c': 'var(--muted)' }}>
      <BackButton t={t} />
      <h1 id="cfg-title">{t.settings}</h1>

      <div className="bk-cols cfg-cols">
        <section className="card cfg-card" aria-labelledby="cfg-read">
          <div className="cfg-head">
            <h2 id="cfg-read">{t.cfgRead}</h2>
            <button type="button" className="linklike cfg-reset" onClick={resetPrefs}>{t.cfgReset}</button>
          </div>

          <div className="cfg-group" role="group" aria-label={t.cfgSize}>
            <span className="bk-label" aria-hidden="true">{t.cfgSize}</span>
            <div className="cfg-size">
              <button type="button" className="ghost icon-btn" aria-label={t.cfgSmaller} disabled={si <= 0} onClick={() => step(-1)}><span className="aa-s" aria-hidden="true">A</span></button>
              <div className="cfg-dots" aria-hidden="true">{SIZES.map((s) => <span key={s} className={s === p.size ? 'on' : undefined} />)}</div>
              <button type="button" className="ghost icon-btn" aria-label={t.cfgLarger} disabled={si >= SIZES.length - 1} onClick={() => step(1)}><span className="aa-l" aria-hidden="true">A</span></button>
            </div>
            <span className="cfg-now" role="status">{p.size} px</span>
          </div>

          <Options label={t.cfgSpacing} value={p.spacing} onPick={(v) => setPrefs({ spacing: v })}
            items={[[SPACINGS[0], t.cfgCompact], [SPACINGS[1], t.cfgNormal], [SPACINGS[2], t.cfgWide]]} />
          <Options label={t.cfgWidth} value={p.width} onPick={(v) => setPrefs({ width: v })}
            items={[[WIDTHS[0], t.cfgNarrow], [WIDTHS[1], t.cfgMedium], [WIDTHS[2], t.cfgBroad]]} />
          <Options label={t.cfgFont} value={p.font} onPick={(v) => setPrefs({ font: v })}
            items={[[FONTS[0], t.cfgSerif, { fontFamily: 'var(--f-read)' }], [FONTS[1], t.cfgSans, { fontFamily: 'var(--f-body)' }]]} />

          <div className="cfg-switch">
            <span className="cfg-switch-text">
              <span id="cfg-lines-l">{t.cfgLines}</span>
              <small id="cfg-lines-d">{t.cfgLinesHelp}</small>
            </span>
            <button type="button" role="switch" className="switch" aria-checked={p.verseLines} aria-labelledby="cfg-lines-l" aria-describedby="cfg-lines-d" onClick={() => setPrefs({ verseLines: !p.verseLines })}><span /></button>
          </div>

          <Options label={t.cfgTheme} value={p.theme} onPick={(v) => setPrefs({ theme: v })}
            items={READ_THEMES.map((k) => [k, { light: t.cfgLight, sepia: t.cfgSepia, dark: t.cfgDark }[k], { background: READ_COLORS[k].bg, color: READ_COLORS[k].fg }])} />
        </section>

        <div className="bk-main cfg-side">
          <section className="card cfg-preview" style={{ ...readStyle(p), background: colors.bg, color: colors.fg }} aria-labelledby="cfg-prev">
            <h2 id="cfg-prev" className="bk-label" style={{ color: colors.fg }}>{t.cfgPreview} · {lang === 'pt' ? 'João' : 'John'} 3{preview ? ` · ${preview.version.label}` : ''}</h2>
            <div className={`text${p.verseLines ? ' lines' : ''}`} lang={preview?.version.lang}>
              <p>{(preview?.verses ?? []).map(([n, v]) => <span key={n}><sup>{n}</sup>{v} </span>)}</p>
            </div>
          </section>

          <section className="card small" aria-labelledby="cfg-where">
            <h2 id="cfg-where">{t.cfgWhere}</h2>
            {synced ? <p className="cfg-where ok"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>{t.cfgSaved}</p> : (
              <div className="cfg-where">
                <p>{enabled && signedIn ? t.cfgLocalConsent : t.cfgLocal}</p>
                {enabled && !signedIn && <button type="button" className="ghost primary" onClick={signInWithGoogle}>{t.signIn}</button>}
              </div>
            )}
          </section>

          {canAcademic && (
            <section className="card small" aria-labelledby="cfg-study">
              <h2 id="cfg-study">{t.settingsStudy}</h2>
              <label className="cfg-row">
                <input type="checkbox" checked={settings.showScholarly} onChange={(e) => onChange({ ...settings, showScholarly: e.target.checked })} />
                <span>
                  <b>{t.settingsScholarly}</b>
                  <small>{t.settingsScholarlyHelp}</small>
                </span>
              </label>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
