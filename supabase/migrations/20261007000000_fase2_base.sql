-- Timóteo App, Fase 2 (versão simples): perfis, plano, administradores, lista de espera, favoritos e posição de leitura.
-- Tudo em `public`, RLS ligada em todas as tabelas, funções com search_path fixo.
-- Regra geral: o cliente (papéis anon e authenticated) só recebe os privilégios listados abaixo; o resto é negado.

-- =====================================================================================================================
-- Funções utilitárias
-- =====================================================================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =====================================================================================================================
-- profiles
-- =====================================================================================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text check (name is null or char_length(name) <= 120),
  email text check (email is null or char_length(email) <= 320),
  sex text check (sex is null or sex in ('female', 'male', 'other')),
  age_band text check (age_band is null or age_band in ('18-24', '25-34', '35-44', '45-54', '55-64', '65+')),
  city_state text check (city_state is null or char_length(city_state) <= 120),
  marketing_consent boolean not null default false,
  marketing_consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column public.profiles.age_band is 'Faixa etária (nunca data de nascimento).';
comment on column public.profiles.marketing_consent_at is 'Preenchida pelo trigger quando marketing_consent muda; o cliente não grava.';

alter table public.profiles enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
-- Sem política de insert (só o trigger de novo usuário cria a linha) e sem política de delete (a exclusão da conta é a Fase 7).

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (name, sex, age_band, city_state, marketing_consent) on public.profiles to authenticated;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- O momento do consentimento é decidido no servidor: marcar grava a data; desmarcar zera.
create or replace function public.profiles_consent_stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.marketing_consent is distinct from old.marketing_consent then
    new.marketing_consent_at = case when new.marketing_consent then now() else null end;
  end if;
  return new;
end;
$$;

create trigger profiles_consent_stamp
  before update on public.profiles
  for each row execute function public.profiles_consent_stamp();

-- =====================================================================================================================
-- entitlements (plano). O cliente só LÊ; quem grava é o admin (por função, em fase futura) e o service_role.
-- =====================================================================================================================

create table public.entitlements (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'essencial' check (plan in ('essencial', 'pro', 'premium')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

alter table public.entitlements enable row level security;

create policy entitlements_select_own on public.entitlements
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.entitlements from anon, authenticated;
grant select on public.entitlements to authenticated;

create trigger entitlements_set_updated_at
  before update on public.entitlements
  for each row execute function public.set_updated_at();

-- =====================================================================================================================
-- app_admins: tabela interna. RLS ligada e nenhuma política: o cliente não lê nem grava.
-- =====================================================================================================================

create table public.app_admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

alter table public.app_admins enable row level security;
revoke all on public.app_admins from anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.app_admins where user_id = (select auth.uid()));
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- =====================================================================================================================
-- waitlist ("Avise-me")
-- =====================================================================================================================

create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  feature text not null check (char_length(feature) between 1 and 100),
  created_at timestamptz not null default now(),
  unique (user_id, feature)
);

alter table public.waitlist enable row level security;

create policy waitlist_insert_own on public.waitlist
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy waitlist_select_own_or_admin on public.waitlist
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

revoke all on public.waitlist from anon, authenticated;
grant select, insert on public.waitlist to authenticated;

-- =====================================================================================================================
-- favorites: `key` é a mesma de src/favKeys.js (book:<slug>, chapter:<slug>:<n>, person:<id>, place:<slug>:<nome PT>)
-- =====================================================================================================================

create table public.favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null check (char_length(key) <= 200),
  created_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.favorites enable row level security;

create policy favorites_all_own on public.favorites
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.favorites from anon, authenticated;
grant select, insert, update, delete on public.favorites to authenticated;

-- =====================================================================================================================
-- reading_position: uma linha por usuário
-- =====================================================================================================================

create table public.reading_position (
  user_id uuid primary key references auth.users (id) on delete cascade,
  version text check (version is null or char_length(version) <= 40),
  slug text check (slug is null or char_length(slug) <= 20),
  chapter int check (chapter >= 1),
  updated_at timestamptz not null default now()
);

alter table public.reading_position enable row level security;

create policy reading_position_all_own on public.reading_position
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.reading_position from anon, authenticated;
grant select, insert, update, delete on public.reading_position to authenticated;

-- =====================================================================================================================
-- Novo usuário (login com Google): cria o perfil e o plano Essencial. Nunca concede plano pelo cliente.
-- =====================================================================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.email
  )
  on conflict (id) do nothing;

  insert into public.entitlements (user_id, plan)
  values (new.id, 'essencial')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Contas que já existiam antes desta migration (ex.: o primeiro teste de login) ganham perfil e plano Essencial.
insert into public.profiles (id, name, email)
select u.id, coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'), u.email
from auth.users u
on conflict (id) do nothing;

insert into public.entitlements (user_id, plan)
select u.id, 'essencial' from auth.users u
on conflict (user_id) do nothing;
