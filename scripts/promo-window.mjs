// Diz se a landing precisa ser reconstruída por causa do fim do preço de lançamento (src/data/plans.json → promoEndsAt).
// A landing é estática e escolhe o preço (lançamento ou normal) na hora do build; sem um novo build ela continuaria
// mostrando o preço de lançamento depois do prazo. O workflow agendado usa esta saída para chamar o deploy hook do Cloudflare.
// Janela: do fim da promoção até 3 dias depois (cobre falha de um dia). Fora dela, nada a fazer. Se o André prorrogar a data,
// a janela anda junto. Sem rede, sem dependências.
//   node scripts/promo-window.mjs            → imprime "rebuild=true" ou "rebuild=false"
//   node scripts/promo-window.mjs --now=ISO  → simula a data (testes)
import fs from 'node:fs';
import path from 'node:path';

export const WINDOW_DAYS = 3;
export function needsRebuild(promoEndsAt, now = new Date()) {
  const end = Date.parse(promoEndsAt);
  if (Number.isNaN(end)) throw new Error(`promoEndsAt inválido: ${promoEndsAt}`);
  const t = new Date(now).getTime();
  return t > end && t <= end + WINDOW_DAYS * 24 * 3600 * 1000;
}

if (process.argv[1]?.endsWith('promo-window.mjs')) {
  const root = path.resolve(import.meta.dirname, '..');
  const { promoEndsAt } = JSON.parse(fs.readFileSync(path.join(root, 'src/data/plans.json'), 'utf8'));
  const arg = process.argv.find((a) => a.startsWith('--now='));
  console.log(`rebuild=${needsRebuild(promoEndsAt, arg ? new Date(arg.slice(6)) : new Date())}`);
}
