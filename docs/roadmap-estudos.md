# Roadmap: preparação de estudos (marcações, anotações e "Meus Estudos")

Decisões do André em 17/10/2026 incorporadas (ver "Decisões tomadas"). Meta: no ar em 31/10/2026, com **go/no-go em 26/10** (ver "Corte"). Decisões de mérito (nomes das categorias, conteúdo dos modelos, limites por plano, texto legal) são do André; o que está em "Decisões" não começa sem ele.

## Objetivo
Passar o app de consulta a uso: o estudante marca e anota o que lê; o estudante, o professor de EBD e o líder de célula montam um roteiro de estudo com o conteúdo do app (texto, ficha, personagens, eventos, lugares) mais as próprias notas, veem no app (inclusive offline) e, no Pro, exportam em PDF.

## Planos (proposta)
| Recurso | Essencial | Pro / Premium |
|---|---|---|
| Marcar versículos por categoria (cor) e anotar | ✅ | ✅ |
| Versículos marcados em Favoritos, por categoria | ✅ | ✅ |
| Meus Estudos | até **5** estudos | ilimitados (teto técnico 200) |
| Modelos de roteiro (4) | ✅ | ✅ |
| Ver e usar estudo offline | ✅ | ✅ |
| Painel de contexto do item | só o que o plano já mostra | completo |
| Exportar PDF (impressão) | ❌ | ✅ |
| Copiar como texto | ❌ (o estudo fica no app) | ❌ no MVP |

Linhas novas na matriz de `plans.json` (a landing e o `check` leem de lá): `marks`, `studies` (com limite), `study-export` (Pro e Premium).

## O que o usuário vê
1. **Leitor:** tocar no número do versículo seleciona (um ou vários); barra com as categorias (cor + nome), "Anotar" e "Adicionar ao estudo". Versículo marcado fica com fundo da cor **e** um marcador/sublinhado (a cor não é o único sinal). Vale também sobre o texto em modo originais? **Não no MVP** (só no texto traduzido).
2. **Favoritos (`#favorites`):** nova seção "Versículos", agrupada por categoria, com filtro por categoria; cada linha mostra a referência, o texto (na versão ativa, se disponível) e a nota.
3. **Meus Estudos (`#studies`, `#studies/<id>`):** lista; criar a partir de um modelo ou em branco; tela do estudo com itens em ordem (subir/descer), nota por item e botão "Adicionar ao estudo" em: leitor (versículos/passagem), ficha do livro, personagem, evento da linha do tempo, lugar do mapa.
4. **Painel de contexto** (o app traz o conteúdo): ao abrir um item, "Contexto" mostra, a partir dos dados existentes e sem texto novo: do livro (autor, data, tema, versículo-chave), a seção do esboço daquele capítulo (`outline.js`), personagens citados no capítulo (`people-chapters.json`), eventos e lugares ligados. O que for Pro aparece como convite para o Essencial (`ProInvite`), como hoje.
5. **Exportar (Pro):** "Exportar PDF" abre uma folha de impressão (`@media print`, o navegador salva em PDF): título, itens na ordem, texto bíblico na versão escolhida com crédito/licença, notas, resumo do contexto. Sem biblioteca nova, sem custo.
6. **Offline:** estudos, marcações e notas ficam no cache local (como os favoritos). O texto dos versículos aparece se a versão estiver baixada em "Uso offline"; se não, aparece só a referência e a nota, com um aviso.

## Modelos de roteiro (conteúdo a aprovar pelo André)
Texto fixo PT/EN em `i18n`, sem IA. Cada modelo é uma lista de blocos com pergunta-guia (o usuário preenche):
- **Estudo de passagem:** Observação (o que o texto diz), Interpretação (o que quis dizer ao primeiro leitor), Aplicação (o que muda em mim), Oração.
- **Estudo de personagem:** quem é, contexto, escolhas e consequências, o que revela de Deus, aplicação.
- **Esboço de sermão:** texto-base, ideia central, pontos, ilustração, apelo/aplicação.
- **Aula de EBD / célula:** objetivo, texto-base, quebra-gelo, perguntas de discussão, aplicação da semana, oração.

