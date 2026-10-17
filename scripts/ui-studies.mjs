// Ferramenta de desenvolvimento (fora do CI): percorre Meus Estudos num navegador de verdade (lista, modelo, itens, reordenar, nota, contexto, leitor →
// "Adicionar ao estudo", limite do Essencial, offline) e sai com erro se algo falhar.
//   node scripts/ui-studies.mjs --url http://127.0.0.1:4182 [--out /pasta/para/capturas]
// Precisa do Playwright (PLAYWRIGHT_MODULE=/caminho/playwright/index.mjs) e de um build servido em --url.
import fs from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const url = arg('--url', 'http://127.0.0.1:4182');
const out = arg('--out', null);
if (out) fs.mkdirSync(out, { recursive: true });
let failed = 0;
const ok = (c, m) => { if (!c) { failed += 1; console.error(`FALHOU: ${m}`); } else console.log(`ok  ${m}`); };
const b = await chromium.launch();
const fresh = async (opts, hash, wait) => {
  const ctx = await b.newContext({ locale: 'pt-BR', serviceWorkers: 'block', ...opts });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => { failed += 1; console.error('ERRO NA PÁGINA', e.message); });
  await pg.goto(`${url}/`);
  await pg.evaluate(() => { localStorage.clear(); localStorage.setItem('lang', 'pt'); });
  await pg.goto(`${url}/${hash}`); await pg.reload(); await pg.waitForSelector(wait, { timeout: 15000 }); await pg.waitForTimeout(300);
  return [ctx, pg];
};
const shot = async (pg, name) => { if (out) await pg.screenshot({ path: `${out}/${name}.png`, fullPage: false }); };

