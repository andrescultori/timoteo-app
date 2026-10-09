import { readColors } from './readingPrefs.js';

// Variáveis CSS da superfície de leitura (tema, tamanho, entrelinha, largura da coluna e fonte). `p` = ajustes já resolvidos (resolvePrefs); `site` = tema do site já resolvido (light | dark), para o tema de leitura "follow".
export function readStyle(p, site = 'light') {
  const c = readColors(p.theme, site);
  return {
    '--r-bg': c.bg, '--r-fg': c.fg, '--r-accent': c.accent,
    '--r-size': `${p.size}px`, '--r-lead': String(p.spacing), '--r-width': `${p.width}px`,
    '--r-font': p.font === 'sans' ? 'var(--f-body)' : 'var(--f-read)',
  };
}
