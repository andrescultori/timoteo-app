-- Timóteo App, Fase 6: painel de administração (só o André, por is_admin()).
-- KPIs agregados (usuários, plano, origem do Pro, sexo, faixa etária, pagamentos, lista de espera), busca de usuário,
-- mudança manual de plano (cortesia para amigos, com prazo e motivo), papéis de conteúdo (editor, revisor) e registro de quem mudou o quê.
-- Aplique depois de 20261011 a 20261014. NÃO é aplicada pelo repositório: ver supabase/README.md.
--
-- Regras:
--   - Toda função abaixo é security definer, com search_path fixo, e recusa quem não é admin (is_admin()) no começo.
--   - O cliente nunca grava user_roles, admin_audit nem entitlements: só estas funções (e o servidor, nos pagamentos).
--   - Sexo e faixa etária só saem agregados, e o gráfico some (hidden) se algum grupo tiver menos de p_min pessoas.
--   - A busca de usuário devolve nome, e-mail, plano e papéis, nunca sexo, idade ou cidade.
--   - Admin continua sendo concedido à mão (app_admins, ver supabase/README.md): não há função para isso.

-- =====================================================================================================================
-- entitlements.note: motivo da concessão manual (ex.: "cortesia, amigo"). Não coloque dado pessoal sensível aqui.
-- =====================================================================================================================

alter table public.entitlements
  add column if not exists note text check (note is null or char_length(note) <= 300);
comment on column public.entitlements.note is 'Motivo da última mudança manual de plano pelo admin. Só o admin grava (admin_set_plan).';

-- =====================================================================================================================
-- user_roles: papéis de conteúdo. O usuário lê só os próprios; quem concede e retira é o admin, por admin_set_role.
-- =====================================================================================================================

create table if not exists public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('editor', 'revisor')),
  granted_by uuid,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

alter table public.user_roles enable row level security;

drop policy if exists user_roles_select_own on public.user_roles;
create policy user_roles_select_own on public.user_roles
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.user_roles from anon, authenticated;
grant select on public.user_roles to authenticated;

-- =====================================================================================================================
-- admin_audit: quem mudou o quê e quando. Sem política: o cliente não lê nem grava (o admin lê por admin_recent_changes).
-- target_user não tem FK de propósito: o registro sobrevive à exclusão da conta, sem dado pessoal (delete_account_data limpa o detalhe).
-- =====================================================================================================================

create table if not exists public.admin_audit (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  admin_id uuid not null,
  action text not null check (action in ('set_plan', 'grant_role', 'revoke_role')),
  target_user uuid not null,
  details jsonb not null default '{}'::jsonb
);

create index if not exists admin_audit_at_idx on public.admin_audit (at desc);

alter table public.admin_audit enable row level security;
revoke all on public.admin_audit from anon, authenticated;

-- =====================================================================================================================
-- admin_kpis: números agregados para o painel.
-- =====================================================================================================================

create or replace function public.admin_kpis(p_min integer default 5)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_min integer := greatest(coalesce(p_min, 5), 2);
  v_total integer;
  v_plan jsonb;
  v_sex jsonb;
  v_age jsonb;
  v_pay jsonb;
  v_wait jsonb;
