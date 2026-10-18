import React from 'react';
import { bySlug } from './data/books.js';
import people from './data/people-index.json'; // só id, nome e livros (público)
import { useContent, getTimeline } from './data/content.js';
import { hrefs } from './route.js';
import { pick } from './timelineUtil.js';
import { refLabel } from './verseSelect.js';
import { tplLabel } from './studiesUi.jsx';

export const peopleById = Object.fromEntries(people.map((p) => [p.id, p]));
export const KIND_KEY = { passage: 'studyKindPassage', chapter: 'studyKindChapter', book: 'studyKindBook', person: 'studyKindPerson', event: 'studyKindEvent', place: 'studyKindPlace', context: 'studyKindContext' };

// Só renderize quando o plano permite a linha do tempo (can('timeline')): este componente pede o conteúdo Pro
export function EventName({ id, t, lang }) {
  const { ready } = useContent('timeline');
  const ev = ready ? getTimeline()?.events?.find((e) => e.id === id) : null;
  return <>{ev ? pick(ev.title, lang) : t.studyEventName}</>;
}

// Rótulo e destino de um item (null = o destino não existe mais nos dados)
export function labelOf(d, t, lang, study) {
  if (d.kind === 'block') return { text: d.free ? t.studyNoteFree : tplLabel(t, study.template, d.id) };
  if (d.kind === 'passage') { const b = bySlug[d.slug]; if (!b) return null; const vs = []; for (let n = d.v1; n <= d.v2; n += 1) vs.push(n); return { text: refLabel(b.name[lang], d.chapter, vs), href: hrefs.book(d.slug, 'read', String(d.chapter), d.v1) }; }
  if (d.kind === 'context') return { text: t.incCtxItem };
  if (d.kind === 'chapter') { const b = bySlug[d.slug]; return b && { text: `${b.name[lang]} ${d.chapter}`, href: hrefs.book(d.slug, 'read', String(d.chapter)) }; }
  if (d.kind === 'book') { const b = bySlug[d.slug]; return b && { text: b.name[lang], href: hrefs.book(d.slug) }; }
  if (d.kind === 'person') { const p = peopleById[d.id]; return p && { text: pick(p.name, lang), href: hrefs.person(d.id) }; }
  if (d.kind === 'event') return { text: t.studyEventName, href: hrefs.timeline(d.id), event: true };
  if (d.kind === 'place') { const b = bySlug[d.slug]; return b && { text: `${d.name} (${b.ab[lang]})`, href: hrefs.book(d.slug, 'map', d.name) }; }
  return null;
}
