# Tema Pergaminho escuro

O app tem **um tema só**, o Pergaminho escuro. Não há seletor de tema nem `data-theme`; o `color-scheme` é sempre `dark`, mesmo com o sistema do navegador em modo claro. Design system aprovado: https://claude.ai/artifact/KubSPfxeLAVWVqNHBhmtPR

## Tokens (`:root` em `src/styles.css`)
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

## Regras de aplicação
- Página `--bg`; painéis `--panel`; campos, abas, chips e cartões dentro de painel `--panel-2`. Sem sombras, exceto `--shadow-pop` no aviso flutuante.
- Texto: `--fg` conteúdo; `--muted` legendas; `--accent` links, datas, título de capítulo e ponto do mapa; `--accent-2` rótulos, referências e número de versículo; hover de link `--accent-hover`.
- Aba, botão e item ativos: fundo `--accent`, texto `--on-accent`.
- Blocos de livro, chips de sigla e a borda superior de 6px dos painéis usam a cor da seção; o texto sobre elas é `--on-section`; borda do bloco `rgba(20,16,11,.4)`. **Cor de seção nunca vira cor de texto.**
- Foco: `outline: 2px solid var(--focus); outline-offset: 2px`. Erro/remover: `--danger`, sempre com texto.
- Raios: botões, abas e busca `--radius-pill`; cartões e itens `--radius-card`; painéis `--radius-panel`; blocos de livro `--radius-chip`.

## Tamanhos
Corpo 17px/1,55; leitor 17px/1,75 (coluna de ~62ch). Títulos em Cormorant 700: página 40/42, personagem 44/46, seção ou período 30/34, lugar e evento 19/23. "Capítulo N" 28px 600, letter-spacing .04em, `--accent`; sigla do bloco 27px 700; wordmark TIMÓTEO 22px 600, letter-spacing .08em. Frase da grade 19px itálico; botões, abas e campos 16px 500; legendas 14,5px; rótulos em maiúsculas 13px 600, letter-spacing .14em; número do versículo 12px 600. Numerais lining. Mapa: nomes dos lugares 18px (16px em tela estreita, em `src/MapView.jsx`); mar em itálico 18px, letter-spacing 3, `--sea-label`; ponto `--accent` com contorno `--panel`; localização debatida: ponto vazado com contorno tracejado.
As fontes vêm do `<link>` do `index.html` (carregadas sempre). `index.html` também fixa `color-scheme: dark`, `theme-color #17130e` e o fundo do `<html>` para não piscar claro.

## Logo
`src/Logo.jsx` é um **placeholder**; o vetor oficial será enviado pelo André. Trocar só esse arquivo (SVG com `currentColor`). Aparece com o wordmark em todas as páginas. Não há favicon nem ícones de PWA ainda.

## Temas anteriores (arquivados)
Auto, claro, escuro e Pergaminho claro saíram do app e estão arquivados:
- **Branch `themes-archive-2026-10`** (a tag de mesmo nome não pôde ser criada pelo ambiente; o branch aponta para o mesmo commit, `b12a4db`, e pode ser convertido em tag).
- **`docs/archive/temas/`**: `styles-temas-anteriores.css`, `App-tema-snippet.jsx.txt` e `README.md` (como restaurar). Esses arquivos não são importados e não entram no build.
