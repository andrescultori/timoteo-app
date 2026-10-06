import React from 'react';
import { LOGO_D, LOGO_W, LOGO_H } from './logoPath.js';

// Marca oficial do Timóteo App, inline para seguir o tema (cor = currentColor; o .logo usa var(--logo) no styles.css).
// O path vem de src/logoPath.js, GERADO por scripts/build-brand-assets.mjs a partir de branding/fonte/. Para trocar o desenho:
// substituir os fontes e rodar o script (ver branding/README.md). `size` é a ALTURA em px (a marca não é quadrada: 152x170).
export default function Logo({ size = 30 }) {
  return (
    <svg width={(size * LOGO_W) / LOGO_H} height={size} viewBox={`0 0 ${LOGO_W} ${LOGO_H}`} aria-hidden="true" focusable="false" fill="currentColor">
      <path d={LOGO_D} fillRule="evenodd" clipRule="evenodd" />
    </svg>
  );
}
