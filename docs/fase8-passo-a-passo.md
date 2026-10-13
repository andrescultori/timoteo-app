# Fase 8: licença "Todos os direitos reservados" e repositório privado

Ordem importa. Cada passo diz quem faz. Decisões de licença e de visibilidade são do André.

## Antes de tornar privado
1. [André] Revisar `LICENSE` e `NOTICE.md` deste PR (texto em rascunho; vale uma conferência jurídica, principalmente a frase sobre cópias já obtidas sob a MIT) e mesclar.
2. [André] Confirmar que o Pro já está fora do site público: `scripts/pro-e2e.mjs` com 18 OK (feito em 13/10/2026) e **apagar os deploys antigos do Cloudflare Pages** (os anteriores ao PR 5 ainda servem o pacote com o Pro). Cloudflare → Workers & Pages → projeto do app → Deployments.
3. [André] Decidir o que fazer com o valor de portfólio do repositório (ver "Portfólio" abaixo).

## Tornar privado
4. [André] GitHub → repositório → Settings → General → Danger Zone → **Change visibility → Make private**. O repositório tem 0 forks e 0 estrelas (02/10/2026).
5. [André] Cloudflare Pages, nos **dois projetos** (app e landing): Settings → Builds → conferir que o app GitHub do Cloudflare ainda tem acesso ao repositório (GitHub → Settings → Applications → Cloudflare Pages → Repository access). Se o build falhar com erro de acesso, é aqui.
6. [André] Fazer um push de teste (ou "Retry deployment") e ver o deploy verde nos dois projetos.
7. [Claude] Conferir que o CI e o workflow `reconcile-payments` seguem rodando. Em repositório privado o plano gratuito do GitHub dá 2.000 minutos de Actions por mês; hoje o uso é de poucos minutos por dia.

## O que não muda
- Quem já copiou o código quando ele era MIT continua com a MIT sobre aquelas cópias; a `LICENSE` nova diz isso.
- O histórico do Git guarda o Pro (ele sempre esteve no repositório); privado, isso fica restrito a quem tem acesso. Só publicar o repositório de novo depois de reescrever o histórico.
- Pessoas que tenham tirado cópias do site público antes do PR 5 podem ter o Pro: não há como recolher isso.

## Portfólio
O repositório era também vitrine de carreira (Data Science/BI). Privado, ele deixa de servir a esse fim. Opções, a decidir pelo André:
- Manter privado e usar a landing, capturas e um texto de estudo de caso no portfólio.
- Criar um repositório público separado só com um recorte sem o conteúdo Pro (a landing, a camada de dados e os testes, por exemplo).

## Supabase gratuito: pausa por inatividade
O plano gratuito pausa o projeto após cerca de 1 semana sem atividade. O workflow `reconcile-payments` roda todo dia e consulta o banco, o que já conta como atividade; não é preciso outro workflow. Confira, depois de uma semana, que o projeto continua ativo. Antes da primeira venda real, passar para o plano pago.
