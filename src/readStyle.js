import { READ_COLORS } from './readingPrefs.js';

// Variáveis CSS da superfície de leitura (tema, tamanho, entrelinha, largura da coluna e fonte). `p` = ajustes já resolvidos (resolvePrefs).
export function readStyle(p) {
  const c = READ_COLORS[p.theme];
  return {
    '--r-bg': c.bg, '--r-fg': c.fg, '--r-accent': c.accent,
    '--r-size': `${p.size}px`, '--r-lead': String(p.spacing), '--r-width': `${p.width}px`,
    '--r-font': p.font === 'sans' ? 'var(--f-body)' : 'var(--f-read)',
  };
}
