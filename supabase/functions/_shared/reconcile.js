// Conciliação: reconfere no Mercado Pago pagamentos que já tinham sido aplicados, pelo MESMO caminho do webhook
// (searchPayments + applyAll: a conferência de referência, valor e moeda continua valendo). Serve para o reembolso e o estorno
// não dependerem só do aviso do webhook. Sem dado pessoal no resumo nem no log (só ids de pagamento).
import { applyAll } from './payments.js';
import { json, secretMatches } from './http.js';

const CONCURRENCY = 5;

// Reconfere uma linha de `payments`. Devolve { changed, errors, notes } e já marca `reconciled_at` se a consulta funcionou.
export async function reconcileRow(row, { search, db, log = console.error }) {
  const list = await search(row.id);
  for (const mp of list) {
    // reembolso parcial: o pagamento segue `approved` e os meses não são desfeitos; o André decide à mão
    if (mp.status === 'approved' && (mp.status_detail === 'partially_refunded' || Number(mp.transaction_amount_refunded) > 0)) {
      log(`conciliação: reembolso parcial (nenhum mês desfeito; decidir à mão): payment ${row.id}, mp_id ${mp.id}, reembolsado ${mp.transaction_amount_refunded ?? '?'}`);
    }
  }
  const outs = await applyAll(list, db);
  let changed = false;
  for (const o of outs) {
    const d = o.detail?.result;
    if (o.result === 'rejected') log(`conciliação: pagamento recusado pela conferência (${o.reason}): payment ${row.id}`);
    if (d === 'reversed') log(`conciliação: ${o.status === 'charged_back' ? 'estorno' : 'reembolso'} aplicado: payment ${row.id}`);
    if (d === 'orphan') log(`conciliação: pagamento de conta excluída (órfão) ${o.status}; se foi aprovado, reembolsar à mão no Mercado Pago: payment ${row.id}`);
    if (d === 'duplicate_payment' || d === 'duplicate_entry') log(`conciliação: ${d}, reembolsar à mão: payment ${row.id}`);
    if (d && d !== 'noop') changed = true;
  }
  await db.markReconciled(row.id);
  return { changed };
}

// Reconfere várias linhas (até CONCURRENCY ao mesmo tempo). Um erro em uma linha não impede as outras.
export async function reconcileAll(rows, deps) {
  let changed = 0;
  let errors = 0;
  let i = 0;
  const worker = async () => {
    while (i < rows.length) {
      const row = rows[i];
      i += 1;
      try {
        if ((await reconcileRow(row, deps)).changed) changed += 1;
      } catch (e) {
        errors += 1;
        (deps.log ?? console.error)(`conciliação: falha ao reconferir payment ${row.id}: ${e.message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, rows.length) }, worker));
  return { read: rows.length, changed, errors };
}

// Requisição da conciliação diária. Só POST, só com o segredo compartilhado no cabeçalho `x-reconcile-secret`.
// 200 com o resumo; 500 (também com o resumo) se alguma linha falhou, para o agendamento avisar.
export async function handleReconcile(req, { secret, db, search, log = console.error, limit = 200 }) {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!(await secretMatches(req.headers.get('x-reconcile-secret'), secret))) return json({ error: 'unauthorized' }, 401);
  const rows = await db.paymentsToReconcile(limit);
  const summary = await reconcileAll(rows, { search, db, log });
  return json(summary, summary.errors ? 500 : 200);
}
