// Ferramenta de desenvolvimento (fora do CI): percorre as marcações de versículo num navegador de verdade (toque no número, barra, categoria, nota,
// rota com versículo, teclado, Favoritos > Versículos e Configurações) e sai com erro se algo falhar.
//   node scripts/ui-marks.mjs --url http://127.0.0.1:4181 [--out /pasta/para/capturas]
// Precisa do Playwright (PLAYWRIGHT_MODULE=/caminho/playwright/index.mjs, se não estiver instalado no projeto) e de um build servido em --url.
import fs from 'node:fs';
const { chromium, devices } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const url = arg('--url', 'http://127.0.0.1:4181');
const out = arg('--out', null);
if (out) fs.mkdirSync(out, { recursive: true });
let failed = 0;
const ok = (c, m) => { if (!c) { failed += 1; console.error(`FALHOU: ${m}`); } else console.log(`ok  ${m}`); };
const b = await chromium.launch();
const fresh = async (opts, hash, wait = '.vnum') => {
  const ctx = await b.newContext({ locale: 'pt-BR', serviceWorkers: 'block', ...opts });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => { failed += 1; console.error('ERRO NA PÁGINA', e.message); });
  await pg.goto(`${url}/`);
  await pg.evaluate(() => { localStorage.clear(); localStorage.setItem('lang', 'pt'); });
  await pg.goto(`${url}/${hash}`); await pg.reload(); await pg.waitForSelector(wait, { timeout: 15000 }); await pg.waitForTimeout(400);
  return [ctx, pg];
};

