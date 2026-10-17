import { useSyncExternalStore } from 'react';
export { favKey, parseFavKey, FAV_TYPES } from './favKeys.js';
import { cleanPrefs } from './readingPrefs.js';
import { LIMITS as MARK_LIMITS, markKey, chapterKey, cleanMark, cleanMarks, indexMarks, compactOps, opKey, applyOps, mergeMarks, toRow, fromRow, chunk, groupRemovals, cleanCategories, categoryList, pickNewer } from './marksCore.js';
import { fetchAll } from './pagedSelect.js';
import { LIMITS as STUDY_LIMITS, cleanStudy, cleanStudies, cleanStudyQueue, mergeStudies, toStudyRow, fromStudyRow } from './studiesCore.js';

// Dados do usuário: favoritos, posição de leitura e ajustes de leitura. A API que os componentes usam (isFav, toggleFav, listFavs, getPosition,
// setPosition, subscribe, useUserData) é a mesma com ou sem conta.
//   Sem conta: tudo fica só no aparelho (localStorage), como na Fase 2A.
//   Com conta (Fase 2B): o localStorage vira CACHE e o Supabase é a fonte. No login faz-se a UNIÃO dos dados do aparelho com os da conta.
//
// localStorage: 'favorites' = [{ key, at }] (at = ISO), 'readingPosition' = { version, slug, chapter, at },
// 'readingPrefs' = { v: ajustes, at } (só o que difere do padrão; ver readingPrefs.js),
// 'favNoticeShown' = '1', 'continueDismissed' = o `at` da posição dispensada, 'syncQueue' = operações ainda não enviadas,
// 'syncAccount' = id da conta cujos dados estão no cache.
// Preparação de estudos: 'verseMarks' = [{ b, c, v, cat, note, at }], 'studyCategories' = { c: [{ id, name }], at }, 'studies' = [estudo],
// filas 'markQueue' e 'studyQueue' (próprias, não a 'syncQueue'), e 'marksAccount', 'studiesAccount', 'catsAccount' = conta com a qual cada
// tipo já foi sincronizado (o cache é um espelho dela; ver mergeMarks e mergeStudies).
// Se o localStorage falhar (modo privado), tudo continua funcionando na sessão, sem salvar.

const K = {
  favs: 'favorites', pos: 'readingPosition', notice: 'favNoticeShown', dismissed: 'continueDismissed', queue: 'syncQueue', acc: 'syncAccount', prefs: 'readingPrefs',
  marks: 'verseMarks', cats: 'studyCategories', studies: 'studies', markQ: 'markQueue', studyQ: 'studyQueue', marksAcc: 'marksAccount', studiesAcc: 'studiesAccount', catsAcc: 'catsAccount',
};

const local = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* sem armazenamento: segue só na memória */ } },
  remove(k) { try { localStorage.removeItem(k); } catch { /* ignora */ } },
};
const backend = local;

const parse = (s) => { try { return JSON.parse(s); } catch { return null; } };
const isStr = (v) => typeof v === 'string' && v.length > 0;
const byRecent = (a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0);

function load() {
  const rawFavs = parse(backend.get(K.favs));
  const seen = new Set();
  const favs = (Array.isArray(rawFavs) ? rawFavs : [])
    .filter((f) => f && isStr(f.key) && isStr(f.at) && !seen.has(f.key) && seen.add(f.key))
    .sort(byRecent);
  const p = parse(backend.get(K.pos));
  const position = p && isStr(p.version) && isStr(p.slug) && Number.isInteger(p.chapter) && p.chapter >= 1 && isStr(p.at)
    ? { version: p.version, slug: p.slug, chapter: p.chapter, at: p.at } : null;
  const rp = parse(backend.get(K.prefs));
  const prefs = cleanPrefs(rp?.v);
  const prefsAt = rp && isStr(rp.at) ? rp.at : null;
  const marks = cleanMarks(parse(backend.get(K.marks)));
  const cp = parse(backend.get(K.cats));
  const categories = cleanCategories(cp?.c);
  const categoriesAt = cp && isStr(cp.at) ? cp.at : null;
  const studies = cleanStudies(parse(backend.get(K.studies)));
  return {
    favs, keys: new Set(favs.map((f) => f.key)), position, prefs, prefsAt, noticeShown: backend.get(K.notice) === '1', dismissedAt: backend.get(K.dismissed), noticePending: false,
    marks, marksIdx: indexMarks(marks), categories, categoriesAt, studies, marksLimitHit: false, studiesLimit: null,
  };
}

