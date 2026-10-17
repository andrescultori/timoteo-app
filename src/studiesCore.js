// "Meus Estudos" (preparação de estudos), sem armazenamento nem rede: testável em Node (scripts/test-studies.mjs).
// Um estudo: { id (uuid gerado no aparelho), title, template: 'passagem' | 'personagem' | 'sermao' | 'ebd' | null, items: [{ k, note? }], at: ISO }.
// Itens guardam REFERÊNCIAS (chaves no formato de favKeys.js), nunca o texto bíblico: o texto vem do leitor na versão escolhida.
// A ordem dos itens é a do array. A mesma regra das chaves e dos limites está em supabase/migrations/20261020000000_estudos_marcacoes.sql.
import { cleanText, chunk, versesToRanges } from './marksCore.js';
import { favKey, parseFavKey } from './favKeys.js';
export { chunk };

export const LIMITS = { titleMax: 120, noteMax: 2000, itemsMax: 100, studiesMax: 200, essencialMax: 5 };

// Blocos de cada modelo (ids). Os títulos e as perguntas-guia ficam no i18n (tplName_*, tplBlock_*, tplAsk_*). Modelos aprovados pelo André.
export const TEMPLATES = {
  passagem: ['observacao', 'interpretacao', 'aplicacao', 'oracao'],
  personagem: ['quem', 'contexto', 'escolhas', 'deus', 'aplicacao'],
  sermao: ['texto-base', 'ideia-central', 'pontos', 'ilustracao', 'apelo'],
  ebd: ['objetivo', 'texto-base', 'quebra-gelo', 'discussao', 'aplicacao-semana', 'oracao'],
};

// Chave de item: a mesma expressão do SQL (study_items_valid). `[\s\S]` e a flag u imitam o "." do Postgres (qualquer caractere, por ponto de código).
export const ITEM_KEY_RE = /^(ref:[a-z0-9]{3}:[0-9]{1,3}:[0-9]{1,3}(-[0-9]{1,3})?|book:[a-z0-9]{3}|chapter:[a-z0-9]{3}:[0-9]{1,3}|verse:[a-z0-9]{3}:[0-9]{1,3}:[0-9]{1,3}|person:[a-z0-9-]{1,60}|event:[a-z0-9-]{1,60}|place:[a-z0-9]{3}:[\s\S]{1,80}|block:[a-z0-9-]{1,30})$/u;
export const isItemKey = (k) => typeof k === 'string' && ITEM_KEY_RE.test(k);
export const blockKey = (id) => `block:${id}`;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isIso = (s) => typeof s === 'string' && s.length > 0 && !Number.isNaN(Date.parse(s));

export function cleanItem(raw) {
  if (!raw || typeof raw !== 'object' || !isItemKey(raw.k)) return null;
  const note = cleanText(raw.note, LIMITS.noteMax);
  return note ? { k: raw.k, note } : { k: raw.k };
}

// Estudo válido ou null. Bloco repetido sai (um por id); passa até 100 itens.
export function cleanStudy(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !UUID_RE.test(raw.id) || !isIso(raw.at)) return null;
  const title = cleanText(raw.title, LIMITS.titleMax);
  if (!title) return null;
  const seen = new Set();
  const items = [];
  for (const x of Array.isArray(raw.items) ? raw.items : []) {
    const it = cleanItem(x);
    if (!it || (it.k.startsWith('block:') && seen.has(it.k))) continue;
    seen.add(it.k);
    items.push(it);
    if (items.length >= LIMITS.itemsMax) break;
  }
  return { id: raw.id.toLowerCase(), title, template: Object.hasOwn(TEMPLATES, raw.template) ? raw.template : null, items, at: new Date(raw.at).toISOString() };
}

export function cleanStudies(list, max = LIMITS.studiesMax) {
  const best = new Map();
  for (const raw of Array.isArray(list) ? list : []) {
    const s = cleanStudy(raw);
    if (!s) continue;
    const cur = best.get(s.id);
    if (!cur || s.at > cur.at) best.set(s.id, s);
  }
  return [...best.values()].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)).slice(0, max);
}

// Estudo novo; com modelo, já vem com os blocos (uma pergunta-guia por bloco, que o usuário preenche).
export function newStudy({ id, title, template = null, now = new Date().toISOString() }) {
  const blocks = Object.hasOwn(TEMPLATES, template) ? TEMPLATES[template] : [];
  return cleanStudy({ id, title, template, items: blocks.map((b) => ({ k: blockKey(b) })), at: now });
}