begin
  if not public.is_admin() then
    raise exception 'acesso negado' using errcode = '42501';
  end if;

  select count(*)::integer into v_total from public.profiles;

  -- plano efetivo: Pro e Premium só valem sem vencimento ou com vencimento futuro; o resto é Essencial
  with u as (
    select p.id,
           case when e.plan in ('pro', 'premium') and (e.expires_at is null or e.expires_at > now()) then e.plan else 'essencial' end as eff,
           coalesce(e.plan in ('pro', 'premium') and e.expires_at is not null and e.expires_at <= now(), false) as expired,
           exists (select 1 from public.payments y where y.user_id = p.id and y.status = 'approved') as paid
    from public.profiles p
    left join public.entitlements e on e.user_id = p.id
  )
  select jsonb_build_object(
    'essencial', count(*) filter (where eff = 'essencial'),
    'pro', count(*) filter (where eff = 'pro'),
    'premium', count(*) filter (where eff = 'premium'),
    'pro_pago', count(*) filter (where eff = 'pro' and paid),
    'pro_cortesia', count(*) filter (where eff = 'pro' and not paid),
    'premium_pago', count(*) filter (where eff = 'premium' and paid),
    'premium_cortesia', count(*) filter (where eff = 'premium' and not paid),
    'vencidos', count(*) filter (where expired)
  ) into v_plan from u;

  -- sexo e faixa etária: agregado; some inteiro se algum grupo tiver menos de v_min pessoas (ou se o total for menor que v_min)
  select case
           when v_total < v_min or count(*) = 0 or bool_or(n < v_min) then jsonb_build_object('hidden', true, 'min', v_min)
           else jsonb_build_object('hidden', false, 'min', v_min, 'items', jsonb_object_agg(k, n))
         end
    into v_sex
    from (select coalesce(sex, 'unspecified') as k, count(*)::integer as n from public.profiles group by 1) s;

  select case
           when v_total < v_min or count(*) = 0 or bool_or(n < v_min) then jsonb_build_object('hidden', true, 'min', v_min)
           else jsonb_build_object('hidden', false, 'min', v_min, 'items', jsonb_object_agg(k, n))
         end
    into v_age
    from (select coalesce(age_band, 'unspecified') as k, count(*)::integer as n from public.profiles group by 1) s;

  -- pagamentos: aprovados, pendentes (e usuários que iniciaram a compra do Pro e não pagaram), reembolsados/estornados, valor líquido
  select jsonb_build_object(
    'aprovados', count(*) filter (where status = 'approved'),
    'pendentes', count(*) filter (where status = 'pending'),
    'recusados', count(*) filter (where status in ('rejected', 'cancelled')),
    'reembolsados', count(*) filter (where status in ('refunded', 'charged_back')),
    'usuarios_iniciaram_sem_pagar', count(distinct user_id) filter (
      where status in ('pending', 'rejected', 'cancelled')
        and user_id is not null
        and not exists (select 1 from public.payments o where o.user_id = payments.user_id and o.status = 'approved')),
    'aprovado_centavos', coalesce(sum(amount_cents) filter (where status = 'approved'), 0)
  ) into v_pay from public.payments;

  select coalesce(jsonb_object_agg(feature, n), '{}'::jsonb)
    into v_wait
    from (select feature, count(*)::integer as n from public.waitlist group by 1) w;

  return jsonb_build_object(
    'generated_at', now(),
    'total_users', v_total,
    'new_7d', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'new_30d', (select count(*) from public.profiles where created_at > now() - interval '30 days'),
    'marketing_consent', (select count(*) from public.profiles where marketing_consent),
    'plan', v_plan,
    'sex', v_sex,
    'age', v_age,
    'payments', v_pay,
    'waitlist', v_wait,
    'roles', (select coalesce(jsonb_object_agg(role, n), '{}'::jsonb) from (select role, count(*)::integer as n from public.user_roles group by 1) r)
  );
end;
$$;

revoke all on function public.admin_kpis(integer) from public, anon;
grant execute on function public.admin_kpis(integer) to authenticated;

-- =====================================================================================================================
-- admin_search_users: busca por e-mail ou nome (vazio = os mais recentes). Nunca devolve sexo, idade ou cidade.
-- =====================================================================================================================

