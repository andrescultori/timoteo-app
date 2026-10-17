// Ferramenta de desenvolvimento (fora do CI): prova da exportação em PDF de Meus Estudos num navegador de verdade.
//   node scripts/ui-pdf.mjs --pro http://127.0.0.1:4190 --free http://127.0.0.1:4182 --out /pasta
// --pro: build servido em que o plano padrão é Pro (ALLOW_LOCAL_PRO=1 VITE_PRO_SOURCE=local, com o atalho de plano; nunca commitado).
// --free: build público (Essencial). Gera a folha na tela e o PDF A4 (page.pdf em mídia de impressão) em --out.
import fs from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const pro = arg('--pro'); const free = arg('--free'); const out = arg('--out', '/tmp/pdf-prova');
fs.mkdirSync(out, { recursive: true });
let failed = 0;
const ok = (c, m) => { if (!c) { failed += 1; console.error(`FALHOU: ${m}`); } else console.log(`ok  ${m}`); };
const b = await chromium.launch();
const fresh = async (url, hash, wait, vp = { width: 1280, height: 900 }) => {
  const ctx = await b.newContext({ viewport: vp, locale: 'pt-BR', serviceWorkers: 'block' });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => { failed += 1; console.error('ERRO NA PÁGINA', e.message); });
  await pg.goto(`${url}/`);
  await pg.evaluate(() => { localStorage.clear(); localStorage.setItem('lang', 'pt'); localStorage.setItem('readingPrefs', JSON.stringify({ v: { siteTheme: 'dark', theme: 'dark' } })); });
  await pg.goto(`${url}/${hash}`); await pg.reload(); await pg.waitForSelector(wait, { timeout: 15000 }); await pg.waitForTimeout(300);
  return [ctx, pg];
};

if (pro) {
  const [ctx, pg] = await fresh(pro, '#joh/read/3', '.vnum'); // site e leitura em tema ESCURO: a folha tem de sair clara
  for (let i = 0; i < 6; i += 1) {
    await pg.locator(`#vs-${16 + i} .vnum`).click();
    await pg.locator('.mk-cat').nth(i).click();
    await pg.getByRole('button', { name: 'Limpar' }).click();
  }
  await pg.locator('#vs-16 .vnum').click(); await pg.getByRole('button', { name: 'Anotar' }).click();
  await pg.locator('dialog textarea').fill('Amor de Deus pelo mundo'); await pg.getByRole('button', { name: 'Salvar' }).click();
  await pg.getByRole('button', { name: 'Limpar' }).click();
  await pg.goto(`${pro}/#studies`); await pg.waitForSelector('.st-tpl');
  await pg.getByRole('button', { name: /Aula de EBD/ }).click(); await pg.waitForSelector('.st-items');
  await pg.locator('.st-item textarea').first().fill('Entender o novo nascimento');
  await pg.getByRole('button', { name: 'Adicionar item' }).click();
  await pg.locator('.st-add select').nth(1).selectOption('joh');
  const n = pg.locator('.st-add input[type=number]');
  await n.nth(0).fill('3'); await n.nth(1).fill('16'); await n.nth(2).fill('21');
  await pg.getByRole('button', { name: 'Adicionar', exact: true }).click(); await pg.waitForSelector('.st-passage .st-verses p');
  await pg.waitForTimeout(900);
  const btn = pg.getByRole('button', { name: 'Exportar o estudo em PDF' });
  ok(await btn.isEnabled(), 'Pro: "Exportar PDF" habilitado');
  ok(await pg.locator('.pro-invite').count() === 0, 'Pro: sem convite');
  await btn.click();
  await pg.waitForSelector('.ps-sheet');
  await pg.waitForFunction(() => !document.querySelector('.ps-bar button').disabled);
  ok(await pg.locator('.ps-bar button').first().evaluate((e) => document.activeElement === e), 'foco vai ao botão de imprimir');
  ok(await pg.locator('.ps-sheet').evaluate((e) => getComputedStyle(e).backgroundColor) === 'rgb(255, 255, 255)', 'a folha é clara mesmo com site e leitura escuros');
  ok(await pg.locator('.ps-verses .vs[data-cat]').count() === 6, 'as 6 marcações aparecem na folha');
  const txt = await pg.locator('.ps-sheet').innerText();
  ok(txt.includes('Porque Deus amou ao mundo'), 'texto bíblico da versão ativa na folha');
  ok(txt.includes('Amor de Deus pelo mundo'), 'nota do versículo na folha');
  ok(txt.includes('Entender o novo nascimento'), 'nota do bloco na folha');
  ok(txt.includes('Feito no Timóteo App · estudo.timoteo.app.br') && txt.includes('Licença Creative Commons'), 'rodapé e licença da versão');
  ok(await pg.locator('.ps-legend li').count() === 6, 'legenda só com as categorias usadas (6)');
  ok(!/posição acadêmica|scholarly/i.test(txt), 'sem posição acadêmica');
  await pg.screenshot({ path: `${out}/folha-tela.png` });
  await pg.emulateMedia({ media: 'print' });
  ok(await pg.locator('#root').evaluate((e) => getComputedStyle(e).display) === 'none', 'impressão: o app some, fica só a folha');
  await pg.pdf({ path: `${out}/estudo.pdf`, format: 'A4', preferCSSPageSize: true, printBackground: true });
  await pg.emulateMedia({ media: 'screen' });
  await pg.keyboard.press('Escape');
  await pg.waitForSelector('.ps-sheet', { state: 'detached' });
  ok(await btn.evaluate((e) => document.activeElement === e) || await pg.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Exportar o estudo em PDF').then(() => true), 'Esc fecha e devolve o foco ao botão');
  await ctx.close();
}
if (free) {
  const [ctx, pg] = await fresh(free, '#studies', '.st-tpl');
  await pg.getByRole('button', { name: /Estudo de passagem/ }).click(); await pg.waitForSelector('.st-items');
  const reqs = []; pg.on('request', (r) => reqs.push(r.url()));
  await pg.getByRole('button', { name: 'Exportar o estudo em PDF' }).click();
  await pg.waitForSelector('.pro-invite');
  ok(await pg.locator('.ps-sheet').count() === 0, 'Essencial: convite ao Pro, sem folha de impressão');
  ok(!reqs.some((u) => /StudyPrint|interlinear/.test(u)), 'Essencial: a folha de impressão nem é baixada');
  await ctx.close();
}
await b.close();
if (failed) { console.error(`\n${failed} verificação(ões) falharam.`); process.exit(1); }
console.log('\nOK: exportação em PDF.');
