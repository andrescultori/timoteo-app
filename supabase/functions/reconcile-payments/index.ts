// Conciliação diária (chamada pelo GitHub Actions; ver .github/workflows/reconcile-payments.yml e supabase/README.md).
// verify_jwt = false: a autenticação é o segredo compartilhado RECONCILE_SECRET no cabeçalho x-reconcile-secret.
// Secrets: RECONCILE_SECRET, MP_ACCESS_TOKEN. Do ambiente: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
import { json } from '../_shared/http.js';
import { createDb } from '../_shared/db.js';
import { searchPayments } from '../_shared/mp.js';
import { handleReconcile } from '../_shared/reconcile.js';

Deno.serve(async (req: Request) => {
  const secret = Deno.env.get('RECONCILE_SECRET');
  const token = Deno.env.get('MP_ACCESS_TOKEN');
  if (!secret || !token) return json({ error: 'not_configured' }, 503);
  try {
    const db = createDb({ url: Deno.env.get('SUPABASE_URL')!, serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! });
    return await handleReconcile(req, { secret, db, search: (id: string) => searchPayments(token, id) });
  } catch (e) {
    console.error('reconcile-payments:', (e as Error).message);
    return json({ error: 'internal' }, 500);
  }
});
