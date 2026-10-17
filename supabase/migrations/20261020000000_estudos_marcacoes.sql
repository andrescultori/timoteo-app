-- Timóteo App, preparação de estudos (PR 1 do roadmap docs/roadmap-estudos.md): marcações de versículos, categorias e "Meus Estudos".
-- NÃO é aplicada pelo repositório: ver supabase/README.md. O André revisa e aplica.
--
-- O que faz:
--   1. app_limits: limites ajustáveis sem nova migration (só SQL Editor / service_role; o app não lê nem grava). Valores: 10000 marcações por
--      usuário, 5 estudos no Essencial, teto técnico de 200 estudos.
--   2. is_pro_active(uuid): a MESMA regra de can_read_pro() (admin, ou Pro/Premium vigente: expires_at nulo ou futuro), mas recebendo o id.
--      can_read_pro() usa auth.uid() e por isso não serve a inserções feitas pelo service_role; ela NÃO é alterada aqui.
--   3. study_categories_valid / study_items_valid: validação do JSON no banco (mesmo padrão de reading_prefs_valid).
--   4. verse_marks (uma linha por versículo marcado), study_settings (categorias: id c1..c6 e nome; a cor vem do app) e studies (itens em jsonb,
--      na ordem do array; só referências, nunca o texto bíblico). RLS "só o dono", sem acesso do anon.
--   5. Gatilhos de limite: marcações (10000) e estudos (Essencial 5, teto 200; só INSERT conta, então quem cai de Pro para Essencial continua
--      lendo, editando e apagando). Também limitam updated_at a now() (a data vem do cliente e decide "o mais recente vence").
--   6. delete_account_data: igual à de 20261015000000_fase6_admin.sql, mais as 3 tabelas novas (sem isso a exclusão de conta ficaria furada).
-- Pode ser reaplicada sem erro (create if not exists, drop policy/trigger if exists, create or replace).
-- Reverter: drop das 3 tabelas e das funções novas; recriar delete_account_data a partir de 20261015000000_fase6_admin.sql.

-- =====================================================================================================================
-- Limites e plano
-- =====================================================================================================================

create table if not exists public.app_limits (
  key text primary key,
  value integer not null check (value > 0)
);
alter table public.app_limits enable row level security;
revoke all on public.app_limits from anon, authenticated;

insert into public.app_limits (key, value) values
  ('verse_marks_max', 10000),
  ('studies_essencial_max', 5),
  ('studies_max', 200)
on conflict (key) do nothing;

