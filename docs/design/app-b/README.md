# Design do app, opção B (escolhida pelo André em 2026-10-08)

Referência visual para implementar. Os 4 arquivos `.dc.html` são maquetes (marcação HTML com estilos inline; **não rodam sozinhos**, dependem de um runtime do editor de design). Leia como especificação de layout, cores, tipografia e espaçamento. O código real é React + CSS do app.

| Arquivo | Tela do app |
|---|---|
| `Grade.dc.html` | Início: grade dos 66 livros |
| `Ficha.dc.html` | Página do livro, aba Ficha |
| `Leitor.dc.html` | Página do livro, aba Ler (com lateral) |
| `Config.dc.html` | Configurações (ajustes de leitura) |

## Princípio
Visual claro, limpo, de app profissional para estudar por muito tempo: fundo off-white, cartões brancos, verde-escuro só onde importa, cor por seção nos livros. **Sem serifada na interface** (a serifada fica só no texto bíblico).

## Cores (brand book)
- Verde-escuro `#0F2D24` (primária: botões, títulos, aba ativa, cartão "Continuar", versículo-chave)
- Off-white `#F8F7F2` (fundo do app)
- Branco `#FFFFFF` (cartões, barra do topo)
- Verde-claro `#6B8F7E` / `#A9C1B3` (detalhes sobre verde-escuro)
- Verde médio de rótulos `#3F6553`; fundo de chip `#E4EBE6`; fundo claro `#F1F0E7`
- Charcoal `#1F2320` (texto); apoio `#4F5853`, `#2E3531`
- Linhas `#E2E1D8` (cartões), `#CFCEC3` e `#9AA39D` (bordas de campos/botões)
- Logo: `public/brand/marca-verde.svg` na barra clara.

## Cores por seção dos livros (fora do brand book, de propósito)
Lei `#0F2D24` · Históricos `#7A4A2B` · Poesia e Sabedoria `#6B3F63` · Profetas Maiores `#2F4F8A` · Profetas Menores `#2D6F7C` · Evangelhos `#8E3B3B` · Atos `#A5601A` · Cartas de Paulo `#55733A` · Outras Cartas `#5B6B7A` · Profecia `#1F2320`. Texto sobre elas: `#F8F7F2`.

## Tipografia (todas hospedadas no app; nunca Google Fonts em produção)
- Títulos e siglas: **Bricolage Grotesque** 700 (h1 44px, h2 26px nos cartões grandes e 22px na lateral, siglas dos livros nos tiles)
- Interface e textos de ficha: **Source Sans 3** 400/600/700, 17px, entrelinha 1,55. Rótulos de campo: 14px, 600, maiúsculas, espaçamento 0,04em, cor `#3F6553`
- **Texto bíblico no leitor:** **Literata** 400 (serifada), padrão 21px, entrelinha 1,7, coluna de 660px; número do versículo em Source Sans 3 600, sobrescrito, cor de destaque
- A Marcellus (serifada da marca) **não** entra no app nesta opção.

## Padrões de componente
- Cartões: fundo branco, borda 1px `#E2E1D8`, raio 18px, padding 24 a 28px. Chips/pílulas: raio 999px. Botões e campos: raio 12px, altura mínima 44px.
- Abas do livro (Resumo, Ficha, Mapa, Ler): pílulas; ativa em verde-escuro com texto off-white.
- Topo: barra branca com borda inferior, logo, menu (Livros, Linha do tempo, Personagens, Genealogia, Favoritos; ativo com sublinhado verde), idioma e selo do plano.
- Card "Continuar de onde parei": verde-escuro, texto off-white, botão off-white.
- Aba Ler: texto à esquerda, lateral à direita (versículo-chave, personagens **do capítulo atual** com link "Ver todos do livro", esboço com a **seção do capítulo atual em negrito e destacada**). Barra do leitor: capítulo, versão, anterior/próximo e botão "Aa Ajustes" que leva às Configurações.
- Ajustes de leitura ficam em **Configurações** (não no leitor): tamanho (6 passos: 17, 19, 21, 23, 26, 30 px), espaçamento (1,45 / 1,7 / 2,0), largura (540 / 660 / 820 px), fonte (serifada / sem serifa), **cada versículo em uma linha** (liga/desliga), tema da leitura (Claro, Sépia, Escuro), restaurar padrão e pré-visualização ao vivo. Aviso de onde ficam salvos (conta ou só neste aparelho).
- Temas da leitura (só a superfície de leitura): Claro fundo `#F8F7F2` texto `#1F2320`; Sépia fundo `#F1E7D0` texto `#3B2F20` destaque `#8A5A2B`; Escuro fundo `#14201B` texto `#E6E4DA` destaque `#A9C1B3`.