let state = { ...load(), account: null };
const listeners = new Set();
const commit = (next) => { state = { ...state, ...next }; listeners.forEach((fn) => fn()); };

export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const getState = () => state;
export const useUserData = () => useSyncExternalStore(subscribe, getState, getState);

// Outras abas: recarrega do armazenamento (o aviso em tela é só desta aba)
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === null || Object.values(K).includes(e.key)) commit({ ...load(), account: state.account, noticePending: state.noticePending });
  });
}

export const isFav = (key) => state.keys.has(key);
export const listFavs = () => state.favs;

const saveFavs = (favs) => { backend.set(K.favs, JSON.stringify(favs)); return { favs, keys: new Set(favs.map((f) => f.key)) }; };

// Adiciona ou remove; devolve true se o item ficou favoritado. Grava no aparelho na hora; com conta, também enfileira o envio.
export function toggleFav(key) {
  const added = !state.keys.has(key);
  const at = new Date().toISOString();
  const next = saveFavs(added ? [{ key, at }, ...state.favs] : state.favs.filter((f) => f.key !== key));
  if (added && !state.noticeShown && !state.account) { backend.set(K.notice, '1'); next.noticeShown = true; next.noticePending = true; } // aviso do aparelho: só no 1º favorito, sem conta
  commit(next);
  if (state.account) { enqueue({ op: added ? 'add' : 'remove', key, at }); flush(); }
  return added;
}

export const getPosition = () => state.position;

// Ajustes de leitura (tamanho, espaçamento, largura, fonte, versículo por linha, tema da leitura). Guardados só com o que difere do padrão.
// Sem conta: localStorage. Com conta (e aceite): também na tabela reading_prefs, a mais recente vence (mesma regra da posição).
export const getPrefs = () => state.prefs;
function writePrefs(prefs) {
  const at = new Date().toISOString();
  backend.set(K.prefs, JSON.stringify({ v: prefs, at }));
  commit({ prefs, prefsAt: at });
  schedulePrefs();
}
export const setPrefs = (patch) => writePrefs(cleanPrefs({ ...state.prefs, ...patch }));
export const resetPrefs = () => writePrefs({});

// Retomar a leitura pelo cartão "Continuar": o leitor abre na versão gravada, mesmo que ela não seja do idioma da interface.
// Vale até o leitor gravar a posição (setPosition limpa).
let resume = null;
export const setResume = (slug, version) => { resume = { slug, version }; };
export const peekResume = (slug) => (resume && resume.slug === slug ? resume.version : null);

// Grava a última posição de leitura (versão, livro, capítulo). Reabrir o mesmo capítulo só atualiza se o cartão estava dispensado.
export function setPosition({ version, slug, chapter }) {
  resume = null;
  const cur = state.position;
  if (cur && cur.version === version && cur.slug === slug && cur.chapter === chapter && state.dismissedAt !== cur.at) return;
  const position = { version, slug, chapter, at: new Date().toISOString() };
  backend.set(K.pos, JSON.stringify(position));
  commit({ position });
  schedulePosition();
}

export const continueVisible = () => !!state.position && state.dismissedAt !== state.position.at;
export function dismissContinue() {
  if (!state.position) return;
  backend.set(K.dismissed, state.position.at);
  commit({ dismissedAt: state.position.at });
}

// Aviso "ficam só neste aparelho": o toast some com "Entendi"; já foi marcado como mostrado no 1º favorito
export const dismissNotice = () => commit({ noticePending: false });
export function acknowledgeNotice() { backend.set(K.notice, '1'); commit({ noticeShown: true, noticePending: false }); }

// Versão preferida do leitor por idioma (a escolha é lembrada entre livros e visitas)
export const getVersionPref = (lang) => backend.get(`ver:${lang}`);
export const setVersionPref = (lang, id) => backend.set(`ver:${lang}`, id);

