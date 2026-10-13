// Pacote Pro (Fase 3B, PR 3): o que sai do pacote público e vai para o Supabase Storage (bucket privado `pro`, prefixo `v1/`).
// Funções puras (sem rede), usadas por scripts/publish-pro.mjs e pelo `npm run check`. Nesta etapa o app AINDA lê tudo do pacote
// público; aqui só se define e se prova (ida e volta sem perda) como o conteúdo Pro e a posição acadêmica se separam.
//
// Chaves publicadas (todas em `v1/`):
//   manifest.json                  hash e tamanho de cada arquivo (gerado por último)
//   info/<slug>.json               { map?, structure? } das fichas Pro (os 9 mapas do Essencial ficam públicos)
//   people/<id>.json               personagem completo, só dos 160 que não são do Essencial
//   timeline.json, genealogy.json  inteiros, SEM a posição acadêmica
//   interlinear/<n>.json, lex-h.json, lex-g.json   originais, arquivos como estão
//   admin/scholarly.json           posição acadêmica removida de fichas, linha do tempo e estrutura (só admin lê: política v1/admin/*)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const PREFIX = 'v1/';
export const KEY_RE = /^(manifest|timeline|genealogy|admin\/scholarly)\.json$|^(info|people)\/[a-z0-9-]+\.json$|^interlinear\/(\d{1,2}|lex-[hg])\.json$/;

const clone = (o) => JSON.parse(JSON.stringify(o));
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// ---------- posição acadêmica: separar e devolver sem perda ----------
// Remove (1) toda propriedade `scholarly` e (2) todo item de lista com `view: 'scholarly'` (leituras da aba Estrutura).
// Devolve { doc, extras }; cada extra guarda o caminho e o valor para restaurar exatamente (itens, pela posição original).
export function stripScholarly(input) {
  const doc = clone(input);
  const extras = [];
  (function walk(node, pth) {
    if (Array.isArray(node)) {
      const keep = [];
      node.forEach((v, i) => {
        if (isObj(v) && v.view === 'scholarly') extras.push({ path: pth, index: i, value: v });
        else keep.push(v);
      });
      node.length = 0;
      node.push(...keep);
      node.forEach((v, i) => walk(v, [...pth, i]));
    } else if (isObj(node)) {
      for (const k of Object.keys(node)) {
        if (k === 'scholarly') { extras.push({ path: pth, key: k, value: node[k] }); delete node[k]; } else walk(node[k], [...pth, k]);
      }
    }
  })(doc, []);
  return { doc, extras };
}

const at = (doc, pth) => pth.reduce((n, k) => n[k], doc);
export function restoreScholarly(input, extras) {
  const doc = clone(input);
  // propriedades primeiro (a ordem das chaves volta a ser a do arquivo original com `scholarly` no fim do objeto: não importa para o dado)
  for (const e of extras.filter((x) => 'key' in x)) at(doc, e.path)[e.key] = clone(e.value);
  // itens: em ordem crescente de posição original, por lista
  for (const e of extras.filter((x) => 'index' in x).sort((a, b) => a.index - b.index)) at(doc, e.path).splice(e.index, 0, clone(e.value));
  return doc;
}

// ---------- leitura das fontes atuais ----------
const readJson = (root, p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const slugsOf = (root) => fs.readdirSync(path.join(root, 'src/data/info')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();

export function loadSources(root) {
  const plans = readJson(root, 'src/data/plans.json');
  const info = Object.fromEntries(slugsOf(root).map((s) => [s, readJson(root, `src/data/info/${s}.json`)]));
  return {
    ess: plans.essencial,
    info,
    people: readJson(root, 'src/data/people.json').people,
    timeline: readJson(root, 'src/data/timeline.json'),
    genealogy: readJson(root, 'src/data/genealogia.json'),
  };
}

// Divide as fontes em: partes Pro (por chave) + posição acadêmica. `rest` é o que SOBRA para o pacote público (usado nos testes
// de ida e volta e, no PR 5, para gerar o pacote público).
export function splitSources(src) {
  const pro = new Map(); // chave (sem prefixo) → objeto JSON
  const scholarly = { info: {}, timeline: [] };
  const restInfo = {};
  for (const [slug, doc] of Object.entries(src.info)) {
    const { doc: noSch, extras } = stripScholarly(doc);
    if (extras.length) scholarly.info[slug] = extras;
    const rest = { ...noSch };
    const part = {};
    if ('map' in rest && !src.ess.mapBooks.includes(slug)) { part.map = rest.map; delete rest.map; }
    if ('structure' in rest && !src.ess.structureBooks.includes(slug)) { part.structure = rest.structure; delete rest.structure; }
    if (Object.keys(part).length) pro.set(`info/${slug}.json`, part);
    restInfo[slug] = rest;
  }
  const essIds = new Set(src.ess.characters);
  const restPeople = [];
  for (const p of src.people) {
    if (essIds.has(p.id)) restPeople.push(p); else pro.set(`people/${p.id}.json`, p);
  }
  const tl = stripScholarly(src.timeline);
  scholarly.timeline = tl.extras;
  pro.set('timeline.json', tl.doc);
  pro.set('genealogy.json', src.genealogy);
  pro.set('admin/scholarly.json', scholarly);
  return { pro, rest: { info: restInfo, people: restPeople } };
}

// Inverso de splitSources: reconstrói fichas, personagens e linha do tempo originais (para provar que nada se perde).
export function joinSources(pro, rest) {
  const sch = pro.get('admin/scholarly.json');
  const info = {};
  for (const [slug, doc] of Object.entries(rest.info)) {
    let d = { ...doc, ...(pro.get(`info/${slug}.json`) ?? {}) };
    if (sch.info[slug]) d = restoreScholarly(d, sch.info[slug]);
    info[slug] = d;
  }
  const people = [...rest.people, ...[...pro.entries()].filter(([k]) => k.startsWith('people/')).map(([, v]) => v)];
  return { info, people, timeline: restoreScholarly(pro.get('timeline.json'), sch.timeline), genealogy: pro.get('genealogy.json') };
}

// ---------- pacote publicável ----------
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const json = (o) => Buffer.from(`${JSON.stringify(o)}\n`);

// Mapa chave → Buffer (já com o manifest). Determinístico: sem datas. Os originais seguem como arquivos, byte a byte.
export function buildPackage(root) {
  const { pro } = splitSources(loadSources(root));
  const files = new Map([...pro.entries()].map(([k, v]) => [k, json(v)]));
  const dir = path.join(root, 'public/interlinear');
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) files.set(`interlinear/${f}`, fs.readFileSync(path.join(dir, f)));
  const manifest = { version: 1, files: Object.fromEntries([...files.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, b]) => [k, { sha256: sha(b), bytes: b.length }])) };
  manifest.totalBytes = Object.values(manifest.files).reduce((s, x) => s + x.bytes, 0);
  files.set('manifest.json', json(manifest));
  return { files, manifest };
}
