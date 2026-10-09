-- Timóteo App, Fase 6 (ajuste): o reembolso não apaga cortesia e o pagamento que não concede nada fica visível.
-- Troca apply_payment (a da 20261010, mais três mudanças). Aplique depois de 20261015. NÃO é aplicada pelo repositório: ver supabase/README.md.
--   1. Concessão por pagamento zera entitlements.updated_by e note: daí em diante o direito "vem do pagamento".
--   2. Reembolso/estorno: se o plano foi editado à mão (updated_by preenchido) depois do pagamento, NÃO desfaz meses nem rebaixa;
--      o pagamento fica reembolsado e o resultado é 'reversed_manual_kept' (a conciliação registra "decidir à mão").
--   3. Pagamento aprovado de quem já tem direito sem prazo (cortesia) ou Premium: continua com 0 meses e plano intacto,
--      mas o resultado agora é 'already_active' (antes 'granted' com 0 meses), para o log mandar reembolsar à mão.

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
      v_already := true;
    else
      v_months := 12;
      v_new := public.payment_extend_expiry(case when v_active then e.expires_at end, v_now, v_months);
      update public.entitlements
        set plan = 'pro',
            expires_at = v_new,
            starts_at = case when v_active then e.starts_at else v_now end,
            usou_preco_de_entrada = true,
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
  -- o preço de entrada só fica "gasto" enquanto sobrar algum pagamento aprovado que concedeu meses
  select exists (select 1 from public.payments where user_id = r.user_id and status = 'approved' and months_granted > 0 and id <> r.id) into v_has_other;
  update public.entitlements set usou_preco_de_entrada = v_has_other where user_id = r.user_id;
  return jsonb_build_object('result', case when v_kept then 'reversed_manual_kept' else 'reversed' end, 'status', p_status, 'months', r.months_granted);
end;
$$;

revoke all on function public.apply_payment(uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.apply_payment(uuid, text, text, integer) to service_role;