// =====================================================================================================================
// Conta (Supabase). Só é usada quando há sessão; sem sessão nada abaixo faz chamada de rede.
// =====================================================================================================================

let account = null; // { client, userId }
let connecting = null; // { userId, promise }
let queue = (() => { const q = parse(backend.get(K.queue)); return Array.isArray(q) ? q.filter((o) => o && isStr(o.key) && (o.op === 'add' || o.op === 'remove')) : []; })();
const saveQueue = () => backend.set(K.queue, JSON.stringify(queue));
// Só a última operação de cada chave importa
const enqueue = (op) => { queue = [...queue.filter((o) => o.key !== op.key), op]; saveQueue(); };

// Fila simples: envia na ordem; se falhar (rede), para e tenta de novo no próximo carregamento, ao voltar a rede ou no próximo favorito.
let flushing = null;
function flush() {
  if (!account) return Promise.resolve();
  if (flushing) return flushing;
  const { client, userId } = account;
  flushing = (async () => {
    while (queue.length && account?.userId === userId) {
      const op = queue[0];
      try {
        const { error } = op.op === 'add'
          ? await client.from('favorites').upsert({ user_id: userId, key: op.key, created_at: op.at }, { onConflict: 'user_id,key' })
          : await client.from('favorites').delete().eq('user_id', userId).eq('key', op.key);
        if (error) throw error;
        queue = queue.filter((o) => o !== op);
        saveQueue();
      } catch { break; }
    }
  })().finally(() => { flushing = null; });
  return flushing;
}

// Posição de leitura: no máximo uma gravação a cada ~10 s (a primeira vai logo); quando a aba fica oculta, envia o que falta.
const POS_MIN_MS = 10000;
let posTimer = null;
let posDirty = false;
let lastPosSent = 0;
async function sendPosition() {
  clearTimeout(posTimer);
  posTimer = null;
  if (!account || !posDirty || !state.position) return;
  posDirty = false;
  lastPosSent = Date.now();
  const p = state.position;
  try {
    const { error } = await account.client.from('reading_position').upsert({ user_id: account.userId, version: p.version, slug: p.slug, chapter: p.chapter, updated_at: p.at });
    if (error) throw error;
  } catch { posDirty = true; } // o próximo setPosition ou carregamento reenvia (a união no login compara as datas)
}
function schedulePosition() {
  if (!account) return;
  posDirty = true;
  if (posTimer) return;
  posTimer = setTimeout(sendPosition, Math.max(0, POS_MIN_MS - (Date.now() - lastPosSent)));
}

// Ajustes de leitura: envio com atraso curto (vários cliques seguidos viram uma gravação). Se a tabela ainda não existe no
// banco (migration não aplicada), prefsReady fica falso e os ajustes seguem só no aparelho, sem quebrar favoritos nem posição.
const PREFS_DELAY_MS = 1500;
let prefsTimer = null;
let prefsDirty = false;
let prefsReady = false;
async function sendPrefs() {
  clearTimeout(prefsTimer);
  prefsTimer = null;
  if (!account || !prefsReady || !prefsDirty || !state.prefsAt) return;
  prefsDirty = false;
  try {
    const { error } = await account.client.from('reading_prefs').upsert({ user_id: account.userId, prefs: state.prefs, updated_at: state.prefsAt });
    if (error) throw error;
  } catch { prefsDirty = true; }
}
function schedulePrefs() {
  if (!account || !prefsReady) return;
  prefsDirty = true;
  if (!prefsTimer) prefsTimer = setTimeout(sendPrefs, PREFS_DELAY_MS);
}

// =====================================================================================================================
// Preparação de estudos: marcações de versículos, categorias e Meus Estudos. Mesmo padrão dos favoritos e dos ajustes (cache local, fila de
// envio, união no login); a lógica pura está em marksCore.js e studiesCore.js. Cada tipo tem a própria flag `ready`: se a migration
// 20261020000000 ainda não foi aplicada, os dados ficam só no aparelho e favoritos, posição e ajustes não são afetados.
// Visitante sem conta: tudo só no aparelho (Essencial). Com conta: o cache é espelho da conta e o envio é em lote, com atraso.
// =====================================================================================================================