## Banco de dados (migrations; o André aplica, link do SQL em cada PR)
Todas com RLS "só o dono", `revoke all ... from anon`, `grant ... to authenticated`, gatilho de limite (como `favorites_limit`) e validação em função (como `reading_prefs_valid`).

```sql
-- verse_marks: uma linha por versículo marcado (numeração da KJV, a do app)
create table public.verse_marks (
  user_id uuid not null references auth.users(id) on delete cascade,
  book text not null,              -- slug
  chapter int not null check (chapter > 0),
  verse int not null check (verse > 0),
  cat text,                        -- id da categoria ('c1'..'c6') ou null (só nota)
  note text check (char_length(note) <= 2000),
  updated_at timestamptz not null default now(),
  primary key (user_id, book, chapter, verse)
);
-- limite: 10000 por usuário

-- study_settings: categorias (nome e cor) por usuário
create table public.study_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  categories jsonb not null default '[]'  -- até 6: [{id,name,color}]; validado por função
  , updated_at timestamptz not null default now()
);

-- studies: um estudo por linha; itens num jsonb (poucas dezenas; "mais recente vence" por estudo)
create table public.studies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  template text,                   -- 'passagem' | 'personagem' | 'sermao' | 'ebd' | null
  items jsonb not null default '[]',  -- [{k:'ref:joh:3:16-21'|'person:<id>'|..., note, pos}]
  updated_at timestamptz not null default now()
);
-- limite: Essencial 5 (gatilho confere o plano, mesma regra de can_read_pro()), Pro 200
```
Itens guardam **referências** (chaves no formato de `favKeys.js`, mais `ref:<slug>:<cap>:<v1>[-<v2>]`), nunca o texto bíblico: o texto vem do leitor na versão escolhida (nenhum problema de licença no banco).

Também na migration (ou em uma 2ª): atualizar `delete_account_data` para apagar as três tabelas e o JSON de "Baixar meus dados" (`YourData.jsx`) para incluí-las. **Sem isso a LGPD fica furada.**

## Código (pontos de contato)
- `src/favKeys.js`: novas chaves `ref:` e `verse:`; `parseFavKey` e o `check` de ida e volta cobrem.
- `src/userdata.js`: API nova no mesmo padrão (`getMarks`, `setMark`, `listStudies`, `saveStudy`, `deleteStudy`, `subscribe`), dois backends (localStorage / Supabase com cache), união no login, fila de envio.
- `src/studyContext.js` (puro, testável em Node): dado um item, devolve o contexto a partir dos dados existentes.
- Telas: `src/Studies.jsx` e `src/StudyPage.jsx` (sob demanda), `src/StudyPrint.jsx` (folha de impressão), seleção de versículo em `BookModal.jsx` (aba Ler), seção em `Favorites.jsx`.
- Tokens `--mk-1..6` no claro e no escuro (o `check` exige o par e confere o contraste do texto sobre a cor); vale também nos temas Sépia e Escuro da leitura.
- `plans.json` + `planRules.js` (`can('studies', {count})`, `can('study-export')`), `landing/content.json` se entrar na landing.

## Status (17/10/2026)
- PR 1 (banco e dados), PR 2 (leitor e Favoritos > Versículos) e PR 3 (Meus Estudos) **mesclados**. PR 4 (PDF do Pro, matriz de planos, landing) em revisão. Faltam: teste logado no Supabase real e o texto legal (ver `docs/checklist-lancamento.md`).
- Fora do lançamento: "Adicionar ao estudo" direto do lugar do mapa e do evento da linha do tempo (usa-se "Adicionar item"), copiar como texto, compartilhar estudo, reordenar por arrastar, tela cheia.

## ETAPA 5 (melhorias, depois do lançamento do PR 4)
- **PR A (sem migration)**: "Adicionar item" separado de "Adicionar nota" (botões no topo e no fim da lista); "Ir ao texto" (leitor com a faixa "Adicionando a: <estudo>", a barra de seleção adiciona direto e volta ao estudo; estado em `sessionStorage`); tocar no texto do versículo seleciona; notas de item com formatação simples (`src/richText.js`: `# `, `## `, `**negrito**`, `*itálico*`, `++sublinhado++`; editor com barra e pré-visualização; também na folha de PDF).
- **PR B (migration `20261021000000_estudos_inc.sql`)**: interruptor "Incluir o conteúdo aqui" (`inc`) nos itens e no Contexto, com o conteúdo no estudo e no PDF; limite de nota de item para 5000 só em `study_items_valid`.
- Fora: originais no estudo (etapa 6), seções com título editável, modelo do usuário, modo ver/editar, seleção por arrasto, marcação em todas as versões, busca textual completa.

