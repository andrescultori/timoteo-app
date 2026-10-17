# Checklist de lançamento (meta: 31/10/2026)

Pendências do André e do projeto, em ordem aproximada. `[x]` feito, `[ ]` aberto. Atualizado em 15/10/2026.

## Antes do lançamento
- [x] Política de preços (Pro mensal/anual; Premium "Em breve"); migration `20261017` aplicada e funções publicadas.
- [x] GitHub Pages desligado (Settings → Pages) e `deploy.yml` removido.
- [x] Workflow da landing corrigido; deploy hook do Cloudflare cadastrado (`LANDING_DEPLOY_HOOK`). Testar rodando o workflow com `force` (esperado HTTP 200).
- [x] Fase 3B, PRs 1 a 4 (camada de carregamento, bucket `pro`, pacote Pro publicado, chave `VITE_PRO_SOURCE`) e e2e verde (18 OK).
- [x] Fase 3B, PR 5 (o site público deixa de levar o Pro): mesclado, site conferido como Pro e como Essencial.
- [ ] **Apagar os deploys antigos do Cloudflare Pages** (**segunda, 19/10**) (projeto do app, aba Deployments, inclusive os de preview): os anteriores ao PR 5 ainda servem o pacote com o Pro. Adiado pelo André em 14/10/2026. **Fazer antes de tornar o repositório privado e antes de ligar a cobrança.** Passo a passo: no projeto do app, Deployments, ⋯ → Delete deployment em cada um que não seja o de produção ativo.
- [x] Chaves novas do Supabase (`sb_secret_...`) em uso e chaves legadas (JWT) desativadas em 13/10/2026. Edge Functions, publicador e e2e (18 OK) verificados sem as legadas. Falta só apagar a variável antiga do ambiente da nuvem, se ainda existir.
- [x] PWA offline: shell (PR 6), texto bíblico por versão (PR 7) e Pro offline com download automático (PR 8) mesclados.
- [ ] **Testar o PWA no celular** (iPhone/Chrome): Configurações → Uso offline → baixar as versões; entrar com a conta Pro e esperar "No aparelho · ≈ 16 MB"; modo avião, fechar e reabrir (Linha do tempo, Personagens, mapa de Romanos); sair da conta e conferir que o bloco some. Prefira abrir pela Tela de Início.
- [ ] **Política de Privacidade:** incluir o armazenamento offline do PWA (texto bíblico e, para assinantes, o conteúdo Pro no aparelho; apagado no logout, ao vencer o plano ou por remoção; Pro offline por até 14 dias sem confirmar o plano). Texto legal é do André; Claude só redige se pedido.
- [ ] **Fase 8 (segunda, 19/10, no computador: revisar `LICENSE`/`NOTICE.md` com o advogado, apagar os deploys, tornar o repositório privado, conferir o Cloudflare nos dois projetos com Retry deployment):** repositório privado e licença "Todos os direitos reservados": `LICENSE` e `NOTICE.md` em PR; passo a passo em `docs/fase8-passo-a-passo.md` (inclui apagar os deploys antigos do Cloudflare e o que fazer com o portfólio).
- [ ] **Mercado Pago (segunda, 19/10, 15h; lembrete agendado):** confirmar a **parcela mínima do anual em 10x** (R$ 39,90 → cerca de R$ 3,99 por parcela). Se o MP recusar, baixar `maxInstallments` do anual em `plans.json` e `MAX_INSTALLMENTS` em `supabase/functions/_shared/pricing.js` (o `check` confere os dois). Também confirmar as taxas atuais (Pix, cartão).
- [ ] **Textos legais:** revisão jurídica dos Termos e da Política; publicar `LEGAL_VERSION` com data; prazo fiscal (contador); CPF no texto ou não; versão EN. A Política precisa de linha sobre o armazenamento offline do PWA (a listar quando chegar lá).
- [ ] **Ligar `VITE_BILLING_ENABLED` em produção** só depois dos itens acima (Fase 8 e textos legais).

## Estudos (marcações e Meus Estudos; ver `docs/roadmap-estudos.md`)
- [x] ETAPA 1 (PR 1: banco, `userdata`, LGPD), ETAPA 2 (PR 2: marcar no leitor, Favoritos > Versículos), ETAPA 3 (PR 3: Meus Estudos, Contexto) e ETAPA 4 (PR 4: PDF do Pro, linhas `marks`/`studies`/`study-export` na matriz, FAQ da landing) feitas.
- [ ] Aprovar o roteiro e as decisões; **go/no-go em 26/10**; avisar o advogado (anotações e estudos entram na Política).
- [ ] **Teste logado no Supabase real** (nunca provado fora do ambiente de testes): marcar um versículo e ver em outro aparelho; criar o 6º estudo no Essencial (mensagem amigável, estudo fica no aparelho); estudo criado e editado em modo avião subindo depois; exportar PDF no Pro (celular e computador) e conferir o convite no Essencial.
- [ ] **Publicar o texto legal** (PR #149, `LEGAL_VERSION` com data) junto com o lançamento de marcações e estudos: anotações e estudos entram na Política.

## Portfólio (decidido em 15/10/2026)
- [ ] Repositório público separado, só com um recorte sem o conteúdo Pro (landing, camada de dados e testes) e mockup com telas de exemplo. Fazer depois de o repositório principal virar privado.

## Logo e imagens
- [ ] Logo final com curvas (já pedido ao designer): trocar os 2 fontes em `branding/fonte/` e rodar `node scripts/build-brand-assets.mjs`.
- [x] Capturas da landing refeitas no tema novo.

## Depois do lançamento
- [ ] **Supabase no plano pago** (pausa por inatividade e egress). Antes da primeira venda real.
- [ ] **Recorrência** (assinatura do Mercado Pago): ETAPA 0 entregue; aguarda as decisões (meio de pagamento, preço de lançamento na assinatura, reembolso, texto legal).
- [ ] Fase 3B: prévia embaçada nas telas bloqueadas (só se quiser conversão).

## Conteúdo e licenças de texto (andamento)
- [ ] Revisão do André: fichas dos 66 livros, personagens, linha do tempo, Almeida 1911 atualizada.
- [ ] Decisões de nomes ambíguos em `scripts/data/people-chapters-overrides.json`.
- [ ] Autorizações pedidas, aguardando retorno: **ARA e NAA** (SBB), **A21** (Edições Vida Nova), **ACF** (SBTB). Cada versão só entra com a licença confirmada em fonte primária (`docs/licencas-texto-biblico.md`).

## Revisores de conteúdo
- [ ] Convidar os revisores (ver "Como convidar" em `supabase/README.md`, seção Administração): entram com Google, o admin dá plano Pro sem prazo ("cortesia") e o papel `revisor`.
