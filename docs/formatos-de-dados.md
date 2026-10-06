# Formatos de dados e documentação técnica

Detalhes que saíram do README. Cada seção descreve o formato de um conjunto de dados e como o `npm run check` o valida.

## Dados do texto bíblico

Os textos ficam em `public/bible/<versão>/<n>.json` (n = 1..66, ordem canônica). Cada arquivo é um array de capítulos, e cada capítulo é um array em que a posição *i* guarda o versículo *i + 1*. Versículo que a versão não tem (por exemplo, os que a ASV omite) fica `null`, para a numeração continuar certa.

| Id | Versão | Licença | Fonte do arquivo |
|---|---|---|---|
| `kjv` | King James Version | Domínio público | [thiagobodruk/bible](https://github.com/thiagobodruk/bible) (`json/en_kjv.json`), com o espaço antes da pontuação removido e 40 notas de margem retiradas (`scripts/data/kjv-fixes.json`) |
| `web` | World English Bible | Domínio público | [seven1m/open-bibles](https://github.com/seven1m/open-bibles) (`eng-web.usfx.xml`, do eBible.org) |
| `asv` | American Standard Version (1901) | Domínio público | [openbibleinfo/American-Standard-Version-Bible](https://github.com/openbibleinfo/American-Standard-Version-Bible) (`usx-english-only/`) |
| `blivre` | Bíblia Livre (2018) | CC BY 4.0 (atribuição obrigatória) | [damarals/biblias](https://github.com/damarals/biblias) (`data/canonical/BLIVRE/`) |

Para regenerar uma versão, passe o id e o caminho da fonte baixada:

```bash
node scripts/build-bible-data.mjs web caminho/para/eng-web.usfx.xml
node scripts/build-bible-data.mjs asv caminho/para/usx-english-only
node scripts/build-bible-data.mjs blivre caminho/para/data/canonical/BLIVRE
```

Só a KJV recalcula `src/data/counts.json` (capítulos e versículos por livro), que é a referência de numeração do site.

Para adicionar uma versão: incluir o formato da fonte em `scripts/build-bible-data.mjs`, gerar os arquivos, registrar em `src/data/bible.js` (nome, idioma, crédito e licença; o leitor mostra o crédito) e documentar a evidência em `docs/licencas-texto-biblico.md`. **Antes de publicar qualquer tradução, confirme a licença em fonte primária.** ARA, NAA, NVI, ACF, ESV, NKJV e a ARC da SBB (1995) têm direitos e não estão no site.

## Mapa

A aba **Mapa** da página do livro aparece nos livros cuja ficha (`src/data/info/<slug>.json`) tem a chave `map`. O desenho usa `d3-geo` sobre a costa em `src/data/land.json`, sem tiles externos. O visual segue a demo aprovada em `docs/map-demo/`.

```json
"map": {
  "route": true,
  "note": { "pt": "...", "en": "..." },
  "places": [
    { "name": { "pt": "Monte Sinai", "en": "Mount Sinai" }, "lonLat": [33.97, 28.54],
      "note": { "pt": "...", "en": "..." }, "ref": "19–20", "uncertain": true, "label": [10, 4, "start"] }
  ]
}
```

- `lonLat` é `[longitude, latitude]`, com duas casas decimais. `ref` guarda só a referência, sem a sigla do livro.
- `uncertain: true` desenha o pin tracejado e marca "?" no rótulo. Use para localização debatida.
- `label` (opcional) é `[dx, dy, âncora]` em pixels e vale como primeira tentativa de posição do rótulo. O mapa testa outras 8 posições sozinho para não sobrepor outros rótulos, pins e bordas; o lugar selecionado sempre mostra o rótulo, e os que não acharem espaço ficam sem rótulo (o nome continua na lista).
- Quando há 3 ou mais lugares muito próximos (1,5° ou menos), aparece o botão **Ampliar região**, que reenquadra o grupo do lugar selecionado (ou o grupo mais denso). Escolher na lista um lugar fora do grupo volta à visão completa. O botão também aparece quando todos os lugares cabem numa área menor que a visão mínima (5,5° × 3,6°), como nos livros históricos.
- `route: true` liga os lugares na ordem listada, em linha simplificada (não é o trajeto exato).
- Confira cada coordenada no OpenBible antes de publicar e marque a incerteza. Critério usado nos mapas: `uncertain: true` se o melhor candidato do OpenBible tem menos de 400 pontos, se o segundo tem mais de 40% da pontuação do primeiro, ou se há 5 ou mais candidatos; regiões e nomes alternativos recebem a incerteza do lugar a que se referem.

## Linha do tempo

O botão **Linha do tempo** abre uma página com duas camadas: (1) períodos e eventos da história bíblica e (2) os livros ligados a cada período. Dados em `src/data/timeline.json`; componente em `src/Timeline.jsx`.

- Anos são inteiros: negativo = a.C., positivo = d.C. (não existe o ano 0). `approx: true` mostra "c.".
- `dates` é `{start, end?, approx?, note?}` ou, quando a datação é debatida, `{traditional: {...}, scholarly: {...}}` (as duas leituras aparecem lado a lado, como nas fichas).
- A **escala muda por bloco** (`blocks[].ppy` = pixels por ano); períodos curtos ganham largura mínima. A tela avisa disso.
- Livros ligados a um período seguem o **cenário que o próprio texto descreve**, não a data de composição. Livros de datação ou ambientação debatida, poéticos e de sabedoria ficam de fora (a tela lista quais).
- Evento com `attested: true` tem data também atestada por fonte fora da Bíblia (marcado com ◆). `npm run check` valida anos, ordem dos períodos, livros e referências. A base de cada data está em `docs/linha-do-tempo-fontes.md`.
- **Ligação com o mapa:** um evento pode ter `places: [{ "book": "2ki", "name": "Laquis", "en": "Lachish" }]`, com `name` igual ao nome em PT do lugar no mapa da ficha daquele livro (`npm run check` confere, inclusive o `en`). O evento mostra botões "Ver no mapa" e o lugar, no mapa, lista os eventos ligados a ele. Link direto: `#timeline/<id-do-evento>`.

## Personagens

O botão **Personagens** abre uma página com a lista (busca e filtro por livro) e, para cada pessoa, o resumo, os livros onde aparece (com o papel em cada um), os eventos da linha do tempo e os lugares do mapa. Dados em `src/data/people.json`; componente em `src/People.jsx`. Links diretos: `#person` e `#person/<id>`.

```json
{ "id": "davi", "name": { "pt": "Davi", "en": "David" }, "summary": { "pt": "...", "en": "..." },
  "books": [{ "book": "1sa", "role": { "pt": "...", "en": "..." } }],
  "events": ["davi"],
  "places": [{ "book": "2sa", "name": "Hebrom", "en": "Hebron" }],
  "bio": { "pt": ["parágrafo 1", "parágrafo 2"], "en": ["paragraph 1", "paragraph 2"] },
  "note": { "pt": "...", "en": "..." } }
```

- `autoLink: false` e `linkBooks: ["luk"]` (opcionais) controlam o link automático do nome nas fichas dos livros: o primeiro desliga (nome que também é tribo ou terra, como Judá), o segundo restringe aos livros listados.
- `events` usa os ids de `timeline.json`; `places` usa o nome em PT do lugar no mapa da ficha daquele livro (e o `en` igual). `npm run check` confere ids únicos, livros, eventos, lugares e PT/EN.
- O evento da linha do tempo lista as pessoas ligadas a ele e o lugar do mapa também.
- `summary` é o resumo de uma frase a três (aparece na lista e abre a página); `bio` é o texto mais longo, em 2 a 3 parágrafos, mostrado abaixo do resumo (PT e EN com o mesmo número de parágrafos).
- O resumo e a bio se limitam ao que o texto bíblico diz, com referências. Pessoas distintas de mesmo nome têm ids distintos (`josue`, `josue-sacerdote`). Genealogia ainda não faz parte.

Na ficha do livro (`src/data/info/<slug>.json`), cada item de `characters` pode ter `ids`: lista de ids de `people.json` (ou `null` para uma parte sem página). Com um id, o nome inteiro vira link para `#person/<id>`; com vários, cada parte do nome ("Adão e Eva", "Paulo, Silvano e Timóteo") liga ao id da mesma posição, e o `npm run check` confere que o número de partes bate nos dois idiomas.

Nos textos da ficha, os nomes de personagens e os lugares do mapa do livro viram links automaticamente (`src/linkify.jsx`), a partir de `src/data/people-index.json`, gerado por `node scripts/build-people-index.mjs` sempre que `people.json` mudar.

## Genealogia

`src/data/genealogia.json` guarda as árvores (hoje duas: `adao-jesus`, desenhada em SVG, e `abraao-tribos`, em lista recuada com `"layout": "list"`; a lista funciona melhor quando há muitos irmãos). Três partes:

- `trees[]`: `id`, `root` (nó da raiz), `title`, `intro`, `note` (PT/EN) e `branches` (nome de cada ramo; hoje só `mt` = Mateus 1, de Salomão a Jesus).
- `nodes{}`: um nó por posição na lista. `name` (PT/EN), `personId` opcional (liga à página do personagem), `branch` opcional e `note` opcional. Os ids são únicos; uma pessoa pode ter mais de um nó se aparecer em mais de uma lista.
- `links[]`: ligações pai → filho. `from`, `to`, `refs[]` (**obrigatório**: `{book, ref}`, por exemplo `{"book":"gen","ref":"5:3"}`), `mother` opcional (id de `people.json`, quando o texto cita a mãe) ou `motherName` (`{pt, en}`, para mãe sem página) e `note` opcional.

Regras: nunca ligar sem referência bíblica; cada nó tem um pai só; todos os nós saem da raiz. A lista de Lucas 3 ficou de fora por decisão do André (deixava a árvore confusa); onde os textos divergem (por exemplo, Gênesis 11 hebraico × Septuaginta/Lucas 3:36), a diferença vai em `note`, sem escolher uma leitura. `npm run check` confere ids, referências, pai único e ciclos. A página usa `d3-hierarchy` (`src/Genealogy.jsx`) e o bloco **Família** da página do personagem lê os mesmos dados (`src/genealogy.js`).

## Configurações

O item "Configurações" do menu da conta (nome do usuário, no topo) abre as preferências de estudo, guardadas no navegador (`localStorage`). Por enquanto: **mostrar a posição acadêmica** (padrão: ligado). Desligada, a ficha mostra só a posição tradicional de autoria e datação, e a linha do tempo só a leitura tradicional das datas. O aviso de que a outra posição existe fica só na própria tela de Configurações. Em Personagens, a lista pode ser ordenada A–Z ou por livro (lembrada no navegador).

## Publicar no GitHub Pages

Settings → Pages → Source: *GitHub Actions*. O workflow em `.github/workflows/deploy.yml` faz o build a cada push na `main`.

## Links e navegação

A navegação usa o hash da URL, sem biblioteca de rotas; o botão voltar do navegador funciona e todo endereço é compartilhável. Livros, linha do tempo e personagens são páginas inteiras (só as Configurações são um popup).

| Endereço | Mostra |
|---|---|
| `#` | grade dos 66 livros |
| `#joh`, `#joh/sheet`, `#joh/read` | livro e aba (`summary`, `sheet`, `map`, `read`) |
| `#2ki/map/Laquis` | aba Mapa com o lugar selecionado (nome em PT) |
| `#timeline`, `#timeline/exodo` | linha do tempo, com o evento em foco |
| `#person`, `#person/davi` | lista de personagens ou a página de uma pessoa |
| `#tree/adao-jesus`, `#tree/adao-jesus/mt-salomao` | árvore genealógica, com o nome em foco |

Trocar de aba ou de lugar atualiza o endereço sem criar entrada no histórico; ir para outra página cria. Ao voltar para a grade, a rolagem é restaurada. O código está em `src/route.js`.

## Salmos

`src/data/psalms.json` tem os 150 salmos (numeração da KJV): `book` (1 a 5, do Saltério), `by` (autores no título: `david`, `asaph`, `korah`, `solomon`, `moses`, `heman`, `ethan`), `genre` (classificação de Gunkel e Westermann; `mixed: true` quando o salmo é misto), `pilgrim` (Sl 120–134, "cântico de romagem") e, nos 13 salmos de título histórico, `hist` (`text`, `ref`, `people`, `events`, `places`). O gênero é uma leitura acadêmica e só aparece com a posição acadêmica ligada. `npm run check` valida a contagem, o livro do Saltério, as pessoas, eventos e lugares ligados.

## Estrutura dos livros de sabedoria

A chave opcional `structure` da ficha (`src/data/info/<slug>.json`) mostra a aba Estrutura: `parts` (cada uma com `ref`, `title` PT/EN, `chapters` e, em Jó, `voice`), `voices` (só em Jó), `note` e `readings` (`name`, `summary` e `view`: `traditional`, `scholarly` ou `null`). Cada capítulo do livro deve estar em exatamente uma parte; o `npm run check` confere isso e as referências. Hoje existe em Jó, Provérbios, Eclesiastes e Cantares.

## Versões parciais

Uma versão em `src/data/bible.js` pode ter `books: [19, 43]` (números 1 a 66). Ela só aparece no leitor desses livros, e o `npm run check` só exige os arquivos deles. Hoje nenhuma versão usa isso (a Almeida 1911 atualizada já cobre os 66 livros), mas o recurso continua disponível para versões parciais.
