# Timóteo App (repo `timoteo-app`)

Nome comercial: **Timóteo App** (em inglês, **Timoteo App**). "TaBíblia" era só o nome de trabalho, inspirado no "TaBíblia Periódica", e não é o nome do produto. O repositório é `andrescultori/timoteo-app` (renomeado de `biblia`) e o site fica em andrescultori.github.io/timoteo-app/.

Tabela interativa dos 66 livros da Bíblia (inspirada no "TaBíblia Periódica"), com ficha de estudo e leitor de texto, para uso público em estudo bíblico. Stack: React 18 + Vite, sem backend. Publicação: GitHub Pages via GitHub Actions.

## Como trabalhar (preferências do André)
- Este é um projeto pessoal do André, não da UniMissional. Só trate como da UniMissional (nome, instituição, contas, licenças em nome dela) quando ele pedir isso de forma explícita.
- Em repositório existente: diagnostique antes de aplicar e espere confirmação. Decisões de mérito (nomes, licenças, o que publicar, conteúdo teológico) são dele.
- Pode abrir PR sem pedir confirmação. O merge continua sendo do André.
- Respostas diretas e objetivas. Aprofunde só quando pedido.
- Prefira soluções que reduzam custo operacional (sem APIs pagas nem serviços que cobrem por uso).
- Se outra ferramenta do ecossistema Claude servir melhor a uma tarefa, diga.

