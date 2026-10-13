-- Timóteo App, Fase 3B (PR 2): bucket PRIVADO `pro` no Storage e a regra de quem pode ler.
-- Aditiva: não altera nenhuma tabela nem função existente. NÃO é aplicada pelo repositório (o André aplica; ver supabase/README.md).
--
-- O que faz:
--   1. Cria o bucket `pro` (privado). Aqui ficará o conteúdo Pro (fichas com mapa/estrutura, personagens, linha do tempo, genealogia,
--      interlinear) e, em `v1/admin/`, a posição acadêmica (só admin). Quem grava é só o script de publicação, com a service_role
--      (que ignora o RLS); o cliente nunca grava, atualiza nem apaga.
--   2. public.can_read_pro(): verdadeiro para admin e para quem tem plano Pro ou Premium VIGENTE em `entitlements`
--      (expires_at nulo = sem prazo; vencido vale como Essencial, como no app).
--   3. Duas políticas de SELECT em storage.objects (e só elas): conteúdo Pro (can_read_pro) e `v1/admin/*` (is_admin).
--      Anônimo e Essencial não leem nada (sem política, o Storage responde como se o arquivo não existisse).
--
-- Reverter: drop policy pro_read_content / pro_read_admin on storage.objects; drop function public.can_read_pro();
--           e (se quiser) apagar o bucket `pro` pelo painel (esvaziado antes).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pro', 'pro', false, 52428800, array['application/json'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_read_pro()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.is_admin(), false)
    or exists (
      select 1 from public.entitlements e
      where e.user_id = (select auth.uid())
        and e.plan in ('pro', 'premium')
        and (e.expires_at is null or e.expires_at > now())
    );
$$;

revoke all on function public.can_read_pro() from public, anon;
grant execute on function public.can_read_pro() to authenticated;
comment on function public.can_read_pro() is 'Pode ler o bucket pro: admin, ou Pro/Premium vigente (vencido = Essencial). Usada pela política do Storage.';

-- conteúdo Pro (tudo no bucket, menos a pasta admin)
create policy pro_read_content on storage.objects
  for select to authenticated
  using (bucket_id = 'pro' and position('/admin/' in '/' || name) = 0 and public.can_read_pro());

-- posição acadêmica e outros itens só do admin
create policy pro_read_admin on storage.objects
  for select to authenticated
  using (bucket_id = 'pro' and position('/admin/' in '/' || name) > 0 and public.is_admin());
