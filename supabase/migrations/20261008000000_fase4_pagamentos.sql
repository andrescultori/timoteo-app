-- Timóteo App, Fase 4: cobrança do plano Pro com Mercado Pago (pagamento único, 12 meses).
-- Quem grava aqui é só o servidor (Edge Functions com a service_role). O cliente (anon e authenticated) apenas LÊ os próprios pagamentos.
-- Não altera a migration da Fase 2: só acrescenta uma coluna em `entitlements`, a tabela `payments` e as funções.

-- =====================================================================================================================
-- entitlements: indicador do preço de entrada (R$29,90 só no primeiro pagamento do usuário)
-- =====================================================================================================================

alter table public.entitlements
  add column usou_preco_de_entrada boolean not null default false;
comment on column public.entitlements.usou_preco_de_entrada is 'true depois do primeiro pagamento aprovado; volta a false se o único pagamento aprovado for reembolsado. Só o servidor grava.';

-- =====================================================================================================================
-- payments: um registro por tentativa de checkout (id = external_reference enviado ao Mercado Pago)
-- =====================================================================================================================

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan text not null default 'pro' check (plan in ('pro')),
  amount_cents integer not null check (amount_cents > 0),
  price_kind text not null check (price_kind in ('entrada', 'cheio')),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'refunded', 'charged_back', 'cancelled')),
  mp_preference_id text,
  mp_payment_id text unique,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  months_granted integer not null default 0 check (months_granted >= 0)
);
comment on table public.payments is 'Pagamentos do plano Pro. id é o external_reference do Mercado Pago. Só o servidor grava.';

create index payments_user_created_idx on public.payments (user_id, created_at desc);

alter table public.payments enable row level security;

create policy payments_select_own on public.payments
  for select to authenticated
  using (user_id = (select auth.uid()));
-- Sem política de insert, update ou delete: o cliente não grava pagamento.

revoke all on public.payments from anon, authenticated;
grant select on public.payments to authenticated;
grant select, insert, update on public.payments to service_role;

-- =====================================================================================================================
-- Funções puras de data (sem acesso a tabelas; testáveis). Contas em UTC, para o resultado não depender do fuso da sessão.
-- =====================================================================================================================

-- Novo vencimento depois de um pagamento aprovado: soma `p_months` ao vencimento atual se ele ainda vale (renovação antecipada),
-- ou à data do pagamento se estiver vencido, for nulo ou o usuário nunca pagou.
create or replace function public.payment_extend_expiry(p_current timestamptz, p_now timestamptz, p_months integer)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select ((greatest(p_now, coalesce(p_current, p_now)) at time zone 'UTC') + make_interval(months => p_months)) at time zone 'UTC';
$$;

-- Vencimento depois de reembolso ou estorno: tira os meses que aquele pagamento concedeu.
create or replace function public.payment_reverse_expiry(p_current timestamptz, p_months integer)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select ((p_current at time zone 'UTC') - make_interval(months => p_months)) at time zone 'UTC';
$$;

-- =====================================================================================================================
-- apply_payment: único caminho que muda o plano por pagamento. Idempotente, sob bloqueio de linha.
--   p_status (já traduzido do Mercado Pago): pending | approved | rejected | cancelled | refunded | charged_back
--   Devolve jsonb { result, ... }. Erros (valor diferente, pagamento inexistente) viram exceção.
-- =====================================================================================================================

