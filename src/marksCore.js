// Marcações de versículos e categorias (preparação de estudos), sem armazenamento nem rede: testável em Node (scripts/test-marks.mjs).
// A mesma lista de valores está nas funções e restrições SQL de supabase/migrations/20261020000000_estudos_marcacoes.sql; os testes conferem os dois lados.
//   marcação: { b: slug (3 caracteres), c: capítulo 1..150, v: versículo 1..176 (numeração da KJV), cat: 'c1'..'c6' | null, note: string | null, at: ISO }
//   Só existe com categoria, com nota ou com as duas. A cor da categoria vem do app (tokens --mk-1..6), não do banco.
//   operação pendente de envio: { op: 'set', ...marcação } | { op: 'del', b, c, v, at }; só a última de cada versículo vale.
export const CATS = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'];
export const LIMITS = { marksMax: 10000, noteMax: 2000, nameMax: 30 };

// Nomes de partida das categorias (o usuário renomeia). Decisão do André em 17/10/2026; a tradução em inglês é proposta a revisar.
export const DEFAULT_CATEGORY_NAMES = {
  pt: ['Missões', 'Salvação', 'Oração', 'Promessa', 'Obediência', 'Para memorizar'],
  en: ['Missions', 'Salvation', 'Prayer', 'Promise', 'Obedience', 'To memorize'],
};

const isInt = (n, lo, hi) => Number.isInteger(n) && n >= lo && n <= hi;
const isIso = (s) => typeof s === 'string' && s.length > 0 && !Number.isNaN(Date.parse(s));
export const validBook = (b) => typeof b === 'string' && /^[a-z0-9]{3}$/.test(b);
export const isCat = (c) => CATS.includes(c);

// Corta pelo número de caracteres (pontos de código), como o char_length do Postgres. Vazio vira null.
export function cleanText(v, max) {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t) return null;
  const chars = Array.from(t);
  return chars.length > max ? chars.slice(0, max).join('').trim() || null : t;
}

export const markKey = (b, c, v) => `${b}:${c}:${v}`;
export const chapterKey = (b, c) => `${b}:${c}`;

// Marcação válida ou null
export function cleanMark(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const { b, c, v } = raw;
  if (!validBook(b) || !isInt(c, 1, 150) || !isInt(v, 1, 176) || !isIso(raw.at)) return null;
  const cat = isCat(raw.cat) ? raw.cat : null;
  const note = cleanText(raw.note, LIMITS.noteMax);
  if (!cat && !note) return null;
  return { b, c, v, cat, note, at: new Date(raw.at).toISOString() };
}

const byPlace = (x, y) => (x.b < y.b ? -1 : x.b > y.b ? 1 : x.c - y.c || x.v - y.v);

// Lista limpa: sem inválidas, uma por versículo (vale a mais recente), em ordem de livro, capítulo e versículo, até o limite
// (acima dele saem as mais antigas).
export function cleanMarks(list, max = LIMITS.marksMax) {
  const best = new Map();
  for (const raw of Array.isArray(list) ? list : []) {
    const m = cleanMark(raw);
    if (!m) continue;
    const k = markKey(m.b, m.c, m.v);
    const cur = best.get(k);
    if (!cur || m.at > cur.at) best.set(k, m);
  }
  let out = [...best.values()];
  if (out.length > max) out = out.sort((x, y) => (x.at < y.at ? 1 : x.at > y.at ? -1 : 0)).slice(0, max);
  return out.sort(byPlace);
}

// Índice capítulo → (versículo → marcação), para o leitor pintar um capítulo sem varrer tudo
export function indexMarks(list) {
  const idx = new Map();
  for (const m of list) {
    const ck = chapterKey(m.b, m.c);
    let ch = idx.get(ck);
    if (!ch) { ch = new Map(); idx.set(ck, ch); }
    ch.set(m.v, m);
  }
  return idx;
}

// ---- fila de envio ----
export function cleanOp(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.op === 'set') { const m = cleanMark(raw); return m ? { op: 'set', ...m } : null; }
  if (raw.op === 'del' && validBook(raw.b) && isInt(raw.c, 1, 150) && isInt(raw.v, 1, 176) && isIso(raw.at)) return { op: 'del', b: raw.b, c: raw.c, v: raw.v, at: new Date(raw.at).toISOString() };
  return null;
}
export const opKey = (o) => markKey(o.b, o.c, o.v);
// Só a última operação de cada versículo importa (mantém a ordem da última de cada um)
export function compactOps(ops) {
  const last = new Map();
  for (const raw of Array.isArray(ops) ? ops : []) {
    const o = cleanOp(raw);
    if (!o) continue;
    last.delete(opKey(o));
    last.set(opKey(o), o);
  }
  return [...last.values()];
}
export const cleanQueue = compactOps;

