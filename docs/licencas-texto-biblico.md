# Licenças do texto bíblico

Levantamento feito em 01/10/2026 a partir das páginas oficiais citadas abaixo. Os termos podem mudar e não substituem confirmação por escrito. Decisões de licença são do André.

## Situação por versão

| Versão | Idioma | Situação | O que fazer |
|---|---|---|---|
| KJV | EN | Domínio público | Já no site. |
| WEB (World English Bible) | EN | Domínio público | **No site.** Ver "Versões no site". |
| ASV (American Standard Version, 1901) | EN | Domínio público | **No site.** |
| TB (Tradução Brasileira) | PT | O texto de 1917 provavelmente é domínio público, mas o arquivo disponível é a edição da SBB de 2010, com copyright declarado | **Não adicionar.** Ver "Versões no site". |
| Almeida 1911 (ALM1911) | PT | Domínio público (texto do Project Gutenberg nº 62383) | A edição com a grafia original foi retirada a pedido do André. Voltou como **ALM1911 (atualizada)**, só com a ortografia modernizada; 66 livros, ainda em revisão (`docs/ortografia-alm1911.md`). Licença da fonte (Gutenberg nº 62383) confirmada pelo André: domínio público nos EUA. |
| Bíblia Livre (BLIVRE) | PT | **CC BY 3.0 Brasil**, a licença escrita pelos autores no repositório oficial (decisão do André em 09/10/2026; não é domínio público, ao contrário do que o `damarals` informa) | **No site**, com atribuição obrigatória. |
| ARC (SBB, 1995) | PT | **Com direitos** (SBB) | Não adicionar. A edição original de 1898 é de domínio público, mas as revisões da SBB não. |
| ARA, NAA, NTLH | PT | **Com direitos** (SBB) | Só com autorização escrita. |
| ACF | PT | Com direitos (Sociedade Bíblica Trinitariana do Brasil) | Não adicionar. |
| NVI | PT | Com direitos (Biblica) | Não adicionar. |
| NKJV | EN | Com direitos (Thomas Nelson / HarperCollins Christian Publishing) | Ver abaixo. |
| ESV | EN | Com direitos (Crossway) | Ver abaixo. |

Atenção: a "ARC" que os aplicativos costumam mostrar é a revisão da SBB de 1995, que tem direitos. Só a edição original de 1898 é de domínio público.

## Versões no site e evidências

Levantamento de 01/10/2026. `ebible.org`, `sbb.org.br`, `gutenberg.org` e as páginas da Bíblia Livre estavam bloqueados pela rede do ambiente de trabalho: o que vem dessas páginas foi lido em trechos devolvidos por busca na web, não na página aberta. Vale reabrir os links abaixo no navegador.

