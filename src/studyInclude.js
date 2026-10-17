// "Incluir o conteúdo aqui" (inc) dos itens do estudo e do Contexto: monta, SEM React e sem rede, os blocos que a tela do estudo e a folha de PDF desenham.
// Só usa dados que o app já tem (personagens, fichas, mapa, linha do tempo). Regras:
//   * o que depende do plano passa por `can` ANTES de olhar o dado; fora do plano o resultado é { type: 'locked' } e nenhum dado Pro entra;
//   * a posição acadêmica só entra com can('academic') (hoje, só admin);
//   * nunca guarda nem devolve texto bíblico (o texto vem do leitor).
// Retorna sempre { status: 'ok' | 'loading', nodes }; `loading` = falta carregar algum dado (a tela mostra "Carregando…").
// Tipos de nó: { type: 'p', text } | { type: 'h', text } | { type: 'dl', rows: [[rótulo, texto]] } | { type: 'list', items: [{ text, href? }] } | { type: 'locked' }.
import { buildContext, studyBases } from './studyContext.js';
import { hrefs } from './routeCore.js';

const pick = (v, lang) => (v && typeof v === 'object' ? v[lang] ?? v.en ?? v.pt ?? null : v ?? null);
const LOCKED = { status: 'ok', nodes: [{ type: 'locked' }] };
const ok = (nodes) => ({ status: 'ok', nodes: nodes.filter(Boolean) });
const LOADING = { status: 'loading', nodes: [] };

// Quais itens têm o interruptor "Incluir o conteúdo aqui"
export const INCLUDABLE = new Set(['person', 'place', 'event', 'chapter', 'book', 'context']);

// O que precisa estar carregado para desenhar os itens incluídos: { people, timeline, infoSlugs: [], peopleChapters }
export function includeNeeds(study, describeItem, can) {
  const need = { people: false, timeline: false, peopleChapters: false, infoSlugs: new Set() };
  const bases = [];
  for (const it of study.items) {
    if (!it.inc) continue;
    const d = describeItem(it.k, study.template);
    if (d.kind === 'person' && can('person', { id: d.id })) need.people = true;
    if (d.kind === 'event' && can('events')) need.timeline = true;
    if (d.kind === 'place' || d.kind === 'chapter' || d.kind === 'book') need.infoSlugs.add(d.slug);
    if (d.kind === 'context') { need.peopleChapters = true; if (can('events')) need.timeline = true; bases.push(true); }
  }
  if (bases.length) for (const b of studyBases(study.items.filter((i) => i.k !== 'block:ctx'))) need.infoSlugs.add(b.slug);
  return { ...need, infoSlugs: [...need.infoSlugs] };
}

// ---- personagem: resumo e livros (quando o plano permite) ----
export function includePerson({ id, lang, can, people, books, t }) {
  if (!can('person', { id })) return LOCKED;
  if (!people) return LOADING;
  const p = people.find((x) => x.id === id);
  if (!p) return ok([{ type: 'p', text: t.incMissing }]);
  const list = (p.books ?? []).map((b) => ({ text: `${books[b.book]?.name?.[lang] ?? b.book}${b.role ? `: ${pick(b.role, lang)}` : ''}`, href: hrefs.book(b.book) }));
  return ok([
    p.summary ? { type: 'p', text: pick(p.summary, lang) } : null,
    list.length ? { type: 'h', text: t.incBooks } : null,
    list.length ? { type: 'list', items: list } : null,
  ]);
}

// ---- lugar do mapa: nome, referência e o texto do mapa (sem desenhar o mapa) ----
export function includePlace({ slug, name, lang, can, info, books, t }) {
  if (!can('map', { slug })) return LOCKED;
  if (!info) return LOADING;
  const p = info.map?.places?.find((x) => x.name?.pt === name);
  if (!p) return ok([{ type: 'p', text: t.incMissing }]);
  const b = books[slug];
  return ok([
    { type: 'dl', rows: [[t.incRef, `${b?.ab?.[lang] ?? slug} ${p.ref}${p.uncertain ? ` · ${t.ctxUncertain}` : ''}`]] },
    p.note ? { type: 'p', text: pick(p.note, lang) } : null,
  ]);
}

// ---- evento: título, data(s) com a nota que explica a base, e os livros ----
const range = (d, lang) => {
  const a = Math.abs(d.start); const bc = d.start < 0; const c = d.approx ? 'c. ' : '';
  const hasEnd = d.end !== undefined && d.end !== d.start;
  const fmt = (n, neg) => (lang === 'pt' ? `${Math.abs(n)} ${neg ? 'a.C.' : 'd.C.'}` : neg ? `${Math.abs(n)} BC` : `AD ${Math.abs(n)}`);
  if (!hasEnd) return c + fmt(d.start, bc);
  return `${c}${fmt(d.start, bc)}–${fmt(d.end, d.end < 0)}`;
};
export function includeEvent({ id, lang, can, timeline, books, t }) {
  if (!can('events')) return LOCKED;
  if (!timeline) return LOADING;
  const e = timeline.events?.find((x) => x.id === id);
  if (!e) return ok([{ type: 'p', text: t.incMissing }]);
  const dates = e.dates?.start !== undefined ? [[null, e.dates]] : [['traditional', e.dates?.traditional], ['scholarly', e.dates?.scholarly]];
  const rows = dates.filter(([view, d]) => d && (view !== 'scholarly' || can('academic'))).map(([view, d]) => [view === 'scholarly' ? t.ctxAuthorScholarly : t.incDate, range(d, lang)]);
  const slugs = [...new Set([e.ref?.book, ...(e.places ?? []).map((p) => p.book)].filter(Boolean))];
  return ok([
    { type: 'h', text: pick(e.title, lang) },
    rows.length ? { type: 'dl', rows } : null,
    e.note ? { type: 'p', text: pick(e.note, lang) } : null,
    slugs.length ? { type: 'list', items: slugs.map((s) => ({ text: `${books[s]?.name?.[lang] ?? s}${s === e.ref?.book ? ` ${e.ref.ref}` : ''}`, href: hrefs.book(s) })) } : null,
  ]);
}

