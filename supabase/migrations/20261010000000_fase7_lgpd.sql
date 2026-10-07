-- Timóteo App, Fase 7 (LGPD): aceite dos Termos e consentimento sensível, exclusão de conta e pagamentos que sobrevivem à conta.
-- Idempotente (pode rodar de novo sem erro). Não altera migrations anteriores: redefine `apply_payment` (create or replace) e muda
-- a FK de `payments.user_id`. O cliente (anon, authenticated) NÃO grava as colunas de aceite diretamente: só a RPC `accept_legal`.

-- =====================================================================================================================
-- profiles: registro do aceite (a data é do servidor)
-- =====================================================================================================================

alter table public.profiles
  add column if not exists terms_version text check (terms_version is null or char_length(terms_version) <= 40),
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists sensitive_consent_at timestamptz,
  add column if not exists sensitive_consent_version text check (sensitive_consent_version is null or char_length(sensitive_consent_version) <= 40);
comment on column public.profiles.terms_accepted_at is 'Aceite dos Termos e da Política (18+). Gravado só por accept_legal.';
comment on column public.profiles.sensitive_consent_at is 'Consentimento específico para dado sensível (convicção religiosa: favoritos, posição de leitura). Gravado só por accept_legal.';
-- (o `grant update (...)` da Fase 2 lista colunas: as novas NÃO entram, então o cliente não consegue gravá-las)

