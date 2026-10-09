import { useEffect, useState } from 'react';
import { useUserData } from './userdata.js';
import { resolvePrefs } from './readingPrefs.js';

// Tema do SITE (claro, escuro ou automático). A preferência `siteTheme` fica nos ajustes de leitura (mesma API de userdata.js:
// aparelho sem conta, conta quando logado); o padrão é "light". O CSS só conhece `data-theme` = light | dark (já resolvido).
// O script inline do index.html aplica o tema antes do primeiro desenho; este módulo o mantém em dia (e acompanha o sistema no "auto").
// A chave antiga `theme` do localStorage (do tempo do Pergaminho) não distingue escolha de padrão: é ignorada e removida.
try { localStorage.removeItem('theme'); } catch { /* sem armazenamento */ }

const query = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null);
export const resolveSite = (pref, systemDark) => (pref === 'dark' ? 'dark' : pref === 'auto' ? (systemDark ? 'dark' : 'light') : 'light');

export function applySite(resolved) {
  const root = document.documentElement;
  root.setAttribute('data-theme', resolved);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#141615' : '#ffffff');
}

// Tema do site já resolvido ('light' | 'dark'), reagindo à preferência e, no "auto", ao sistema.
export function useResolvedSite() {
  const { prefs } = useUserData();
  const pref = resolvePrefs(prefs).siteTheme;
  const [system, setSystem] = useState(() => !!query()?.matches);
  useEffect(() => {
    const m = query();
    if (!m || pref !== 'auto') return undefined;
    const on = () => setSystem(m.matches);
    on();
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [pref]);
  return resolveSite(pref, system);
}

// Chamado uma vez, no App: aplica o tema ao <html>.
export function useApplySiteTheme() {
  const resolved = useResolvedSite();
  useEffect(() => { applySite(resolved); }, [resolved]);
  return resolved;
}
