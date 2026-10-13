# Checklist de lançamento (meta: 31/10/2026)

Pendências do André e do projeto, em ordem aproximada. `[x]` feito, `[ ]` aberto. Atualizado em 14/10/2026.

## Antes do lançamento
- [x] Política de preços (Pro mensal/anual; Premium "Em breve"); migration `20261017` aplicada e funções publicadas.
- [x] GitHub Pages desligado (Settings → Pages) e `deploy.yml` removido.
- [x] Workflow da landing corrigido; deploy hook do Cloudflare cadastrado (`LANDING_DEPLOY_HOOK`). Testar rodando o workflow com `force` (esperado HTTP 200).
- [x] Fase 3B, PRs 1 a 4 (camada de carregamento, bucket `pro`, pacote Pro e publicado, chave `VITE_PRO_SOURCE`).
- [ ] **e2e do Storage** verde (`node scripts/pro-e2e.mjs`, esperado 18 OK) → PR 5 (tirar o Pro do pacote público e virar o padrão para `storage`) → apagar os deploys antigos do Cloudflare.
- [ ] **Trocar (rodar) a `service_role`** no painel do Supabase, depois dos testes.
- [ ] PWA offline (PRs 6 a 9 da sequência).
- [ ] **Fase 8:** repositório privado e licença "Todos os direitos reservados" (ver abaixo).
- [ ] **Mercado Pago:** confirmar a **parcela mínima do anual em 10x** (R$ 39,90 → cerca de R$ 3,99 por parcela). Se o MP recusar, baixar `maxInstallments` do anual em `plans.json` e `MAX_INSTALLMENTS` em `supabase/functions/_shared/pricing.js` (o `check` confere os dois). Também confirmar as taxas atuais (Pix, cartão).
- [ ] **Textos legais:** revisão jurídica dos Termos e da Política; publicar `LEGAL_VERSION` com data; prazo fiscal (contador); CPF no texto ou não; versão EN. A Política precisa de linha sobre o armazenamento offline do PWA (a listar quando chegar lá).
- [ ] **Ligar `VITE_BILLING_ENABLED` em produção** só depois dos itens acima (Fase 8 e textos legais).

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