const LIMIT_CODE = '23514'; // check_violation: os gatilhos de limite do banco recusam com este código (hint: marks_limit | studies_plan | studies_max)
const BATCH_DELAY_MS = 1500;
const EMPTY_MARKS = new Map();
const sig = (o) => `${o.op}|${o.b ? opKey(o) : ''}|${o.at}`;

let markQueue = compactOps(parse(backend.get(K.markQ)));
let studyQueue = cleanStudyQueue(parse(backend.get(K.studyQ)));
const saveMarkQueue = () => backend.set(K.markQ, JSON.stringify(markQueue));
const saveStudyQueue = () => backend.set(K.studyQ, JSON.stringify(studyQueue));
let marksReady = false;
let studiesReady = false;
let catsReady = false;
let marksTimer = null;
let studiesTimer = null;
let catsTimer = null;
let marksSending = null;
let studiesSending = null;
let catsDirty = false;

// Grava linhas (upsert). Se o banco recusar por limite (23514), regrava uma a uma para saber QUAIS foram recusadas, sem perder as boas.
// Devolve { error, rejected, hint }: error = falha de rede ou outra (nada a descartar, tenta de novo depois).
async function upsertSafe(client, table, rows, onConflict) {
  const one = async (batch) => (await client.from(table).upsert(batch, { onConflict })).error;
  const err = await one(rows);
  if (!err) return { error: null, rejected: [], hint: null };
  if (err.code !== LIMIT_CODE) return { error: err, rejected: [], hint: null };
  if (rows.length === 1) return { error: null, rejected: rows, hint: err.hint ?? null };
  const rejected = [];
  let hint = null;
  for (const r of rows) {
    const e = await one([r]);
    if (!e) continue;
    if (e.code !== LIMIT_CODE) return { error: e, rejected, hint };
    rejected.push(r);
    hint = e.hint ?? hint;
  }
  return { error: null, rejected, hint };
}
const studyLimitFrom = (hint) => (hint === 'studies_max' ? 'max' : 'plan');

// ---- marcações ----
export const getMarks = () => state.marks;
export const marksOfChapter = (slug, n) => state.marksIdx.get(chapterKey(slug, n)) ?? EMPTY_MARKS; // Map versículo → marcação
export const getMark = (slug, n, v) => marksOfChapter(slug, n).get(v) ?? null;
export const dismissMarksLimit = () => commit({ marksLimitHit: false });

// Marca, remarca ou limpa versículos de um capítulo. `patch`: { cat, note }; a chave presente (mesmo null) vale, a ausente mantém o que já havia.
// Sem categoria e sem nota a marcação some. Devolve { changed, limit }: limit = o aparelho já tem o máximo de marcações.
export function markVerses(slug, chapter, verses, patch = {}) {
  const at = new Date().toISOString();
  const cur = new Map(state.marks.map((m) => [markKey(m.b, m.c, m.v), m]));
  const ops = [];
  let limit = false;
  for (const v of new Set(verses)) {
    const k = markKey(slug, chapter, v);
    const old = cur.get(k);
    const next = cleanMark({ b: slug, c: chapter, v, cat: 'cat' in patch ? patch.cat : old?.cat, note: 'note' in patch ? patch.note : old?.note, at });
    if (!next) {
      if (old) { cur.delete(k); ops.push({ op: 'del', b: slug, c: chapter, v, at }); }
      continue;
    }
    if (!old && cur.size >= MARK_LIMITS.marksMax) { limit = true; continue; }
    cur.set(k, next);
    ops.push({ op: 'set', ...next });
  }
  if (ops.length) {
    const marks = cleanMarks([...cur.values()]);
    backend.set(K.marks, JSON.stringify(marks));
    commit({ marks, marksIdx: indexMarks(marks), ...(limit ? { marksLimitHit: true } : {}) });
    if (state.account) { markQueue = compactOps([...markQueue, ...ops]); saveMarkQueue(); scheduleMarks(); }
  } else if (limit) commit({ marksLimitHit: true });
  return { changed: ops.length, limit };
}
export const clearMarks = (slug, chapter, verses) => markVerses(slug, chapter, verses, { cat: null, note: null });