## Estrutura
- `README.md` (PT) e `README.en.md` (EN): README de portfólio, espelhados; mexer nos dois juntos. Formatos de dados e detalhes técnicos em `docs/formatos-de-dados.md`. Capturas em `docs/images/`. Contagens (livros com mapa, eventos, personagens) aparecem nos dois README: atualizar ao mudar.
- `src/data/books.js`: os 66 livros (slug, siglas e nomes PT/EN, seção, testamento). Atos tem seção própria (`atos`), por decisão do André. A ordem canônica é o número do livro (1 a 66), igual ao nome dos arquivos de texto.
- `src/data/counts.json`: capítulos e versículos por livro. É gerado pelo script, não editar à mão.
- `src/data/bible.js`: versões de texto disponíveis (com crédito e licença mostrados no leitor) e carregamento por livro. Dentro de cada idioma, a primeira da lista é a padrão.
- `public/bible/<versão>/<n>.json`: texto por livro (array de capítulos; cada capítulo é um array em que a posição i é o versículo i+1; versículo ausente na versão é `null`).
- `scripts/build-bible-data.mjs`: gera o texto por livro a partir da fonte de cada versão (`kjv`, `web`, `asv`, `blivre`); a `alm1911a` vem de `scripts/modernize-alm1911.mjs`. Só a KJV recalcula `counts.json` e aplica `scripts/data/kjv-fixes.json` (notas de margem removidas da fonte).
- `src/i18n.js`: textos da interface (PT/EN). Novo idioma = nova chave em `T` e em `LANGS`.
- `src/data/info/<slug>.json`: ficha de cada livro (PT/EN), com a chave opcional `map` (lugares do mapa; formato no README).
- `src/data/land.json`: costa em vetor (Natural Earth 50m, recortada). Não editar à mão.
- `src/MapView.jsx`: aba Mapa (d3-geo, SVG em pixels reais, rótulos sem colisão, botão "Ampliar região"). Carregada sob demanda.
- `src/route.js`: rotas por hash (`#joh/map/Laquis`, `#timeline/<evento>`, `#person/<id>`); `go` navega com histórico, `sync` só atualiza o endereço. Livro, linha do tempo e personagens são **páginas**, não popups.
- `src/Timeline.jsx`: página da linha do tempo (períodos, eventos, livros por período; escala por bloco). Carregada sob demanda; link `#timeline`.
- `src/People.jsx`: página de personagens (lista com busca e filtro por livro; detalhe com livros, eventos e lugares). Carregada sob demanda; links `#person` e `#person/<id>`.
- `src/Genealogy.jsx`, `src/genealogy.js` e `src/data/genealogia.json`: página da árvore (`#tree/adao-jesus`, nó em foco `#tree/adao-jesus/mt-salomao`), com `d3-hierarchy`. Nós e ligações pai → filho **com referência bíblica obrigatória**. Só a lista de Mateus 1 (decisão do André: a de Lucas 3 deixava a árvore confusa); as divergências vão em `note` (sem escolher leitura). O bloco **Família** da página do personagem lê os mesmos dados. Formato em `docs/formatos-de-dados.md`.
- `src/PsalmsView.jsx` e `src/data/psalms.json`: aba **Salmos** (só em Salmos): grade dos 150 salmos, coloridos por livro do Saltério, título ou gênero (o gênero, classificação acadêmica de Gunkel/Westermann, some com a posição acadêmica desligada); detalhe com título histórico (13 salmos), personagens ligados e leitor. Rotas `#psa/psalms/51` e `#psa/read/23`. Numeração da KJV.
- `src/StructureView.jsx`: aba **Estrutura** (Jó, Provérbios, Eclesiastes e Cantares), lida da chave `structure` da ficha: capítulos coloridos pela parte (em Jó, pela voz), lista das partes e, em Eclesiastes e Cantares, as leituras (a acadêmica some com a posição acadêmica desligada).
- `src/SettingsModal.jsx` e `src/settings.js`: modal de Configurações (⚙ no topo) e contexto das preferências de estudo. Hoje: mostrar/esconder a posição acadêmica (fichas e linha do tempo); o padrão é mostrar. Guardado no navegador.
- Rodapé de assinatura em `src/App.jsx` (classe `.assinatura`; texto "Desenvolvido por" / "Developed by" na chave `madeBy` do i18n; segue o idioma ativo). "André Scultori" → github.com/andrescultori; **"GitHub" → o repositório** (github.com/andrescultori/timoteo-app), por decisão do André, **não** o GitHub Pages, que é o padrão da skill de assinatura. Ano: 2026 (criação). Manter assim.
- `src/linkify.jsx` e `src/data/people-index.json`: na ficha do livro, nomes de personagens ligam a `#person/<id>` e lugares do mapa do próprio livro ligam à aba Mapa (só a 1ª ocorrência por bloco; nome ambíguo como José/Tiago só liga se o livro desambiguar). O índice é gerado de `people.json` por `node scripts/build-people-index.mjs` (rode ao mudar `people.json`; o `npm run check` avisa se estiver velho).
- `src/BackButton.jsx` e `src/route.js` (`goBack`, `canGoBack`): botão Voltar das páginas volta à página anterior do app (sem histórico, vai ao início). O início tem a casinha ao lado do título.
- Dois temas, **Pergaminho escuro** (padrão, tokens no `:root` de `src/styles.css`) e **Pergaminho claro** (`:root[data-theme='light']`), com o botão do cabeçalho em ciclo Auto → ☾ → ☀ (`src/App.jsx`; preferência em `localStorage.theme` = auto | dark | light; o auto segue o sistema, e o CSS só vê `data-theme` dark | light). Os temas antigos (auto, claro e escuro de antes do Pergaminho) estão arquivados em `docs/archive/temas/` e no branch/tag `themes-archive-2026-10`; o Pergaminho claro **não** foi arquivado. `src/Logo.jsx` é **placeholder** (o André envia o vetor oficial). Detalhes em `docs/tema-pergaminho.md`.
- `src/BookModal.jsx`: página do livro (nome histórico; abas Resumo, Ficha, Mapa e Ler). `src/App.jsx`: grade, filtros, tema, idioma, link direto por hash (`#joh`).

