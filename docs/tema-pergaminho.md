# Tema Pergaminho (parchment)

Quarto tema do app, depois de Auto, Escuro e Claro. Claro por definição (`color-scheme: light`), com serifa no app todo. **Não há variante escura**: com o sistema em modo escuro, o Pergaminho continua claro.

## Como funciona
- O botão do cabeçalho percorre auto → dark → light → parchment → auto. O valor fica em `localStorage` (`theme`); um valor inválido volta para `auto`. O tema vira o atributo `data-theme` em `<html>` (`auto` remove o atributo). Código: `src/App.jsx`.
- Os tokens ficam em `src/styles.css`, no bloco `:root[data-theme='parchment']`. As regras que só existem no Pergaminho vêm no fim do arquivo, todas com esse prefixo; os outros temas não mudam.
- **Regra do modo escuro automático:** o bloco `@media (prefers-color-scheme: dark)` usa `:root:not([data-theme='light']):not([data-theme='parchment'])`. Sem o `:not([data-theme='parchment'])` o Pergaminho viraria escuro quando o sistema está em escuro. **Todo tema claro novo precisa entrar nessa lista.**
- Fontes (Cormorant Garamond e EB Garamond) só são pedidas ao Google Fonts na primeira vez que o tema é ativado (`<link id="parchment-fonts">`, em `App.jsx`). Até carregar, vale a Georgia.

## Tokens
| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#fbf9f3` | fundo da página |
| `--panel` | `#fffdf8` | painéis e cartões |
| `--panel-2` | `#f6f1e4` | campos, abas, chips, botões secundários (nos outros temas = `--panel`) |
| `--fg` / `--muted` | `#1f2320` / `#54492f` | tinta e texto secundário |
| `--line` / `--line-soft` | `#dccba6` / `#e6d8b8` | filetes e separadores leves |
| `--accent` / `--on-accent` | `#0f2d24` / `#f8f7f2` | marca; texto sobre a marca (aba e botão ativos) |
| `--accent-2` / `--accent-hover` / `--green-soft` | `#3f5a4e` / `#1f4a3b` / `#6b8f7e` | números de versículo e rótulos; hover de link; detalhes |
| `--s-*` | pigmentos envelhecidos | cores das seções (lei `#d8a3a0` … profecia `#b3a894`) |
| `--sea` `--land` `--coast` `--halo` | `#d3d6c4` `#f1e5c8` `#a68c66` `#f1e5c8` | mapa |
| `--f-display` | Cormorant Garamond | títulos, nomes de livro, siglas, wordmark |
| `--f-body` / `--f-read` | EB Garamond | texto e leitor |

## Tamanhos
Texto de conteúdo `--fs-content` 17px/1.55 (ficha, lugares, linha do tempo, personagens); leitor 17px/1.75, coluna de ~62ch, número do versículo 12px; subtítulo da grade `--fs-sub` 19px itálico; título de página 40px (personagem 44px); título de seção 28px; legendas 14,5–15px; rótulos do mapa `--fs-map-label` 18px (mar: `--fs-water`).
O tamanho dos rótulos do mapa é lido da variável CSS em `src/MapView.jsx` (hook `useCssNumber`, `src/useTheme.js`) porque entra no cálculo de colisão dos rótulos.

## Logo
`src/Logo.jsx` é um **placeholder**; o vetor oficial será enviado pelo André. Trocar só esse arquivo (SVG com `currentColor`). Aparece só no Pergaminho, ao lado do wordmark "TIMÓTEO" (primeira palavra do título do app, em maiúsculas). Não há favicon nem ícones de PWA ainda.

## Contraste (WCAG)
Tinta sobre fundo 15,1:1; secundário 8,4:1; `--accent-2` sobre painel 7,4:1; texto claro sobre accent 13,8:1; texto escuro sobre os chips das seções 5,3 a 10,2:1. **Abaixo de 4,5:1:** o rótulo "Mar Mediterrâneo" (`#5e6b5c` sobre `--sea`, 3,8:1). Sugestão: `#4a5748` (cerca de 5,5:1), à espera da decisão do André.

## Adicionar outro tema
1. Crie `:root[data-theme='nome']` em `src/styles.css` com todos os tokens da tabela e `color-scheme`.
2. Se for claro, inclua `:not([data-theme='nome'])` no seletor do `@media` escuro.
3. Acrescente o valor em `THEMES` e `THEME_LABEL` em `src/App.jsx` e as chaves `themeNome` em PT e EN no `src/i18n.js`.
4. Regras só desse tema ficam no fim do `styles.css`, com o prefixo do tema.
