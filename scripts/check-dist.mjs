// Confere que um build do site público (dist/) NÃO leva o conteúdo Pro (Fase 3B, PR 5).
//   node scripts/check-dist.mjs [pasta]   (padrão: dist/; roda sozinho depois de `npm run build` quando o build é o padrão `storage`)
// Procura no que vai ao ar: trechos de textos que só existem no Pro (biografias, notas da linha do tempo e da genealogia, mapas e estrutura
// Pro, posição acadêmica das fichas) e a pasta dos originais. Também exporta `checkDist` para os testes.
import fs from 'node:fs';
import path from 'node:path';
import { loadSources, splitSources } from './pro-lib.mjs';

const root = path.resolve(import.meta.dirname, '..');
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
// o JSON do build escapa aspas e barras: comparamos sobre texto "normalizado" (sem aspas, barras, quebras)
const norm = (s) => String(s).replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\["\\n]/g, '').replace(/["'`\\\s]/g, '');

export function sentinels(rootDir = root) {
  const src = loadSources(rootDir);
  const { pro } = splitSources(src);
  const out = [];
  const add = (label, text) => { const n = norm(text).slice(0, 40); if (n.length >= 25) out.push({ label, n }); };
  for (const p of pro.get('people.json')) { add(`bio de ${p.id}`, (p.bio?.pt ?? [])[0] ?? ''); add(`resumo de ${p.id}`, p.summary?.pt ?? ''); }
  for (const e of pro.get('timeline.json').events) add(`evento ${e.id}`, e.note?.pt ?? '');
  for (const p of pro.get('timeline.json').periods) add(`período ${p.id}`, p.summary?.pt ?? '');
  for (const [id, n] of Object.entries(pro.get('genealogy.json').nodes ?? {})) add(`genealogia ${id}`, n.note?.pt ?? '');
  for (const [slug, part] of [...pro].filter(([k]) => k.startsWith('info/')).map(([k, v]) => [k.slice(5, -5), v])) {
    if (part.structure?.note?.pt) add(`estrutura de ${slug}`, part.structure.note.pt);
    for (const pl of part.map?.places ?? []) add(`lugar ${slug}/${pl.name?.pt}`, pl.note?.pt ?? pl.description?.pt ?? '');
  }
  for (const [slug, info] of Object.entries(src.info)) { add(`acadêmica (autoria) de ${slug}`, info.author?.scholarly?.pt ?? ''); add(`acadêmica (data) de ${slug}`, info.date?.scholarly?.pt ?? ''); }
  return out;
}

export function checkDist(dir, rootDir = root) {
  const problems = [];
  if (!fs.existsSync(dir)) return [`pasta não existe: ${dir}`];
  if (fs.existsSync(path.join(dir, 'interlinear'))) problems.push('dist/interlinear existe: os originais não podem ir ao ar');
  const files = walk(dir).filter((f) => /\.(js|css|json|html|webmanifest)$/.test(f));
  const text = files.map((f) => ({ f, t: norm(fs.readFileSync(f, 'utf8')) }));
  for (const s of sentinels(rootDir)) {
    const hit = text.find((x) => x.t.includes(s.n));
    if (hit) problems.push(`vazou no site público: ${s.label} (${path.relative(dir, hit.f)})`);
  }
  return problems;
}

if (process.argv[1]?.endsWith('check-dist.mjs')) {
  if (process.argv.includes('--if-storage') && process.env.VITE_PRO_SOURCE === 'local') { console.log('dist: build `local` (só para testes): conferência do Pro ignorada.'); process.exit(0); }
  const dir = path.resolve(process.argv.slice(2).find((a) => !a.startsWith('--')) ?? path.join(root, 'dist'));
  const problems = checkDist(dir);
  if (problems.length) { console.error(`dist: ${problems.length} problema(s):\n- ${problems.slice(0, 20).join('\n- ')}${problems.length > 20 ? `\n… e mais ${problems.length - 20}` : ''}`); process.exit(1); }
  console.log(`OK dist: nenhum conteúdo Pro no site público (${sentinels().length} trechos conferidos, sem a pasta de originais).`);
}