## Regras de conteúdo
- Personagens: o resumo se limita ao que o texto bíblico diz, com referências; onde a identidade, a autoria ou a datação são debatidas, usar `note`. Pessoas distintas de mesmo nome têm ids distintos (ex.: `josue` e `josue-sacerdote`).
- Linha do tempo: nunca inventar datas. Cada data tem base (texto bíblico ou registro externo) em `docs/linha-do-tempo-fontes.md`; onde a cronologia é debatida, mostrar as duas leituras. Livros ligados a um período seguem o cenário do texto, não a data de composição.
- **Linha evangélica (protestante), não católica.** O projeto usa o cânon de 66 livros e só versões de tradição evangélica/protestante (KJV, WEB, ASV, Bíblia Livre; ARA e NAA, se a SBB autorizar). Versões e livros católicos (Bíblia de Jerusalém, Ave-Maria, Pastoral, CNBB; deuterocanônicos como Tobias, Judite, Sabedoria, Eclesiástico/Sirácida, Baruque, 1–2 Macabeus e os acréscimos a Daniel e Ester) não entram como texto nem como conteúdo de estudo. A numeração dos Salmos é a hebraica (KJV). Onde a tradição católica diferir, não seguir; se houver dúvida, avisar o André.
- Texto bíblico em português só entra com licença clara. ARA e NAA pertencem à Sociedade Bíblica do Brasil (SBB) e aguardam autorização (contato do termo de uso: direitos@sbb.org.br). A KJV é de domínio público. Só a edição original de 1898 da ARC é de domínio público; a ARC da SBB (1995) tem direitos.
- Antes de adicionar qualquer versão, leia `docs/licencas-texto-biblico.md` (situação de cada versão, regras da SBB, ESV e NKJV) e confirme a licença em fonte primária. Mostre a evidência ao André e espere a confirmação dele.
- Fichas dos livros: nunca inventar dados. Onde autoria, data ou local forem debatidos, registrar as posições e marcar a incerteza. Versículo-chave guarda só a referência; o texto vem do leitor.
- Lugares do mapa: coordenadas do OpenBible (CC BY 4.0, atribuição visível na aba e no README). Localização debatida leva `uncertain: true`. Não inventar coordenadas.
- Não reproduzir a arte do TaBíblia Periódica original. O design deste projeto é próprio.

## Decisões em aberto
- Versões em português: no site, Bíblia Livre (CC BY 4.0, atribuição obrigatória). A Almeida 1911 com a grafia original foi retirada a pedido do André (ortografia antiga). Em seu lugar há a **Almeida 1911 atualizada** (`alm1911a`, só ortografia), nos 66 livros (gerada por script, revisão do André em andamento, correções via `scripts/data/alm1911-ortografia.json`); ver `docs/ortografia-alm1911.md`. O André vai pedir a ARA e a NAA à SBB. ARA e NAA aguardam autorização da SBB (André vai pedir). TB não entra (a SBB declara copyright sobre a edição de 2010). ARC de 1898: sem fonte digital confiável. Detalhes em `docs/licencas-texto-biblico.md`.
- Comercialização: produto **Timóteo App**, planos Essencial (grátis), Pro (R$49,90/ano, R$29,90 no 1º pagamento) e Premium (depois). Cloudflare Pages (landing e app em projetos separados, `*.pages.dev`, sem domínio por ora) e Supabase dedicado. Hoje o conteúdo é público sob MIT; a mudança de licença e o repositório privado só vêm depois do Cloudflare no ar. Ver `docs/comercializacao.md` e `docs/landing-brief.md`.
- Logo oficial pendente (André envia o vetor; `src/Logo.jsx` é provisório).
- ESV e NKJV: avaliadas, não adicionadas. ESV só via API não comercial e exigiria proxy; NKJV exige permissão escrita.