create or replace function public.app_limit(p_key text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select value from public.app_limits where key = p_key;
$$;
revoke all on function public.app_limit(text) from public, anon, authenticated;

create or replace function public.is_pro_active(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.app_admins where user_id = p_user)
      or exists (
        select 1 from public.entitlements e
        where e.user_id = p_user
          and e.plan in ('pro', 'premium')
          and (e.expires_at is null or e.expires_at > now())
      );
$$;
revoke all on function public.is_pro_active(uuid) from public, anon, authenticated;
grant execute on function public.is_pro_active(uuid) to service_role;
comment on function public.is_pro_active(uuid) is 'Mesma regra de can_read_pro(), por id: admin, ou Pro/Premium vigente (vencido = Essencial).';

-- =====================================================================================================================
-- Validação do JSON (o cliente aceita exatamente o mesmo: src/marksCore.js e src/studiesCore.js; os testes conferem os dois lados)
-- =====================================================================================================================

create or replace function public.study_categories_valid(c jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case when pg_catalog.jsonb_typeof(c) <> 'array' then false else (
    pg_catalog.jsonb_array_length(c) <= 6
    and pg_catalog.length(c::text) <= 600
    and not exists (
      select 1 from pg_catalog.jsonb_array_elements(c) e
      where case when pg_catalog.jsonb_typeof(e) <> 'object' then true else (
        exists (select 1 from pg_catalog.jsonb_object_keys(e) k where k not in ('id', 'name'))
        or (e ->> 'id') is null
        or (e ->> 'id') not in ('c1', 'c2', 'c3', 'c4', 'c5', 'c6')
        or coalesce(pg_catalog.jsonb_typeof(e -> 'name'), '') <> 'string'
        or pg_catalog.char_length(e ->> 'name') not between 1 and 30
      ) end
    )
    and (select count(distinct e ->> 'id') from pg_catalog.jsonb_array_elements(c) e) = pg_catalog.jsonb_array_length(c)
  ) end;
$$;

create or replace function public.study_items_valid(p jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case when pg_catalog.jsonb_typeof(p) <> 'array' then false else (
    pg_catalog.jsonb_array_length(p) <= 100
    and pg_catalog.length(p::text) <= 100000
    and not exists (
      select 1 from pg_catalog.jsonb_array_elements(p) e
      where case when pg_catalog.jsonb_typeof(e) <> 'object' then true else (
        exists (select 1 from pg_catalog.jsonb_object_keys(e) k where k not in ('k', 'note'))
        or coalesce(pg_catalog.jsonb_typeof(e -> 'k'), '') <> 'string'
        or (e ->> 'k') !~ '^(ref:[a-z0-9]{3}:[0-9]{1,3}:[0-9]{1,3}(-[0-9]{1,3})?|book:[a-z0-9]{3}|chapter:[a-z0-9]{3}:[0-9]{1,3}|verse:[a-z0-9]{3}:[0-9]{1,3}:[0-9]{1,3}|person:[a-z0-9-]{1,60}|event:[a-z0-9-]{1,60}|place:[a-z0-9]{3}:.{1,80}|block:[a-z0-9-]{1,30})$'
        or (e ? 'note' and (pg_catalog.jsonb_typeof(e -> 'note') <> 'string' or pg_catalog.char_length(e ->> 'note') > 2000))
      ) end
    )
  ) end;
$$;

revoke all on function public.study_categories_valid(jsonb), public.study_items_valid(jsonb) from public;
grant execute on function public.study_categories_valid(jsonb), public.study_items_valid(jsonb) to authenticated, service_role;

-- =====================================================================================================================
-- verse_marks: uma linha por versículo marcado (numeração da KJV, a do app)
-- =====================================================================================================================

create table if not exists public.verse_marks (
  user_id uuid not null references auth.users (id) on delete cascade,
  book text not null check (book ~ '^[a-z0-9]{3}$'),             -- slug de 3 caracteres (os 66 livros)
  chapter integer not null check (chapter between 1 and 150),
  verse integer not null check (verse between 1 and 176),        -- 176 = Salmo 119
  cat text check (cat in ('c1', 'c2', 'c3', 'c4', 'c5', 'c6')),  -- a cor vem do token do app, não do banco
  note text check (note is null or char_length(note) between 1 and 2000),
  updated_at timestamptz not null default now(),
  primary key (user_id, book, chapter, verse),
  check (cat is not null or note is not null)                    -- linha sem categoria e sem nota não existe
);

alter table public.verse_marks enable row level security;

drop policy if exists verse_marks_all_own on public.verse_marks;
create policy verse_marks_all_own on public.verse_marks
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.verse_marks from anon, authenticated;
grant select, insert, update, delete on public.verse_marks to authenticated;

-- Limite por usuário. Regravar um versículo que já existe (upsert) não conta como linha nova.
-- SECURITY DEFINER: lê app_limit(), que o app não pode executar (os limites ficam fora do alcance do cliente).
create or replace function public.verse_marks_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT'
     and not exists (select 1 from public.verse_marks
                     where user_id = new.user_id and book = new.book and chapter = new.chapter and verse = new.verse)
     and (select count(*) from public.verse_marks where user_id = new.user_id) >= public.app_limit('verse_marks_max') then
    raise exception 'Limite de marcações por usuário atingido.' using errcode = 'check_violation', hint = 'marks_limit';
  end if;
  new.updated_at := least(coalesce(new.updated_at, now()), now()); -- a data do cliente nunca fica no futuro
  return new;
end;
$$;

revoke all on function public.verse_marks_guard() from public, anon, authenticated;

drop trigger if exists verse_marks_guard on public.verse_marks;
create trigger verse_marks_guard
  before insert or update on public.verse_marks
  for each row execute function public.verse_marks_guard();

-- =====================================================================================================================
-- study_settings: categorias do usuário (id c1..c6 e nome; até 6)
-- =====================================================================================================================

create table if not exists public.study_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  categories jsonb not null default '[]'::jsonb check (public.study_categories_valid(categories)),
  updated_at timestamptz not null default now()
);

alter table public.study_settings enable row level security;

drop policy if exists study_settings_all_own on public.study_settings;
create policy study_settings_all_own on public.study_settings
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.study_settings from anon, authenticated;
grant select, insert, update, delete on public.study_settings to authenticated;

create or replace function public.study_settings_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := least(coalesce(new.updated_at, now()), now());
  return new;
end;
$$;

drop trigger if exists study_settings_guard on public.study_settings;
create trigger study_settings_guard
  before insert or update on public.study_settings
  for each row execute function public.study_settings_guard();

-- =====================================================================================================================
-- studies: um estudo por linha; itens na ordem do array [{k, note}] (referências, nunca o texto bíblico)
-- =====================================================================================================================

create table if not exists public.studies (
  id uuid primary key default gen_random_uuid(),                 -- o cliente gera o id (criar offline)
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  template text check (template in ('passagem', 'personagem', 'sermao', 'ebd')),
  items jsonb not null default '[]'::jsonb check (public.study_items_valid(items)),
  updated_at timestamptz not null default now()
);

create index if not exists studies_user_idx on public.studies (user_id, updated_at desc);

alter table public.studies enable row level security;

drop policy if exists studies_all_own on public.studies;
create policy studies_all_own on public.studies
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.studies from anon, authenticated;
grant select, insert, update, delete on public.studies to authenticated;

-- SECURITY DEFINER como can_read_pro(): is_pro_active lê app_admins, que o usuário não lê. Só INSERT conta no limite.
create or replace function public.studies_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  if tg_op = 'INSERT' then
    select count(*) into n from public.studies where user_id = new.user_id;
    if n >= public.app_limit('studies_max') then
      raise exception 'Limite técnico de estudos atingido.' using errcode = 'check_violation', hint = 'studies_max';
    end if;
    if n >= public.app_limit('studies_essencial_max') and not public.is_pro_active(new.user_id) then
      raise exception 'Limite de estudos do plano Essencial atingido.' using errcode = 'check_violation', hint = 'studies_plan';
    end if;
  end if;
  new.updated_at := least(coalesce(new.updated_at, now()), now());
  return new;
end;
$$;
revoke all on function public.studies_guard() from public, anon, authenticated;

drop trigger if exists studies_guard on public.studies;
create trigger studies_guard
  before insert or update on public.studies
  for each row execute function public.studies_guard();

-- =====================================================================================================================
-- Exclusão de conta: corpo igual ao de 20261015000000_fase6_admin.sql, mais verse_marks, study_settings e studies.
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
  delete from public.verse_marks where user_id = p_user_id;
  delete from public.study_settings where user_id = p_user_id;
  delete from public.studies where user_id = p_user_id;
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