async function sendMarks() {
  clearTimeout(marksTimer);
  marksTimer = null;
  if (!account || !marksReady || !markQueue.length) return undefined;
  if (marksSending) return marksSending;
  marksSending = (async () => {
    const { client, userId } = account;
    const batch = markQueue;
    let limit = false;
    try {
      for (const part of chunk(batch.filter((o) => o.op === 'set'), 200)) {
        const r = await upsertSafe(client, 'verse_marks', part.map((o) => toRow(o, userId)), 'user_id,book,chapter,verse');
        if (r.error) throw r.error;
        if (r.rejected.length) limit = true;
      }
      for (const g of groupRemovals(batch.filter((o) => o.op === 'del').map(opKey))) {
        const { error } = await client.from('verse_marks').delete().eq('user_id', userId).eq('book', g.b).eq('chapter', g.c).in('verse', g.verses);
        if (error) throw error;
      }
      const done = new Set(batch.map(sig));
      markQueue = markQueue.filter((o) => !done.has(sig(o)));
      saveMarkQueue();
      if (limit) commit({ marksLimitHit: true }); // o banco recusou algumas (limite): ficam só no aparelho
      return true;
    } catch { return false; /* rede ou erro: a fila fica e o próximo gatilho (nova marcação, aba oculta, volta da rede, próximo carregamento) tenta de novo */ }
  })().then((sent) => { marksSending = null; if (sent && markQueue.length && marksReady && account) scheduleMarks(); }); // sem laço de tentativas: só reagenda o que chegou durante o envio
  return marksSending;
}
function scheduleMarks() {
  if (!account || !marksReady || marksTimer) return;
  marksTimer = setTimeout(sendMarks, BATCH_DELAY_MS);
}

// ---- categorias (nome editável, até 6; ids c1..c6; a cor vem do app) ----
export const getCategories = (lang) => categoryList(state.categories, lang); // as 6, com o nome do usuário ou o de partida
export function setCategories(list) {
  const categories = cleanCategories(list);
  const at = new Date().toISOString();
  backend.set(K.cats, JSON.stringify({ c: categories, at }));
  commit({ categories, categoriesAt: at });
  scheduleCats();
}
export const resetCategories = () => setCategories([]);
async function sendCats() {
  clearTimeout(catsTimer);
  catsTimer = null;
  if (!account || !catsReady || !catsDirty || !state.categoriesAt) return;
  catsDirty = false;
  try {
    const { error } = await account.client.from('study_settings').upsert({ user_id: account.userId, categories: state.categories, updated_at: state.categoriesAt });
    if (error) throw error;
  } catch { catsDirty = true; }
}
function scheduleCats() {
  if (!account || !catsReady) return;
  catsDirty = true;
  if (!catsTimer) catsTimer = setTimeout(sendCats, BATCH_DELAY_MS);
}

// ---- Meus Estudos ----
export const listStudies = () => state.studies;
export const getStudy = (id) => state.studies.find((s) => s.id === id) ?? null;
export const newStudyId = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) => (c ^ (Math.random() * 16) >> (c / 4)).toString(16)));
export const dismissStudiesLimit = () => commit({ studiesLimit: null });

// Cria ou atualiza um estudo (as funções de studiesCore.js devolvem o estudo já com a data nova). O limite do PLANO é do banco (gatilho
// studies_guard) e da interface (studyQuota); aqui só o teto técnico, para o aparelho não crescer sem fim.
export function saveStudy(raw) {
  const study = cleanStudy(raw);
  if (!study) return { ok: false, error: 'invalid' };
  const exists = state.studies.some((x) => x.id === study.id);
  if (!exists && state.studies.length >= STUDY_LIMITS.studiesMax) return { ok: false, error: 'max' };
  const studies = cleanStudies([study, ...state.studies.filter((x) => x.id !== study.id)]);
  backend.set(K.studies, JSON.stringify(studies));
  commit({ studies });
  if (state.account) { studyQueue = { ...studyQueue, [study.id]: { op: 'upsert', at: study.at } }; saveStudyQueue(); scheduleStudies(); }
  return { ok: true, study };
}
export function deleteStudy(id) {
  if (!state.studies.some((x) => x.id === id)) return false;
  const studies = state.studies.filter((x) => x.id !== id);
  backend.set(K.studies, JSON.stringify(studies));
  commit({ studies });
  if (state.account) { studyQueue = { ...studyQueue, [id]: { op: 'delete', at: new Date().toISOString() } }; saveStudyQueue(); scheduleStudies(); }
  return true;
}

