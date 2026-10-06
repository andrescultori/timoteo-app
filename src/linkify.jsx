import React, { useEffect, useMemo, useState } from 'react';
import { hrefs } from './route.js';
import { usePlan } from './plan.js';

// Liga, nos textos da ficha, os nomes de personagens (página #person/<id>) e os lugares do mapa do próprio livro (#<livro>/map/<lugar>).
// Regras: maiúsculas e minúsculas contam (evita "tiro", "job"); só a primeira ocorrência de cada nome em cada bloco de texto vira link;
// nome que serve a mais de uma pessoa (José, Tiago, Filipe...) só liga se o livro desambiguar (uma só delas aparece nele).
// Os nomes vêm de people-index.json (gerado de people.json por scripts/build-people-index.mjs), carregado sob demanda.

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const alias = (name) => name.split(/[,(]/)[0].trim();

export function useLinkIndex(book, info, lang) {
  const [people, setPeople] = useState(null);
  const { can, plan, isAdmin } = usePlan();
  useEffect(() => {
    let alive = true;
    import('./data/people-index.json').then((m) => { if (alive) setPeople(m.default ?? m); }).catch(() => { /* sem links, o texto continua */ });
    return () => { alive = false; };
  }, []);

  return useMemo(() => {
    const entries = new Map(); // texto → href
    if (people) {
      const byAlias = new Map();
      for (const p of people) {
        if (p.no || (p.only && !p.only.includes(book.slug))) continue; // autoLink: false / linkBooks em people.json
        if (!can('person', { id: p.id })) continue; // fora do plano: texto comum, nunca link para página que não abre
        const a = alias(p.name[lang]);
        if (a.length < 3) continue;
        if (!byAlias.has(a)) byAlias.set(a, []);
        byAlias.get(a).push(p);
      }
      for (const [a, list] of byAlias) {
        const here = list.filter((p) => p.books.includes(book.slug));
        const pick = list.length === 1 ? list[0] : here.length === 1 ? here[0] : null;
        if (pick) entries.set(a, hrefs.person(pick.id));
      }
    }
    for (const pl of can('map', { slug: book.slug }) ? info?.map?.places ?? [] : []) { // livro sem mapa no plano: o lugar vira texto comum
      const n = pl.name[lang];
      if (n && n.length >= 3 && !entries.has(n)) entries.set(n, hrefs.book(book.slug, 'map', pl.name.pt));
    }
    if (!entries.size) return null;
    const names = [...entries.keys()].sort((a, b) => b.length - a.length);
    const re = new RegExp(`(?<![\\p{L}\\p{N}])(${names.map(esc).join('|')})(?![\\p{L}\\p{N}])`, 'gu');
    return { re, entries };
  }, [people, info, book.slug, lang, plan, isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps
}

// Texto com links. `index` vem de useLinkIndex; sem índice (carregando), devolve o texto puro.
export function Rich({ text, index }) {
  if (!index || !text) return text ?? null;
  const { re, entries } = index;
  const out = [];
  const seen = new Set();
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (seen.has(m[1])) continue;
    if (/\d\s*$/.test(text.slice(0, m.index))) continue; // "1 Enoque", "2 Reis": nome de livro, não de pessoa
    seen.add(m[1]);
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(<a key={m.index} className="plink" href={entries.get(m[1])}>{m[1]}</a>);
    last = m.index + m[1].length;
  }
  if (!out.length) return text;
  if (last < text.length) out.push(text.slice(last));
  return out;
}