// ---- capítulo e livro: resumo da ficha (tema, autoria e data pela tradição, esboço do capítulo) ----
export function includeFicha({ slug, chapter, lang, can, info, books, t, peopleIndex = [] }) {
  if (!info) return LOADING;
  const ctx = buildContext({ slug, chapter, lang, book: books[slug], info, peopleIndex, can, plan: undefined, scholarly: can('academic'), hasMap: false });
  return ok(fichaNodes(ctx, t));
}
function fichaNodes(ctx, t) {
  const f = ctx.ficha;
  const rows = [];
  if (f?.theme) rows.push([t.ctxTheme, f.theme]);
  if (f?.author?.traditional) rows.push([t.ctxAuthor, f.author.traditional]);
  if (f?.author?.scholarly) rows.push([t.ctxAuthorScholarly, f.author.scholarly]);
  if (f?.date?.traditional) rows.push([t.ctxDate, f.date.traditional]);
  if (f?.date?.scholarly) rows.push([t.ctxAuthorScholarly, f.date.scholarly]);
  if (f?.keyVerse) rows.push([t.ctxKeyVerse, f.keyVerse]);
  return [
    rows.length ? { type: 'dl', rows } : null,
    ctx.outline.length ? { type: 'h', text: t.ctxOutline } : null,
    ctx.outline.length ? { type: 'list', items: ctx.outline.map((o) => ({ text: `${o.title} (${o.ref})` })) } : null,
  ];
}

// ---- Contexto (item especial block:ctx): o do 1º texto-base do estudo ----
export function includeContext({ study, lang, can, infos, peopleChapters, peopleIndex, timeline, books, t, plan }) {
  const base = studyBases(study.items.filter((i) => i.k !== 'block:ctx'), timeline, books)[0];
  if (!base) return ok([{ type: 'p', text: t.ctxEmpty }]);
  const info = infos?.[base.slug];
  if (!info) return LOADING;
  const wantsEvents = can('events');
  if (wantsEvents && !timeline) return LOADING;
  const ctx = buildContext({ slug: base.slug, chapter: base.chapter, lang, book: books[base.slug], info, peopleChapters, peopleIndex, timeline, can, plan, scholarly: can('academic'), hasMap: !!info.map });
  const title = `${books[base.slug]?.name?.[lang] ?? base.slug}${base.chapter ? ` ${base.chapter}` : ''}`;
  const chars = ctx.characters.status === 'ok' ? ctx.characters.items.filter((c) => !c.pro || can('person', { id: c.id })) : [];
  return ok([
    { type: 'h', text: title },
    ...fichaNodes(ctx, t),
    chars.length ? { type: 'h', text: t.ctxCharacters } : null,
    chars.length ? { type: 'list', items: chars.map((c) => ({ text: c.name, href: c.id && c.link ? hrefs.person(c.id) : undefined })) } : null,
    ctx.events.status === 'locked' ? { type: 'h', text: t.ctxEvents } : ctx.events.items.length ? { type: 'h', text: t.ctxEvents } : null,
    ctx.events.status === 'locked' ? { type: 'locked' } : ctx.events.items.length ? { type: 'list', items: ctx.events.items.map((e) => ({ text: `${e.title} (${e.ref})`, href: hrefs.timeline(e.id) })) } : null,
    ctx.places.status === 'locked' ? { type: 'h', text: t.ctxPlaces } : ctx.places.items.length ? { type: 'h', text: t.ctxPlaces } : null,
    ctx.places.status === 'locked' ? { type: 'locked' } : ctx.places.items.length ? { type: 'list', items: ctx.places.items.map((p) => ({ text: `${p.name} (${p.ref}${p.uncertain ? ` · ${t.ctxUncertain}` : ''})`, href: hrefs.book(base.slug, 'map', p.namePt) })) } : null,
  ]);
}

// Despacha por tipo de item (describeItem). `deps`: { lang, can, t, books, people, timeline, infos, peopleChapters, peopleIndex, plan, study }
export function includeFor(d, deps) {
  if (d.kind === 'person') return includePerson({ id: d.id, ...deps });
  if (d.kind === 'place') return includePlace({ slug: d.slug, name: d.name, ...deps, info: deps.infos?.[d.slug] });
  if (d.kind === 'event') return includeEvent({ id: d.id, ...deps });
  if (d.kind === 'chapter') return includeFicha({ slug: d.slug, chapter: d.chapter, ...deps, info: deps.infos?.[d.slug] });
  if (d.kind === 'book') return includeFicha({ slug: d.slug, chapter: null, ...deps, info: deps.infos?.[d.slug] });
  if (d.kind === 'context') return includeContext(deps);
  return ok([]);
}