async function sendStudies() {
  clearTimeout(studiesTimer);
  studiesTimer = null;
  if (!account || !studiesReady || !Object.keys(studyQueue).length) return undefined;
  if (studiesSending) return studiesSending;
  studiesSending = (async () => {
    const { client, userId } = account;
    const snap = studyQueue;
    let limit = null;
    try {
      const sets = Object.entries(snap).filter(([, o]) => o.op === 'upsert').map(([id]) => state.studies.find((x) => x.id === id)).filter(Boolean);
      for (const part of chunk(sets, 20)) {
        const r = await upsertSafe(client, 'studies', part.map((x) => toStudyRow(x, userId)), 'id');
        if (r.error) throw r.error;
        if (r.rejected.length) limit = studyLimitFrom(r.hint);
      }
      const dels = Object.entries(snap).filter(([, o]) => o.op === 'delete').map(([id]) => id);
      if (dels.length) {
        const { error } = await client.from('studies').delete().eq('user_id', userId).in('id', dels);
        if (error) throw error;
      }
      const next = { ...studyQueue };
      for (const [id, o] of Object.entries(snap)) if (next[id] && next[id].op === o.op && next[id].at === o.at) delete next[id];
      studyQueue = next;
      saveStudyQueue();
      if (limit) commit({ studiesLimit: limit }); // recusado pelo plano: o estudo fica só no aparelho
      return true;
    } catch { return false; /* igual às marcações: a fila fica e o próximo gatilho tenta de novo */ }
  })().then((sent) => { studiesSending = null; if (sent && Object.keys(studyQueue).length && studiesReady && account) scheduleStudies(); });
  return studiesSending;
}
function scheduleStudies() {
  if (!account || !studiesReady || studiesTimer) return;
  studiesTimer = setTimeout(sendStudies, BATCH_DELAY_MS);
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { sendPosition(); sendPrefs(); flush(); sendMarks(); sendStudies(); sendCats(); } });
  window.addEventListener('online', () => { flush(); if (posDirty) schedulePosition(); if (prefsDirty) schedulePrefs(); scheduleMarks(); scheduleStudies(); if (catsDirty) scheduleCats(); });
}

function clearCache() {
  [K.favs, K.pos, K.queue, K.acc, K.dismissed, K.prefs, K.marks, K.cats, K.studies, K.markQ, K.studyQ, K.marksAcc, K.studiesAcc, K.catsAcc].forEach(backend.remove);
  queue = [];
  markQueue = [];
  studyQueue = {};
  clearTimeout(posTimer);
  posTimer = null;
  posDirty = false;
  clearTimeout(prefsTimer);
  prefsTimer = null;
  prefsDirty = false;
  prefsReady = false;
  clearTimeout(marksTimer);
  marksTimer = null;
  clearTimeout(studiesTimer);
  studiesTimer = null;
  clearTimeout(catsTimer);
  catsTimer = null;
  catsDirty = false;
  marksReady = false;
  studiesReady = false;
  catsReady = false;
  commit({
    favs: [], keys: new Set(), position: null, dismissedAt: null, noticePending: false, prefs: {}, prefsAt: null,
    marks: [], marksIdx: new Map(), categories: [], categoriesAt: null, studies: [], marksLimitHit: false, studiesLimit: null,
  });
}

const older = (a, b) => (a < b ? a : b);

