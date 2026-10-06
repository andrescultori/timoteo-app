# Marca do Timóteo App

## Fontes (não editar)
`branding/fonte/` guarda os dois SVGs originais, **como o André os enviou**:
- `Timoteo_Logomarca.svg` (152×170): só a marca.
- `Timoteo_Logo_Completo.svg` (486×337): marca + TIMÓTEO + ESTUDO BÍBLICO.

Cada um tem **um único `<path>`**. O desenho não é alterado por nenhum script: só mudam a cor de preenchimento e o fundo. Hoje os fontes são traçados de imagem (bordas em degraus); o André vai mandar uma versão final com curvas.

## Cores
- Bege `#F1F0E7`: marca sobre fundo escuro.
- Verde `#042016`: marca sobre fundo claro e fundo do ícone.

## Regenerar tudo
```bash
npm install
node scripts/build-brand-assets.mjs
```
O script usa `@resvg/resvg-js` (devDependency, gratuita, sem serviço externo). **Trocar o desenho** = substituir os 2 arquivos de `branding/fonte/` (mesmos nomes) e rodar o comando acima; depois commitar o que mudou (os ativos gerados ficam versionados, o build do Cloudflare não os gera). O `npm run check` falha se os ativos não baterem com os fontes.

## O que é gerado
| Arquivo | Uso |
|---|---|
| `public/brand/marca-bege.svg`, `marca-verde.svg` | marca solta (bege em fundo escuro, verde em fundo claro) |
| `public/brand/logo-completo-bege.svg`, `logo-completo-verde.svg` | marca + nome + legenda (só a partir de ~300 px de largura) |
| `public/favicon.svg` | quadrado arredondado (raio de 22%) verde com a marca bege em 60% da largura |
| `public/favicon-32.png`, `icon-192.png`, `icon-512.png` | mesmo ícone, em PNG |
| `public/apple-touch-icon.png` (180) | quadrado cheio, sem cantos (o iOS arredonda) |
| `public/icon-maskable-512.png` | fundo verde cheio, marca em 45% (zona segura do Android) |
| `public/og-image.png` (1200×630) | logo completo bege sobre verde, com margem, para compartilhar o link |
| `src/logoPath.js` | o `d` da marca, importado por `src/Logo.jsx` (arquivo gerado) |

`index.html` e `public/manifest.webmanifest` apontam para esses arquivos com caminhos relativos.

## No app
`src/Logo.jsx` desenha a marca **inline** (`currentColor`), e o `.logo` usa a variável `--logo` de `src/styles.css` (bege no tema escuro, verde no claro).
