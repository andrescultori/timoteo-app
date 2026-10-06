# Comercialização: planos, hospedagem e fases

Nome do produto: **Timóteo App** (decidido em 02/10/2026). "TaBíblia" era o nome de trabalho.

Decisões do André estão marcadas como **[decidido]**; o que Claude assumiu para seguir está como **[proposto, confirmar]**; o que falta está em "Pendências".

## Planos

| | Essencial (grátis) | Pro | Premium (lançamento futuro) |
|---|---|---|---|
| Preço | R$0 | R$49,90/ano; **R$29,90 no primeiro pagamento** | R$79,90/ano; **R$49,90 no primeiro pagamento** |
| Acesso | Sem login para ler; cadastro opcional | 12 meses por pagamento | 12 meses por pagamento |

O preço de entrada vale para todo novo assinante, sempre (um indicador por usuário registra que já usou). As renovações custam o preço cheio.

### O que cada plano inclui [decidido]

| Conteúdo | Essencial | Pro | Premium |
|---|---|---|---|
| Bíblia (todas as versões atuais e futuras) | ✅ | ✅ | ✅ |
| Fichas dos 66 livros | ✅ sem mapa e sem estrutura (exceções abaixo) | ✅ completas, com mapas e estruturas | ✅ |
| Mapas | só Evangelhos e Pentateuco | ✅ todos | ✅ |
| Estrutura | só Salmos | ✅ Jó, Provérbios, Eclesiastes, Cantares e Salmos | ✅ |
| Personagens | 30 a 50 principais (lista aprovada pelo André) | ✅ todos (210 hoje) | ✅ |
| Linha do tempo | ❌ | ✅ | ✅ |
| Genealogia | ❌ | ✅ (em expansão: fases 1 e 2 prontas; reis de Judá, dinastias do norte e sacerdotes por vir) | ✅ |
| Favoritos (livros, capítulos, personagens, lugares) e "continuar de onde parei" | ✅ sem limite; no aparelho sem cadastro, em todos os aparelhos com cadastro | ✅ | ✅ |
| Leitura gamificada (badges, progresso anual) | em breve | em breve (no Pro) | ✅ |
| Links externos (BibleProject, concordância) | em breve | em breve (no Pro) | ✅ |
| IA: 10 conteúdos por mês, em PDF | ❌ | ❌ | ✅ |

Premium, detalhe: devocional (5 a 10 minutos, 1 página) e pregação (20 a 30 minutos, 2 páginas), enviados em PDF com aviso de direitos autorais e a fonte. O limite é de 10 produções por mês por usuário. Versículos citados nos PDFs só podem vir de versões com licença liberada (ver `docs/licencas-texto-biblico.md`).

Gamificação (quando entrar): badges de leitura por livro, por seção (Pentateuco, Evangelhos...) e por progresso (10%, 25%, 50%, completo), compartilháveis no Story do Instagram (imagem gerada no navegador, sem custo de servidor); linha de leitura anual que mostra o percentual lido e se está atrasado, em dia ou adiantado. Exige login.

Links externos (quando entrar): vídeos do BibleProject por livro e busca em concordância online. São só links.

## Decisões já tomadas

