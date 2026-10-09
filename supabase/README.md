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

## 4. Publicar as funções (a conciliação, abaixo, tem a sua)
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


---

# Conciliação de pagamentos (Fase 4)

Reembolso e estorno não podem depender só do aviso (webhook): se o aviso se perder, a pessoa fica com meses que já devolvemos. Dois mecanismos reconferem no Mercado Pago, pelo mesmo caminho do webhook (referência, valor e moeda continuam conferidos):
- **`verify-payment`** (logado, ao voltar do checkout e no botão "Conferir pagamento" do perfil): além dos pagamentos em aberto, reconfere os **aprovados dos últimos 45 dias** do próprio usuário.
- **`reconcile-payments`** (diária, pelo GitHub Actions): varre `payments` aprovados nos últimos 45 dias e pendentes dos últimos 3, no máximo 200 por execução, os reconferidos há mais tempo primeiro (`reconciled_at`).

O estorno (chargeback) chega no Mercado Pago em outro tópico de notificação (`topic_chargebacks_wh`), que o `mp-webhook` não trata; a conciliação diária é o que o aplica. **Reembolso parcial não desfaz meses** (o pagamento segue aprovado): a conciliação só registra no log (`reembolso parcial ... decidir à mão`) para você decidir; não há regra de proporção.

## Aplicar
1. Migration `20261009000000_fase4_conciliacao.sql` (nova; não mexe nas anteriores): coluna `payments.reconciled_at` e as funções `payments_to_reconcile` e `user_payments_to_verify` (só `service_role`).
2. Publicar as funções (a `verify-payment` mudou; a `reconcile-payments` é nova):
```bash
supabase functions deploy verify-payment    --project-ref zqxodmjrbzmyhnkqszqh
supabase functions deploy reconcile-payments --project-ref zqxodmjrbzmyhnkqszqh --no-verify-jwt
```

## Segredo `RECONCILE_SECRET` (o mesmo valor nos dois lados; nunca no repositório)
1. Gere um valor longo e aleatório, por exemplo `openssl rand -hex 32`.
2. **Supabase:** `supabase secrets set --project-ref zqxodmjrbzmyhnkqszqh RECONCILE_SECRET='<valor>'` (ou Edge Functions → Secrets no painel).
3. **GitHub:** repositório → Settings → Secrets and variables → Actions → New repository secret, nome `RECONCILE_SECRET`, o mesmo valor.
A função compara o segredo em tempo constante; sem o cabeçalho `x-reconcile-secret` (ou com valor errado) responde 401.

## Agendamento (GitHub Actions, sem custo)
`.github/workflows/reconcile-payments.yml` roda todo dia às 06:17 UTC e também à mão. Faz um `POST` na função e **falha se a resposta não for 200** (o GitHub avisa por e-mail). Observação: o GitHub desativa workflows agendados de um repositório sem atividade por 60 dias; se isso acontecer, reative em Actions.

## Rodar à mão
- Pelo GitHub: Actions → "Conciliação de pagamentos" → Run workflow.
- Pelo terminal:
```bash
curl -sS -X POST -H "x-reconcile-secret: $RECONCILE_SECRET" \
  https://zqxodmjrbzmyhnkqszqh.supabase.co/functions/v1/reconcile-payments
```
Resposta esperada: `{"read":N,"changed":M,"errors":0}` com HTTP 200. `read` = pagamentos reconferidos (até 200); `changed` = quantos mudaram de estado (por exemplo, um reembolso aplicado); `errors` > 0 devolve HTTP 500 (alguma consulta ao Mercado Pago falhou; as demais foram processadas e a linha com erro é tentada de novo na próxima). Nada de dado pessoal no resumo nem no log.
- Quando algo mudar, o rastro está em Edge Functions → `reconcile-payments` → Logs: `reembolso aplicado`, `estorno aplicado`, `duplicate_payment`/`duplicate_entry` e `reembolso parcial`, sempre com o id do pagamento (o `payments.id`, que é o `external_reference`).
- Para conferir um caso: depois da execução, o pagamento está `refunded`/`charged_back` e o `entitlements` do usuário voltou ao Essencial (se esse era o único com meses), com `usou_preco_de_entrada = false`.


---

# LGPD: aceite, exportar e excluir conta (Fase 7)

Migration `20261010000000_fase7_lgpd.sql` (**idempotente**, aplique depois das anteriores) e a função `delete-account`. Nada é aplicado ou publicado automaticamente.

## O que há
- `profiles`: colunas `terms_version`, `terms_accepted_at`, `sensitive_consent_at`, `sensitive_consent_version`. O cliente **não** as grava direto; só a RPC `accept_legal(p_version, p_marketing)` (security definer, só `authenticated`, data do servidor).
- `payments.user_id` agora é **nulo** quando a conta é excluída (FK `on delete set null`): o registro fiscal fica, sem ligação com a pessoa. `apply_payment` ganhou o resultado `orphan` (atualiza só o pagamento, nunca um plano).
- `delete_account_data(uuid)` (só `service_role`): apaga favoritos, posição de leitura, "Avise-me", plano, perfil e a linha de `app_admins`; apaga pagamentos rejeitados e cancelados; **anonimiza** os demais (aprovados, reembolsados, estornados e **pendentes**); recusa o **único** admin. Idempotente.
- `functions/delete-account` (`verify_jwt = true`): confere o JWT e o **e-mail digitado**, chama `delete_account_data` e apaga o usuário no Auth (`DELETE /auth/v1/admin/users/{id}`, com a `service_role` do ambiente da função). Se o Auth falhar depois da limpeza, é só repetir. Não reembolsa nem cancela o Pro. Usa o secret `APP_URL` (CORS), o mesmo da Fase 4.
- Testes: `npm test` cobre `accept_legal`, a exclusão, o admin único, o pagamento órfão e a conciliação com órfão.

