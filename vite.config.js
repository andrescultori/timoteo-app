import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { splitInfo, publicPeople } from './src/data/proSplit.js';

// Origem do conteúdo Pro (Fase 3B):
//   storage (PADRÃO do `vite build`): o site público NÃO leva o conteúdo Pro. Na hora do build, personagens Pro viram só nome e livros, as fichas
//     perdem mapa/estrutura Pro e a posição acadêmica, linha do tempo e genealogia saem, e os originais (public/interlinear) não vão para dist/.
//     O Pro chega só pelo Supabase Storage, para quem o banco autoriza.
//   local (PADRÃO do `vite dev`): tudo vem dos arquivos, como sempre (desenvolvimento e capturas de tela). Num build de produção só com ALLOW_LOCAL_PRO=1
//     (testes e regressão visual): publicar um build `local` vaza o Pro, então ele é recusado sem essa variável.
export default defineConfig(({ command }) => {
  const source = process.env.VITE_PRO_SOURCE || (command === 'build' ? 'storage' : 'local');
  if (!['storage', 'local'].includes(source)) throw new Error(`VITE_PRO_SOURCE inválido: "${source}" (use storage ou local)`);
  if (command === 'build' && source === 'local' && !process.env.ALLOW_LOCAL_PRO) {
    throw new Error('Build de produção com VITE_PRO_SOURCE=local incluiria o conteúdo Pro no site público. Use o padrão (storage) ou, só para testes e capturas, ALLOW_LOCAL_PRO=1.');
  }
  const ess = JSON.parse(fs.readFileSync(new URL('./src/data/plans.json', import.meta.url), 'utf8')).essencial;
  let outDir = 'dist';
  let root = process.cwd();
  const split = source === 'storage' && {
    name: 'timoteo-pro-split',
    enforce: 'pre',
    configResolved(c) { outDir = c.build.outDir; root = c.root; },
    transform(code, id) {
      const f = id.split('?')[0].replaceAll('\\', '/');
      if (!f.endsWith('.json')) return null;
      if (f.endsWith('/src/data/people.json')) return JSON.stringify({ people: publicPeople(JSON.parse(code).people, ess) });
      let m = /\/src\/data\/info\/([a-z0-9-]+)\.json$/.exec(f);
      if (m) return JSON.stringify(splitInfo(m[1], JSON.parse(code), ess).rest);
      if (f.endsWith('/src/data/timeline.json')) return JSON.stringify({ blocks: [], periods: [], events: [] });
      if (f.endsWith('/src/data/genealogia.json')) return JSON.stringify({ trees: [], nodes: {}, links: [] });
      return null;
    },
    closeBundle() { fs.rmSync(path.resolve(root, outDir, 'interlinear'), { recursive: true, force: true }); }, // os originais só saem do Storage
  };
  return {
    // base relativa: funciona na raiz do domínio (Cloudflare Pages) e em qualquer subpasta.
    base: './',
    plugins: [
      react(),
      ...(split ? [split] : []),
      // PWA (Fase 3B, PR 6): o shell do app fica no aparelho e abre sem rede. O texto bíblico entra no cache só depois de lido (PR 7 traz o download
      // completo); o Pro nunca passa pelo service worker (vem do Supabase, outra origem). O manifest continua sendo public/manifest.webmanifest.
      VitePWA({
        registerType: 'prompt',
        manifest: false,
        injectRegister: false,
        workbox: {
          globPatterns: ['**/*.{html,js,css,woff2,svg,png,webmanifest}'],
          globIgnores: ['bible/**', 'interlinear/**', 'licencas/**', 'og-image.png', 'brand/**'],
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
          navigateFallback: 'index.html',
          cleanupOutdatedCaches: true,
          runtimeCaching: [
            {
              urlPattern: ({ url, sameOrigin }) => sameOrigin && /\/bible\/[^/]+\/\d+\.json$/.test(url.pathname),
              handler: 'CacheFirst',
              options: { cacheName: 'bible-text-v1', cacheableResponse: { statuses: [200] }, expiration: { maxEntries: 600 } },
            },
          ],
        },
      }),
    ],
    define: { 'import.meta.env.VITE_PRO_SOURCE': JSON.stringify(source) },
  };
});