// Aplica operações (na ordem) sobre um Map chave → marcação
export function applyOps(map, ops) {
  for (const o of ops) {
    const k = opKey(o);
    if (o.op === 'del') map.delete(k);
    else { const { op, ...m } = o; map.set(k, m); } // eslint-disable-line no-unused-vars
  }
  return map;
}

// ---- união no login ----
// `synced` = este aparelho já foi sincronizado com ESTA conta (o cache é um espelho da conta): só valem as operações pendentes, e o que a conta
// não tem mais (apagado em outro aparelho) não ressuscita. Sem `synced` (primeira união, dados do modo local), o que só existe aqui sobe e,
// havendo as duas, a mais recente vence. Operação pendente mais antiga que a da conta perde ("o mais recente vence").
// Devolve { marks, upload: [marcações a gravar na conta], remove: [chaves a apagar na conta] }.
export function mergeMarks({ local = [], remote = [], queue = [], synced = false }) {
  const remoteMap = new Map(cleanMarks(remote, Infinity).map((m) => [markKey(m.b, m.c, m.v), m]));
  const merged = new Map(remoteMap);
  const upload = new Map();
  const remove = new Set();
  if (!synced) {
    for (const m of cleanMarks(local, Infinity)) {
      const k = markKey(m.b, m.c, m.v);
      const r = remoteMap.get(k);
      if (!r || m.at > r.at) { merged.set(k, m); upload.set(k, m); }
    }
  }
  for (const o of compactOps(queue)) {
    const k = opKey(o);
    const r = remoteMap.get(k);
    if (r && r.at > o.at) continue; // a conta tem uma edição mais nova: a operação perde
    if (o.op === 'del') { merged.delete(k); upload.delete(k); if (r) remove.add(k); } else { const { op, ...m } = o; merged.set(k, m); upload.set(k, m); remove.delete(k); } // eslint-disable-line no-unused-vars
  }
  return { marks: cleanMarks([...merged.values()]), upload: [...upload.values()], remove: [...remove] };
}

// ---- linhas do banco ----
export const toRow = (m, userId) => ({ user_id: userId, book: m.b, chapter: m.c, verse: m.v, cat: m.cat, note: m.note, updated_at: m.at });
export const fromRow = (r) => (r && r.updated_at ? cleanMark({ b: r.book, c: r.chapter, v: r.verse, cat: r.cat, note: r.note, at: r.updated_at }) : null);

export const chunk = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };

// Chaves "b:c:v" para apagar, agrupadas por livro e capítulo: [{ b, c, verses: [..] }]
export function groupRemovals(keys) {
  const g = new Map();
  for (const k of keys) {
    const [b, c, v] = k.split(':');
    const gk = `${b}:${c}`;
    if (!g.has(gk)) g.set(gk, { b, c: Number(c), verses: [] });
    g.get(gk).verses.push(Number(v));
  }
  return [...g.values()];
}

// Versículos → intervalos contíguos: [16, 17, 18, 20] → [[16, 18], [20, 20]]
export function versesToRanges(verses) {
  const sorted = [...new Set(verses)].filter((v) => Number.isInteger(v) && v >= 1).sort((a, b) => a - b);
  const out = [];
  for (const v of sorted) {
    const last = out[out.length - 1];
    if (last && v === last[1] + 1) last[1] = v; else out.push([v, v]);
  }
  return out;
}

// ---- categorias (id c1..c6 e nome; o que o usuário não renomeou fica com o nome de partida) ----
export function cleanCategories(raw) {
  const seen = new Set();
  const out = [];
  for (const x of Array.isArray(raw) ? raw : []) {
    if (!x || typeof x !== 'object' || !isCat(x.id) || seen.has(x.id)) continue;
    const name = cleanText(x.name, LIMITS.nameMax);
    if (!name) continue;
    seen.add(x.id);
    out.push({ id: x.id, name });
  }
  return out.sort((a, b) => CATS.indexOf(a.id) - CATS.indexOf(b.id));
}
// As 6 categorias prontas para a tela: [{ id, name, custom }]
export function categoryList(stored, lang = 'pt') {
  const names = DEFAULT_CATEGORY_NAMES[lang] ?? DEFAULT_CATEGORY_NAMES.pt;
  const mine = new Map(cleanCategories(stored).map((c) => [c.id, c.name]));
  return CATS.map((id, i) => ({ id, name: mine.get(id) ?? names[i], custom: mine.has(id) }));
}
// Registro único com data (categorias, como os ajustes de leitura): o mais recente vence.
// Devolve { value, at, up, down }: up = a versão local é a mais nova (sobe para a conta); down = a da conta venceu.
export function pickNewer(local, remote) {
  const l = local && local.at ? local : null;
  const r = remote && remote.at ? remote : null;
  if (r && (!l || r.at > l.at)) return { value: r.value, at: r.at, up: false, down: true };
  if (l && (!r || l.at > r.at)) return { value: l.value, at: l.at, up: true, down: false };
  return { value: l ? l.value : r ? r.value : undefined, at: l ? l.at : r ? r.at : null, up: false, down: false };
}
