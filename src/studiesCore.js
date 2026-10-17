// "Meus Estudos" (preparação de estudos), sem armazenamento nem rede: testável em Node (scripts/test-studies.mjs).
// Um estudo: { id (uuid gerado no aparelho), title, template: 'passagem' | 'personagem' | 'sermao' | 'ebd' | null, items: [{ k, note? }], at: ISO }.
// Itens guardam REFERÊNCIAS (chaves no formato de favKeys.js), nunca o texto bíblico: o texto vem do leitor na versão escolhida.
// A ordem dos itens é a do array. A mesma regra das chaves e dos limites está em supabase/migrations/20261020000000_estudos_marcacoes.sql.
import { cleanText, chunk } from './marksCore.js';
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
