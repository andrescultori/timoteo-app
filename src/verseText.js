import { useEffect, useState } from 'react';
import { bySlug } from './data/books.js';
import { VERSIONS, loadBook } from './data/bible.js';
import { getVersionPref } from './userdata.js';

// Versão do texto fora do leitor (Favoritos > Versículos, Meus Estudos): a preferida do idioma (a mesma do leitor) ou a primeira disponível
export function pickVersion(lang) {
  const inLang = VERSIONS.filter((v) => v.available && v.lang === lang);
  return (inLang.find((v) => v.id === getVersionPref(lang)) ?? inLang[0] ?? VERSIONS[0]).id;
}

// Texto dos livros pedidos (carregado sob demanda, um por livro; fica no cache do navegador depois de lido). `${versão}/${slug}` → dados | 'erro'
export function useBookTexts(slugs, version) {
  const [texts, setTexts] = useState({});
  const need = slugs.filter((s) => !(`${version}/${s}` in texts)).join(',');
  useEffect(() => {
    let alive = true;
    need.split(',').filter(Boolean).forEach((slug) => {
      const key = `${version}/${slug}`;
      loadBook(version, bySlug[slug].n).then((d) => alive && setTexts((x) => ({ ...x, [key]: d }))).catch(() => alive && setTexts((x) => ({ ...x, [key]: 'erro' })));
    });
    return () => { alive = false; };
  }, [need, version]);
  return texts;
}
