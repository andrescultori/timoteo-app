import { readColors, markColors } from './readingPrefs.js';

// Variáveis CSS da superfície de leitura (tema, tamanho, entrelinha, largura da coluna e fonte). `p` = ajustes já resolvidos (resolvePrefs); `site` = tema do site já resolvido (light | dark), para o tema de leitura "follow".
export function readStyle(p, site = 'light') {
  const c = readColors(p.theme, site);
  const mk = markColors(p.theme, site);
  return {
    ...Object.fromEntries(mk.fill.flatMap((f, i) => [[`--mk${i + 1}`, f], [`--mk${i + 1}i`, mk.ink[i]]])), // cores das marcações no tema da leitura
    '--r-bg': c.bg, '--r-fg': c.fg, '--r-accent': c.accent,
    '--r-size': `${p.size}px`, '--r-lead': String(p.spacing), '--r-width': `${p.width}px`,
    '--r-font': p.font === 'sans' ? 'var(--f-body)' : 'var(--f-read)',
  };
}
