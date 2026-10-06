# Temas anteriores (arquivo)

Até out/2026 o Timóteo App tinha quatro temas: **auto** (segue o sistema), **claro**, **escuro** e **Pergaminho claro** (parchment). Em out/2026 passou a existir só o **Pergaminho escuro** (`docs/tema-pergaminho-escuro.md`). Este diretório guarda o que foi retirado, para voltarmos se for preciso.

**Estes arquivos não são importados pelo app nem entram no build** (ficam fora de `src/` e de `public/`).

## O que há aqui
- `styles-temas-anteriores.css`: os blocos de CSS copiados sem alteração de `src/styles.css` (tokens do `:root` claro, `@media (prefers-color-scheme: dark)`, `:root[data-theme='dark']`, `:root[data-theme='parchment']` e as regras específicas do Pergaminho claro).
- `App-tema-snippet.jsx.txt`: do `src/App.jsx`, o estado `theme`, o `cycleTheme`, o botão e o `useEffect` que grava `data-theme`.

## Onde está o código completo
Branch **`themes-archive-2026-10`** (mesmo commit planejado para a tag de mesmo nome, `b12a4db`): tem `styles.css`, `App.jsx`, `MapView.jsx`, `useTheme.js`, `i18n.js` e `index.html` do último estado com os quatro temas. `git checkout themes-archive-2026-10 -- <arquivo>` recupera qualquer um.

## Como restaurar
1. Em `src/styles.css`, troque o bloco `:root` único (Pergaminho escuro) por: o `:root` claro, o `@media` escuro e os blocos `data-theme` da Parte 1 de `styles-temas-anteriores.css`, e acrescente a Parte 2 no fim do arquivo. O Pergaminho escuro vira um bloco `:root[data-theme='...']` (copie os tokens do `:root` atual) e entra na exclusão do `@media` escuro.
2. Em `src/App.jsx`, recoloque o estado `theme`, o `cycleTheme`, o botão de tema e o `useEffect` do `data-theme` (`App-tema-snippet.jsx.txt`); recoloque as chaves `toggleTheme` e `themeAuto/Dark/Light/Parchment` em `src/i18n.js` (veja o branch de arquivo).
3. Recupere `src/useTheme.js` e os trechos de `src/MapView.jsx` que leem o tema (rótulos 12,5px/11px nos temas antigos) do branch de arquivo.
4. Remova do `index.html` o `color-scheme: dark`, o `theme-color` fixo e o `<style>` do `<html>`; restaure as fontes dos temas claros (Bricolage Grotesque, Figtree e Literata) ou deixe as do Pergaminho.
5. Remova dos tokens do `:root` do tema escuro os que só existem nele, se não forem mais usados (`--line-strong`, `--focus`, `--danger`, `--on-section`, `--sea-label`, `--space-*`, `--radius-*`, `--shadow-pop`), e rode `npm run check` e `npm run build`.