- **[decidido]** Texto bíblico disponível em todos os planos, inclusive o Essencial (importante para as licenças de uso).
- **[decidido]** Cobrança **anual** (substitui o "vitalício" de antes). Renovação: **[proposto, confirmar]** 12 meses de acesso pagos manualmente (Pix ou cartão no checkout do Mercado Pago), com aviso por e-mail perto do vencimento. Assinatura recorrente fica como possibilidade futura. Ao vencer, a conta volta ao Essencial sem perder progresso.
- **[decidido]** Hospedagem no **Cloudflare Pages**, em `*.pages.dev`, **sem domínio por ora**. A venda é testada antes. A landing e o app serão **dois projetos separados** do Cloudflare Pages, para que o domínio seja só anexado depois (`timoteo.com.br` na landing e `app.timoteo.com.br` no app; `timoteo.com.br` estava livre em 02/10/2026).
- **[decidido]** **Supabase em projeto dedicado** (login, banco, regras de acesso por plano).
- **[decidido]** Cobrança por **Mercado Pago**, com checkout hospedado por eles.
- **[decidido]** Cadastro **opcional**: nome e e-mail obrigatórios; sexo, faixa etária e cidade/estado opcionais. Leitura e fichas do Essencial abertas, sem login. Ganchos de cadastro: salvar progresso e favoritos entre aparelhos, "Avise-me" nos recursos "em breve" e uma caixa separada e desmarcada para novidades e promoções (consentimento próprio, com descadastro em todo e-mail). Idade só em faixas, não data de nascimento.
- **[decidido]** Entrada: login por link mágico por e-mail. **[proposto, confirmar]** Sem domínio próprio não há e-mail próprio confiável; então, no lançamento, oferecer **login com Google** e deixar o link mágico para quando houver domínio. Se o André quiser link mágico já no lançamento, o domínio passa a ser pré-requisito.
- **[decidido]** Fonte do conteúdo: o repositório (privado) continua sendo a fonte; um script publica o conteúdo Pro no Supabase. Quando o editor existir, o Supabase vira a fonte e o repositório guarda uma exportação.
- **[decidido]** Admin no lançamento: mudar o plano de um usuário e convidar usuário como "editor de conteúdo". O editor de conteúdo vem **depois** do lançamento.
- **[decidido]** Mudar a licença para **todos os direitos reservados** e deixar o repositório **privado**, **depois** de o Cloudflare estar no ar e do conteúdo Pro já estar fora do site público. Mantém atribuição às partes de terceiros (OpenBible e Bíblia Livre, CC BY 4.0), em arquivo de avisos. Mudar a licença não revoga o MIT de quem já copiou o que foi publicado (0 forks e 0 estrelas em 02/10/2026).
- **[decidido]** Conteúdo Pro visto por usuário sem o plano aparece "embaçado", com a mensagem "Disponível na versão Pro". **Regra técnica:** o embaçado é desenhado com conteúdo falso (esqueleto ou texto genérico). Nunca enviar o dado real ao navegador de quem não tem o plano e escondê-lo com CSS, porque isso se desfaz pelo inspetor.
- **[decidido]** O que existe hoje continua sendo o produto. As fichas já publicadas ficam públicas na parte do Essencial; o resto sai do site público.
- **[decidido]** Vercel descartado: o plano Hobby é restrito a uso não comercial (vercel.com/docs/limits/fair-use-guidelines).
- **[decidido]** PWA no roadmap; apps nas lojas só depois de validar a venda.
- **[decidido]** Landing em página própria, mostrando o que é o app, os planos em caixas com ✅/❌ e o botão "Escolher plano". Visual prototipado no Claude Design e depois implementado no Code (ver `docs/landing-brief.md`).
- **[informado]** O André já usa o Mercado Pago no LGND Checklist e a conta não exigiu domínio próprio.
- **[proposto, confirmar]** Next.js: o André escolheu Next.js (rotas reais ajudam o SEO do Essencial). Para lançar mais cedo e com menos risco, **lançar no app atual (Vite, rotas por hash) e migrar para Next.js depois**. A escolha entre migrar antes ou depois é dele.
- **[proposto, confirmar]** Lançamento só com texto em domínio público ou CC BY (KJV, WEB, ASV, Almeida 1911 atualizada, Bíblia Livre) mais links para o YouVersion. ARA e NAA entram só com autorização por escrito.

## Restrições verificadas

- **Cloudflare, plano gratuito:** o contrato (Self-Serve Subscription Agreement, seção 2.2.1(h)) proíbe "process or collect personal or business credit card information on any web property that is receiving Free Services". Regra de projeto: **nenhum campo de número de cartão em páginas nossas** (nem formulário embutido); o cliente digita o cartão na página do Mercado Pago. A seção 2.2 inteira foi lida pelo André na fonte (01/10/2026): não há proibição geral de uso comercial. Limites do Pages gratuito: 500 builds/mês, 20.000 arquivos, 25 MiB por arquivo; funções do Pages contam na cota de 100 mil requisições/dia do Workers.
- **Plano B de hospedagem: Hostinger** (aplicações web com Node.js, deploy pelo GitHub). O contrato permite cobrar clientes, mas todos os planos têm limites de CPU, RAM e processos, com risco de lentidão ou suspensão. Preços promocionais com contrato de 48 meses e renovação 3 a 4 vezes maior (página consultada em 02/10/2026). Mantendo o app estático com Supabase, a troca de host é só mudar o deploy.
- **GitHub Pages:** repositório privado só em plano pago, e o uso para negócio online é proibido (docs.github.com, limites do GitHub Pages).
- **Apple e Google (fase posterior):** compra de conteúdo digital dentro do app exige o sistema de compra da loja (Apple, diretriz 3.1.1); comissão de 15% a 30% (no Brasil há regras novas pelo acordo com o CADE, a confirmar); app que é só o site é recusado (diretriz 4.2). Conta Google pessoal nova exige teste fechado com 12 testadores por 14 dias. Conta Apple: US$99/ano.
- **Texto bíblico:** o uso comercial muda a conta das licenças (SBB, YouVersion). Ver `docs/licencas-texto-biblico.md` e a sessão dedicada a direitos.