// Login (e abertura do app já logado): UNIÃO dos favoritos do aparelho com os da conta, sem duplicar por chave (vale o created_at mais
// antigo); a posição de leitura mais recente vence. Depois disso a conta é a fonte e o aparelho é o cache.
export function connectAccount(client, userId) {
  if (connecting && connecting.userId === userId) return connecting.promise;
  const promise = (async () => {
    // O cache é de outra conta (logout que não terminou)? Não mistura: descarta.
    const cachedFor = backend.get(K.acc);
    if (cachedFor && cachedFor !== userId) clearCache();
    account = { client, userId };
    commit({ account: userId, noticePending: false });
    try {
      const [fr, pr] = await Promise.all([
        client.from('favorites').select('key,created_at'),
        client.from('reading_position').select('version,slug,chapter,updated_at').maybeSingle(),
      ]);
      if (fr.error || pr.error) throw fr.error || pr.error;

      const remote = new Map(fr.data.map((r) => [r.key, new Date(r.created_at).toISOString()]));
      const merged = new Map(remote);
      const toUpload = [];
      for (const f of state.favs) {
        const r = remote.get(f.key);
        if (r === undefined || f.at < r) { merged.set(f.key, r === undefined ? f.at : older(f.at, r)); toUpload.push({ user_id: userId, key: f.key, created_at: merged.get(f.key) }); }
      }
      // operações pendentes (feitas offline) valem sobre a união: remoção não ressuscita, adição entra
      for (const o of queue) { if (o.op === 'remove') merged.delete(o.key); else if (!merged.has(o.key)) merged.set(o.key, o.at); }
      const pendingRemoves = new Set(queue.filter((o) => o.op === 'remove').map((o) => o.key));
      const upload = toUpload.filter((r) => !pendingRemoves.has(r.key));
      for (let i = 0; i < upload.length; i += 100) {
        const { error } = await client.from('favorites').upsert(upload.slice(i, i + 100), { onConflict: 'user_id,key' });
        if (error) throw error;
      }
      const favs = [...merged].map(([key, at]) => ({ key, at })).sort(byRecent);

      // posição: a mais recente vence
      let position = state.position;
      const rp = pr.data;
      const remotePos = rp && isStr(rp.slug) && isStr(rp.version) && Number.isInteger(rp.chapter)
        ? { version: rp.version, slug: rp.slug, chapter: rp.chapter, at: new Date(rp.updated_at).toISOString() } : null;
      if (remotePos && (!position || remotePos.at > position.at)) { position = remotePos; backend.set(K.pos, JSON.stringify(position)); }
      else if (position && (!remotePos || position.at > remotePos.at)) posDirty = true; // a do aparelho é mais recente: sobe para a conta

      // ajustes de leitura: o mais recente vence. Falha aqui (ex.: tabela ainda não criada) não derruba o resto.
      let prefs = state.prefs;
      let prefsAt = state.prefsAt;
      try {
        const { data, error } = await client.from('reading_prefs').select('prefs,updated_at').maybeSingle();
        if (error) throw error;
        prefsReady = true;
        const remoteAt = data ? new Date(data.updated_at).toISOString() : null;
        if (data && (!prefsAt || remoteAt > prefsAt)) { prefs = cleanPrefs(data.prefs); prefsAt = remoteAt; backend.set(K.prefs, JSON.stringify({ v: prefs, at: prefsAt })); }
        else if (prefsAt && (!remoteAt || prefsAt > remoteAt)) prefsDirty = true; // o do aparelho é mais novo: sobe para a conta
      } catch { prefsReady = false; }

      // ---- preparação de estudos: cada tipo em seu try, isolado (uma falha, como a tabela ainda não existir, não derruba o resto) ----
      // `synced`: o cache já foi sincronizado com ESTA conta antes. Então a conta é a fonte: só sobem as operações pendentes, e o que foi apagado
      // em outro aparelho não ressuscita. Sem isso (primeira união, dados do modo local) o que só existe aqui sobe.
      let marks = state.marks;
      let marksLimitHit = false;
      let studiesLimit = null;
      try {
        const synced = backend.get(K.marksAcc) === userId;
        const rows = await fetchAll(client, 'verse_marks', 'book,chapter,verse,cat,note,updated_at', ['book', 'chapter', 'verse']);
        const snap = markQueue;
        const m = mergeMarks({ local: state.marks, remote: rows.map(fromRow).filter(Boolean), queue: snap, synced });
        let limit = false;
        for (const part of chunk(m.upload, 500)) {
          const r = await upsertSafe(client, 'verse_marks', part.map((x) => toRow(x, userId)), 'user_id,book,chapter,verse');
          if (r.error) throw r.error;
          if (r.rejected.length) limit = true;
        }
        for (const g of groupRemovals(m.remove)) {
          const { error } = await client.from('verse_marks').delete().eq('user_id', userId).eq('book', g.b).eq('chapter', g.c).in('verse', g.verses);
          if (error) throw error;
        }
        const done = new Set(snap.map(sig));
        markQueue = markQueue.filter((o) => !done.has(sig(o))); // as feitas durante a espera ficam e valem sobre o resultado
        saveMarkQueue();
        marks = cleanMarks([...applyOps(new Map(m.marks.map((x) => [markKey(x.b, x.c, x.v), x])), markQueue).values()]);
        backend.set(K.marks, JSON.stringify(marks));
        backend.set(K.marksAcc, userId);
        marksReady = true;
        marksLimitHit = limit;
      } catch { marksReady = false; }

      let categories = state.categories;
      let categoriesAt = state.categoriesAt;
      try {
        const { data, error } = await client.from('study_settings').select('categories,updated_at').maybeSingle();
        if (error) throw error;
        const pick = pickNewer(state.categoriesAt ? { value: state.categories, at: state.categoriesAt } : null, data ? { value: cleanCategories(data.categories), at: new Date(data.updated_at).toISOString() } : null);
        catsReady = true;
        if (pick.down) { categories = pick.value; categoriesAt = pick.at; backend.set(K.cats, JSON.stringify({ c: categories, at: categoriesAt })); } else if (pick.up) catsDirty = true; // a do aparelho é mais nova: sobe
        backend.set(K.catsAcc, userId);
      } catch { catsReady = false; }

      let studies = state.studies;
      try {
        const synced = backend.get(K.studiesAcc) === userId;
        const rows = await fetchAll(client, 'studies', 'id,title,template,items,updated_at', ['id']);
        const snap = studyQueue;
        const m = mergeStudies({ local: state.studies, remote: rows.map(fromStudyRow).filter(Boolean), queue: snap, synced });
        let limit = null;
        for (const part of chunk(m.upload, 20)) {
          const r = await upsertSafe(client, 'studies', part.map((x) => toStudyRow(x, userId)), 'id');
          if (r.error) throw r.error;
          if (r.rejected.length) limit = studyLimitFrom(r.hint);
        }
        if (m.remove.length) {
          const { error } = await client.from('studies').delete().eq('user_id', userId).in('id', m.remove);
          if (error) throw error;
        }
        const next = { ...studyQueue };
        for (const [id, o] of Object.entries(snap)) if (next[id] && next[id].op === o.op && next[id].at === o.at) delete next[id];
        studyQueue = next;
        saveStudyQueue();
        studies = m.studies;
        backend.set(K.studies, JSON.stringify(studies));
        backend.set(K.studiesAcc, userId);
        studiesReady = true;
        studiesLimit = limit;
      } catch { studiesReady = false; }

      backend.set(K.acc, userId);
      commit({ ...saveFavs(favs), position, prefs, prefsAt, marks, marksIdx: indexMarks(marks), categories, categoriesAt, studies, ...(marksLimitHit ? { marksLimitHit } : {}), ...(studiesLimit ? { studiesLimit } : {}) });
      if (prefsDirty) sendPrefs();
      if (posDirty) sendPosition();
      if (catsDirty) sendCats();
      sendMarks();
      sendStudies();
      flush();
    } catch {
      // Sem rede ou erro: segue com o cache e tenta de novo no próximo carregamento (a união ainda não foi feita)
    }
  })();
  connecting = { userId, promise };
  return promise;
}

// Logout: envia o que falta e limpa o cache da conta neste aparelho, para os dados não passarem de uma pessoa para outra.
export async function disconnectAccount({ flush: send = false } = {}) {
  if (send && account) {
    await Promise.race([Promise.all([flush(), sendPosition(), sendPrefs(), sendMarks(), sendStudies(), sendCats()]), new Promise((r) => setTimeout(r, 4000))]).catch(() => {});
  }
  const wasConnected = !!account || !!backend.get(K.acc); // sem conta ligada (modo local, ainda sem o aceite dos Termos), os favoritos são só do aparelho: não apagar
  account = null;
  prefsReady = false;
  marksReady = false;
  studiesReady = false;
  catsReady = false;
  connecting = null;
  commit({ account: null });
  if (wasConnected) clearCache();
}
