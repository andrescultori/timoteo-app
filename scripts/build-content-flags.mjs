// Gera src/data/content-flags.json: quais livros TÊM mapa e estrutura Pro. Fica no pacote público para as abas Mapa e Estrutura
// aparecerem para o Essencial (com o convite ao Pro) mesmo quando a ficha pública já não traz `map` nem `structure`.
// Rode depois de mudar src/data/info/*.json ou o `essencial` de plans.json: node scripts/build-content-flags.mjs (o `npm run check` confere).
import fs from 'node:fs';
import path from 'node:path';
import { loadSources } from './pro-lib.mjs';

export function buildFlags(root) {
  const src = loadSources(root);
  const slugs = Object.keys(src.info).sort();
  return {
    map: slugs.filter((s) => 'map' in src.info[s] && !src.ess.mapBooks.includes(s)),
    structure: slugs.filter((s) => 'structure' in src.info[s] && !src.ess.structureBooks.includes(s)),
  };
}

if (process.argv[1]?.endsWith('build-content-flags.mjs')) {
  const root = path.resolve(import.meta.dirname, '..');
  fs.writeFileSync(path.join(root, 'src/data/content-flags.json'), `${JSON.stringify(buildFlags(root))}\n`);
  console.log('src/data/content-flags.json atualizado');
}
