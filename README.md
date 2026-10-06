🇧🇷 Português | [🇺🇸 English](README.en.md)

# 📖 Timóteo App

**Estudo bíblico interativo: cada livro com ficha, mapa, linha do tempo e personagens, e o texto em quatro versões de licença clara.**

Uma tabela dos 66 livros da Bíblia, em que cada livro abre uma ficha de estudo (autor, data, tema, esboço), um mapa dos lugares citados e o texto para leitura. Uma linha do tempo e páginas de personagens se ligam aos livros e aos mapas. Tudo é estático (React + Vite), publicado no GitHub Pages, com interface em português e inglês.

**▶ Demo ao vivo: <https://andrescultori.github.io/timoteo-app/>**

> **Sobre o conteúdo.** É um projeto pessoal e original. Fichas, datas e resumos de personagens são rascunhos em revisão manual: onde autoria, datação ou localização são debatidas, o site mostra as posições (tradicional e acadêmica) lado a lado e marca a incerteza. O texto bíblico só entra com licença clara.

![Grade dos 66 livros por seção](docs/images/grade.png)

## O problema

Estudar a Bíblia com contexto exige abrir várias fontes: o texto, uma ficha do livro, um mapa, uma cronologia e uma lista de personagens. Cada uma costuma estar em um lugar, sem ligação com as outras, e quase nenhuma mostra onde os estudiosos divergem.

## A solução

Uma única interface em que as peças se ligam entre si:

```
Livro (grade dos 66)
   ↓
Ficha · Mapa · Texto
   ↓            ↓
Linha do tempo ⇄ Mapa ⇄ Personagens
```

Do Êxodo na linha do tempo, por exemplo, um clique leva ao mapa de Êxodo já no lugar certo; do lugar no mapa, outro clique mostra os eventos e as pessoas ligados a ele.

## O que o site tem

- **Grade dos 66 livros** por seção, com busca e filtro por testamento. Link direto por livro (`#joh`).
- **Ficha de estudo** de cada livro, em PT e EN: autor, data, lugar, destinatários, versículo-chave, tema, contexto histórico, personagens, esboço e conexões. Autoria e datação mostram a **posição tradicional e a acadêmica lado a lado**; um botão em Configurações (⚙) esconde a acadêmica para estudar de forma mais simples.
- **Mapa** em 46 livros, com costa em vetor própria (sem tiles externos), rótulos sem colisão, zoom por região, legenda e marcação de localização debatida.
- **Linha do tempo** com 13 períodos e 69 eventos, em escala por bloco, datas aproximadas marcadas e cronologias debatidas (como a do Êxodo) mostradas lado a lado. Os livros ficam ligados ao período que o texto descreve.
- **Personagens**: 210 pessoas, com resumo, livros onde aparecem, eventos e lugares; lista por ordem alfabética ou por livro.
- **Genealogia**: duas árvores: de Adão a Jesus (Gênesis, Rute, 1Crônicas e Mateus 1) e de Abraão às doze tribos; cada ligação cita o texto bíblico e as divergências ficam em notas.
- **Salmos como tabela**: os 150 salmos coloridos por livro do Saltério, título ou gênero, com os salmos de título histórico ligados a Davi, aos personagens e à linha do tempo.
- **Estrutura de Jó, Provérbios, Eclesiastes e Cantares**: os capítulos coloridos por parte (em Jó, por quem fala), a lista das partes e, em Eclesiastes e Cantares, as leituras lado a lado.
- **Leitor de texto** em KJV, WEB e ASV (inglês), Bíblia Livre (português), com crédito e licença de cada uma.
- Dois temas, Pergaminho escuro e Pergaminho claro (serifa), PT e EN.

![Linha do tempo, com as duas leituras da data do Êxodo](docs/images/linha-do-tempo.png)

![Mapa de 2 Reis, com legenda](docs/images/mapa.png)

<img src="docs/images/mapa-celular.png" alt="Mapa no celular" width="260">

![Página de um personagem, ligada a livros, evento e lugares](docs/images/personagens.png)

## Stack técnica

| Camada | Tecnologia |
|---|---|
| Interface | React 18 + Vite |
| Mapas | d3-geo, SVG em pixels reais |
| Genealogia | d3-hierarchy, árvore em SVG |
| Costa | Natural Earth 50m (domínio público), recortada |
| Lugares | OpenBible.info Bible Geocoding Data (CC BY 4.0) |
| Texto bíblico | arquivos JSON por livro e versão, carregados sob demanda |
| Validação | `npm run check` (fichas, mapas, linha do tempo, personagens e textos) e CI no GitHub Actions |
| Publicação | GitHub Pages via GitHub Actions |

## Decisões técnicas

- **Texto bíblico só com licença clara.** Cada versão tem a evidência da licença em `docs/licencas-texto-biblico.md`. Versões com direitos (ARA, NAA, NVI, ESV, NKJV e outras) ficam de fora até haver autorização.
- **Nunca inventar dados.** Coordenadas vêm do OpenBible e localizações debatidas são marcadas; datas da linha do tempo têm base registrada em `docs/linha-do-tempo-fontes.md`.
- **Custo operacional zero.** Site estático, sem API paga e sem serviço que cobre por uso.
- **Validação automática dos dados.** Um script confere ids, referências de capítulo, coordenadas, vínculos entre linha do tempo, mapa e personagens, e a numeração de todos os textos; o CI roda isso em todo pull request.
- **Escala por bloco na linha do tempo.** Quatro mil anos não cabem em uma escala linear sem esmagar o Novo Testamento; cada bloco tem a sua escala, e a tela avisa.

## Dados, formatos e documentação

Os formatos de cada conjunto de dados (texto, mapa, linha do tempo, personagens, configurações) estão em [`docs/formatos-de-dados.md`](docs/formatos-de-dados.md). As fontes e licenças dos textos estão em [`docs/licencas-texto-biblico.md`](docs/licencas-texto-biblico.md) e a base das datas em [`docs/linha-do-tempo-fontes.md`](docs/linha-do-tempo-fontes.md).

## Rodando localmente

```bash
npm install
npm run dev
npm run check   # confere fichas, mapas, linha do tempo, personagens e textos
npm run build
```

Todo pull request roda `npm run check` e `npm run build`; o deploy no Pages acontece no push para a `main`.

## Créditos

- Costa: [Natural Earth](https://www.naturalearthdata.com/) (domínio público), pelo pacote `world-atlas`, recortada e simplificada.
- Lugares do mapa: [OpenBible.info Bible Geocoding Data](https://www.openbible.info/geo/), licença [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Coordenadas arredondadas e adaptadas.
- Projeção: [d3-geo](https://github.com/d3/d3-geo) (ISC).
- Árvore genealógica: [d3-hierarchy](https://github.com/d3/d3-hierarchy) (ISC).
- Textos: KJV (domínio público); WEB ([eBible.org](https://ebible.org/eng-web/), domínio público); ASV (domínio público, edição digital de [openbibleinfo](https://github.com/openbibleinfo/American-Standard-Version-Bible)); **Bíblia Livre (BLIVRE), © 2018 Diego Santos, Mario Sérgio e Marco Teles, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)**, [fonte](https://github.com/blivre/BibliaLivre).

Ideia original da tabela: "TaBíblia Periódica" (Grupo de Jovens Conquistando as Nações; fonte indicada: Sociedade Bíblica do Brasil). Este projeto tem design e código próprios.

*Licença do código: [MIT](LICENSE). Os textos bíblicos e os dados de terceiros seguem as licenças indicadas acima.*
