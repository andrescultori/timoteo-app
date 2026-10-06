# Supabase (Fase 2)

Projeto dedicado do Timóteo App: ref `zqxodmjrbzmyhnkqszqh`, região `sa-east-1` (São Paulo). A URL e a chave **publishable** são públicas por natureza (estão em `.env.example`). **Nunca** coloque neste repositório a `service_role`, a senha do banco, tokens de acesso ou o Client Secret do Google.

## O que há aqui
- `config.toml`: só a convenção de pasta do Supabase CLI. A CLI **não** é dependência do projeto.
- `migrations/<timestamp>_*.sql`: o esquema, revisado no PR. **Nada é aplicado automaticamente.**

## Tabelas da `20261007000000_fase2_base.sql`
`profiles`, `entitlements`, `app_admins`, `waitlist`, `favorites`, `reading_position`, todas em `public`, com RLS ligada, privilégios mínimos (`revoke all` de `anon` e `authenticated` e `grant` só do necessário) e funções com `set search_path = ''`. Mais o trigger `on_auth_user_created` (cria o perfil e o plano Essencial a cada novo usuário). Quem pode ler e gravar cada tabela está na descrição do PR da Fase 2.

## Como aplicar (uma vez, depois de revisar)
Escolha uma das formas:
1. **Painel**: SQL Editor → cole o conteúdo do arquivo da migration → Run.
2. **CLI** (instalada na sua máquina, fora do projeto): `supabase login`, `supabase link --project-ref zqxodmjrbzmyhnkqszqh`, `supabase db push`.
3. **MCP do Supabase** (pelo Claude, com o seu aval): `apply_migration` com o mesmo SQL.

Depois de aplicar, confira no painel (Database → Tables) se as 6 tabelas aparecem com o cadeado de RLS ligado e rode o **Advisors** (segurança) para ver se não há alerta.

## Tornar-se admin (manual, uma vez)
Entre uma vez no app com o Google (isso cria o seu usuário) e, no SQL Editor, rode (troque o e-mail pelo seu):

```sql
insert into public.app_admins (user_id)
select id from auth.users where email = 'SEU-EMAIL-AQUI'
on conflict do nothing;
```

Nunca coloque o seu e-mail ou id dentro de uma migration.

## Mudar o plano de alguém (por enquanto, à mão)
O cliente não consegue gravar em `entitlements`. Para testar o plano Pro, no SQL Editor:

```sql
update public.entitlements set plan = 'pro', expires_at = now() + interval '12 months'
where user_id = (select id from auth.users where email = 'EMAIL-DO-USUARIO');
```

## Variáveis do app
`VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`: em `.env.example` para desenvolvimento (copie para `.env.local`) e nas variáveis do projeto do Cloudflare Pages para produção. Sem elas o app funciona só no aparelho (sem login).

## Login com Google
Já está configurado no painel (credencial OAuth e URLs de retorno). O app usa `redirectTo = origem + caminho` (sem o hash); essa URL precisa estar em Authentication → URL Configuration → Redirect URLs (a de produção, `https://timoteo-app.pages.dev/`, e `http://localhost:5173/` para desenvolvimento).