{ // computador
  const [ctx, pg] = await fresh({ viewport: { width: 1280, height: 900 } }, '#joh/read/3');
  ok(await pg.locator('.vnum').first().evaluate((e) => parseFloat(getComputedStyle(e, '::after').width) >= 44), 'alvo de toque do número com pelo menos 44px de largura');
  await pg.locator('#vs-16 .vnum').click(); await pg.locator('#vs-17 .vnum').click();
  ok((await pg.locator('.mark-bar-top b').innerText()).includes('João 3.16-17'), 'barra mostra "João 3.16-17"');
  ok(await pg.locator('.mark-bar-in[role=toolbar]').count() === 1, 'a barra é role=toolbar');
  ok(await pg.locator('.mark-bar').evaluate((e) => getComputedStyle(e).position) === 'fixed', 'a barra é position: fixed');
  await pg.locator('.mk-cat').nth(0).click();
  ok(await pg.locator('.vs[data-cat=c1]').count() === 2, 'categoria aplicada aos dois versículos');
  ok(await pg.locator('.mk-cat[aria-pressed=true]').count() === 1, 'a categoria ativa de todos aparece pressionada');
  if (out) await pg.screenshot({ path: `${out}/leitor-marcado.png` });
  await pg.locator('.mk-cat').nth(0).click();
  ok(await pg.locator('.vs[data-cat]').count() === 0, 'tocar na categoria ativa de todos remove a marca');
  await pg.locator('.mk-cat').nth(1).click();
  await pg.getByRole('button', { name: 'Limpar' }).click();
  ok(await pg.locator('.mark-bar').count() === 0, 'Limpar fecha a barra');
  await pg.locator('#vs-16 .vnum').focus(); await pg.keyboard.press('Enter');
  ok(await pg.locator('#vs-16 .vnum[aria-pressed=true]').count() === 1, 'Enter no número seleciona (teclado)');
  await pg.keyboard.press('Space');
  ok(await pg.locator('.vs.sel').count() === 0, 'Espaço desmarca a seleção (teclado)');
  await pg.locator('#vs-16 .vnum').click();
  await pg.getByRole('button', { name: 'Anotar' }).click();
  ok(await pg.locator('#note-text').evaluate((e) => getComputedStyle(e).fontSize) === '16px', 'textarea da nota com 16px (sem zoom no iOS)');
  await pg.fill('#note-text', 'Deus amou o mundo');
  ok((await pg.locator('.note-count').innerText()).startsWith('17 de 2000'), 'contador de caracteres');
  if (out) await pg.screenshot({ path: `${out}/nota.png` });
  await pg.getByRole('button', { name: 'Salvar' }).click();
  ok(await pg.locator('.vnote').count() === 1, 'versículo com nota ganha o lápis');
  ok(JSON.parse(await pg.evaluate(() => localStorage.getItem('verseMarks')))[0].note === 'Deus amou o mundo', 'a nota foi gravada no aparelho');
  await pg.locator('.vnote').click();
  ok(await pg.locator('#note-text').inputValue() === 'Deus amou o mundo', 'o lápis abre a nota');
  await pg.keyboard.press('Escape');
  await ctx.close();
}
{ // rota com versículo
  const [ctx, pg] = await fresh({ viewport: { width: 1280, height: 900 } }, '#joh/read/3/16');
  ok(await pg.locator('.vs.sel').count() === 1 && (await pg.locator('.mark-bar-top b').innerText()).includes('João 3.16'), '#joh/read/3/16 abre com o versículo 16 selecionado');
  await ctx.close();
}
{ // originais: marcas só leitura
  const ctx = await b.newContext({ locale: 'pt-BR', serviceWorkers: 'block', viewport: { width: 1280, height: 900 } });
  const pg = await ctx.newPage();
  await pg.goto(`${url}/`);
  await pg.evaluate(() => { localStorage.clear(); localStorage.setItem('lang', 'pt'); localStorage.setItem('readingPrefs', JSON.stringify({ v: { originals: true }, at: '2026-01-01T00:00:00.000Z' })); localStorage.setItem('verseMarks', JSON.stringify([{ b: 'joh', c: 1, v: 1, cat: 'c2', note: null, at: '2026-10-17T10:00:00.000Z' }])); });
  await pg.goto(`${url}/#joh/read/1`); await pg.reload(); await pg.waitForSelector('.reader-text', { timeout: 15000 }); await pg.waitForTimeout(1500);
  const orig = await pg.locator('.text.orig').count();
  if (orig) { ok(await pg.locator('.text.orig .vtext[data-cat=c2]').count() === 1 && await pg.locator('.vnum').count() === 0, 'modo originais: marca visível e sem seleção'); } else console.log('(originais indisponíveis neste build: passo ignorado)');
  await ctx.close();
}
{ // celular
  const [ctx, pg] = await fresh({ ...devices['iPhone 13 Pro'] }, '#joh/read/3');
  await pg.locator('#vs-16 .vnum').tap(); await pg.locator('#vs-17 .vnum').tap();
  await pg.locator('.mk-cat').nth(2).tap();
  const bar = await pg.locator('.mark-bar-in').boundingBox();
  ok(bar && bar.x >= 0 && bar.x + bar.width <= pg.viewportSize().width, 'a barra cabe na largura do celular');
  if (out) await pg.screenshot({ path: `${out}/celular-barra.png` });
  await ctx.close();
}
{ // Favoritos > Versículos e Configurações
  const marks = [{ b: 'joh', c: 3, v: 16, cat: 'c1', note: 'Resumo', at: '2026-10-17T10:00:00.000Z' }, { b: 'rom', c: 8, v: 28, cat: 'c4', note: null, at: '2026-10-17T10:00:01.000Z' }, { b: 'gen', c: 1, v: 1, cat: null, note: 'só nota', at: '2026-10-17T10:00:02.000Z' }];
  for (const [name, opts] of [['desktop', { viewport: { width: 1280, height: 900 } }], ['celular', { ...devices['iPhone 13 Pro'] }]]) {
    const ctx = await b.newContext({ locale: 'pt-BR', serviceWorkers: 'block', ...opts });
    const pg = await ctx.newPage();
    await pg.goto(`${url}/`);
    await pg.evaluate((m) => { localStorage.clear(); localStorage.setItem('lang', 'pt'); localStorage.setItem('verseMarks', JSON.stringify(m)); }, marks);
    await pg.goto(`${url}/#favorites`); await pg.reload(); await pg.waitForSelector('.fv-item'); await pg.waitForTimeout(800);
    ok((await pg.locator('.tab[aria-selected=true]').innerText()).includes('Versículos') && await pg.locator('.fv-item').count() === 3, `${name}: Favoritos abre em Versículos quando há marcações`);
    await pg.locator('.fv-filter button').nth(1).click();
    ok(await pg.locator('.fv-item').count() === 1, `${name}: filtro por categoria`);
    await pg.locator('.tab', { hasText: 'Favoritos' }).click();
    ok(await pg.locator('.fv-item').count() === 0 && await pg.locator('.soon').count() >= 1, `${name}: a aba Favoritos continua com as seções de sempre`);
    await pg.goto(`${url}/#settings`); await pg.reload(); await pg.waitForSelector('.cat-row');
    await pg.locator('.cat-row input').first().fill('Missão e evangelismo');
    await pg.getByRole('button', { name: 'Salvar nomes' }).click();
    ok(JSON.parse(await pg.evaluate(() => localStorage.getItem('studyCategories'))).c[0].name === 'Missão e evangelismo', `${name}: renomear categoria em Configurações`);
    await ctx.close();
  }
}
await b.close();
console.log(failed ? `\n${failed} verificação(ões) falharam.` : '\nTudo certo: marcação, nota, rota, teclado, Favoritos e Configurações.');
process.exit(failed ? 1 : 0);
