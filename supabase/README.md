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


---

# Cobrança com Mercado Pago (Fase 4)

Migration `20261008000000_fase4_pagamentos.sql` (aplique **depois** da da Fase 2; ela não altera a anterior) e três Edge Functions em `functions/`. Nada é aplicado ou publicado automaticamente, e nenhuma credencial vai para o repositório.

## O que há
- `entitlements.usou_preco_de_entrada`, tabela `payments`, `apply_payment()` e funções de data (ver o comentário no início da migration).
- `functions/create-checkout` (logado), `functions/verify-payment` (logado) e `functions/mp-webhook` (`verify_jwt = false`, protegido pelo `x-signature`). Código comum em `functions/_shared/` (JS puro, sem SDK).
- Testes: `npm test` roda as funções puras e as migrations de verdade em Postgres (PGlite). O CI roda isso em todo PR.

## 1. Aplicar a migration
Igual à Fase 2 (painel → SQL Editor, CLI `supabase db push` ou MCP com o seu aval). Depois confira em Database → Tables que `payments` aparece com RLS ligada e rode o Advisors.

## 2. Credenciais de teste do Mercado Pago
No painel de desenvolvedores do Mercado Pago, na sua aplicação: **Credenciais de teste** (Access Token de teste) e **Usuários de teste** (um vendedor e um comprador). Pague sempre com o usuário comprador de teste.

## 3. Secrets das funções (somente no Supabase, nunca no repositório)
```bash
supabase secrets set --project-ref zqxodmjrbzmyhnkqszqh \
  MP_ACCESS_TOKEN='<access token de teste>' \
  MP_WEBHOOK_SECRET='<assinatura secreta do webhook>' \
  APP_URL='https://timoteo-app.pages.dev'
```
(ou Edge Functions → Secrets no painel). `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já existem no ambiente das funções: **não** os defina nem os copie para lugar nenhum. `APP_URL` é a origem do app, sem barra no fim e sem hash. Para desenvolvimento local, `http://localhost:5173` já é aceito no CORS.

## 4. Publicar as funções
```bash
supabase functions deploy create-checkout --project-ref zqxodmjrbzmyhnkqszqh
supabase functions deploy verify-payment  --project-ref zqxodmjrbzmyhnkqszqh
supabase functions deploy mp-webhook      --project-ref zqxodmjrbzmyhnkqszqh --no-verify-jwt
```
(`supabase/config.toml` já marca `verify_jwt = false` só para o `mp-webhook`; o `--no-verify-jwt` garante o mesmo.)

## 5. Webhook no painel do Mercado Pago
Sua aplicação → **Webhooks** → URL `https://zqxodmjrbzmyhnkqszqh.supabase.co/functions/v1/mp-webhook`, evento **Pagamentos** (`payment`). Copie a **assinatura secreta** gerada e use-a como `MP_WEBHOOK_SECRET`. O botão "Simular notificação" do painel envia um id de teste: a função responde 200 e ignora (o pagamento não existe), o que confirma a URL e a assinatura.

## 6. Ligar no app
Em `.env.local` (desenvolvimento) ou nas variáveis do projeto do Cloudflare Pages (produção): `VITE_BILLING_ENABLED=true`. Sem isso o app continua com o "Avise-me". Faça novo build/deploy depois de mudar.

## 7. Roteiro de teste de ponta a ponta (credenciais de teste)
Use o comprador de teste. Para cada caso, confira o plano em `#profile` e as linhas em `payments`/`entitlements` (SQL Editor).
1. **Aprovado (cartão de teste aprovado):** `#timeline` (conta Essencial) → "Assinar o Pro" mostra R$ 29,90 → paga → volta em `#checkout/retorno` → "Pagamento aprovado", Pro por 12 meses, `usou_preco_de_entrada = true`. A próxima oferta mostra R$ 49,90.
2. **Pix pendente depois aprovado:** pague com Pix e **não** conclua: a página mostra "ainda não foi confirmado" e o plano segue Essencial. Conclua o Pix (no ambiente de teste, simule o pagamento): em até alguns minutos a página (ou o botão "Conferir pagamento" do perfil) vira "aprovado".
3. **Recusado:** cartão de teste com resultado "recusado": a página mostra "não foi aprovado"; `payments.status = 'rejected'`; plano inalterado.
4. **Webhook repetido:** no painel, reenvie a notificação do pagamento aprovado: resposta 200, `expires_at` não muda.
5. **Webhook perdido:** desative o webhook (ou rode com `MP_WEBHOOK_SECRET` errado) e pague: ao voltar, `verify-payment` aplica o pagamento; o plano é liberado pela página de retorno.
6. **Renovação antecipada:** com Pro vigente, "Renovar por mais 12 meses" no perfil (R$ 49,90) → o `expires_at` soma 12 meses ao vencimento atual (≈ 24 meses a partir de hoje).
7. **Reembolso:** reembolse o pagamento no painel do Mercado Pago (7 dias). Em instantes o webhook devolve o prazo (renovação: volta aos 12 meses; único pagamento: volta ao Essencial e libera o preço de entrada). Se o webhook não chegar, o botão "Conferir pagamento" resolve.
8. **Vencido:** `update public.entitlements set expires_at = now() - interval '1 day' where user_id = ...;` → o app mostra Essencial; pagar de novo conta da data do pagamento.

## O que conferir no primeiro teste (a documentação do Mercado Pago não estava acessível quando o código foi escrito)
- A URL devolvida em `init_point` abre o checkout com as credenciais de teste (se não abrir, trocar por `sandbox_init_point` em `create-checkout/index.ts`).
- O `back_url` com `?checkout=...` volta ao app (o Mercado Pago acrescenta `payment_id`, `status`, `external_reference`); o app ignora o status da URL e só usa `external_reference` como dica, validada no servidor.
- A assinatura do webhook é aceita (manifest `id:<data.id minúsculo>;request-id:<x-request-id>;ts:<ts>;`). Se der 401 com o segredo certo, comparar com o modelo atual da documentação em `functions/_shared/mp.js` (`buildManifest`).
- Em pagamento parcelado com juros, `transaction_amount` deve continuar igual ao preço do item (os juros ficam em outro campo). Se vier maior, a função recusa por valor diferente (log `amount`): ajustar a conferência para `transaction_amount` sem juros.
- Pix pago em duplicidade e o log `pagamento duplicado, reembolsar à mão`: reembolsar no painel.
- **Como tratar `duplicate_payment` e `duplicate_entry`** (aparecem como `console.error` do `mp-webhook` em Edge Functions → Logs, e em `payments` como aprovado com `months_granted = 0`): o dinheiro entrou mas não concedeu meses. Reembolse esse pagamento no painel do Mercado Pago; o reembolso não mexe no plano. `duplicate_payment` = o mesmo checkout pago duas vezes; `duplicate_entry` = dois checkouts a preço de entrada (só o primeiro vale).
