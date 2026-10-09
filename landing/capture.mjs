// Gera as capturas da landing (landing/img/*.webp) a partir de um build do app servido em APP_URL (padrão http://127.0.0.1:4180).
// As telas do Pro só aparecem no plano Pro; por isso a captura usa um build LOCAL em que o plano padrão é "pro" (a mudança nunca é commitada).
// Uso: node landing/capture.mjs   (precisa do Playwright e de um Chromium; ver landing/README.md)
import fs from 'node:fs';
import path from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const base = process.env.APP_URL ?? 'http://127.0.0.1:4180';
const out = path.join(import.meta.dirname, 'img');
// click: texto de um botão a clicar antes da captura; scroll: px de rolagem
const shots = {
  ficha: { hash: '#joh/sheet' },
  mapa: { hash: '#joh/map', scroll: 250 },
  'linha-do-tempo': { hash: '#timeline', click: 'Egito e Êxodo' },
  personagens: { hash: '#person/davi' },
};
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, locale: 'pt-BR' });
await ctx.addInitScript(() => { try { localStorage.setItem('lang', 'pt'); localStorage.setItem('showScholarly', '0'); } catch {} });
const pg = await ctx.newPage();
const conv = await ctx.newPage();
await conv.setContent('<canvas id="c"></canvas>');
for (const [name, { hash, click, scroll }] of Object.entries(shots)) {
  await pg.goto(`${base}/${hash}`);
  await pg.waitForTimeout(1200);
  if (click) { await pg.getByRole('button', { name: click }).first().click(); await pg.waitForTimeout(400); }
  if (scroll) { await pg.evaluate((y) => window.scrollTo(0, y), scroll); await pg.waitForTimeout(300); }
  const png = (await pg.screenshot()).toString('base64');
  const webp = await conv.evaluate(async (b64) => {
    const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode();
    const c = document.getElementById('c'); c.width = 960; c.height = 600;
    c.getContext('2d').drawImage(img, 0, 0, 960, 600);
    return c.toDataURL('image/webp', 0.82).split(',')[1];
  }, png);
  fs.writeFileSync(path.join(out, `${name}.webp`), Buffer.from(webp, 'base64'));
  console.log(name, (Buffer.from(webp, 'base64').length / 1024).toFixed(0), 'KB');
}
await b.close();
