// Ajustes de leitura (visual B): valores permitidos, padrão e validação. Puro (sem navegador), usado por userdata.js e pelos testes.
// A mesma lista de valores está na função SQL `reading_prefs_valid` (supabase/migrations/20261011000000_reading_prefs.sql); os testes conferem os dois lados.
export const SIZES = [17, 19, 21, 23, 26, 30]; // px
export const SPACINGS = [1.45, 1.7, 2]; // entrelinha
export const WIDTHS = [540, 660, 820]; // px
export const FONTS = ['serif', 'sans'];
export const READ_THEMES = ['light', 'sepia', 'dark'];

export const DEFAULTS = { size: 21, spacing: 1.7, width: 660, font: 'serif', verseLines: false, theme: 'light', originals: false, cantillation: false };

const RULES = {
  size: (v) => SIZES.includes(v),
  spacing: (v) => SPACINGS.includes(v),
  width: (v) => WIDTHS.includes(v),
  font: (v) => FONTS.includes(v),
  verseLines: (v) => typeof v === 'boolean',
  theme: (v) => READ_THEMES.includes(v),
  originals: (v) => typeof v === 'boolean', // faixa com o texto em hebraico e grego (plano Pro)
  cantillation: (v) => typeof v === 'boolean', // mostrar os acentos de cantilação do hebraico (padrão: escondidos)
};

// Aceita só chaves conhecidas com valores permitidos; o resto é descartado. Guarda apenas o que difere do padrão.
export function cleanPrefs(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const k of Object.keys(RULES)) if (k in raw && RULES[k](raw[k]) && raw[k] !== DEFAULTS[k]) out[k] = raw[k];
  return out;
}

export const resolvePrefs = (p) => ({ ...DEFAULTS, ...cleanPrefs(p) });

// Tema de leitura: cores só da superfície de leitura (docs/design/app-b/README.md)
export const READ_COLORS = {
  light: { bg: '#f8f7f2', fg: '#1f2320', accent: '#3f6553' },
  sepia: { bg: '#f1e7d0', fg: '#3b2f20', accent: '#8a5a2b' },
  dark: { bg: '#14201b', fg: '#e6e4da', accent: '#a9c1b3' },
};
