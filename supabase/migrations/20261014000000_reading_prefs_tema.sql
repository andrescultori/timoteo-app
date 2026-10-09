-- Timóteo App: modo escuro. Ajustes de leitura ganham `siteTheme` (tema do site: light | dark | auto) e o tema de leitura (`theme`)
-- passa a aceitar também "follow" (acompanha o site; é o padrão). Recria a função de validação da 20261013000000.
-- Aplique em ordem depois das anteriores. Sem ela, essas escolhas só ficam no aparelho. NÃO é aplicada pelo repositório.

create or replace function public.reading_prefs_valid(p jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(p) = 'object'
    and pg_catalog.length(p::text) <= 300
    and not exists (select 1 from pg_catalog.jsonb_object_keys(p) as k where k not in ('size', 'spacing', 'width', 'font', 'verseLines', 'theme', 'originals', 'cantillation', 'siteTheme'))
    and (not p ? 'size' or p -> 'size' in ('17'::jsonb, '19'::jsonb, '21'::jsonb, '23'::jsonb, '26'::jsonb, '30'::jsonb))
    and (not p ? 'spacing' or p -> 'spacing' in ('1.45'::jsonb, '1.7'::jsonb, '2'::jsonb))
    and (not p ? 'width' or p -> 'width' in ('540'::jsonb, '660'::jsonb, '820'::jsonb))
    and (not p ? 'font' or p -> 'font' in ('"serif"'::jsonb, '"sans"'::jsonb))
    and (not p ? 'verseLines' or p -> 'verseLines' in ('true'::jsonb, 'false'::jsonb))
    and (not p ? 'theme' or p -> 'theme' in ('"follow"'::jsonb, '"light"'::jsonb, '"sepia"'::jsonb, '"dark"'::jsonb))
    and (not p ? 'originals' or p -> 'originals' in ('true'::jsonb, 'false'::jsonb))
    and (not p ? 'cantillation' or p -> 'cantillation' in ('true'::jsonb, 'false'::jsonb))
    and (not p ? 'siteTheme' or p -> 'siteTheme' in ('"light"'::jsonb, '"dark"'::jsonb, '"auto"'::jsonb));
$$;
