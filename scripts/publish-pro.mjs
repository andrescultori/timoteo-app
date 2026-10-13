// Publica o pacote Pro no Supabase Storage (bucket privado `pro`, prefixo v1/). Fase 3B, PR 3.
// Roda onde o André decidir (a máquina dele ou um ambiente de nuvem), NUNCA em workflow do GitHub. Lê do AMBIENTE (nada no repositório):
//   SUPABASE_URL=https://<ref>.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY=...       (só para gravar no bucket; ignora o RLS)
// Idempotente: compara o sha256 de cada arquivo com o manifest remoto e envia só o que mudou; o manifest vai por último.
//   node scripts/publish-pro.mjs --dry-run     mostra o que enviaria/apagaria, sem enviar
//   node scripts/publish-pro.mjs               publica
//   node scripts/publish-pro.mjs --no-prune    não apaga do bucket o que saiu do pacote
import path from 'node:path';
import { buildPackage, PREFIX } from './pro-lib.mjs';

const root = path.resolve(import.meta.dirname, '..');
const dry = process.argv.includes('--dry-run');
const prune = !process.argv.includes('--no-prune');
const env = (k) => { const v = process.env[k]; if (!v) { console.error(`Falta a variável de ambiente ${k} (ver o cabeçalho do script).`); process.exit(2); } return v; };
const { files, manifest } = buildPackage(root);
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
console.log(`pacote: ${files.size} arquivos, ${(manifest.totalBytes / 1048576).toFixed(1)} MB`);

if (dry && !process.env.SUPABASE_URL) { console.log('(dry-run sem SUPABASE_URL: só o pacote local; nada foi comparado com o remoto)'); process.exit(0); }
const URL_ = env('SUPABASE_URL').replace(/\/$/, '');
const KEY = env('SUPABASE_SERVICE_ROLE_KEY');
const auth = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function remoteManifest() {
  const r = await fetch(`${URL_}/storage/v1/object/authenticated/pro/${PREFIX}manifest.json`, { headers: auth });
  if (r.status === 400 || r.status === 404) return { files: {} }; // primeira publicação
  if (!r.ok) throw new Error(`manifest remoto: HTTP ${r.status}`);
  return r.json();
}
const put = async (key, buf) => {
  const r = await fetch(`${URL_}/storage/v1/object/pro/${PREFIX}${key}`, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json', 'x-upsert': 'true', 'cache-control': 'max-age=300' }, body: buf });
  if (!r.ok) throw new Error(`${key}: HTTP ${r.status} ${(await r.text()).slice(0, 120)}`);
};

const remote = await remoteManifest();
const changed = [...files.keys()].filter((k) => k !== 'manifest.json' && remote.files?.[k]?.sha256 !== manifest.files[k].sha256);
const removed = Object.keys(remote.files ?? {}).filter((k) => !(k in manifest.files));
console.log(`a enviar: ${changed.length} (${kb(changed.reduce((s, k) => s + files.get(k).length, 0))}) | a apagar: ${prune ? removed.length : `0 (${removed.length} ficam, --no-prune)`} | iguais: ${Object.keys(manifest.files).length - changed.length}`);
if (dry) { for (const k of changed.slice(0, 20)) console.log(`  + ${k}`); if (changed.length > 20) console.log(`  … e mais ${changed.length - 20}`); for (const k of removed) console.log(`  - ${k}`); process.exit(0); }

let i = 0; let bad = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (i < changed.length) {
    const k = changed[i]; i += 1;
    try { await put(k, files.get(k)); } catch (e) { bad += 1; console.error(`FALHA ${e.message}`); }
  }
}));
if (bad) { console.error(`${bad} arquivo(s) falharam: o manifest NÃO foi atualizado (rode de novo, é idempotente).`); process.exit(1); }
if (prune && removed.length) {
  const r = await fetch(`${URL_}/storage/v1/object/pro`, { method: 'DELETE', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: removed.map((k) => `${PREFIX}${k}`) }) });
  if (!r.ok) { console.error(`apagar: HTTP ${r.status}`); process.exit(1); }
}
await put('manifest.json', files.get('manifest.json'));
console.log('publicado. Rode de novo para conferir: deve dizer "a enviar: 0".');