-- Aceita os Termos e a Política e consente com o tratamento do dado sensível; opcionalmente liga/desliga as novidades.
-- O trigger profiles_consent_stamp (Fase 2) carimba marketing_consent_at quando marketing_consent muda.
create or replace function public.accept_legal(p_version text, p_marketing boolean default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'não autenticado' using errcode = '28000';
  end if;
  if p_version is null or btrim(p_version) = '' or char_length(p_version) > 40 then
    raise exception 'versão inválida' using errcode = '22023';
  end if;
  update public.profiles
    set terms_version = p_version,
        terms_accepted_at = now(),
        sensitive_consent_at = now(),
        sensitive_consent_version = p_version,
        marketing_consent = coalesce(p_marketing, marketing_consent)
    where id = v_uid;
  if not found then
    raise exception 'perfil inexistente' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.accept_legal(text, boolean) from public, anon;
grant execute on function public.accept_legal(text, boolean) to authenticated;

-- =====================================================================================================================
-- payments sobrevivem à exclusão da conta (obrigação fiscal): user_id nulo e FK on delete set null
-- =====================================================================================================================

alter table public.payments alter column user_id drop not null;
alter table public.payments drop constraint if exists payments_user_id_fkey;
alter table public.payments
  add constraint payments_user_id_fkey foreign key (user_id) references auth.users (id) on delete set null;
-- RLS: a política `payments_select_own` (user_id = auth.uid()) nunca casa com user_id nulo, então o pagamento órfão só é visível ao service_role.

-- apply_payment: igual à da Fase 4, mais o ramo do pagamento órfão (user_id nulo): atualiza só o pagamento, nunca entitlements.
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

  -- Pagamento órfão (a conta foi excluída: user_id nulo). O dinheiro e o status ficam registrados para a conciliação fiscal,
  -- mas nenhum plano de ninguém é tocado. Aprovado depois da exclusão (ex.: Pix pago tarde) entra aqui: reembolsar à mão.
  if r.user_id is null then
    if p_status = 'approved' then
      if r.status = 'approved' then
        return jsonb_build_object('result', 'noop', 'reason', 'already_applied', 'status', r.status);
      end if;
      if r.status in ('refunded', 'charged_back') then
        return jsonb_build_object('result', 'noop', 'reason', 'already_reversed', 'status', r.status);
      end if;
      update public.payments
        set status = 'approved', mp_payment_id = p_mp_payment_id, approved_at = now(), months_granted = 0
        where id = r.id;
      return jsonb_build_object('result', 'orphan', 'status', 'approved');
    end if;
    if p_status in ('rejected', 'cancelled') then
      if r.status = 'pending' then
        update public.payments set status = p_status where id = r.id;
        return jsonb_build_object('result', 'orphan', 'status', p_status);
      end if;
      return jsonb_build_object('result', 'noop', 'reason', 'not_pending', 'status', r.status);
    end if;
    -- refunded | charged_back
    if r.status <> 'approved' or r.mp_payment_id is distinct from p_mp_payment_id then
      return jsonb_build_object('result', 'noop', 'reason', 'not_the_approved_payment', 'status', r.status);
    end if;
    update public.payments set status = p_status where id = r.id;
    return jsonb_build_object('result', 'orphan', 'status', p_status);
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

    -- Preço de entrada pago duas vezes (dois checkouts abertos, ou abuso): o dinheiro entrou e fica registrado, mas não concede meses.
    -- A checagem vem DEPOIS do bloqueio de `entitlements`: duas aprovações simultâneas do mesmo usuário são serializadas ali,
    -- e a segunda enxerga a primeira já gravada. Só conta como "outro" um pagamento de entrada que de fato concedeu meses
    -- (assim, depois de reembolsar o primeiro, uma nova compra a preço de entrada volta a valer).
    if r.price_kind = 'entrada' and exists (
      select 1 from public.payments
      where user_id = r.user_id and id <> r.id and status = 'approved' and price_kind = 'entrada' and months_granted > 0
    ) then
      update public.payments
        set status = 'approved', mp_payment_id = p_mp_payment_id, approved_at = v_now, months_granted = 0
        where id = r.id;
      return jsonb_build_object('result', 'duplicate_entry', 'months', 0);
    end if;

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
  -- o preço de entrada só fica "gasto" enquanto sobrar algum pagamento aprovado que concedeu meses
  select exists (select 1 from public.payments where user_id = r.user_id and status = 'approved' and months_granted > 0 and id <> r.id) into v_has_other;
  update public.entitlements set usou_preco_de_entrada = v_has_other where user_id = r.user_id;
  return jsonb_build_object('result', 'reversed', 'status', p_status, 'months', r.months_granted);
end;
$$;

revoke all on function public.apply_payment(uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.apply_payment(uuid, text, text, integer) to service_role;

-- =====================================================================================================================
-- Exclusão de conta: apaga os dados pessoais e anonimiza os pagamentos. Só service_role (chamada pela Edge Function delete-account).
--   - apaga favorites, reading_position, waitlist, entitlements, profiles e a linha de app_admins do usuário;
--   - apaga pagamentos rejeitados e cancelados dele (nada foi cobrado);
--   - ANONIMIZA (user_id = null) os demais: aprovados, reembolsados, estornados e também os PENDENTES (um Pix pago depois da
--     exclusão vira pagamento órfão, em vez de dinheiro sem rastro; reembolsar à mão no Mercado Pago);
--   - recusa se o usuário for o único admin. Idempotente.
-- O usuário em auth.users é apagado depois, pela Edge Function (Auth Admin API).
-- =====================================================================================================================

create or replace function public.delete_account_data(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_anon integer;
  v_del integer;
begin
  if p_user_id is null then
    raise exception 'usuário inválido' using errcode = '22023';
  end if;
  if exists (select 1 from public.app_admins where user_id = p_user_id)
     and (select count(*) from public.app_admins) = 1 then
    raise exception 'último administrador' using errcode = 'P0001';
  end if;

  delete from public.payments where user_id = p_user_id and status in ('rejected', 'cancelled');
  get diagnostics v_del = row_count;
  update public.payments set user_id = null where user_id = p_user_id;
  get diagnostics v_anon = row_count;

  delete from public.favorites where user_id = p_user_id;
  delete from public.reading_position where user_id = p_user_id;
  delete from public.waitlist where user_id = p_user_id;
  delete from public.entitlements where user_id = p_user_id;
  delete from public.app_admins where user_id = p_user_id;
  delete from public.profiles where id = p_user_id;

  return jsonb_build_object('deleted_payments', v_del, 'anonymized_payments', v_anon);
end;
$$;

revoke all on function public.delete_account_data(uuid) from public, anon, authenticated;
grant execute on function public.delete_account_data(uuid) to service_role;
