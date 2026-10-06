# Temas Pergaminho (escuro e claro)

O app tem **dois temas**, os dois do design Pergaminho:
- **Pergaminho escuro**: tokens no `:root` de `src/styles.css`, `color-scheme: dark`.
- **Pergaminho claro**: `:root[data-theme='light']`, só troca os tokens de cor; tipografia, tamanhos e regras são os mesmos.

O botão do cabeçalho percorre **Auto → ☾ (escuro) → ☀ (claro) → Auto**. A preferência fica em `localStorage.theme` (`auto`, `dark` ou `light`; padrão `light`: quem abre pela primeira vez vê o Pergaminho claro, mesmo com o sistema em escuro; quem já tem valor guardado, inclusive `auto`, mantém).
- **Auto** segue o sistema (`prefers-color-scheme`): escuro → Pergaminho escuro, claro → Pergaminho claro, e acompanha a troca do sistema enquanto o app está aberto.
- O CSS só conhece `data-theme='dark'|'light'`: `src/App.jsx` grava em `<html>` o tema já resolvido (no auto, o do sistema). O `:root` sem atributo é o escuro.
- Valores antigos guardados: `parchment` (nome antigo do Pergaminho claro) vira `light`; valor inválido vira `light`.
- `index.html` aplica o tema (resolvido) antes do primeiro desenho e `App.jsx` ajusta o `theme-color`, para o fundo não piscar. `<meta name="color-scheme">` é `dark light`.
Design system do escuro: https://claude.ai/artifact/KubSPfxeLAVWVqNHBhmtPR

## Tokens do Pergaminho escuro (`:root` em `src/styles.css`)
| Grupo | Tokens |
|---|---|
| Superfícies | `--bg #17130e` (página), `--panel #1f1a13` (painéis), `--panel-2 #2a2319` (campos, abas, chips e cartões dentro de painel) |
| Linhas | `--line #4a3f2e` (bordas decorativas), `--line-soft #352d21` (separadores de lista), `--line-strong #8a7957` (contorno de controle) |
| Texto | `--fg #efe6d2`, `--muted #b8aa8c` |
| Destaque | `--accent #a9cdbb`, `--accent-hover #c6e0d2`, `--accent-2 #8fb5a6`, `--on-accent #0f2d24` |
| Estados | `--focus #c6e0d2`, `--danger #e39a8b`, `--on-section #14100b` (texto sobre as cores de seção) |
| Seções | `--s-lei #c58f8c`, `--s-historicos #bc7266`, `--s-poesia #a3ae76`, `--s-profMaiores #75905f`, `--s-profMenores #cbae63`, `--s-evangelhos #c98e4d`, `--s-atos #7aa494`, `--s-paulo #92a9ba`, `--s-outras #7087a5`, `--s-profecia #a09581` |
| Mapa | `--sea #111a17`, `--land #2f281a`, `--coast #8a7957`, `--halo #2f281a`, `--sea-label #9fb3a8` |
| Outros | `--shadow-pop`, `--space-1…10` (4 a 40px), `--radius-chip 5px`, `--radius-card 8px`, `--radius-panel 12px`, `--radius-pill 999px`; fontes `--f-display` (Cormorant Garamond), `--f-body` e `--f-read` (EB Garamond) |

## Tokens do Pergaminho claro (`:root[data-theme='light']`)
`--bg #fbf9f3`, `--panel #fffdf8`, `--panel-2 #f6f1e4`; `--line #dccba6`, `--line-soft #e6d8b8`; `--fg #1f2320`, `--muted #54492f`; `--accent #0f2d24`, `--accent-hover #1f4a3b`, `--accent-2 #3f5a4e`, `--on-accent #f8f7f2`; seções `#d8a3a0 #c9776a #b8c38a #869c6e #e0c27a #d9a060 #8fb5a6 #a7bcca #8199b5 #b3a894`; mapa `--sea #d3d6c4`, `--land #f1e5c8`, `--coast #a68c66`, `--halo #f1e5c8`.
Tokens que o desenho original do claro não tinha e foram **derivados** (revisar com o André): `--line-strong #8a7957` (igual ao do escuro; 3,8 a 4,2:1), `--focus #1f4a3b`, `--danger #9a3b2c`, `--sea-label #4a5748` (o `#5e6b5c` do Pergaminho claro original dava 3,8:1), `--shadow-pop` com tinta clara. `--on-section` e `--space-*`/`--radius-*` são os mesmos do escuro.

## Regras de aplicação
- Página `--bg`; painéis `--panel`; campos, abas, chips e cartões dentro de painel `--panel-2`. Sem sombras, exceto `--shadow-pop` no aviso flutuante.
- Texto: `--fg` conteúdo; `--muted` legendas; `--accent` links, datas, título de capítulo e ponto do mapa; `--accent-2` rótulos, referências e número de versículo; hover de link `--accent-hover`.
- Aba, botão e item ativos: fundo `--accent`, texto `--on-accent`.
- Blocos de livro, chips de sigla e a borda superior de 6px dos painéis usam a cor da seção; o texto sobre elas é `--on-section`; borda do bloco `rgba(20,16,11,.4)`. **Cor de seção nunca vira cor de texto.**
- Foco: `outline: 2px solid var(--focus); outline-offset: 2px`. Erro/remover: `--danger`, sempre com texto.
- Raios: botões, abas e busca `--radius-pill`; cartões e itens `--radius-card`; painéis `--radius-panel`; blocos de livro `--radius-chip`.

## Tamanhos
Corpo 17px/1,55; leitor 17px/1,75 (coluna de ~62ch). Títulos em Cormorant 700: página 40/42, personagem 44/46, seção ou período 30/34, lugar e evento 19/23. "Capítulo N" 28px 600, letter-spacing .04em, `--accent`; sigla do bloco 27px 700; wordmark TIMÓTEO 22px 600, letter-spacing .08em. Frase da grade 19px itálico; botões, abas e campos 16px 500; legendas 14,5px; rótulos em maiúsculas 13px 600, letter-spacing .14em; número do versículo 12px 600. Numerais lining. Mapa: nomes dos lugares 18px (16px em tela estreita, em `src/MapView.jsx`); mar em itálico 18px, letter-spacing 3, `--sea-label`; ponto `--accent` com contorno `--panel`; localização debatida: ponto vazado com contorno tracejado.
As fontes vêm do `<link>` do `index.html` (carregadas sempre).

## Logo
`src/Logo.jsx` é um **placeholder**; o vetor oficial será enviado pelo André. Trocar só esse arquivo (SVG com `currentColor`). Aparece com o wordmark em todas as páginas. Não há favicon nem ícones de PWA ainda.

## Temas antigos (arquivados)
Saíram do app o modo automático (que seguia o sistema) e os temas claro e escuro de antes do Pergaminho (fontes Bricolage Grotesque, Figtree e Literata). Estão arquivados:
- **Branch `themes-archive-2026-10`** (a tag de mesmo nome não pôde ser criada pelo ambiente; o branch aponta para o mesmo commit, `b12a4db`, e pode ser convertido em tag).
- **`docs/archive/temas/`**: `styles-temas-anteriores.css`, `App-tema-snippet.jsx.txt` e `README.md` (como restaurar). Não são importados e não entram no build.

## Adicionar outro tema
1. Crie `:root[data-theme='nome']` em `src/styles.css` com todos os tokens (copie o bloco `light`) e `color-scheme`.
2. Inclua o valor em `THEMES`/`THEME_LABEL` e nas chaves `theme…` do `src/i18n.js`; ajuste o script do `index.html` e o ciclo do botão (`THEMES` em `App.jsx`).