const touch = (s, patch, now) => ({ ...s, ...patch, at: now });

// Edições: devolvem um estudo novo (ou { error }). `now` vira a data do estudo.
export function addItem(study, k, note, now = new Date().toISOString()) {
  const it = cleanItem({ k, note });
  if (!it) return { error: 'invalid' };
  if (study.items.length >= LIMITS.itemsMax) return { error: 'full' };
  if (study.items.some((x) => x.k === it.k)) return { error: 'duplicate' };
  return { study: touch(study, { items: [...study.items, it] }, now) };
}
export function removeItem(study, index, now = new Date().toISOString()) {
  if (!Number.isInteger(index) || index < 0 || index >= study.items.length) return { error: 'invalid' };
  return { study: touch(study, { items: study.items.filter((_, i) => i !== index) }, now) };
}
export function moveItem(study, index, dir, now = new Date().toISOString()) {
  const to = index + (dir < 0 ? -1 : 1);
  if (!Number.isInteger(index) || index < 0 || index >= study.items.length || to < 0 || to >= study.items.length) return { error: 'invalid' };
  const items = [...study.items];
  [items[index], items[to]] = [items[to], items[index]];
  return { study: touch(study, { items }, now) };
}
export function setItemNote(study, index, note, now = new Date().toISOString()) {
  if (!Number.isInteger(index) || index < 0 || index >= study.items.length) return { error: 'invalid' };
  const items = study.items.map((x, i) => (i === index ? cleanItem({ k: x.k, note }) : x));
  return { study: touch(study, { items }, now) };
}
export function renameStudy(study, title, now = new Date().toISOString()) {
  const t = cleanText(title, LIMITS.titleMax);
  return t ? { study: touch(study, { title: t }, now) } : { error: 'invalid' };
}

// Pode criar mais um estudo? O servidor tem a palavra final (gatilho studies_guard); isto evita a ida e volta e serve à interface.
// Só a CRIAÇÃO é limitada: quem caiu de Pro para Essencial com mais estudos continua vendo, editando e apagando.
export function studyQuota({ count, pro = false, essencialMax = LIMITS.essencialMax, max = LIMITS.studiesMax }) {
  if (count >= max) return { ok: false, reason: 'max' };
  if (!pro && count >= essencialMax) return { ok: false, reason: 'plan' };
  return { ok: true, reason: null };
}

// ---- união no login (por id; mesma ideia de mergeMarks) ----
// queue: { [id]: { op: 'upsert' | 'delete', at } }. Devolve { studies, upload: [estudos a gravar], remove: [ids a apagar na conta] }.
export function mergeStudies({ local = [], remote = [], queue = {}, synced = false }) {
  const remoteMap = new Map(cleanStudies(remote, Infinity).map((s) => [s.id, s]));
  const merged = new Map(remoteMap);
  const upload = new Map();
  const remove = new Set();
  const localMap = new Map(cleanStudies(local, Infinity).map((s) => [s.id, s]));
  if (!synced) {
    for (const s of localMap.values()) {
      const r = remoteMap.get(s.id);
      if (!r || s.at > r.at) { merged.set(s.id, s); upload.set(s.id, s); }
    }
  }
  for (const [id, o] of Object.entries(queue ?? {})) {
    if (!o || (o.op !== 'upsert' && o.op !== 'delete')) continue;
    const r = remoteMap.get(id);
    if (r && isIso(o.at) && r.at > new Date(o.at).toISOString()) continue; // a conta tem uma edição mais nova
    if (o.op === 'delete') { merged.delete(id); upload.delete(id); if (r) remove.add(id); continue; }
    const s = localMap.get(id);
    if (s) { merged.set(id, s); upload.set(id, s); remove.delete(id); }
  }
  return { studies: cleanStudies([...merged.values()]), upload: [...upload.values()], remove: [...remove] };
}

export const toStudyRow = (s, userId) => ({ id: s.id, user_id: userId, title: s.title, template: s.template, items: s.items, updated_at: s.at });
export const fromStudyRow = (r) => (r && r.updated_at ? cleanStudy({ id: r.id, title: r.title, template: r.template, items: r.items, at: r.updated_at }) : null);