| Versão | Evidência da licença | Observações |
|---|---|---|
| WEB | [ebible.org/eng-web/copyright.htm](https://ebible.org/eng-web/copyright.htm): domínio público, com declaração CC0. O prefácio dentro do arquivo-fonte repete "Public Domain (not copyrighted)". | "World English Bible" é marca do eBible.org: se o texto for alterado, não pode mais ser chamado de WEB. Não alterar o texto. |
| ASV | [ebible.org/eng-asv/copyright.htm](https://ebible.org/eng-asv/copyright.htm) e o [LICENSE.md](https://github.com/openbibleinfo/American-Standard-Version-Bible/blob/main/LICENSE.md) do repositório-fonte (lido em arquivo). | Omite 16 versículos que o texto grego crítico não traz. |
| Bíblia Livre | `LICENCA.md` e `README.md` do [repositório oficial](https://github.com/blivre/BibliaLivre) (lidos em arquivo): CC BY 3.0 Brasil, com crédito sugerido. O [eBible](https://ebible.org/porbr2018/copyright.htm) (redistribuidor) cita 4.0 Brasil. | O André escolheu a **3.0 Brasil** em 09/10/2026, a dos autores; o eBible, que cita a 4.0, não é a fonte da licença. O arquivo do site é um instantâneo de 2018; o repositório oficial está na versão 2025.1.0, com cerca de um terço dos versículos redigidos de outro jeito. No NT, o instantâneo segue o texto crítico (Nestle 1904): 15 versículos em branco. O repositório oficial também tem a variante Textus Receptus (`tr`). |
| Almeida 1911 (atualizada) | [Project Gutenberg nº 62383](https://www.gutenberg.org/ebooks/62383): "public domain in the USA" (via busca). O texto de partida é o mesmo da edição retirada. | A atualização é só de grafia, feita por este projeto. A página do Gutenberg ainda precisa ser aberta num navegador para confirmar a licença. |
| TB (não adicionada) | As páginas da [SBB](https://www.sbb.org.br/biblia/TB/GEN.12) exibem "Tradução Brasileira © 1917, 2010 Sociedade Bíblica do Brasil". | A tradução de 1917 provavelmente é domínio público, mas o arquivo disponível é a edição de 2010 da SBB, de ortografia modernizada. Fora, até haver uma fonte do texto de 1917. |
| ARC 1898 | Não foi encontrada fonte digital confiável. | Há escaneamentos de edições de 1904 e 1914 no Internet Archive, que exigiriam OCR e revisão. A "ARC" dos aplicativos é a revisão da SBB de 1995, com direitos. |

Fontes de arquivo descartadas: o `en_web.json` do `thiagobodruk/bible` (nota de rodapé vazada dentro do versículo e pontuação quebrada). A KJV desse mesmo repositório tinha cerca de 4.300 versículos com espaço antes da pontuação (ex.: "the LORD .") e 40 com notas de margem vazadas no texto (ex.: "I am the LORD : : or, JEHOVAH"). Foi corrigida em `scripts/data/kjv-fixes.json` e no script, sem trocar nenhuma palavra do texto. A alternativa testada, `eng-kjv.osis.xml` do `open-bibles`, foi descartada: duplica trechos (1Cr 11:2, Ez 17:24), padroniza a grafia (Cæsar → Caesar) e traz variantes de edição (ex.: Gn 50:23 "the son Manasseh").

## SBB (ARA e NAA): como pedir autorização

O termo de uso da SBB (EULA) permite uso pessoal e sem fins lucrativos, como leitura, cultos, estudo bíblico e atividades educacionais, e exige autorização prévia por escrito para uso comercial. Proíbe copiar, distribuir ou modificar sem permissão. Não encontrei regras para integrar o texto em site de terceiros nem limites de versículos.

Passo a passo:
1. O pedido é do André, como projeto pessoal (não é da UniMissional). Dizer isso no e-mail. Se algum dia for pedido em nome da UniMissional, isso precisa ser decidido por ele e dito de forma explícita.
2. Escrever para **direitos@sbb.org.br** (endereço indicado no EULA para pedidos de autorização), com cópia para **contato@sbb.org.br**.
3. Informar: quem é o solicitante, o projeto (Timóteo App), o endereço do site e do repositório, e que é gratuito, sem anúncios, sem venda e para estudo bíblico.
4. Dizer exatamente o que quer: quais versões (ARA, NAA), exibição por capítulo, sem botão de download, texto servido do próprio site ou por API, idiomas da interface.
5. Pedir resposta por escrito com: autorização ou negativa, condições, texto exato do aviso de direitos autorais que deve aparecer e prazo de validade.
6. Sem resposta em cerca de 10 dias úteis, ligar para (11) 4195-9590 ou usar o WhatsApp 800-727-8888, ambos listados em sbb.org.br/fale-conosco.
7. Não publicar o texto antes da autorização escrita. Guardar a resposta no repositório (por exemplo em `docs/`) e exibir o aviso exigido no rodapé.

## ESV (Crossway)

- Citação livre: até 500 versículos, sem passar de 50% de qualquer livro e sem ser 25% ou mais do texto total da obra.
- O texto completo da ESV **não pode ser hospedado** no site. Pelo que as páginas mostram, o cache local é limitado a 500 versículos.
- A API gratuita (api.esv.org) é só para uso **não comercial**: sem cobrança de acesso, anúncios ou patrocínio. Limites informados: 60 requisições por minuto, 1.000 por hora e 5.000 por dia; até 500 versículos (ou meio livro) por consulta; o texto não pode ser alterado.
- A ESV não pode ser traduzida nem citada em obra publicada sob licença Creative Commons.
- Aviso exigido: "Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®), © 2001 by Crossway, a publishing ministry of Good News Publishers. ESV Text Edition: 2025. The ESV text may not be quoted in any publication made available to the public by a Creative Commons license. The ESV may not be translated in whole or in part into any other language. Used by permission. All rights reserved."
- Licenças acima desse limite são pedidas pelo formulário em crossway.org/permissions/digital/, e a política citada é licenciar a organizações, não a indivíduos. Como este é um projeto pessoal, o caminho realista é só a API gratuita não comercial, se valer a pena.
- Consequência técnica: a chave da API ficaria exposta em um site estático. Seria preciso um proxy serverless pequeno, o que foge do "sem backend". Avaliar custo e se vale a pena antes de qualquer trabalho.

## NKJV (HarperCollins Christian Publishing / Thomas Nelson)

- Citação livre: até 500 versículos, sem ser livro completo e sem passar de 25% do texto da obra.
- Um site com a Bíblia inteira está fora desse limite e exige permissão escrita. Pedido pelo formulário em harpercollinschristian.com/permissions ou por correio ao Departamento de Permissões (P.O. Box 141000, Nashville, TN 37214).
- Aviso exigido: "Scripture taken from the New King James Version®. Copyright © 1982 by Thomas Nelson. Used by permission. All rights reserved."
- Não encontrei API gratuita oficial. Provavelmente não vale o esforço agora.

## Ordem sugerida
1. Feito: WEB, ASV e Bíblia Livre (TB ficou de fora; ver acima). A Almeida 1911 entrou e foi retirada depois, pela ortografia antiga.
2. Em paralelo: pedido da SBB para ARA e NAA.
3. Depois: ESV via API só se houver proxy simples e o uso for não comercial.
4. NKJV: deixar de fora por enquanto.

## Fontes consultadas
- SBB, termo de uso (EULA): sbb.org.br/acordo-de-licenca-de-usuario-final-eula
- SBB, contato: sbb.org.br/fale-conosco
- Crossway, permissões: crossway.org/permissions
- ESV API: api.esv.org
- NKJV, termos de citação (StudyLight): studylight.org/site-resources/copyright-statements/eng/nkj.html
- Situação das versões em português: github.com/damarals/biblias (informação de terceiros, a confirmar em fonte primária)

## Originais em hebraico e grego (interlinear)

Dados em `public/interlinear/`, gerados por `scripts/build-interlinear.mjs` a partir de clones das fontes abaixo (feito em 09/10/2026; a revisão exata de cada fonte fica gravada em cada arquivo, no campo `src`). Licenças lidas nos arquivos das próprias fontes (não em páginas de terceiros).

| Dado | Fonte | Licença | Evidência |
|---|---|---|---|
| Texto hebraico (WLC), lema e morfologia | Open Scriptures Hebrew Bible (OSHB), github.com/openscriptures/morphhb | WLC: domínio público. Lema e morfologia: **CC BY 4.0** | `LICENSE.md` e `README.md` do repositório |
| Léxico hebraico (glosa curta, transliteração, Strong) | Open Scriptures Hebrew Lexicon, github.com/openscriptures/HebrewLexicon (`LexicalIndex.xml`, `HebrewStrong.xml`) | **CC BY 4.0**; o texto de BDB e do Strong permanece em domínio público | `readme.md` do repositório |
| Texto grego do NT (Nestlé 1904) | github.com/biblicalhumanities/Nestle1904 | Domínio público (o site de origem declara) | `xhtml/README.md` |
| Morfologia, lema e Strong do NT | mesmo repositório (`morph/`), Dr. Ulrik Sandborg-Petersen | **CC0** | `morph/README.md` |
| Glosas por palavra do NT | mesmo repositório (`glosses/`), extraídas da Berean Interlinear Bible | Domínio público: README do repositório ("This is now in the public domain") e página de licenciamento da Berean (berean.bible/licensing.htm, lida pelo André em 09/10/2026): "The Berean Bible and Majority Bible texts are officially placed into the public domain as of April 30, 2023… Licensing is not required for any use." (a frase trata da Berean Bible; as glosas da Berean Interlinear são do mesmo projeto) | `glosses/README.md` |
| Strong grego (lema, transliteração, definição) | github.com/morphgnt/strongs-dictionary-xml | **CC0** | `README.md` do repositório |

**Atribuição exibida no app** (quando a faixa de originais está ligada):
- Hebraico: "Texto hebraico: Open Scriptures Hebrew Bible Project (github.com/openscriptures/morphhb), CC BY 4.0; texto do Westminster Leningrad Codex, domínio público. Léxico: Open Scriptures Hebrew Lexicon, CC BY 4.0."
- Grego: "Texto grego: Nestle 1904 (domínio público); morfologia e Strong: biblicalhumanities.org, CC0; glosas: Berean Interlinear Bible (domínio público)."

**Mudanças feitas por este projeto:** o texto do OSHB foi reorganizado na numeração da KJV (os marcadores `KJV:` do próprio OSHB indicam onde começa cada versículo da KJV), o qere substitui o ketiv, e o formato foi compactado. O texto das palavras não foi alterado.

**Avaliado e não usado:** MorphGNT/SBLGNT (texto sob o EULA do SBLGNT; parsing CC BY-SA), OpenGNT (CC BY-SA 4.0) e a STEPBible-Data (o TAGNT usa a grafia do NA28, que tem direitos, e colunas derivadas do OpenGNT; o TIPNR e o TBCWG têm texto gerado por IA). A STEP só entra se autorizar por escrito; ver a conversa de 09/10/2026.

**Fonte tipográfica dos originais:** Cardo, de David J. Perry (SIL Open Font License 1.1, sem Reserved Font Name; `public/licencas/OFL-Cardo.txt`). Escolhida porque cobre todos os sinais usados (vogais e acentos de cantilação do hebraico e o grego politônico) num único desenho; subsetada em `src/fonts/cardo-hebrew.woff2` (7 KB) e `cardo-greek.woff2` (25 KB) com `pyftsubset` (fonttools), mantendo as tabelas de posicionamento. Hospedada no app, nunca pelo Google.