create or replace function public.apply_payment(
  p_payment_id uuid,
  p_mp_payment_id text,
  p_status text,
  p_amount_cents integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.payments;
  e public.entitlements;
  v_now timestamptz := now();
  v_active boolean;
  v_months integer;
  v_new timestamptz;
  v_has_other boolean;
begin
  if p_status not in ('pending', 'approved', 'rejected', 'cancelled', 'refunded', 'charged_back') then
    raise exception 'status inválido: %', p_status using errcode = '22023';
  end if;
  if p_mp_payment_id is null or char_length(p_mp_payment_id) = 0 or char_length(p_mp_payment_id) > 40 then
    raise exception 'mp_payment_id inválido' using errcode = '22023';
  end if;

  select * into r from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'pagamento inexistente' using errcode = 'P0002';
  end if;
  if p_amount_cents is distinct from r.amount_cents then
    raise exception 'valor diferente do registrado' using errcode = '22023';
  end if;

  -- Aguardando (Pix pendente, em análise): nunca libera nada.
  if p_status = 'pending' then
    return jsonb_build_object('result', 'noop', 'reason', 'pending', 'status', r.status);
  end if;

  if p_status = 'approved' then
    if r.status = 'approved' then
      if r.mp_payment_id is distinct from p_mp_payment_id then
        -- segundo pagamento aprovado no mesmo checkout (ex.: Pix pago duas vezes): não concede de novo; o André reembolsa à mão
        return jsonb_build_object('result', 'duplicate_payment', 'status', r.status);
      end if;
      return jsonb_build_object('result', 'noop', 'reason', 'already_applied', 'status', r.status);
    end if;
    if r.status in ('refunded', 'charged_back') then
      return jsonb_build_object('result', 'noop', 'reason', 'already_reversed', 'status', r.status);
    end if;

    insert into public.entitlements (user_id, plan) values (r.user_id, 'essencial') on conflict (user_id) do nothing;
    select * into e from public.entitlements where user_id = r.user_id for update;

    v_active := e.plan <> 'essencial' and (e.expires_at is null or e.expires_at > v_now);
    if v_active and (e.expires_at is null or e.plan = 'premium') then
      -- direito já vigente sem prazo (concessão manual) ou Premium: não mexe no plano nem no prazo
      v_months := 0;
      update public.entitlements set usou_preco_de_entrada = true where user_id = r.user_id;
    else
      v_months := 12;
      v_new := public.payment_extend_expiry(case when v_active then e.expires_at end, v_now, v_months);
      update public.entitlements
        set plan = 'pro',
            expires_at = v_new,
            starts_at = case when v_active then e.starts_at else v_now end,
            usou_preco_de_entrada = true
        where user_id = r.user_id;
    end if;

    update public.payments
      set status = 'approved', mp_payment_id = p_mp_payment_id, approved_at = v_now, months_granted = v_months
      where id = r.id;
    return jsonb_build_object('result', 'granted', 'months', v_months, 'expires_at', v_new);
  end if;

  if p_status in ('rejected', 'cancelled') then
    if r.status = 'pending' then
      update public.payments set status = p_status where id = r.id;
      return jsonb_build_object('result', 'updated', 'status', p_status);
    end if;
    return jsonb_build_object('result', 'noop', 'reason', 'not_pending', 'status', r.status);
  end if;

  -- refunded | charged_back: só desfaz o que este pagamento concedeu
  if r.status <> 'approved' or r.mp_payment_id is distinct from p_mp_payment_id then
    return jsonb_build_object('result', 'noop', 'reason', 'not_the_approved_payment', 'status', r.status);
  end if;

  update public.payments set status = p_status where id = r.id;
  select * into e from public.entitlements where user_id = r.user_id for update;
  if found and r.months_granted > 0 and e.expires_at is not null then
    v_new := public.payment_reverse_expiry(e.expires_at, r.months_granted);
    if v_new <= v_now then
      update public.entitlements set plan = 'essencial', expires_at = null where user_id = r.user_id;
    else
      update public.entitlements set expires_at = v_new where user_id = r.user_id;
    end if;
  end if;
  -- o preço de entrada só fica "gasto" enquanto sobrar algum pagamento aprovado
  select exists (select 1 from public.payments where user_id = r.user_id and status = 'approved' and id <> r.id) into v_has_other;
  update public.entitlements set usou_preco_de_entrada = v_has_other where user_id = r.user_id;
  return jsonb_build_object('result', 'reversed', 'status', p_status, 'months', r.months_granted);
end;
$$;

-- Só o servidor (service_role) executa. O Supabase concede execute a anon e authenticated por padrão: revogar de forma explícita.
revoke all on function public.apply_payment(uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.apply_payment(uuid, text, text, integer) to service_role;
revoke all on function public.payment_extend_expiry(timestamptz, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.payment_extend_expiry(timestamptz, timestamptz, integer) to service_role;
revoke all on function public.payment_reverse_expiry(timestamptz, integer) from public, anon, authenticated;
grant execute on function public.payment_reverse_expiry(timestamptz, integer) to service_role;
