# Brief da landing do Timóteo App (para o Claude Design)

Uso: colar no Claude Design para prototipar o visual; depois o Code implementa. Os textos abaixo são **rascunho para aprovação do André** (decisão de mérito dele). Planos e preços saem de `docs/comercializacao.md`.

## O que é a página

Landing estática, em português (com versão em inglês depois), publicada em projeto próprio do Cloudflare Pages. Objetivo único: explicar o produto e levar a pessoa a **escolher um plano**. O app fica em outro endereço; o botão "Escolher plano" leva a ele com o plano na URL.

## Público e tom

Estudantes da Bíblia, líderes e professores de escola bíblica, brasileiros evangélicos. Tom acessível, moderno e minimalista; linha evangélica. Nada de promessa exagerada. Não usar a arte do TaBíblia Periódica original; o design é próprio.

Visual aprovado pelo André em 03/10/2026 no mockup feito no Claude Design (azul-tinta com detalhe dourado; títulos Bricolage Grotesque, texto Source Sans 3; tabela colorida das siglas dos 66 livros no topo). As mudanças de texto pedidas por ele já estão neste brief.

## Seções (em ordem)

1. **Topo:** nome "Timóteo App", uma frase de valor e dois botões: "Começar grátis" (abre o app) e "Ver planos" (rola até os planos).
2. **O que é:** uma tabela dos 66 livros da Bíblia; cada livro abre uma ficha de estudo, um mapa dos lugares e o texto para leitura. Mostrar 3 a 4 capturas (já existem em `docs/images/`: grade, mapa, linha do tempo, personagens; refazer com a marca nova).
3. **Como as peças se ligam:** linha do tempo ⇄ mapa ⇄ personagens (um clique leva de um ao outro). Diagrama simples.
4. **O que tem hoje (números reais, atualizar na hora de publicar):** 66 livros com ficha em português e inglês; 210 personagens; linha do tempo com 13 períodos e 69 eventos; mapas nas seções da Bíblia; genealogia de Adão a Jesus (em expansão); texto bíblico em várias versões de licença clara.
5. **Posição tradicional e acadêmica lado a lado:** onde autoria, datação ou localização são debatidas, o app mostra as posições e marca a incerteza (e há um botão para esconder a posição acadêmica).
6. **Planos (caixas com ✅/❌):** Essencial, Pro e Premium (este com selo "em breve"). Quatro estados por item: incluído, não incluído, em parte e em breve (ícones, não só cor). Cada caixa tem preço, lista de itens com ✅ ou ❌ e o botão "Escolher plano". Pro em destaque. Itens "em breve" marcados assim, sem ✅. A tabela deve ser alimentada pela configuração única de planos para não divergir do app.
7. **Perguntas frequentes:** como funciona o pagamento (checkout do Mercado Pago, sem cartão na nossa página), o que acontece ao vencer (volta ao Essencial, sem perder progresso), que versões da Bíblia existem, para quem é, como cancelar.
8. **Rodapé:** "Desenvolvido por André Scultori · © 2026 · GitHub" (skill de assinatura; o GitHub aponta para o repositório do projeto), links para Termos de uso e Política de privacidade.

## Planos para a tabela

Preços: Essencial R$0; Pro R$49,90/ano (primeiro pagamento R$29,90); Premium R$79,90/ano (primeiro pagamento R$49,90), em breve. Exibir o preço riscado e o de entrada, como o André pediu ("de R$49,90 por R$29,90 no 1º ano").

Itens (✅ inclui, ❌ não inclui):
- Bíblia em todas as versões disponíveis: Essencial ✅, Pro ✅, Premium ✅
- Fichas dos 66 livros: Essencial em parte ("mapas e estrutura dos livros poéticos limitados"), Pro ✅ completas, Premium ✅
- Mapas: Essencial só Evangelhos e Pentateuco, Pro ✅ todos, Premium ✅
- Estrutura dos livros poéticos: Essencial em parte ("livro de Salmos completo"), Pro ✅, Premium ✅
- Personagens: Essencial 30 a 50 principais, Pro ✅ 200+, Premium ✅
- Linha do tempo: Essencial ❌, Pro ✅, Premium ✅
- Genealogia: Essencial ❌, Pro ✅ (em expansão), Premium ✅
- "Leitura gamificada e mais": "em breve" no Pro e no Premium (o "mais" são os links BibleProject e concordância)
- 10 devocionais ou pregações com IA por mês, em PDF: só Premium (em breve)

## Regras

- Sem depoimentos, avaliações ou números de usuários inventados. Só o que for verdadeiro na publicação.
- Não colocar nenhum campo de cartão na página.
- A landing só coleta e-mail na lista de espera ("Avise-me" do Premium e dos recursos em breve), com a caixa de consentimento própria.
- Contagens e preços vêm de dados do projeto, não escritos à mão em vários lugares.
- Acessível (contraste, teclado) e legível no celular; carregamento rápido.

## Logo (arquivos prontos)
Gerados a partir dos SVGs originais em `branding/fonte/` (ver `branding/README.md`); a versão final com curvas ainda vai chegar e entra trocando só os 2 fontes e rodando `node scripts/build-brand-assets.mjs`. Não redesenhar nem "consertar" o serrilhado.
- `public/brand/marca-bege.svg` e `marca-verde.svg`: só a marca (152×170).
- `public/brand/logo-completo-bege.svg` e `logo-completo-verde.svg`: marca + TIMÓTEO + ESTUDO BÍBLICO (486×337).
- `public/favicon.svg`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`, `og-image.png` (1200×630), `manifest.webmanifest`: ícones e compartilhamento do app; a landing pode reaproveitá-los.
- **Regra de cor:** bege `#F1F0E7` sobre fundo escuro; verde `#042016` sobre fundo claro (e fundo do ícone).
- **Tamanho:** o logo completo só a partir de ~300 px de largura, porque "ESTUDO BÍBLICO" é muito fino. Abaixo disso, usar só a marca.
- **Atenção:** nos fontes traçados de imagem, os traços horizontais finos de "ESTUDO BÍBLICO" saem com espessura zero em alguns pontos (o E parece F, o L parece I). Só some com a versão final em curvas; até lá, evitar essa legenda em destaque.

