// Gera os ativos de marca a partir dos 2 SVGs-fonte em branding/fonte/ (ver branding/README.md).
// Uso: node scripts/build-brand-assets.mjs        (regenera tudo)
// O path (`d`) dos fontes NUNCA é alterado: só se troca cor de preenchimento e fundo. Trocar o desenho = trocar os 2 fontes e rodar de novo.
import fs from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const root = path.resolve(import.meta.dirname, '..');
const FONTE = path.join(root, 'branding/fonte');
const PUB = path.join(root, 'public');
const BRAND = path.join(PUB, 'brand');

const BEGE = '#F1F0E7'; // marca sobre fundo escuro
const VERDE = '#042016'; // marca sobre fundo claro e fundo do ícone

// lê o `d` e o tamanho (viewBox) de um fonte
function lerFonte(nome) {
  const svg = fs.readFileSync(path.join(FONTE, nome), 'utf8');
  const d = svg.match(/<path\b[^>]*?\sd="([^"]*)"/)?.[1];
  const vb = svg.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/);
  if (!d || !vb) throw new Error(`${nome}: não achei o path (d) ou o viewBox`);
  if ((svg.match(/<path\b/g) ?? []).length !== 1) throw new Error(`${nome}: esperava exatamente 1 <path>`);
  return { d, w: Number(vb[1]), h: Number(vb[2]) };
}
const marca = lerFonte('Timoteo_Logomarca.svg');
const completo = lerFonte('Timoteo_Logo_Completo.svg');

const RULES = 'fill-rule="evenodd" clip-rule="evenodd"';
const pathEl = (d, fill) => `<path d="${d}" fill="${fill}" ${RULES}/>`;

// SVG da marca ou do logo completo em uma cor (mesmo path, fill trocado)
const soltoSvg = (f, fill, titulo) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${f.w}" height="${f.h}" viewBox="0 0 ${f.w} ${f.h}">\n  <title>${titulo}</title>\n  ${pathEl(f.d, fill)}\n</svg>\n`;

// quadrado de lado `lado` com a marca bege centralizada ocupando `largura` (fração do lado); `raio` em fração do lado
function icone({ lado = 512, largura = 0.6, raio = 0, fundo = VERDE }) {
  const k = (lado * largura) / marca.w;
  const x = (lado - marca.w * k) / 2;
  const y = (lado - marca.h * k) / 2;
  const r = raio * lado;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}" viewBox="0 0 ${lado} ${lado}">\n  <rect width="${lado}" height="${lado}"${r ? ` rx="${+r.toFixed(2)}"` : ''} fill="${fundo}"/>\n  <g transform="translate(${+x.toFixed(3)} ${+y.toFixed(3)}) scale(${+k.toFixed(5)})">${pathEl(marca.d, BEGE)}</g>\n</svg>\n`;
}

// og-image: logo completo bege centralizado sobre verde, com margem (ocupa `altura` da altura)
function og({ w = 1200, h = 630, altura = 0.74 }) {
  const k = (h * altura) / completo.h;
  const x = (w - completo.w * k) / 2;
  const y = (h - completo.h * k) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">\n  <rect width="${w}" height="${h}" fill="${VERDE}"/>\n  <g transform="translate(${+x.toFixed(3)} ${+y.toFixed(3)}) scale(${+k.toFixed(5)})">${pathEl(completo.d, BEGE)}</g>\n</svg>\n`;
}

const png = (svg, largura) => new Resvg(svg, { fitTo: { mode: 'width', value: largura }, background: 'rgba(0,0,0,0)' }).render().asPng();
const out = [];
const gravar = (arq, conteudo) => { fs.mkdirSync(path.dirname(arq), { recursive: true }); fs.writeFileSync(arq, conteudo); out.push(path.relative(root, arq)); };

// SVGs soltos
gravar(path.join(BRAND, 'marca-bege.svg'), soltoSvg(marca, BEGE, 'Timóteo — Logomarca'));
gravar(path.join(BRAND, 'marca-verde.svg'), soltoSvg(marca, VERDE, 'Timóteo — Logomarca'));
gravar(path.join(BRAND, 'logo-completo-bege.svg'), soltoSvg(completo, BEGE, 'Timóteo — Logo completo'));
gravar(path.join(BRAND, 'logo-completo-verde.svg'), soltoSvg(completo, VERDE, 'Timóteo — Logo completo'));

// ícone do app: quadrado arredondado (rx = 22% do lado), marca em ~60% da largura
const arredondado = icone({ largura: 0.6, raio: 0.22 });
gravar(path.join(PUB, 'favicon.svg'), arredondado);
gravar(path.join(PUB, 'favicon-32.png'), png(arredondado, 32));
gravar(path.join(PUB, 'icon-192.png'), png(arredondado, 192));
gravar(path.join(PUB, 'icon-512.png'), png(arredondado, 512));
// iOS arredonda sozinho: quadrado cheio, sem cantos
gravar(path.join(PUB, 'apple-touch-icon.png'), png(icone({ largura: 0.6, raio: 0 }), 180));
// maskable: fundo cheio, marca em ~45% (dentro da zona segura de 80%)
gravar(path.join(PUB, 'icon-maskable-512.png'), png(icone({ largura: 0.45, raio: 0 }), 512));
// compartilhamento (Open Graph)
gravar(path.join(PUB, 'og-image.png'), png(og({}), 1200));

// o `d` da marca para o componente do app (src/Logo.jsx importa daqui); arquivo GERADO
gravar(path.join(root, 'src/logoPath.js'),
  `// GERADO por scripts/build-brand-assets.mjs a partir de branding/fonte/Timoteo_Logomarca.svg. Não editar à mão.\nexport const LOGO_W = ${marca.w};\nexport const LOGO_H = ${marca.h};\nexport const LOGO_D = '${marca.d}';\n`);

console.log(`Gerados ${out.length} arquivos:`);
for (const f of out) console.log(`  ${f}  (${(fs.statSync(path.join(root, f)).size / 1024).toFixed(1)} KB)`);
