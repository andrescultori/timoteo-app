-- Timóteo App: política de preços de 13/10/2026. Pro (e, no futuro, Premium) em dois períodos: mensal (1 mês, pagamento avulso) e anual (12 meses).
-- O preço (lançamento ou normal) é decidido pelo servidor, pela data da compra (supabase/functions/_shared/pricing.js); não há mais "preço de
-- entrada no 1º pagamento do usuário". Aplique DEPOIS da 20261016 e ANTES de publicar a nova create-checkout. NÃO é aplicada pelo repositório.
--   1. payments.months: quanto este pagamento concede (1 ou 12). Linhas antigas ficam com 12, o que reproduz o comportamento anterior.
--   2. price_kind mantém os valores 'entrada' e 'cheio' (CHECK intacto): agora significam "preço de lançamento" e "preço normal".
--   3. apply_payment (a da 20261016) com 3 mudanças: concede r.months (antes 12 fixo); some o bloco "duplicate_entry" (a regra do 1º pagamento
--      acabou: dois checkouts pagos do mesmo período somam, como renovação; o mesmo checkout pago duas vezes segue como duplicate_payment, 0 meses);
--      deixa de ler e de gravar entitlements.usou_preco_de_entrada (a coluna e seus dados ficam como estão).
-- Aditiva e idempotente (add column if not exists, create or replace).

alter table public.payments
  add column if not exists months integer not null default 12 check (months in (1, 12));
comment on column public.payments.months is 'Meses que este pagamento concede: 1 (mensal avulso) ou 12 (anual). Definido pelo servidor em create-checkout.';
comment on column public.entitlements.usou_preco_de_entrada is 'Sem uso desde 20261017000000 (a regra do 1º pagamento acabou); a coluna e os dados ficam.';

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
  v_already boolean := false;
  v_kept boolean := false;
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

    v_active := e.plan <> 'essencial' and (e.expires_at is null or e.expires_at > v_now);
    if v_active and (e.expires_at is null or e.plan = 'premium') then
      -- direito já vigente sem prazo (concessão manual) ou Premium: não mexe no plano nem no prazo
      v_months := 0;
      v_already := true;
    else
      v_months := r.months; -- 1 (mensal) ou 12 (anual), definido pelo servidor ao criar o checkout
      v_new := public.payment_extend_expiry(case when v_active then e.expires_at end, v_now, v_months);
      update public.entitlements
        set plan = 'pro',
            expires_at = v_new,
            starts_at = case when v_active then e.starts_at else v_now end,
            updated_by = null, -- o direito passa a vir do pagamento (e não de uma edição manual do admin)
            note = null
        where user_id = r.user_id;
    end if;

    update public.payments
      set status = 'approved', mp_payment_id = p_mp_payment_id, approved_at = v_now, months_granted = v_months
      where id = r.id;
    if v_already then
      -- o pagamento entrou, mas o usuário já tinha direito sem prazo (cortesia) ou Premium: 0 meses, plano intacto. Reembolsar à mão.
      return jsonb_build_object('result', 'already_active', 'months', 0);
    end if;
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
  if found and r.months_granted > 0 and e.expires_at is not null and e.updated_by is not null then
    -- o admin editou o plano à mão depois do pagamento (cortesia): o reembolso NÃO mexe no plano nem no prazo; decidir à mão
    v_kept := true;
  elsif found and r.months_granted > 0 and e.expires_at is not null then
    v_new := public.payment_reverse_expiry(e.expires_at, r.months_granted);
    if v_new <= v_now then
      update public.entitlements set plan = 'essencial', expires_at = null where user_id = r.user_id;
    else
      update public.entitlements set expires_at = v_new where user_id = r.user_id;
    end if;
  end if;
  return jsonb_build_object('result', case when v_kept then 'reversed_manual_kept' else 'reversed' end, 'status', p_status, 'months', r.months_granted);
end;
$$;

revoke all on function public.apply_payment(uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.apply_payment(uuid, text, text, integer) to service_role;
