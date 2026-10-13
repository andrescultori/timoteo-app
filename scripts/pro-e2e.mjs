// Teste de ponta a ponta da origem `storage` (Fase 3B, PR 4): constrói o app com VITE_PRO_SOURCE=storage, cria contas de teste
// (Pro vigente, Pro vencido, Essencial), abre o app num navegador de verdade (Playwright) e confere o que cada uma vê e quais
// pedidos ao Storage faz. Roda ONDE HÁ REDE ATÉ O SUPABASE (a máquina do André ou a sessão de nuvem com a rede liberada). Fora do CI.
// Tudo do AMBIENTE (nada no repositório): SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY e, se o Playwright não for
// uma dependência do projeto, PLAYWRIGHT_MODULE=/caminho/playwright/index.mjs. Precisa do pacote publicado (node scripts/publish-pro.mjs).
//   node scripts/pro-e2e.mjs [--keep]   (--keep não apaga as contas de teste)
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const env = (k) => { const v = process.env[k]; if (!v) { console.error(`Falta a variável de ambiente ${k} (ver o cabeçalho do script).`); process.exit(2); } return v; };
const URL_ = env('SUPABASE_URL').replace(/\/$/, '');
const PUB = env('SUPABASE_PUBLISHABLE_KEY');
const SERVICE = env('SUPABASE_SERVICE_ROLE_KEY');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const root = path.resolve(import.meta.dirname, '..');
const keep = process.argv.includes('--keep');
const svc = { apikey: PUB, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' };
const ref = new URL(URL_).hostname.split('.')[0];

// ---- dados para as conferências ----
const people = JSON.parse(fs.readFileSync(path.join(root, 'src/data/people.json'), 'utf8')).people;
const plans = JSON.parse(fs.readFileSync(path.join(root, 'src/data/plans.json'), 'utf8'));
const proPerson = people.find((p) => !plans.essencial.characters.includes(p.id));
const bioText = (p) => (Array.isArray(p.bio?.pt) ? p.bio.pt[0] : p.bio?.pt ?? '').slice(0, 40);

// ---- build e servidor estático ----
const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'pro-e2e-'));
console.log('construindo o app com VITE_PRO_SOURCE=storage…');
execFileSync('npx', ['vite', 'build', '--outDir', dist, '--emptyOutDir'], { cwd: root, stdio: 'ignore', env: { ...process.env, VITE_PRO_SOURCE: 'storage', VITE_SUPABASE_URL: URL_, VITE_SUPABASE_PUBLISHABLE_KEY: PUB } });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  const p = path.join(dist, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  const f = fs.existsSync(p) && fs.statSync(p).isFile() ? p : path.join(dist, 'index.html');
  res.writeHead(200, { 'Content-Type': mime[path.extname(f)] ?? 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

// ---- contas de teste ----
const created = [];
async function mkUser(tag, ent) {
  const email = `e2e-${tag}-${Date.now()}@example.com`;
  const password = `${crypto.randomUUID()}Aa1!`;
  const r = await fetch(`${URL_}/auth/v1/admin/users`, { method: 'POST', headers: svc, body: JSON.stringify({ email, password, email_confirm: true }) });
  const u = await r.json();
  if (!r.ok || !u.id) throw new Error(`criar conta de teste: HTTP ${r.status}`);
  created.push(u.id);
  if (ent) {
    const e = await fetch(`${URL_}/rest/v1/entitlements?on_conflict=user_id`, { method: 'POST', headers: { ...svc, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ user_id: u.id, ...ent }) });
    if (!e.ok) throw new Error(`dar plano à conta de teste: HTTP ${e.status}`);
  }
  const t = await fetch(`${URL_}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: PUB, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const session = await t.json();
  if (!t.ok || !session.access_token) throw new Error(`login da conta de teste: HTTP ${t.status}`);
  // o aceite dos Termos (como o app faz depois do login); sem ele o app fica em modo local
  await fetch(`${URL_}/rest/v1/rpc/accept_legal`, { method: 'POST', headers: { apikey: PUB, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_version: 'e2e', p_marketing: false }) });
  return session;
}
const day = 864e5;
const users = {
  pro: await mkUser('pro', { plan: 'pro', expires_at: new Date(Date.now() + 10 * day).toISOString() }),
  vencido: await mkUser('vencido', { plan: 'pro', expires_at: new Date(Date.now() - 60e3).toISOString() }),
  essencial: await mkUser('essencial', { plan: 'essencial', expires_at: null }),
  anon: null,
};

// ---- cenários ----
let bad = 0;
const check = (ok, msg) => { console.log(`${ok ? 'OK  ' : 'FALHA'} ${msg}`); if (!ok) bad += 1; };
const browser = await chromium.launch();

async function visit(who, hash, { prefs, expect, wait = 'h1' }) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 }, locale: 'pt-BR' }); // o app escolhe o idioma pelo navegador: sem isto vem em inglês e a biografia (PT) não casa
  const s = users[who];
  await ctx.addInitScript(({ s, ref, prefs }) => {
    try {
      if (s) localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify({ access_token: s.access_token, refresh_token: s.refresh_token, token_type: 'bearer', expires_in: s.expires_in, expires_at: s.expires_at, user: s.user }));
      localStorage.setItem('lang', 'pt');
      if (prefs) localStorage.setItem('readingPrefs', JSON.stringify({ v: prefs, at: new Date().toISOString() })); // formato de src/userdata.js: { v: ajustes, at }
    } catch { /* ignora */ }
  }, { s, ref, prefs });
  const page = await ctx.newPage();
  const storage = [];
  page.on('response', (r) => { const u = r.url(); if (u.includes('/storage/v1/object/')) storage.push({ key: u.split('/pro/')[1] ?? u, status: r.status() }); });
  await page.goto(`${base}${hash}`);
  await page.waitForSelector(wait, { timeout: 20000 }).catch(() => {});
  // espera a condição esperada aparecer (arquivos grandes, como people.json com 534 KB e o interlinear, demoram pela rede/proxy); se for
  // uma conferência de AUSÊNCIA (convite ao Pro, sem pedidos), a condição também aparece rápido e o tempo extra abaixo cobre pedidos tardios
  const t0 = Date.now();
  await page.waitForFunction(expect.js ?? '0', null, { timeout: 40000, polling: 250 }).catch(() => {});
  await page.waitForTimeout(2500); // sobra para pedidos tardios ao Storage
  const found = await page.evaluate(expect.js ?? '0');
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  if (process.env.E2E_VERBOSE || !found) console.log(`     [${who} ${hash}] condição em ${secs}s; Storage: ${storage.map((x) => `${x.key}=${x.status}`).join(' ') || '(nenhum pedido)'}`);
  await ctx.close();
  return { storage, found };
}
const has = (r, key, status = 200) => r.storage.some((x) => x.key.startsWith(`v1/${key}`) && x.status === status);
const none = (r) => r.storage.length === 0;

// 1) Pro vigente
{
  const t1 = await visit('pro', '#timeline', { expect: { js: "document.querySelectorAll('.tl-period').length" } });
  check(t1.found > 0 && has(t1, 'timeline.json'), `Pro: linha do tempo carrega do Storage (períodos na tela: ${t1.found})`);
  const p1 = await visit('pro', `#person/${proPerson.id}`, { expect: { js: `document.body.innerText.includes(${JSON.stringify(bioText(proPerson))}) ? 1 : 0` } });
  check(p1.found === 1 && has(p1, 'people.json'), `Pro: personagem Pro (${proPerson.id}) mostra a biografia completa`);
  const m1 = await visit('pro', '#rom/map', { expect: { js: "document.querySelectorAll('.card svg').length" } });
  check(m1.found > 0 && has(m1, 'info/rom.json'), 'Pro: mapa de Romanos (Pro) abre com os lugares');
  const s1 = await visit('pro', '#job/structure', { expect: { js: "document.querySelectorAll('.card svg, .card .st-part, .card [class*=st-]').length" } });
  check(s1.found > 0 && has(s1, 'info/job.json'), 'Pro: estrutura de Jó abre');
  const o1 = await visit('pro', '#joh/read/1', { prefs: { originals: true }, expect: { js: "document.querySelectorAll('.ostrip').length" } });
  check(o1.found > 0 && has(o1, 'interlinear/43.json'), 'Pro: originais de João carregam do Storage');
  check(!t1.storage.some((x) => x.key.startsWith('v1/admin')) , 'Pro (não admin) nunca pede a posição acadêmica');
}
// 2) Essencial, Pro vencido e deslogado: convite ao Pro e NENHUM pedido ao Storage
for (const who of ['essencial', 'vencido', 'anon']) {
  const t = await visit(who, '#timeline', { expect: { js: "document.querySelectorAll('.pro-invite').length" } });
  check(t.found > 0 && none(t), `${who}: linha do tempo mostra o convite ao Pro e não pede nada ao Storage`);
  const p = await visit(who, `#person/${proPerson.id}`, { expect: { js: "document.querySelectorAll('.pro-invite').length" } });
  check(p.found > 0 && none(p), `${who}: personagem Pro mostra o convite e não pede nada ao Storage`);
  const m = await visit(who, '#rom/map', { expect: { js: "document.querySelectorAll('.pro-invite').length" } });
  check(m.found > 0 && none(m), `${who}: mapa Pro mostra o convite e não pede nada ao Storage`);
  const g = await visit(who, '#gen/map', { expect: { js: "document.querySelectorAll('.card svg').length" } });
  check(g.found > 0 && none(g), `${who}: mapa do Essencial (Gênesis) abre sem o Storage`);
}
await browser.close();
server.close();
if (!keep) for (const id of created) await fetch(`${URL_}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: svc });
fs.rmSync(dist, { recursive: true, force: true });
console.log(bad ? `\n${bad} verificação(ões) falharam: me mande a saída inteira.` : '\nTudo certo: a origem `storage` funciona para Pro, e Essencial, vencido e deslogado não recebem nada.');
process.exit(bad ? 1 : 0);
