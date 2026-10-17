-- Meus Estudos, ETAPA 5 (PR B): chave opcional "inc" por item e nota de item de até 5000 caracteres.
-- O que muda: SÓ a função study_items_valid (create or replace; pode ser reaplicada sem erro). Nenhuma tabela, coluna, política ou gatilho muda.
--   * cada item aceita as chaves k, note e inc (boolean): "inc" = "Incluir o conteúdo aqui" (personagem, lugar, evento, capítulo, livro e o Contexto);
--   * a nota de item sobe de 2000 para 5000 caracteres (verse_marks.note continua 2000);
--   * continuam valendo: item é objeto, k é string e casa com o regex de chaves (igual ao de 20261020000000), até 100 itens e 100000 caracteres no JSON.
-- A data de "inc" não guarda conteúdo, só a escolha: o conteúdo incluído vem sempre dos dados do app e do plano de quem vê.
-- Reverter: recriar study_items_valid a partir de 20261020000000_estudos_marcacoes.sql.

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
        exists (select 1 from pg_catalog.jsonb_object_keys(e) k where k not in ('k', 'note', 'inc'))
        or coalesce(pg_catalog.jsonb_typeof(e -> 'k'), '') <> 'string'
        or (e ->> 'k') !~ '^(ref:[a-z0-9]{3}:[0-9]{1,3}:[0-9]{1,3}(-[0-9]{1,3})?|book:[a-z0-9]{3}|chapter:[a-z0-9]{3}:[0-9]{1,3}|verse:[a-z0-9]{3}:[0-9]{1,3}:[0-9]{1,3}|person:[a-z0-9-]{1,60}|event:[a-z0-9-]{1,60}|place:[a-z0-9]{3}:.{1,80}|block:[a-z0-9-]{1,30})$'
        or (e ? 'note' and (pg_catalog.jsonb_typeof(e -> 'note') <> 'string' or pg_catalog.char_length(e ->> 'note') > 5000))
        or (e ? 'inc' and pg_catalog.jsonb_typeof(e -> 'inc') <> 'boolean')
      ) end
    )
  ) end;
$$;

revoke all on function public.study_items_valid(jsonb) from public;
grant execute on function public.study_items_valid(jsonb) to authenticated, service_role;
