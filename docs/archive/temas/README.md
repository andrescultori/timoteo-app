# Temas anteriores (arquivo)

Até out/2026 o Timóteo App tinha quatro temas: **auto** (seguia o sistema), **claro**, **escuro** (as paletas verde-água, com Bricolage Grotesque, Figtree e Literata) e **Pergaminho claro**. Em out/2026 ficaram só os dois Pergaminho, **escuro** (padrão) e **claro** (`docs/tema-pergaminho.md`). Este diretório guarda o que foi retirado (auto, claro e escuro antigos), para voltarmos se for preciso. **O Pergaminho claro não foi retirado**: hoje é o tema `light`.

**Estes arquivos não são importados pelo app nem entram no build** (ficam fora de `src/` e de `public/`).

## O que há aqui
- `styles-temas-anteriores.css`: os tokens do `:root` claro antigo, o `@media (prefers-color-scheme: dark)` e `:root[data-theme='dark']` antigo, copiados sem alteração de `src/styles.css`.
- `App-tema-snippet.jsx.txt`: do `src/App.jsx` de antes, o estado `theme` (auto | dark | light | parchment), o `cycleTheme`, o botão e o `useEffect` do `data-theme`. É o ciclo antigo; no app de hoje o botão só alterna escuro/claro.

## Onde está o código completo
Branch **`themes-archive-2026-10`** (mesmo commit planejado para a tag de mesmo nome, `b12a4db`): `styles.css`, `App.jsx`, `MapView.jsx`, `useTheme.js`, `i18n.js` e `index.html` do último estado com os quatro temas. `git checkout themes-archive-2026-10 -- <arquivo>` recupera qualquer um.

## Como restaurar (auto, claro e escuro antigos)
1. Em `src/styles.css`, acrescente os blocos do arquivo como temas novos (por exemplo `:root[data-theme='classic-light']` e `'classic-dark'`), com os tokens que o Pergaminho tem a mais (`--panel-2`, `--line-soft`, `--line-strong`, `--accent-2`, `--accent-hover`, `--on-accent`, `--focus`, `--danger`, `--on-section`, `--sea-label`, `--shadow-pop`); o `@media` automático precisa excluir os `data-theme` que existirem.
2. Em `src/App.jsx` e `src/i18n.js`, amplie `THEMES`, os rótulos e o botão (o trecho `App-tema-snippet.jsx.txt` mostra o ciclo antigo).
3. As fontes antigas (Bricolage Grotesque, Figtree, Literata) e o tamanho de rótulo do mapa (12,5px) vêm do branch de arquivo; o mapa de hoje usa 18px fixos em `src/MapView.jsx`.
4. Rode `npm run check` e `npm run build`.
