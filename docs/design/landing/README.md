# Design da landing page (nas cores do brand book)

`Landing.dc.html` é a maquete (marcação HTML com estilos inline; **não roda sozinha**, depende do runtime do editor de design). Leia como especificação. Conteúdo, textos e decisões de produto: `docs/landing-brief.md` e `docs/comercializacao.md`. O visual segue o app (`docs/design/app-b/README.md`): mesmas cores, mesmas fontes (Bricolage Grotesque + Source Sans 3), sem serifada, sem Marcellus.

## Seções, na ordem
NAV (logo `marca-verde.svg`, links, botão "Abrir o app") · HERO ("Estude a Bíblia com contexto, em um só lugar") · NÚMEROS · O QUE É ("Tudo o que você consulta ao estudar um livro, junto") · LIGAÇÕES + POSIÇÕES · PLANOS ("Escolha seu plano": Essencial, Pro, Premium; matriz de recursos) · PERGUNTAS (FAQ) · CTA FINAL · RODAPÉ (assinatura + Termos de uso + Política de privacidade).

## Pontos de atenção
- Na matriz de planos, a linha "Leitura gamificada e mais" fica **acima** das linhas "não disponíveis".
- Posição acadêmica: **só Premium** (decisão do André), que ainda não está à venda.
- Preços e matriz vêm de `src/data/plans.json` (fonte única). Não digitar preço à mão em dois lugares.
- Cores por seção dos livros: as 10 do README do app, usadas nas amostras.
- Imagens de tela são **placeholders** na maquete: trocar por capturas reais do app novo.
- Textos só em português por ora; versão EN depois.
