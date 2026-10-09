# Landing do Timóteo App

Página estática (HTML + CSS, **sem JavaScript** e sem dependências) gerada por `landing/build.mjs`. Visual do app (`docs/design/landing/` e `docs/design/app-b/`); fontes Bricolage Grotesque e Source Sans 3 **hospedadas** (nada do Google; licenças OFL em `dist/licencas/`). Sem analytics, cookies nem formulários.

## Comandos
- `npm run landing` gera `landing/dist/`.
- `npm run check` (e o CI) roda `node landing/build.mjs --check`: o build falha se um preço, nome de plano ou linha da matriz do `src/data/plans.json` não aparecer no HTML, se `plans.json` ganhar uma linha que a landing não mostra nem omite, se faltar imagem, `alt`, `width`/`height`, ou se algo citar recursos do Google.
- `node landing/capture.mjs` refaz as capturas de `landing/img/` (ver o cabeçalho do arquivo: usa um build **local** do app com plano padrão "pro", que nunca é commitado).

## De onde vem cada coisa (nada digitado em dois lugares)
| Dado | Fonte |
|---|---|
| Nomes, preços, preço de entrada, matriz ✅/❌/em parte/em breve | `src/data/plans.json` |
| Personagens, eventos, períodos | `src/data/people.json`, `src/data/timeline.json` |
| Livros, siglas e seções | `src/data/books.js`; cores das seções: `src/styles.css` (`--s-*`) |
| Versões do texto bíblico | `src/data/bible.js` (menos as de `hideVersions` em `config.json`) |
| Dias de reembolso | `src/data/billing.json` |
| Meses do Pro | `supabase/functions/_shared/pricing.js` |
| Textos, FAQ e notas curtas da matriz | `landing/content.json` (marcadores `{refundDays}`, `{months}`, `{price}`, `{versions}`) |
| Endereço do app, endereço da landing, canal de contato | `landing/config.json` |

## Cloudflare Pages (projeto separado do app)
Root directory `landing`, build command `node build.mjs`, output `dist`, branch `main`. Sem variáveis de ambiente. Se quiser evitar rebuild a cada push no app, use "Build watch paths" (incluir `landing/*`, `src/data/*`, `src/styles.css`, `supabase/functions/_shared/pricing.js`).

## Antes de publicar
1. `config.json`: `siteUrl` (endereço final, para canonical e `og:url`); `contactChannel` já definido (`{ "url": "...", "label": "..." }`; hoje o Instagram @andrescultori; sem canal, a página `/contato/` avisa que ele será informado).
2. Cobrança ligada no app (`VITE_BILLING_ENABLED`) e Termos e Política publicados (a landing aponta para `#terms` e `#privacy` do app e promete compra do Pro).
3. Refazer as capturas se o app mudar (`landing/capture.mjs`).
