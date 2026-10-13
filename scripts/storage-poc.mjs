// Prova de conceito do bucket `pro` (Fase 3B, PR 2). Roda NA MÁQUINA DO ANDRÉ, depois de aplicar a migration 20261018. Fora do CI e do build.
// Confere, contra o Supabase de verdade: (1) Pro vigente lê; (2) Essencial/vencido e deslogado NÃO leem; (3) URL assinada de quem tem direito;
// (4) se o Storage entrega o JSON comprimido (gzip/br) e quanto trafega. Sobe um arquivo de teste em `v1/_poc/` e apaga no fim.
// Tudo vem do AMBIENTE do shell (nada de segredo no repositório):
//   SUPABASE_URL=https://<ref>.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY=...      (só para subir e apagar o arquivo de teste)
//   SUPABASE_PUBLISHABLE_KEY=...       (chave publishable, pública)
//   PRO_JWT=... e ESSENCIAL_JWT=...    (OPCIONAIS: access_token de uma conta Pro vigente e de uma Essencial; no navegador logado:
//                                       localStorage `sb-<ref>-auth-token` → access_token). Sem eles, o script CRIA duas contas de teste
//                                       (poc-pro-*@example.com e poc-essencial-*@example.com), loga com elas e APAGA as duas no fim.
//   node scripts/storage-poc.mjs [arquivo.json] [--keep]
import fs from 'node:fs';

const env = (k) => { const v = process.env[k]; if (!v) { console.error(`Falta a variável de ambiente ${k} (ver o cabeçalho do script).`); process.exit(2); } return v; };
const URL_ = env('SUPABASE_URL').replace(/\/$/, '');
const SERVICE = env('SUPABASE_SERVICE_ROLE_KEY');
const PUB = env('SUPABASE_PUBLISHABLE_KEY');
const auto = !process.env.PRO_JWT || !process.env.ESSENCIAL_JWT;
const created = [];
const svc = { apikey: PUB, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' };
async function mkUser(tag, pro) {
  const email = `poc-${tag}-${Date.now()}@example.com`;
  const password = `${crypto.randomUUID()}Aa1!`;
  const r = await fetch(`${URL_}/auth/v1/admin/users`, { method: 'POST', headers: svc, body: JSON.stringify({ email, password, email_confirm: true }) });
  const u = await r.json();
  if (!r.ok || !u.id) { console.error(`não consegui criar a conta de teste (${r.status})`); process.exit(2); }
  created.push(u.id);
  if (pro) {
    const e = await fetch(`${URL_}/rest/v1/entitlements?on_conflict=user_id`, { method: 'POST', headers: { ...svc, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ user_id: u.id, plan: 'pro', expires_at: new Date(Date.now() + 10 * 864e5).toISOString() }) });
    if (!e.ok) { console.error(`não consegui dar Pro à conta de teste (${e.status})`); process.exit(2); }
  }
  const t = await fetch(`${URL_}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: PUB, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const tj = await t.json();
  if (!t.ok || !tj.access_token) { console.error(`login da conta de teste falhou (${t.status})`); process.exit(2); }
  return tj.access_token;
}
const PRO = auto ? await mkUser('pro', true) : process.env.PRO_JWT;
const ESS = auto ? await mkUser('essencial', false) : process.env.ESSENCIAL_JWT;
if (auto) console.log('     (contas de teste criadas: uma Pro vigente e uma Essencial)');
const file = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 'public/interlinear/24.json';
const keep = process.argv.includes('--keep');
const key = 'v1/_poc/sample.json';
const body = fs.readFileSync(file);
let bad = 0;
const check = (ok, msg) => { console.log(`${ok ? 'OK  ' : 'FALHA'} ${msg}`); if (!ok) bad += 1; };
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

const up = await fetch(`${URL_}/storage/v1/object/pro/${key}`, { method: 'POST', headers: { apikey: PUB, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', 'x-upsert': 'true' }, body });
check(up.ok, `upload do arquivo de teste (${file}, ${kb(body.length)}): HTTP ${up.status}`);

const get = (jwt) => fetch(`${URL_}/storage/v1/object/authenticated/pro/${key}`, { headers: { apikey: PUB, ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}), 'Accept-Encoding': 'gzip, br' } });

const rPro = await get(PRO);
const txt = await rPro.text();
check(rPro.ok, `Pro vigente lê: HTTP ${rPro.status}`);
check(rPro.ok && Buffer.byteLength(txt) === body.length, `conteúdo íntegro (${kb(Buffer.byteLength(txt))} depois de descomprimir)`);
console.log(`     content-encoding: ${rPro.headers.get('content-encoding') ?? '(nenhum)'} | content-length: ${rPro.headers.get('content-length') ?? '(ausente)'} | cache-control: ${rPro.headers.get('cache-control') ?? '-'} | cf-cache-status: ${rPro.headers.get('cf-cache-status') ?? '-'}`);
const wire = Number(rPro.headers.get('content-length'));
if (wire) console.log(`     tráfego medido: ${kb(wire)} de ${kb(body.length)} (${Math.round((wire / body.length) * 100)}%) ${rPro.headers.get('content-encoding') ? '→ o Storage comprime' : '→ SEM compressão: multiplique o egress estimado por ~4'}`);

for (const [nome, jwt] of [['Essencial (ou Pro vencido)', ESS], ['deslogado', null]]) {
  const r = await get(jwt);
  check(!r.ok && (r.status === 400 || r.status === 404 || r.status === 401 || r.status === 403), `${nome} NÃO lê: HTTP ${r.status}`);
}

const sg = await fetch(`${URL_}/storage/v1/object/sign/pro/${key}`, { method: 'POST', headers: { apikey: PUB, Authorization: `Bearer ${PRO}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 60 }) });
const sgj = await sg.json().catch(() => ({}));
check(sg.ok && sgj.signedURL, `Pro vigente gera URL assinada: HTTP ${sg.status}`);
const sgE = await fetch(`${URL_}/storage/v1/object/sign/pro/${key}`, { method: 'POST', headers: { apikey: PUB, Authorization: `Bearer ${ESS}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 60 }) });
check(!sgE.ok, `Essencial NÃO gera URL assinada: HTTP ${sgE.status}`);

if (!keep) {
  const del = await fetch(`${URL_}/storage/v1/object/pro`, { method: 'DELETE', headers: { apikey: PUB, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: [key] }) });
  check(del.ok, `arquivo de teste apagado: HTTP ${del.status}`);
}
if (auto && !keep) {
  for (const id of created) await fetch(`${URL_}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: svc });
  console.log('     (contas de teste apagadas)');
}
console.log(bad ? `\n${bad} verificação(ões) falharam: NÃO siga para o PR 3; me mande a saída.` : '\nTudo certo: o modelo B (Storage privado com política por plano) funciona.');
process.exit(bad ? 1 : 0);
