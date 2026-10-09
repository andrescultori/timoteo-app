// Ferramenta de desenvolvimento (fora do CI): capturas de todas as telas e comparação pixel a pixel entre dois builds.
//   Capturar:  node scripts/visual-regression.mjs shoot --url http://127.0.0.1:4180 --out /tmp/golden [--site light|dark]
//   Comparar:  node scripts/visual-regression.mjs diff /tmp/golden /tmp/novo        (sai com erro se algum pixel mudar)
// Precisa do Playwright (PLAYWRIGHT_MODULE=/caminho/playwright/index.mjs, se não estiver instalado no projeto).
// Para ver as telas do plano Pro, sirva um build local em que o plano padrão é "pro" (o atalho nunca é commitado).
// Serve para provar que o tema claro não mudou ao mexer no CSS (regra: qualquer pixel de diferença no claro é regressão).
import fs from 'node:fs';
import path from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');

const ROUTES = {
  home: '#', livro: '#joh', ficha: '#joh/sheet', mapa: '#joh/map', ler: '#joh/read/3', 'ler-salmo': '#psa/read/23', salmos: '#psa/psalms/51', estrutura: '#job/structure',
  linha: '#timeline', 'linha-evento': '#timeline/exodo', personagens: '#person', personagem: '#person/davi', arvore: '#tree/adao-jesus', favoritos: '#favorites',
  perfil: '#profile', config: '#settings', termos: '#terms', privacidade: '#privacy', retorno: '#checkout/retorno',
  'originais-he': { hash: '#gen/read/1', prefs: { originals: true } }, 'originais-grc': { hash: '#joh/read/1', prefs: { originals: true } },
  'leitura-sepia': { hash: '#joh/read/3', prefs: { theme: 'sepia', size: 26 } }, 'leitura-escura': { hash: '#joh/read/3', prefs: { theme: 'dark' } },
  'home-continuar': { hash: '#', position: true },
};
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const mode = process.argv[2];

if (mode === 'shoot') {
  const url = arg('--url'); const out = arg('--out'); const site = arg('--site', 'light');
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  for (const [w, h] of [[390, 844], [1280, 900]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, locale: 'pt-BR', reducedMotion: 'reduce' });
    const pg = await ctx.newPage();
    for (const [name, r] of Object.entries(ROUTES)) {
      const { hash, prefs = {}, position = false } = typeof r === 'string' ? { hash: r } : r;
      await pg.goto(`${url}/`);
      await pg.evaluate(([p, pos]) => {
        localStorage.clear(); localStorage.setItem('lang', 'pt');
        localStorage.setItem('readingPrefs', JSON.stringify({ v: p, at: '2026-01-01T00:00:00.000Z' }));
        if (pos) localStorage.setItem('readingPosition', JSON.stringify({ version: 'blivre', slug: 'joh', chapter: 3, at: '2026-01-01T00:00:00.000Z' }));
      }, [site === 'dark' ? { ...prefs, siteTheme: 'dark' } : prefs, position]);
      await pg.goto(`${url}/${hash}`); await pg.reload();
      await pg.waitForLoadState('networkidle'); await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(700);
      if (name === 'linha-evento' || name === 'personagem') await pg.waitForTimeout(300);
      await pg.screenshot({ path: path.join(out, `${name}-${w}.png`), fullPage: true });
    }
    await ctx.close();
  }
  await b.close();
  console.log(`${Object.keys(ROUTES).length * 2} capturas em ${out}`);
} else if (mode === 'diff') {
  const [a, c] = [process.argv[3], process.argv[4]];
  const b = await chromium.launch();
  const pg = await b.newPage();
  await pg.setContent('<canvas id="a"></canvas><canvas id="b"></canvas>');
  let bad = 0; let total = 0;
  for (const f of fs.readdirSync(a).filter((x) => x.endsWith('.png')).sort()) {
    if (!fs.existsSync(path.join(c, f))) { console.log(`FALTA ${f}`); bad += 1; continue; }
    const n = await pg.evaluate(async ([x, y]) => {
      const load = async (b64) => { const i = new Image(); i.src = `data:image/png;base64,${b64}`; await i.decode(); return i; };
      const [i1, i2] = [await load(x), await load(y)];
      if (i1.width !== i2.width || i1.height !== i2.height) return { size: [i1.width, i1.height, i2.width, i2.height] };
      const get = (i, id) => { const cv = document.getElementById(id); cv.width = i.width; cv.height = i.height; const g = cv.getContext('2d'); g.drawImage(i, 0, 0); return g.getImageData(0, 0, i.width, i.height).data; };
      const [d1, d2] = [get(i1, 'a'), get(i2, 'b')];
      let diff = 0; for (let k = 0; k < d1.length; k += 4) if (d1[k] !== d2[k] || d1[k + 1] !== d2[k + 1] || d1[k + 2] !== d2[k + 2]) diff += 1;
      return { diff };
    }, [fs.readFileSync(path.join(a, f)).toString('base64'), fs.readFileSync(path.join(c, f)).toString('base64')]);
    total += 1;
    if (n.size) { console.log(`TAMANHO ${f}: ${n.size.join(' ')}`); bad += 1; } else if (n.diff) { console.log(`DIFERE ${f}: ${n.diff} pixels`); bad += 1; }
  }
  await b.close();
  console.log(bad ? `${bad} de ${total} telas mudaram.` : `OK: ${total} telas idênticas, pixel a pixel.`);
  process.exit(bad ? 1 : 0);
} else { console.error('uso: shoot --url U --out DIR [--site light|dark] | diff A B'); process.exit(2); }