## Aplicar e publicar
1. Aplicar a migration (painel, CLI ou MCP, como nas outras).
2. Publicar: `supabase functions deploy delete-account --project-ref zqxodmjrbzmyhnkqszqh`. Republicar `create-checkout`, `mp-webhook` e `reconcile-payments` (o primeiro agora exige o aceite dos Termos; os outros registram o pagamento órfão no log).
3. Conferir no Advisors que não há alerta novo.

## Testar com uma conta de teste
1. Entre com uma conta Google de teste: o modal de consentimento aparece antes do Google; marque as caixas 1 e 2. Depois do login, em `profiles`, `terms_accepted_at` e `sensitive_consent_at` estão preenchidos.
2. `#profile` → **Seus dados**: "Baixar meus dados" baixa um JSON (perfil, plano, favoritos, posição, "Avise-me" e pagamentos).
3. Crie um favorito e um checkout de teste (deixe pendente). **Excluir minha conta**: digite o e-mail e confirme. Esperado: volta ao início deslogado; no SQL Editor, `select count(*) from auth.users where email = '...'` = 0, sem linhas em `favorites`, `profiles` etc., e o pagamento pendente com `user_id` nulo.
4. Conta que já existia antes da Fase 7: ao entrar, o app abre o consentimento e fica em modo local (nada em `favorites` no Supabase) até aceitar.

## Tratando pagamentos órfãos
Pagamento de conta excluída que for **aprovado depois** (Pix pago tarde) aparece no log como `pagamento de conta excluída (órfão) aprovado, reembolsar à mão`. Reembolse no painel do Mercado Pago: o webhook ou a conciliação registram o reembolso, sem mexer em plano nenhum.

## Antes de ligar a cobrança em produção
O `npm run check` avisa enquanto os textos legais estiverem em rascunho. **Pré-requisito para `VITE_BILLING_ENABLED=true` em produção:** textos revisados e publicados (`LEGAL_VERSION` com data em `src/legal/version.js`, sem `[colchetes]` em `docs/legal/`), prazo fiscal confirmado com o contador e `refundContact` definitivo em `src/data/billing.json`.

---

# Ajustes de leitura sincronizados (visual B)

Migration `20261011000000_reading_prefs.sql` (**idempotente**, aplique depois da `20261010000000_fase7_lgpd.sql`). **Não é aplicada pelo repositório.**

## O que há
- Tabela `reading_prefs`: uma linha por usuário (`prefs` em JSONB + `updated_at`), RLS "só o dono" (mesmo molde de `reading_position`), sem acesso de `anon`.
- Função `reading_prefs_valid(jsonb)` e um `check` na coluna: só aceita as chaves `size` (17, 19, 21, 23, 26, 30), `spacing` (1,45, 1,7, 2), `width` (540, 660, 820), `font` (`serif`, `sans`), `verseLines` (booleano) e `theme` (`light`, `sepia`, `dark`). Os testes (`npm test`) conferem que o SQL aceita exatamente o que `src/readingPrefs.js` aceita.
- `delete_account_data` é recriada **com** `reading_prefs` na lista do que se apaga (o resto é idêntico à da Fase 7). A exportação "Seus dados" (`src/YourData.jsx`) passa a incluir `ajustes_de_leitura`.

## Aplicar
SQL Editor do Supabase: cole o conteúdo do arquivo e rode. (Pelo assistente do MCP, a parte com `delete from` já travou antes; prefira o SQL Editor.) Nenhuma função de borda muda.

## Como o app se comporta
- Sem conta, ou sem o aceite dos Termos: os ajustes ficam só no aparelho (`localStorage.readingPrefs`).
- Com conta e aceite: o mais recente vence no login; mudanças sobem com ~1,5 s de atraso; o cache é limpo no logout.
- **Se a migration ainda não foi aplicada**, o app ignora a tabela (os ajustes ficam no aparelho) e favoritos e posição seguem normais. Dá para publicar o app antes ou depois da migration.

## Atenção: texto legal (decisão de vocês, não alterei)
A Política de Privacidade (item 3, "Preferências no aparelho") diz que preferências como tema e idioma ficam **só no navegador**. Com esta mudança, os **ajustes de leitura** de quem tem conta passam a ser guardados no servidor (dado pessoal comum, não sensível, apagado com a conta). Revisar o texto (e a tabela do item 3) antes de publicar a sincronização, e depois atualizar `LEGAL_VERSION`.

## Chaves novas dos ajustes de leitura
Depois da `20261011000000`, aplique **em ordem** `20261012000000_reading_prefs_originals.sql` (chave `originals`: faixa dos originais em hebraico e grego) e `20261013000000_reading_prefs_cantillation.sql` (chave `cantillation`: mostrar os acentos de cantilação). Cada uma só recria `reading_prefs_valid` (idempotente). Sem elas, essas chaves ficam só no aparelho.

## Tema do site e da leitura (modo escuro)
Aplique `20261014000000_reading_prefs_tema.sql` depois da `20261013000000`: a função `reading_prefs_valid` passa a aceitar `siteTheme` (`light`, `dark`, `auto`) e o valor `follow` em `theme`. Sem ela, essas escolhas ficam só no aparelho.