## Passo a passo (hoje: sáb 17/10; lançamento: sáb 31/10)
| Quando | Etapa | Quem |
|---|---|---|
| 17–18/10 | Aprovar este roteiro e as Decisões abaixo; avisar o advogado sobre anotações e estudos | André |
| 19/10 | Mockup de "Meu Estudo", seleção no leitor e Favoritos > Versículos (Claude Design) | Claude |
| 19/10 | ETAPA 0 do Code: diagnóstico do que muda em `userdata.js`, leitor e Favoritos | Code |
| 20/10 | **PR 1:** migration + `userdata` (marks, categorias, studies) + LGPD (excluir/baixar) + testes PGlite. André aplica o SQL | Code / André |
| 21–23/10 | **PR 2:** marcação e nota no leitor, tokens de cor, Favoritos > Versículos | Code |
| 22–26/10 | **PR 3:** Meus Estudos (lista, modelos, itens, "Adicionar ao estudo", painel de contexto, offline) | Code |
| **26/10** | **Go/no-go** (ver "Corte") | André |
| 27–28/10 | **PR 4:** exportar PDF (Pro), matriz de planos, `can()`, landing | Code |
| 28–30/10 | Texto legal atualizado (Política e Termos; `LEGAL_VERSION` nova), i18n EN, e2e no celular, ajustes | André / Code |
| 31/10 | Lançamento | André |

## Corte (se o prazo apertar)
Em 26/10: se o PR 3 não estiver mesclado e testado, lança só **marcações + notas + Favoritos > Versículos** (PRs 1 e 2) e Meus Estudos sai como "v1.1" (2 a 3 semanas depois), anunciado no Instagram. O PDF (PR 4) só entra com o PR 3.

## Riscos
- **Texto legal:** anotações e estudos são dados pessoais do usuário; a Política e os Termos precisam citá-los, e uma `LEGAL_VERSION` nova pede novo aceite. O texto é do André (e do advogado); Claude só redige se pedido.
- **Prazo:** convive com cobrança (teste do MP em 19/10), Fase 8 (19/10) e revisão jurídica. Nenhum PR deste roteiro mexe na cobrança nem no Pro do Storage.
- **Conflito de sincronização:** marcação por versículo e estudo inteiro, "mais recente vence" (mesma regra dos ajustes de leitura). Edição simultânea do mesmo estudo em dois aparelhos pode perder a edição mais antiga; aceitável no MVP.
- **Seleção de versículo no celular:** o texto é um só `<p>` com `<span>` por versículo; tocar no número deve ser o gesto (não seleção livre), para não brigar com copiar/colar do navegador.

## Fora do MVP
IA que gera estudo; compartilhar estudo por link (exige leitura pública e pesa na LGPD); comparar versões lado a lado; marcar no modo originais; grupos/turmas; lembretes.

## Decisões tomadas (André, 17/10/2026)
1. **Categorias:** nomes **editáveis pelo usuário** (até 6); as cores seguem os tokens `--mk-1..6` e têm de encaixar em todos os temas (claro, escuro, sépia). Nomes padrão de partida: Missões, Salvação, Oração, Promessa, Obediência, Para memorizar (o usuário renomeia).
2. **Essencial: 5 estudos.** Sem "copiar como texto": o estudo fica no app (visível e salvo offline). **Pós-lançamento:** modo tela cheia para ajudar a visualização (ex.: apresentar em célula/aula).
3. **Modelos:** aprovados (blocos e perguntas-guia acima).
4. **Marcação no Essencial:** grátis.
5. **Go/no-go em 26/10:** aceito.
6. **Texto legal:** rascunho feito a pedido do André (PR em rascunho, não mesclar antes dos PRs de estudos); falta o advogado.