## Fases (para o Code implementar)

Cada fase vira uma branch e um PR; o merge é do André. O Code diagnostica e espera confirmação nas decisões de mérito. Fases 1 a 8 levam ao lançamento do Essencial e do Pro.

**Fase 0: decisões e pendências do André (antes de tocar no código)**
- Aprovar a lista dos 30 a 50 personagens do Essencial (Claude propõe cerca de 40 por critério objetivo: mais livros ligados, os Doze, patriarcas, reis e profetas principais).
- Redigir ou aprovar Termos de uso, Política de privacidade e texto de consentimento LGPD (revisão jurídica é decisão dele).
- Criar as contas: Cloudflare, Supabase (projeto dedicado), Mercado Pago (já tem) e, se usar, Google Cloud para o login com Google.
- Conferir na fonte as taxas atuais do Mercado Pago e o preço e os limites do Supabase pago, e ver se R$49,90/ano cobre o custo fixo.
- Confirmar os itens "proposto".

**Fase 1: site atual no Cloudflare Pages (sem reescrever) — FEITA** (https://timoteo-app.pages.dev/)
- Build `npm run build`, saída `dist`. O `base: './'` do Vite já funciona na raiz.
- Projeto do app no Cloudflare Pages (build `npm run build`, saída `dist`, branch de produção `main`), no ar em `timoteo-app.pages.dev`; o GitHub Pages segue no ar até validar.
- Conferir hash (`#joh`), `public/bible/` e fichas.

**Fase 2: Supabase dedicado (login e dados do usuário)**
- Tabelas: perfis (nome, e-mail, campos opcionais, consentimento de novidades com data), planos e direitos (`plano`, `inicia_em`, `expira_em`, `usou_preco_de_entrada`), papéis (`admin`, `editor`), lista de espera ("Avise-me", com o recurso de interesse).
- Regras de acesso (RLS) por usuário; ninguém lê o plano de outro; só `admin` altera planos.
- Login com Google no lançamento; link mágico quando houver domínio e SMTP próprio. Conferir na documentação os limites do envio padrão do Supabase antes de decidir.
- Cadastro opcional na interface, com a caixa de novidades separada e desmarcada.

**Fase 2A: favoritos e "continuar de onde parei" (sem backend; pode vir antes da Fase 1) — FEITA** (`src/userdata.js`, página `#favorites`)
- Coração nas páginas de livro, capítulo do leitor, personagem e lugar do mapa. Escopo inicial: só esses quatro tipos (eventos, salmos e versículos depois).
- Chaves: livro = slug; capítulo = slug + número; personagem = id; lugar = slug do livro + nome em PT (lugar não tem id; se um nome mudar, o favorito se perde; o `npm run check` pode avisar quando um favorito conhecido deixar de existir).
- Sem cadastro, salva no aparelho (localStorage). Depois do primeiro favorito, aviso único: "Seus favoritos ficam só neste aparelho. Entre para guardá-los e acessá-los em qualquer lugar." **[decidido]** Não bloquear o coração atrás do cadastro e **sem limite** de favoritos em nenhum plano.
- Página "Meus favoritos" (`#favorites`), agrupada por tipo, com remover.
- "Continuar de onde parei": guarda a última posição de leitura (versão, livro, capítulo) e oferece retomar no início. Mesmo aviso de aparelho.

**Fase 2B: sincronização (depois da Fase 2)**
- Tabelas `favorites` (`user_id`, `type`, `ref`, `created_at`, única por usuário + tipo + ref) e `reading_position` (uma linha por usuário), com RLS só do próprio usuário.
- No login, os favoritos e a posição locais migram para a conta (união sem duplicar; posição mais recente vence). Depois disso, a conta é a fonte e o aparelho é cache.
- Favorito de conteúdo Pro de quem está no Essencial (ou cujo Pro venceu) continua na lista, aberto como convite ao Pro, nunca como link quebrado.

**Fase 3: conteúdo por plano (o que sai do site público)**
- Definir em **um arquivo de configuração único** o que cada plano inclui (usado pelo app e pela landing, para a tabela ✅/❌ nunca divergir).
- O pacote público do Essencial contém só o que é do Essencial: fichas sem `map` e sem `structure` (exceto Evangelhos e Pentateuco no mapa, e Salmos na estrutura), os personagens da lista aprovada, sem linha do tempo e sem genealogia.
- O conteúdo Pro (demais mapas e estruturas, demais personagens, linha do tempo, genealogia) vai para o Supabase por script de publicação (`scripts/`), com RLS por plano; o app o busca após o login.
- Links entre conteúdos (linkify): nome de personagem fora do Essencial vira texto comum ou convite para o Pro, nunca link quebrado. Bloco "Família" e links de evento só no Pro.
- Embaçado com dado falso nas telas Pro vistas por quem não tem o plano.
- `npm run check` precisa continuar validando os dados nos dois lados (pacote público e pacote Pro).

**Fase 4: cobrança com Mercado Pago**
- Função de borda (Supabase Edge Function) cria o pagamento no checkout hospedado; o webhook confirma o pagamento consultando a API do Mercado Pago (não confiar só no corpo recebido), é idempotente e grava o direito com `expira_em` = 12 meses.
- Preço de entrada no primeiro pagamento e preço cheio nas renovações, conforme o indicador do usuário.
- Aviso por e-mail antes de vencer (quando houver e-mail próprio); ao vencer, volta ao Essencial.
- Nenhum campo de cartão nas nossas páginas.

**Fase 5: landing (projeto separado no Cloudflare Pages)**
- Protótipo no Claude Design a partir de `docs/landing-brief.md`; depois o Code implementa em página estática, rápida e boa para SEO.
- Caixas dos planos com ✅/❌ lidas da configuração única da Fase 3; botão "Escolher plano" leva ao app com o plano na URL (cadastro ou login e checkout).
- A landing não coleta dados pessoais além da lista de espera, que escreve no Supabase.

**Fase 6: admin mínimo (para o André)**
- Listar usuários, mudar o plano de um usuário (com registro de quem mudou e quando) e convidar usuário como editor de conteúdo.

**Fase 7: LGPD e páginas legais**
- Termos de uso, Política de privacidade, consentimento no cadastro, exportar e excluir a conta, descadastro de novidades.
- Favoritos e histórico de leitura podem revelar convicção religiosa, que a LGPD trata como dado pessoal sensível (art. 5º, II). A Política e o consentimento precisam dizer isso; exportar e excluir a conta incluem favoritos e posição de leitura. Nada disso é usado para marketing nem compartilhado.

**Fase 8: licença e repositório**
- Só depois das fases 1 e 3: trocar o `LICENSE` para todos os direitos reservados, criar o arquivo de avisos de terceiros (OpenBible e Bíblia Livre, CC BY 4.0), atualizar os README e tornar o repositório privado. O GitHub Pages sai do ar.

**Depois do lançamento**
- Plano Pro "em breve": leitura gamificada (tabela de progresso por capítulo; badges; imagem para Story; linha de leitura anual) e links para BibleProject e concordância.
- Editor de conteúdo no admin (texto em PT e EN com os links automáticos entre ficha, personagem e lugar; o linkify atual já gera boa parte deles). O Supabase vira a fonte e o repositório guarda exportação.
- Domínio próprio, e-mail próprio (link mágico, avisos e promoções) e SMTP.
- Migração para Next.js, se confirmada.
- Premium: IA com cota mensal (10 por mês), registro de uso, PDF com aviso de direitos e fonte; fornecedor da IA a decidir.
- PWA; depois lojas.

## Pendências e riscos

- Texto de ARA e NAA: autorização da SBB e termos da YouVersion (sessão dedicada).
- Taxas do Mercado Pago e preço do Supabase: não verificados.
- O plano gratuito do Supabase pausa projetos inativos e não é adequado com clientes pagantes; prever o plano pago antes do lançamento.
- Sem domínio, o link mágico depende de envio confiável; ver Fase 2.
- Pagar em `*.pages.dev` funciona, mas passa menos confiança no checkout; revisar quando houver vendas.
- Idade e cidade: dados opcionais, em faixas; coletar só o necessário.
- Custo da IA no Premium: o limite mensal precisa caber na receita anual.
- Nome: checar INPI (classes 9, 41, 42 e 45) e os perfis de Instagram e Facebook antes de divulgar; as ferramentas de Claude não conseguiram verificar essas redes.