create or replace function public.admin_search_users(p_query text default '', p_limit integer default 20, p_offset integer default 0)
returns table (
  id uuid,
  email text,
  name text,
  plan text,
  effective_plan text,
  expires_at timestamptz,
  note text,
  roles text[],
  is_admin boolean,
  has_paid boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_q text := pg_catalog.btrim(coalesce(p_query, ''));
  v_like text;
begin
  if not public.is_admin() then
    raise exception 'acesso negado' using errcode = '42501';
  end if;

  v_like := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  return query
  select p.id,
         p.email,
         p.name,
         coalesce(e.plan, 'essencial'),
         case when e.plan in ('pro', 'premium') and (e.expires_at is null or e.expires_at > now()) then e.plan else 'essencial' end,
         e.expires_at,
         e.note,
         coalesce((select array_agg(r.role order by r.role) from public.user_roles r where r.user_id = p.id), '{}'::text[]),
         exists (select 1 from public.app_admins a where a.user_id = p.id),
         exists (select 1 from public.payments y where y.user_id = p.id and y.status = 'approved'),
         p.created_at
  from public.profiles p
  left join public.entitlements e on e.user_id = p.id
  where v_q = '' or p.email ilike v_like or p.name ilike v_like
  order by p.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke all on function public.admin_search_users(text, integer, integer) from public, anon;
grant execute on function public.admin_search_users(text, integer, integer) to authenticated;

-- =====================================================================================================================
-- admin_set_plan: define o plano de um usuário à mão (cortesia). Essencial zera o prazo. Pro/Premium: sem prazo (null) ou data futura.
-- Não mexe em usou_preco_de_entrada nem em pagamentos. Registra no admin_audit.
-- =====================================================================================================================

create or replace function public.admin_set_plan(p_user uuid, p_plan text, p_expires_at timestamptz default null, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_exp timestamptz;
  v_old_plan text;
  v_old_exp timestamptz;
  v_note text := nullif(pg_catalog.btrim(coalesce(p_note, '')), '');
begin
  if not public.is_admin() then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  if p_user is null or not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'usuário não encontrado' using errcode = '22023';
  end if;
  if p_plan is null or p_plan not in ('essencial', 'pro', 'premium') then
    raise exception 'plano inválido' using errcode = '22023';
  end if;
  if v_note is not null and char_length(v_note) > 300 then
    raise exception 'motivo longo demais (máximo 300 caracteres)' using errcode = '22023';
  end if;

  if p_plan = 'essencial' then
    v_exp := null;
  else
    v_exp := p_expires_at;
    if v_exp is not null and v_exp <= now() then
      raise exception 'o vencimento precisa ser uma data futura' using errcode = '22023';
    end if;
  end if;

  select plan, expires_at into v_old_plan, v_old_exp from public.entitlements where user_id = p_user for update;

  insert into public.entitlements (user_id, plan, starts_at, expires_at, updated_by, note)
  values (p_user, p_plan, now(), v_exp, (select auth.uid()), v_note)
  on conflict (user_id) do update
    set plan = excluded.plan,
        starts_at = case when public.entitlements.plan = excluded.plan then public.entitlements.starts_at else now() end,
        expires_at = excluded.expires_at,
        updated_by = excluded.updated_by,
        note = excluded.note;

  insert into public.admin_audit (admin_id, action, target_user, details)
  values ((select auth.uid()), 'set_plan', p_user, jsonb_build_object(
    'from_plan', v_old_plan, 'from_expires_at', v_old_exp, 'to_plan', p_plan, 'to_expires_at', v_exp, 'note', v_note));

  return jsonb_build_object('plan', p_plan, 'expires_at', v_exp);
end;
$$;

revoke all on function public.admin_set_plan(uuid, text, timestamptz, text) from public, anon;
grant execute on function public.admin_set_plan(uuid, text, timestamptz, text) to authenticated;

-- =====================================================================================================================
-- admin_set_role: concede ou retira o papel editor/revisor. (Admin não passa por aqui: é manual, em app_admins.)
-- =====================================================================================================================

create or replace function public.admin_set_role(p_user uuid, p_role text, p_grant boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changed integer;
begin
  if not public.is_admin() then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  if p_user is null or not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'usuário não encontrado' using errcode = '22023';
  end if;
  if p_role is null or p_role not in ('editor', 'revisor') then
    raise exception 'papel inválido' using errcode = '22023';
  end if;

  if coalesce(p_grant, false) then
    insert into public.user_roles (user_id, role, granted_by) values (p_user, p_role, (select auth.uid()))
    on conflict (user_id, role) do nothing;
  else
    delete from public.user_roles where user_id = p_user and role = p_role;
  end if;
  get diagnostics v_changed = row_count;

  if v_changed > 0 then
    insert into public.admin_audit (admin_id, action, target_user, details)
    values ((select auth.uid()), case when coalesce(p_grant, false) then 'grant_role' else 'revoke_role' end, p_user, jsonb_build_object('role', p_role));
  end if;

  return jsonb_build_object('role', p_role, 'granted', coalesce(p_grant, false), 'changed', v_changed > 0);
end;
$$;

revoke all on function public.admin_set_role(uuid, text, boolean) from public, anon;
grant execute on function public.admin_set_role(uuid, text, boolean) to authenticated;

-- =====================================================================================================================
-- admin_recent_changes: as últimas mudanças feitas pelo painel (quem, em quem, o quê, quando).
-- =====================================================================================================================

create or replace function public.admin_recent_changes(p_limit integer default 30)
returns table (
  at timestamptz,
  action text,
  admin_email text,
  target_email text,
  details jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'acesso negado' using errcode = '42501';
  end if;

  return query
  select a.at, a.action, pa.email, pt.email, a.details
  from public.admin_audit a
  left join public.profiles pa on pa.id = a.admin_id
  left join public.profiles pt on pt.id = a.target_user
  order by a.at desc, a.id desc
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
end;
$$;

revoke all on function public.admin_recent_changes(integer) from public, anon;
grant execute on function public.admin_recent_changes(integer) to authenticated;

-- =====================================================================================================================
-- Exclusão de conta: igual à da 20261011, mais user_roles e a limpeza do detalhe do registro de auditoria (fica só o rastro sem dado).
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
  delete from public.reading_prefs where user_id = p_user_id;
  delete from public.user_roles where user_id = p_user_id;
  update public.admin_audit set details = '{}'::jsonb where target_user = p_user_id;
  delete from public.waitlist where user_id = p_user_id;
  delete from public.entitlements where user_id = p_user_id;
  delete from public.app_admins where user_id = p_user_id;
  delete from public.profiles where id = p_user_id;

  return jsonb_build_object('deleted_payments', v_del, 'anonymized_payments', v_anon);
end;
$$;

revoke all on function public.delete_account_data(uuid) from public, anon, authenticated;
grant execute on function public.delete_account_data(uuid) to service_role;
