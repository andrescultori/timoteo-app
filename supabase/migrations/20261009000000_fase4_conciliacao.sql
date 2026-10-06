-- Timóteo App, Fase 4 (conciliação): reembolso e estorno não podem depender só do webhook.
-- Acrescenta `payments.reconciled_at` e duas funções de seleção usadas pelas Edge Functions `reconcile-payments` (diária) e
-- `verify-payment` (por usuário). Não altera `apply_payment` nem as migrations anteriores.

alter table public.payments add column reconciled_at timestamptz;
comment on column public.payments.reconciled_at is 'Última vez em que a conciliação reconferiu este pagamento no Mercado Pago. Só o servidor grava.';

create index payments_reconcile_idx on public.payments (reconciled_at asc nulls first, created_at)
  where status in ('approved', 'pending');

-- Pagamentos que a conciliação diária deve reconferir: aprovados nos últimos 45 dias (podem ser reembolsados ou estornados)
-- e pendentes dos últimos 3 dias (Pix que pode ter sido pago). Os reconferidos há mais tempo primeiro (os nunca reconferidos vêm antes).
-- O teto de 200 por execução vale mesmo que o chamador peça mais.
create or replace function public.payments_to_reconcile(p_limit integer default 200)
returns setof public.payments
language sql
stable
security definer
set search_path = ''
as $$
  select p.*
  from public.payments p
  where (p.status = 'approved' and p.approved_at >= now() - interval '45 days')
     or (p.status = 'pending' and p.created_at >= now() - interval '3 days')
  order by p.reconciled_at asc nulls first, p.created_at asc
  limit least(greatest(coalesce(p_limit, 200), 1), 200);
$$;

-- Pagamentos de UM usuário que o verify-payment deve reconferir: os em aberto dos últimos 3 dias (pendentes, recusados,
-- cancelados) e os aprovados nos últimos 45 dias. No máximo 10, os mais recentes primeiro.
create or replace function public.user_payments_to_verify(p_user_id uuid)
returns setof public.payments
language sql
stable
security definer
set search_path = ''
as $$
  select p.*
  from public.payments p
  where p.user_id = p_user_id
    and ((p.status in ('pending', 'rejected', 'cancelled') and p.created_at >= now() - interval '3 days')
      or (p.status = 'approved' and p.approved_at >= now() - interval '45 days'))
  order by p.created_at desc
  limit 10;
$$;

-- Só o servidor (service_role) executa.
revoke all on function public.payments_to_reconcile(integer) from public, anon, authenticated;
grant execute on function public.payments_to_reconcile(integer) to service_role;
revoke all on function public.user_payments_to_verify(uuid) from public, anon, authenticated;
grant execute on function public.user_payments_to_verify(uuid) to service_role;
