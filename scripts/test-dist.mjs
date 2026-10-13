// Testa o filtro do Pro no build (vite.config.js + scripts/check-dist.mjs): o build PADRÃO (storage) não leva o Pro ao site público, e o detector
// realmente acusa um build `local` (que leva). Faz dois builds em pasta temporária (~15 s). Roda no `npm test`.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { checkDist } from './check-dist.mjs';

const root = path.resolve(import.meta.dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-test-'));
const build = (name, env) => {
  const out = path.join(tmp, name);
  execFileSync('npx', ['vite', 'build', '--outDir', out, '--emptyOutDir'], { cwd: root, stdio: 'ignore', env: { ...process.env, ...env } });
  return out;
};
let n = 0;
try {
  const pub = build('storage', { VITE_PRO_SOURCE: '' });
  assert.deepEqual(checkDist(pub), [], 'o build padrão vazou conteúdo Pro'); n += 1;
  assert.ok(!fs.existsSync(path.join(pub, 'interlinear')), 'os originais não podem ir ao ar'); n += 1;
  assert.ok(fs.existsSync(path.join(pub, 'bible')), 'o texto bíblico continua público'); n += 1;

  const leaky = build('local', { VITE_PRO_SOURCE: 'local', ALLOW_LOCAL_PRO: '1' });
  const problems = checkDist(leaky);
  assert.ok(problems.length > 100 && problems.some((p) => p.includes('interlinear')) && problems.some((p) => p.includes('bio de')), 'o detector não acusou o build local (que leva o Pro)'); n += 1;

  assert.throws(() => execFileSync('npx', ['vite', 'build', '--outDir', path.join(tmp, 'x')], { cwd: root, stdio: 'pipe', env: { ...process.env, VITE_PRO_SOURCE: 'local', ALLOW_LOCAL_PRO: '' } }), /ALLOW_LOCAL_PRO/, 'build de produção local sem ALLOW_LOCAL_PRO deve ser recusado'); n += 1;
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(`OK: ${n} testes do filtro do Pro no build passaram.`);
