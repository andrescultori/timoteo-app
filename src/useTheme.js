import { useEffect, useState } from 'react';

// Tema ativo (valor de data-theme em <html>; vazio = automático) e números de variáveis CSS do tema, para o código
// que precisa dos mesmos valores que o CSS (ex.: tamanho dos rótulos do mapa, usado no cálculo de colisão).
const root = () => document.documentElement;
const readNumber = (name) => parseFloat(getComputedStyle(root()).getPropertyValue(name)) || 0;

function useRootAttr(read) {
  const [v, setV] = useState(read);
  useEffect(() => {
    const update = () => setV(read());
    update();
    const mo = new MutationObserver(update);
    mo.observe(root(), { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return v;
}

export const useThemeAttr = () => useRootAttr(() => root().getAttribute('data-theme') || '');
export const useCssNumber = (name) => useRootAttr(() => readNumber(name));