## Roadmap
1. Publicar o repositório e o GitHub Pages. **Feito.**
2. Fichas completas por livro: autor, data, local, destinatários, versículo-chave, tema, contexto histórico, personagens, esboço, conexões. **Rascunho dos 66 livros pronto**; a revisão do André é manual e segue em andamento (pontos de atenção: autoria das cartas do NT, datação de Daniel, versículos-chave, traduções em EN).
3. Mapa: costa em vetor com d3 (sem tiles externos). **Aba pronta** (demo em `docs/map-demo/`); **mapas feitos para todas as seções**, com revisão do André em andamento. Sem mapa de propósito: Jó, Salmos, Provérbios, Eclesiastes, Cantares (adiados a pedido do André), Lamentações, Joel, Habacuque, Ageu, Malaquias, Efésios, 2 Tessalonicenses, Filemom, Hebreus, Tiago, 2 Pedro, 1–3 João e Judas (poucos ou nenhum lugar distinto no OpenBible). **Linha do tempo: pronta** (`src/Timeline.jsx`, dados em `src/data/timeline.json`, base das datas em `docs/linha-do-tempo-fontes.md`; revisão do André pendente).
4. Textos: **KJV, WEB, ASV e Bíblia Livre no site, mais a Almeida 1911 atualizada (66 livros, em revisão).** Pendentes: ARA e NAA (autorização da SBB) e, se aparecer fonte confiável, a ARC de 1898.
5. Páginas de personagens bíblicos (`src/People.jsx`, dados em `src/data/people.json`). **Em andamento:** estrutura pronta e 210 personagens (AT e NT, seleção de principais; os Doze completos), cada um com `summary` e `bio` de 2 a 3 parágrafos (revisão do André pendente); faltam os demais, por seção, com revisão do André. Cada personagem liga a livros, eventos da linha do tempo e lugares do mapa (nos dois sentidos). Resumos só com o que o texto bíblico diz. **Genealogia: fases 1 e 2 prontas** (Adão a Jesus pela lista de Mateus 1; Abraão, Ismael, Esaú, Jacó e as 12 tribos; `src/data/genealogia.json`); faltam as fases 3 (reis de Judá e dinastias do norte) e 4 (sacerdotes), cada uma com referências e revisão do André. Outros conteúdos: a definir.
6. Integração linha do tempo ↔ mapas: **feita** (evento → lugares do mapa; lugar → eventos). Cada evento pode ter `places: [{book, name, en}]`, validado contra o mapa da ficha. Os três (linha do tempo, mapa e personagens) já se ligam nos dois sentidos.

7. Versículos das fichas (versículo-chave, referências no esboço, nos textos e nas bios) linkados ao texto bíblico. **Adiado** até se decidir como o texto bíblico será oferecido (leitor próprio, YouVersion ou os dois; ver "Decisões em aberto").
8. Plano de leitura (ex.: Provérbios em 31 dias, Salmos em 30). **Mais adiante**, depois da genealogia dos personagens e de mais eventos na linha do tempo (reis e profetas).
8b. **Temas Pergaminho escuro e claro: feitos** (`docs/tema-pergaminho.md`); logo oficial pendente (o André envia o vetor).
9. **Comercialização (Essencial, Pro, Premium).** Planos, decisões, restrições e fases em `docs/comercializacao.md` (fases 0 a 8 levam ao lançamento; gamificação, links externos e editor de conteúdo vêm depois). Landing: `docs/landing-brief.md`. Resumo: site atual no Cloudflare Pages, Supabase (login Google, planos, conteúdo Pro fora do site público, favoritos e "continuar de onde parei" sincronizados; sem cadastro ficam no aparelho), cobrança anual pelo Mercado Pago (checkout hospedado, sem cartão no site), landing em projeto separado, admin mínimo, LGPD, e só então licença nova e repositório privado. **Nada disso começa sem o André confirmar a fase 0.**

## Comandos
- `npm install` e `npm run dev`: desenvolvimento.
- `npm run check`: confere fichas (campos PT/EN, referências de capítulo), lugares do mapa (coordenadas dentro da costa, nome repetido), linha do tempo, personagens (ids, livros, eventos e lugares existentes), chaves repetidas ou faltando no `i18n.js` e textos bíblicos (66 livros, capítulos iguais aos da KJV, null só onde falta versículo). Rode antes de abrir PR.
- `npm run build`: build de produção em `dist/`. O CI (`.github/workflows/ci.yml`) roda `check` e `build` em todo PR.
- `node scripts/build-bible-data.mjs <id> <caminho-da-fonte>`: regenera os dados de uma versão. Fontes e formatos no README (seção "Dados do texto bíblico").