for (const [label, vp] of [['desktop', { width: 1280, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
  const [ctx, pg] = await fresh({ viewport: vp }, '#studies', '#st-title');
  ok(await pg.locator('h1').count() === 1, `${label}: uma h1`);
  ok((await pg.locator('.st-quota').innerText()).includes('0 de 5 estudos no Essencial'), `${label}: painel de cota`);
  ok(await pg.locator('.st-bar[role=progressbar]').count() === 1, `${label}: barra de cota é progressbar`);
  ok((await pg.locator('.fav-device').innerText()).includes('Salvos neste aparelho'), `${label}: tag de salvo no aparelho`);
  await shot(pg, `${label}-lista-vazia`);
  // modelo
  await pg.getByRole('button', { name: 'Aula de EBD ou célula' }).click();
  await pg.waitForSelector('.st-items');
  ok(await pg.locator('.st-item').count() === 6, `${label}: modelo EBD cria 6 blocos`);
  ok((await pg.locator('.st-item textarea').first().getAttribute('placeholder')).startsWith('O que a turma'), `${label}: pergunta-guia como placeholder`);
  // nota com autosave
  await pg.locator('.st-item textarea').first().fill('Conhecer João 3');
  await pg.waitForTimeout(900);
  ok(JSON.parse(await pg.evaluate(() => localStorage.getItem('studies')))[0].items[0].note === 'Conhecer João 3', `${label}: nota salva no aparelho`);
  // reordenar
  const first = await pg.locator('.st-item').first().locator('.st-item-head b').innerText();
  await pg.getByRole('button', { name: /^Descer o item: Objetivo/ }).click();
  ok((await pg.locator('.st-item').first().locator('.st-item-head b').innerText()) !== first, `${label}: descer muda a ordem`);
  ok(await pg.getByRole('button', { name: /^Subir o item/ }).first().isDisabled(), `${label}: o primeiro não sobe`);
  // adicionar passagem
  await pg.getByRole('button', { name: 'Adicionar item' }).first().click();
  await pg.locator('.st-add select').first().selectOption('passage');
  await pg.locator('.st-add select').nth(1).selectOption('joh');
  const nums = pg.locator('.st-add input[type=number]');
  await nums.nth(0).fill('3'); await nums.nth(1).fill('16'); await nums.nth(2).fill('17');
  await pg.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await pg.waitForSelector('.st-passage .st-verses p', { timeout: 10000 });
  ok((await pg.locator('.st-passage .st-verses').innerText()).includes('16'), `${label}: texto da passagem na versão ativa`);
  ok(JSON.parse(await pg.evaluate(() => localStorage.getItem('studies')))[0].items.some((i) => i.k === 'ref:joh:3:16-17'), `${label}: só a referência é guardada`);
  ok(!JSON.stringify(await pg.evaluate(() => localStorage.getItem('studies'))).includes('amou'), `${label}: texto bíblico NÃO é guardado`);
  // contexto
  if (!(await pg.locator('.st-ctx').evaluate((e) => e.open))) await pg.locator('.st-ctx > summary').click(); // no celular o contexto começa recolhido
  await pg.waitForSelector('.st-ctx-body h3');
  ok((await pg.locator('.st-ctx-body').innerText()).includes('Personagens citados'), `${label}: painel Contexto`);
  ok(!(await pg.locator('.st-ctx-body').innerText()).includes('Posição acadêmica'), `${label}: sem posição acadêmica para quem não é admin`);
  ok((await pg.locator('.st-ctx-body').innerText()).includes('Pro'), `${label}: eventos mostram o convite ao Pro`);
  await shot(pg, `${label}-estudo`);
  // titulo
  await pg.getByLabel('Título do estudo').fill('Aula sobre João 3');
  await pg.waitForTimeout(900);
  await pg.goto(`${url}/#studies`); await pg.waitForSelector('.st-card');
  ok((await pg.locator('.st-card').first().innerText()).includes('Aula sobre João 3'), `${label}: lista mostra o título editado`);
  ok((await pg.locator('.st-card').first().innerText()).includes('7 itens'), `${label}: lista mostra a contagem de itens`);
  // limite do Essencial: cria até 5
  for (let i = 0; i < 4; i += 1) { await pg.getByRole('button', { name: 'Estudo de passagem' }).click(); await pg.waitForSelector('.st-items'); await pg.goto(`${url}/#studies`); await pg.waitForSelector('.st-card'); }
  ok((await pg.locator('.st-quota').innerText()).includes('5 de 5'), `${label}: 5 de 5`);
  ok(await pg.locator('.st-templates').count() === 0 && await pg.locator('.st-new').count() === 0, `${label}: no limite, criar vira convite ao Pro`);
  ok((await pg.locator('.pro-invite').count()) === 1, `${label}: ProInvite no limite`);
  await shot(pg, `${label}-limite`);
  await ctx.close();
}

{ // leitor → adicionar ao estudo
  const [ctx, pg] = await fresh({ viewport: { width: 1280, height: 900 } }, '#joh/read/3', '.vnum');
  await pg.locator('#vs-16 .vnum').click(); await pg.locator('#vs-17 .vnum').click(); await pg.locator('#vs-20 .vnum').click();
  const btn = pg.getByRole('button', { name: 'Adicionar ao estudo' }).last();
  ok(await btn.isEnabled(), 'leitor: "Adicionar ao estudo" habilitado');
  await btn.click();
  await pg.waitForSelector('dialog[open]');
  await pg.locator('dialog input[type=text]').fill('Meu estudo de João');
  await pg.getByRole('button', { name: 'Criar e adicionar' }).click();
  ok((await pg.locator('dialog[role=status], dialog [role=status]').innerText()).includes('2 itens adicionados'), 'leitor: confirma 2 itens (16-17 e 20)');
  await shot(pg, 'leitor-adicionado');
  await pg.getByRole('link', { name: 'Abrir o estudo' }).click();
  await pg.waitForSelector('.st-items');
  ok(await pg.locator('.st-passage').count() === 2, 'leitor: o estudo tem as duas passagens');
  // offline: edita sem rede
  await ctx.setOffline(true);
  await pg.getByRole('button', { name: 'Adicionar nota' }).first().click();
  ok(await pg.locator('.st-item').count() === 3, 'offline: nota adicionada');
  await ctx.setOffline(false);
  await ctx.close();
}
{ // PR A: notas formatadas e "Ir ao texto"
  const [ctx, pg] = await fresh({ viewport: { width: 1280, height: 900 } }, '#studies', '.st-tpl');
  await pg.getByRole('button', { name: '+ Novo estudo' }).click(); await pg.locator('.st-form input').fill('Teste PR A'); await pg.getByRole('button', { name: 'Criar estudo' }).click();
  await pg.waitForSelector('.st-addbar');
  ok(await pg.locator('.st-addbar').count() === 2, 'dois conjuntos de botões (cabeçalho e rodapé da lista)');
  ok(await pg.getByRole('button', { name: 'Adicionar nota' }).count() === 2 && await pg.getByRole('button', { name: 'Adicionar item' }).count() === 2, 'botões "Adicionar item" e "Adicionar nota" distintos');
  await pg.getByRole('button', { name: 'Adicionar nota' }).first().click();
  const ta = pg.locator('.rt-editor textarea');
  await ta.fill('# Título\nolá mundo\n<b>cru</b>');
  await ta.evaluate((e) => { e.focus(); e.setSelectionRange(13, 18); });
  await pg.getByRole('button', { name: /^Negrito/ }).click();
  ok((await ta.inputValue()).includes('olá **mundo**'), 'botão N aplica negrito à seleção');
  await ta.evaluate((e) => { e.focus(); e.setSelectionRange(e.value.length, e.value.length); });
  const before = (await ta.inputValue()).length;
  await pg.keyboard.press('Control+i');
  ok((await ta.inputValue()).length === before + 2, 'Ctrl+I insere o par de itálico');
  ok(await pg.getByRole('button', { name: 'Título 1' }).evaluate((e) => e.getBoundingClientRect().height >= 44), 'botões da barra com 44px');
  await pg.getByRole('tab', { name: 'Pré-visualizar' }).click();
  ok(await pg.locator('.rt-preview h4').count() === 1 && await pg.locator('.rt-preview strong').count() >= 1, 'pré-visualização: título e negrito');
  ok(await pg.locator('.rt-preview b').count() === 0 && (await pg.locator('.rt-preview').innerText()).includes('<b>cru</b>'), 'HTML cru aparece como texto');
  await pg.waitForTimeout(900);
  // "Ir ao texto"
  await pg.getByRole('button', { name: 'Adicionar item' }).first().click();
  await pg.getByRole('button', { name: 'Ir ao texto' }).click();
  await pg.waitForSelector('.add-banner');
  ok((await pg.locator('.add-banner').innerText()).includes('Teste PR A'), 'faixa "Adicionando a: Teste PR A"');
  const box = await pg.locator('#vs-3').boundingBox();
  await pg.locator('#vs-3').click({ position: { x: Math.min(100, box.width - 6), y: 10 } });
  await pg.locator('#vs-4 .vnum').click();
  await pg.getByRole('button', { name: 'Adicionar ao estudo' }).last().click();
  await pg.waitForSelector('.st-items');
  ok(await pg.locator('.st-passage').count() === 1 && (await pg.locator('.st-passage').innerText()).includes('1.3-4'), 'a barra adicionou direto ao estudo e voltou a ele, sem perguntar');
  ok(await pg.evaluate(() => sessionStorage.getItem('studyAddTarget')) === null, 'o destino foi limpo');
  await pg.goto(`${url}/#gen/read/1`); await pg.waitForSelector('.vnum');
  ok(await pg.locator('.add-banner').count() === 0, 'sem destino, o leitor não tem a faixa');
  await ctx.close();
}

await b.close();
if (failed) { console.error(`\n${failed} verificação(ões) falharam.`); process.exit(1); }
console.log('\nOK: Meus Estudos no navegador.');