export function cleanStudyQueue(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [id, o] of Object.entries(raw)) if (UUID_RE.test(id) && o && (o.op === 'upsert' || o.op === 'delete') && isIso(o.at)) out[id.toLowerCase()] = { op: o.op, at: new Date(o.at).toISOString() };
  return out;
}

// ---- itens: descrição, chaves e texto (puros, usados pela tela do estudo) ----

// Chaves `ref:` para os versículos selecionados no leitor: um intervalo contíguo vira um item ([16, 17, 20] → ref ...:16-17 e ref ...:20)
export function refKeysFor(slug, chapter, verses) {
  return versesToRanges(verses).map(([a, b]) => favKey.ref(slug, chapter, a, b));
}

// Bloco livre (nota sem pergunta-guia): id único e curto, só [a-z0-9-] (≤ 30 caracteres, como o banco exige)
export function newNoteId(now = Date.now(), salt = Math.floor(Math.random() * 1296)) {
  return `nota-${now.toString(36)}${salt.toString(36)}`.slice(0, 30);
}
export const isBlockOfTemplate = (template, id) => Object.hasOwn(TEMPLATES, template) && TEMPLATES[template].includes(id);

// Descreve uma chave de item: { kind, ...partes }. kind: block | passage | verse | chapter | book | person | event | place | unknown.
// `block` ganha `free: true` quando não pertence ao modelo do estudo (nota livre).
export function describeItem(key, template = null) {
  if (typeof key === 'string' && key.startsWith('block:')) { const id = key.slice(6); return { kind: 'block', id, free: !isBlockOfTemplate(template, id) }; }
  const k = parseFavKey(key);
  if (!k) return { kind: 'unknown', key };
  if (k.type === 'ref') return { kind: 'passage', slug: k.slug, chapter: k.n, v1: k.v1, v2: k.v2 };
  if (k.type === 'verse') return { kind: 'passage', slug: k.slug, chapter: k.n, v1: k.v, v2: k.v };
  if (k.type === 'chapter') return { kind: 'chapter', slug: k.slug, chapter: k.n };
  if (k.type === 'book') return { kind: 'book', slug: k.slug };
  if (k.type === 'person') return { kind: 'person', id: k.id };
  if (k.type === 'event') return { kind: 'event', id: k.id };
  if (k.type === 'place') return { kind: 'place', slug: k.slug, name: k.name };
  return { kind: 'unknown', key };
}

// Versículos de uma passagem a partir dos dados do livro (array de capítulos; posição i = versículo i+1; null = ausente na versão).
// Devolve [{ n, text }] (text null = a versão não tem o versículo). Nunca guarda texto: o texto vem do leitor na versão ativa.
export function passageVerses(bookData, chapter, v1, v2 = v1) {
  const ch = Array.isArray(bookData) ? bookData[chapter - 1] : null;
  if (!Array.isArray(ch)) return [];
  const out = [];
  for (let n = v1; n <= Math.min(v2, ch.length); n += 1) out.push({ n, text: ch[n - 1] ?? null });
  return out;
}

// "há 5 minutos" / "5 minutes ago" (para "editado há…" na lista de estudos)
export function relativeTime(iso, now = Date.now(), lang = 'pt') {
  const sec = Math.round((now - Date.parse(iso)) / 1000);
  if (!Number.isFinite(sec)) return '';
  if (sec < 60) return lang === 'pt' ? 'agora há pouco' : 'just now';
  const rtf = new Intl.RelativeTimeFormat(lang === 'pt' ? 'pt-BR' : 'en', { numeric: 'auto' });
  const units = [['minute', 60], ['hour', 3600], ['day', 86400], ['month', 2592000], ['year', 31536000]];
  let best = units[0];
  for (const u of units) if (sec >= u[1]) best = u;
  return rtf.format(-Math.floor(sec / best[1]), best[0]);
}


// Acrescenta várias chaves de uma vez ("Adicionar ao estudo" do leitor). Repetida e inválida são puladas; para ao chegar em 100.
// Devolve { study, added, skipped, full }; `full` = sobrou item sem caber.
export function addKeys(study, keys, now = new Date().toISOString()) {
  let cur = study;
  let added = 0;
  let skipped = 0;
  let full = false;
  for (const k of keys) {
    const r = addItem(cur, k, undefined, now);
    if (r.study) { cur = r.study; added += 1; } else if (r.error === 'full') { full = true; skipped += 1; } else skipped += 1;
  }
  return { study: cur, added, skipped, full };
}
