// Ajustes de leitura (visual B): valores permitidos, padrão e validação. Puro (sem navegador), usado por userdata.js e pelos testes.
// A mesma lista de valores está na função SQL `reading_prefs_valid` (supabase/migrations/20261011000000_reading_prefs.sql); os testes conferem os dois lados.
export const SIZES = [17, 19, 21, 23, 26, 30]; // px
export const SPACINGS = [1.45, 1.7, 2]; // entrelinha
export const WIDTHS = [540, 660, 820]; // px
export const FONTS = ['serif', 'sans'];
export const READ_THEMES = ['follow', 'light', 'sepia', 'dark']; // follow = acompanha o tema do site
export const SITE_THEMES = ['light', 'dark', 'auto']; // tema do site: claro (padrão), escuro ou o do sistema

export const DEFAULTS = { size: 21, spacing: 1.7, width: 660, font: 'serif', verseLines: false, theme: 'follow', originals: false, cantillation: false, siteTheme: 'light' };

const RULES = {
  size: (v) => SIZES.includes(v),
  spacing: (v) => SPACINGS.includes(v),
  width: (v) => WIDTHS.includes(v),
  font: (v) => FONTS.includes(v),
  verseLines: (v) => typeof v === 'boolean',
  theme: (v) => READ_THEMES.includes(v),
  originals: (v) => typeof v === 'boolean', // faixa com o texto em hebraico e grego (plano Pro)
  cantillation: (v) => typeof v === 'boolean', // mostrar os acentos de cantilação do hebraico (padrão: escondidos)
  siteTheme: (v) => SITE_THEMES.includes(v),
};

// Aceita só chaves conhecidas com valores permitidos; o resto é descartado. Guarda apenas o que difere do padrão.
export function cleanPrefs(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const k of Object.keys(RULES)) if (k in raw && RULES[k](raw[k]) && raw[k] !== DEFAULTS[k]) out[k] = raw[k];
  return out;
}

export const resolvePrefs = (p) => ({ ...DEFAULTS, ...cleanPrefs(p) });

// Tema de leitura: cores só da superfície de leitura (docs/design/app-b/README.md e app-b-dark/README.md). "follow" usa as do tema do site.
export const READ_COLORS = {
  light: { bg: '#f8f7f2', fg: '#1f2320', accent: '#3f6553' },
  sepia: { bg: '#f1e7d0', fg: '#3b2f20', accent: '#8a5a2b' },
  dark: { bg: '#181a19', fg: '#e6e4da', accent: '#a9c1b3' },
};
// Cores das marcações de versículo (categorias c1..c6) por tema de LEITURA, que é independente do tema do site: `fill` (fundo do versículo) e
// `ink` (sublinhado e bolinha). O `npm run check` confere o contraste: texto sobre o fundo ≥ 4,5:1 e tinta sobre a página ≥ 3:1.
// No CSS, os mesmos valores do claro e do escuro estão em :root e :root[data-theme='dark'] (--mk1..6 e --mk1i..6i), para Favoritos e a barra de marcação.
export const MARK_COLORS = {
  light: { fill: ['#cfe3fb', '#f9d3df', '#e2d6f5', '#cdebd3', '#fbe9a6', '#c9ebe7'], ink: ['#1f5fa8', '#b02a5b', '#6a3fb0', '#2a7a43', '#8a6a00', '#0f7a72'] },
  sepia: { fill: ['#c3d6e8', '#efc6c0', '#d9c9e0', '#c4dcb8', '#f2d98b', '#bfdcd2'], ink: ['#1f5a96', '#a3274f', '#62399e', '#2b6b3a', '#7a5a00', '#0f6f66'] },
  dark: { fill: ['#1f3f66', '#6a2a40', '#46306b', '#1f4d33', '#5a4a12', '#14504c'], ink: ['#7fb2ee', '#f08fb0', '#b99aef', '#6fcb8d', '#e6c34d', '#5fd0c6'] },
};
export const readColors = (theme, siteResolved = 'light') => READ_COLORS[theme === 'follow' ? siteResolved : theme] ?? READ_COLORS.light;
export const markColors = (theme, siteResolved = 'light') => MARK_COLORS[theme === 'follow' ? siteResolved : theme] ?? MARK_COLORS.light;
