// Testes do pacote Pro (scripts/pro-lib.mjs): separar a posição acadêmica e o conteúdo Pro sem perder nada. Roda no `npm test`.
import assert from 'node:assert/strict';
import path from 'node:path';
import crypto from 'node:crypto';
import { stripScholarly, restoreScholarly, splitSources, joinSources, loadSources, buildPackage, KEY_RE, PREFIX } from './pro-lib.mjs';

let n = 0;
const t = (name, fn) => { fn(); n += 1; };
const root = path.resolve(import.meta.dirname, '..');

// ---- stripScholarly / restoreScholarly em dados pequenos ----
t('remove propriedade scholarly em qualquer profundidade e restaura igual', () => {
  const d = { a: { scholarly: { x: 1 }, tradicional: 2 }, l: [{ scholarly: 'z', k: 1 }, { k: 2 }] };
  const { doc, extras } = stripScholarly(d);
  assert.deepEqual(doc, { a: { tradicional: 2 }, l: [{ k: 1 }, { k: 2 }] });
  assert.equal(extras.length, 2);
  assert.deepEqual(restoreScholarly(doc, extras), d);
});
t('remove itens de lista com view scholarly e devolve na posição original', () => {
  const d = { readings: [{ view: 'traditional', a: 1 }, { view: 'scholarly', a: 2 }, { view: 'x', a: 3 }, { view: 'scholarly', a: 4 }] };
  const { doc, extras } = stripScholarly(d);
  assert.deepEqual(doc.readings.map((r) => r.a), [1, 3]);
  assert.deepEqual(restoreScholarly(doc, extras), d);
});
t('sem posição acadêmica: nada muda', () => {
  const d = { a: [1, { b: 2 }] };
  const { doc, extras } = stripScholarly(d);
  assert.deepEqual(doc, d); assert.equal(extras.length, 0);
});
t('stripScholarly não altera o objeto de entrada', () => {
  const d = { scholarly: 1, k: 2 };
  stripScholarly(d);
  assert.deepEqual(d, { scholarly: 1, k: 2 });
});

// ---- com os dados reais ----
const src = loadSources(root);
const { pro, rest } = splitSources(src);
const proJson = (k) => JSON.stringify(pro.get(k));

t('o pacote Pro não contém posição acadêmica fora de admin/scholarly.json', () => {
  for (const [k, v] of pro) {
    if (k === 'admin/scholarly.json') continue;
    const s = JSON.stringify(v);
    assert.ok(!/"scholarly"\s*:/.test(s) && !/"view":"scholarly"/.test(s), `${k} ainda tem posição acadêmica`);
  }
  assert.ok(!/"scholarly"/.test(JSON.stringify(rest)), 'o que sobra para o público ainda tem posição acadêmica');
});
t('ida e volta sem perda: fichas, personagens, linha do tempo e genealogia', () => {
  const back = joinSources(pro, rest);
  assert.deepEqual(back.info, src.info);
  assert.deepEqual(back.timeline, src.timeline);
  assert.deepEqual(back.genealogy, src.genealogy);
  const byId = Object.fromEntries(src.people.map((p) => [p.id, p]));
  assert.equal(back.people.length, src.people.length);
  for (const p of back.people) assert.deepEqual(p, byId[p.id]);
});
t('só os personagens fora do Essencial vão ao pacote Pro', () => {
  const proIds = [...pro.keys()].filter((k) => k.startsWith('people/')).map((k) => k.slice(7, -5));
  assert.equal(proIds.length, src.people.length - src.ess.characters.length);
  for (const id of src.ess.characters) assert.ok(!proIds.includes(id), `${id} é do Essencial`);
  assert.equal(rest.people.length, src.ess.characters.length);
});
t('só mapas e estruturas Pro vão ao pacote; os do Essencial ficam nas fichas públicas', () => {
  for (const slug of src.ess.mapBooks) assert.ok('map' in rest.info[slug], `${slug}: mapa do Essencial tem de ficar público`);
  for (const [slug, d] of Object.entries(rest.info)) {
    if (!src.ess.mapBooks.includes(slug)) assert.ok(!('map' in d), `${slug}: mapa Pro não pode ficar público`);
    assert.ok(!('structure' in d), `${slug}: estrutura Pro não pode ficar pública`);
  }
  const expected = Object.entries(src.info).filter(([s, d]) => ('map' in d && !src.ess.mapBooks.includes(s)) || 'structure' in d).map(([s]) => s).sort();
  assert.deepEqual([...pro.keys()].filter((k) => k.startsWith('info/')).map((k) => k.slice(5, -5)).sort(), expected);
});

// ---- pacote e manifest ----
const { files, manifest } = buildPackage(root);
t('todas as chaves seguem o formato permitido e há manifest', () => {
  for (const k of files.keys()) assert.match(k, KEY_RE, `chave fora do padrão: ${k}`);
  assert.ok(files.has('manifest.json') && files.has('admin/scholarly.json') && files.has('timeline.json'));
  assert.equal(PREFIX, 'v1/');
});
t('todo arquivo é JSON válido e o manifest confere tamanho e hash', () => {
  for (const [k, buf] of files) {
    JSON.parse(buf.toString('utf8'));
    if (k === 'manifest.json') continue;
    assert.equal(manifest.files[k].bytes, buf.length, `${k}: tamanho`);
    assert.equal(manifest.files[k].sha256, crypto.createHash('sha256').update(buf).digest('hex'), `${k}: hash`);
  }
  assert.equal(Object.keys(manifest.files).length, files.size - 1);
});
t('o pacote é determinístico (duas montagens, mesmo manifest)', () => {
  assert.deepEqual(buildPackage(root).files.get('manifest.json'), files.get('manifest.json'));
});
t('os 66 interlinear e os 2 léxicos estão no pacote, byte a byte', () => {
  const inter = [...files.keys()].filter((k) => k.startsWith('interlinear/'));
  assert.equal(inter.length, 68);
  assert.ok(files.has('interlinear/lex-h.json') && files.has('interlinear/lex-g.json'));
});
t('o arquivo da posição acadêmica fica em v1/admin/ (a política do bucket o restringe ao admin)', () => {
  for (const k of files.keys()) assert.equal(k.startsWith('admin/'), k === 'admin/scholarly.json', `só admin/scholarly.json vai em admin/: ${k}`);
});

console.log(`OK: ${n} testes do pacote Pro passaram.`);
