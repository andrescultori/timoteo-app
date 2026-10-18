// Contexto de um texto-base para a tela do estudo (puro, testado em scripts/test-study-context.mjs). Só usa dados que já existem nos JSONs do app:
// ficha do livro (autor/tradição, data, tema, versículo-chave, esboço), personagens citados no capítulo (people-chapters.json), e, no Pro, eventos da
// linha do tempo e lugares do mapa. Nada de texto novo e nada inventado.
// Regras: o que depende do plano vem marcado como `locked` (a tela mostra o convite ao Pro, sem carregar nem expor o conteúdo); a posição acadêmica
// só sai para quem é admin (`scholarly: true`); o resto do mundo recebe SÓ a tradição.
import { sectionsAt } from './outline.js';
import { peopleInChapterFrom, bookHasChapters } from './peopleChapters.js';
import { describeItem } from './studiesCore.js';

const pick = (v, lang) => (v && typeof v === 'object' ? v[lang] ?? v.en ?? v.pt ?? null : v ?? null);
export const chapterOfRef = (r) => { const m = /^(\d+)/.exec(String(r ?? '')); return m ? Number(m[1]) : null; };

// De onde vem o contexto de um item: { slug, chapter } (chapter null = o livro todo) ou null (personagem e lugar sem passagem não têm texto-base).
// `timeline`: { events } só para achar o livro e o capítulo de um evento.
export function baseOf(key, timeline = null) {
  const d = describeItem(key);
  if (d.kind === 'passage' || d.kind === 'chapter') return { slug: d.slug, chapter: d.chapter };
  if (d.kind === 'book' || d.kind === 'place') return { slug: d.slug, chapter: null };
  if (d.kind === 'event') {
    const e = timeline?.events?.find((x) => x.id === d.id);
    return e?.ref?.book ? { slug: e.ref.book, chapter: chapterOfRef(e.ref.ref) } : null;
  }
  return null;
}

// `can(feature, ctx)`: o can() do plano (planRules.js). `book`: { slug, name, testament, section, chapters } (já em texto da língua).
// Entradas que podem faltar (ainda carregando): info, peopleChapters, timeline.
export function buildContext({ slug, chapter = null, lang = 'pt', book, info = null, peopleChapters = null, peopleIndex = [], timeline = null, can, scholarly = false, hasMap = false, plan = 'essencial' }) {
  const ctx = (feature, extra = {}) => can(feature, { plan, ...extra });
  const out = { slug, chapter, book: book ?? null, ficha: null, outline: [], characters: { status: 'empty', items: [] }, events: { status: 'empty', items: [] }, places: { status: 'none', items: [] } };

  if (info) {
    const both = (f) => (f ? { traditional: pick(f.traditional, lang), ...(scholarly && f.scholarly ? { scholarly: pick(f.scholarly, lang) } : {}) } : null);
    out.ficha = { author: both(info.author), date: both(info.date), theme: pick(info.theme, lang), keyVerse: info.keyVerse ?? null };
    out.outline = chapter && Array.isArray(info.outline) ? sectionsAt(info.outline, chapter).map((i) => ({ ref: info.outline[i].ref, title: pick(info.outline[i].title, lang) })) : [];
  }

  // personagens: do capítulo (people-chapters.json, só os citados pelo nome) ou, sem capítulo, os da ficha do livro
  const nameOf = new Map(peopleIndex.map((p) => [p.id, pick(p.name, lang)]));
  const person = (id, name) => ({ id, name, link: ctx('person', { id }), pro: !ctx('person', { id }) });
  if (chapter && peopleChapters && bookHasChapters(peopleChapters, slug)) {
    const items = peopleInChapterFrom(peopleChapters, slug, chapter).filter((id) => nameOf.has(id)).map((id) => person(id, nameOf.get(id)));
    out.characters = { status: items.length ? 'ok' : 'empty', items };
  } else if (info?.characters?.length) {
    const items = info.characters.map((c) => (c.ids?.length === 1 && c.ids[0] ? person(c.ids[0], pick(c.name, lang)) : { id: null, name: pick(c.name, lang), link: false, pro: false }));
    out.characters = { status: 'ok', items };
  }

  // eventos da linha do tempo: Pro. Sem o plano nada do conteúdo entra aqui.
  if (!ctx('events')) out.events = { status: 'locked', items: [] };
  else if (timeline?.events?.length) {
    const items = timeline.events.filter((e) => e.ref?.book === slug && (chapter == null || chapterOfRef(e.ref.ref) === chapter)).map((e) => ({ id: e.id, title: pick(e.title, lang), ref: e.ref.ref }));
    out.events = { status: items.length ? 'ok' : 'empty', items };
  }

  // lugares do mapa: Essencial nos livros liberados, Pro nos demais; livro sem mapa não mostra a seção
  if (hasMap) {
    if (!ctx('map', { slug }) || !info?.map) out.places = { status: 'locked', items: [] };
    else {
      const items = info.map.places.filter((p) => chapter == null || chapterOfRef(p.ref) === chapter).map((p) => ({ name: pick(p.name, lang), namePt: p.name.pt, ref: p.ref, uncertain: !!p.uncertain }));
      out.places = { status: items.length ? 'ok' : 'empty', items };
    }
  }
  return out;
}

// Textos-base distintos do estudo, na ordem dos itens: [{ id, slug, chapter }]. Serve ao seletor do Contexto e ao "incluir o contexto" (usa o 1º).
export function studyBases(items, timeline = null, books = null) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const b = baseOf(it.k, timeline);
    if (!b || (books && !books[b.slug])) continue;
    const id = `${b.slug}:${b.chapter ?? ''}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, ...b });
  }
  return out;
}
