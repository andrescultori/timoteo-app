-- Timóteo App, visual B: ajustes de leitura sincronizados (tamanho, espaçamento, largura, fonte, versículo por linha, tema da leitura).
-- Uma linha por usuário, só o dono lê e grava (RLS). O JSON é validado no banco: só as chaves e os valores abaixo.
-- Só é usada com conta e com o aceite dos Termos (o app fica em modo local sem o aceite). Também entra em delete_account_data.
-- NÃO é aplicada pelo repositório: ver supabase/README.md.

create or replace function public.reading_prefs_valid(p jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(p) = 'object'
    and pg_catalog.length(p::text) <= 300
    and not exists (select 1 from pg_catalog.jsonb_object_keys(p) as k where k not in ('size', 'spacing', 'width', 'font', 'verseLines', 'theme'))
    and (not p ? 'size' or p -> 'size' in ('17'::jsonb, '19'::jsonb, '21'::jsonb, '23'::jsonb, '26'::jsonb, '30'::jsonb))
    and (not p ? 'spacing' or p -> 'spacing' in ('1.45'::jsonb, '1.7'::jsonb, '2'::jsonb))
    and (not p ? 'width' or p -> 'width' in ('540'::jsonb, '660'::jsonb, '820'::jsonb))
    and (not p ? 'font' or p -> 'font' in ('"serif"'::jsonb, '"sans"'::jsonb))
    and (not p ? 'verseLines' or p -> 'verseLines' in ('true'::jsonb, 'false'::jsonb))
    and (not p ? 'theme' or p -> 'theme' in ('"light"'::jsonb, '"sepia"'::jsonb, '"dark"'::jsonb));
$$;

create table if not exists public.reading_prefs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  prefs jsonb not null default '{}'::jsonb check (public.reading_prefs_valid(prefs)),
  updated_at timestamptz not null default now()
);

alter table public.reading_prefs enable row level security;

drop policy if exists reading_prefs_all_own on public.reading_prefs;
create policy reading_prefs_all_own on public.reading_prefs
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.reading_prefs from anon, authenticated;
grant select, insert, update, delete on public.reading_prefs to authenticated;
revoke all on function public.reading_prefs_valid(jsonb) from public;
grant execute on function public.reading_prefs_valid(jsonb) to authenticated, service_role;

-- Exclusão de conta: igual à da Fase 7, com reading_prefs na lista de dados apagados.
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
  delete from public.waitlist where user_id = p_user_id;
  delete from public.entitlements where user_id = p_user_id;
  delete from public.app_admins where user_id = p_user_id;
  delete from public.profiles where id = p_user_id;

  return jsonb_build_object('deleted_payments', v_del, 'anonymized_payments', v_anon);
end;
$$;

revoke all on function public.delete_account_data(uuid) from public, anon, authenticated;
grant execute on function public.delete_account_data(uuid) to service_role;
