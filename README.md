![Jokenpo Landing Page](docs/images/readme-banner.png)

# Jokenpo Landing Page

Código da landing page oficial da [Jokenpo](https://jokenpo.cards), loja de card games, jogos de tabuleiro e torneios semanais no Shopping New Way Center (Pajuçara, Natal/RN). O projeto é construído com Astro 7, TypeScript estrito, CSS nativo, Decap CMS, integração com chatbot da Blip e deploy na Vercel.

## Prévia do site

![Tela inicial da Jokenpo no desktop com título em destaque, colagem de cartas e botão do Blip Chat no canto inferior direito](docs/images/site-hero.png)

| Estante de jogos com filtros por categoria | Agenda semanal em formato de ingressos |
|---|---|
| ![Estante de jogos da Jokenpo com filtros Todos, Leves, Médios e Grandes](docs/images/site-estante.png) | ![Agenda semanal de torneios e eventos da Jokenpo](docs/images/site-agenda.png) |

<details>
<summary>Prévia mobile (390px)</summary>

<img src="docs/images/site-mobile.png" alt="Versão mobile da página inicial da Jokenpo em largura de 390px" width="300" />

</details>

## Chatbot com Blip

O atendimento automatizado no site usa o widget flutuante da plataforma Blip implementado em [src/components/BlipChatWidget.astro](src/components/BlipChatWidget.astro) e carregado pelo layout base em [src/layouts/BaseLayout.astro](src/layouts/BaseLayout.astro). O componente importa o pacote `blip-chat-widget` localmente, sem depender de CDN externa, e só inicializa após o evento `load` quando `PUBLIC_BLIP_APP_KEY` está preenchida. Sem a chave configurada, nenhum código do chat roda e o botão permanece oculto.

Visualmente, o lançador no canto inferior direito segue o estilo Arcade 2.0, com fundo amarelo (`#ffd400`), ícone e contorno em `#0e0e10`, sombra sólida deslocada e contador de notificações em rosa (`#ff3ea5`). Como o botão padrão da biblioteca usa uma `<div>`, o componente adiciona `role="button"`, `tabindex="0"`, abertura por `Enter` e `Space`, `aria-expanded` e `aria-label` atualizados pelos eventos `OnEnter` e `OnLeave`, além de suporte a `:focus-visible`, `prefers-reduced-motion` e `forced-colors: active`.

Para ativar o bot em desenvolvimento ou produção, preencha `PUBLIC_BLIP_APP_KEY` (obtida em `Canais > Blip Chat > Instalação` no portal da Blip), informe `PUBLIC_BLIP_COMMON_URL` se o contrato usar domínio dedicado e inclua `localhost` e `jokenpo.cards` na lista de domínios autorizados em `Canais > Blip Chat > Configurações`.

## Decisões de projeto

### Acessibilidade

A página segue os critérios da WCAG 2.2 AA e funciona com navegação por teclado, leitor de tela e modo de alto contraste (`forced-colors: active`). O foco visível usa anel em `box-shadow` que acompanha o contorno dos botões, com `scroll-padding-top` no documento para o cabeçalho fixo não cobrir a seção de destino, além de link de salto para o conteúdo principal e fechamento do menu mobile por `Escape` ou clique externo.

Animações respeitam `prefers-reduced-motion: reduce`, e a faixa contínua de categorias em `src/components/Marquee.astro` oferece um botão para pausar ou retomar o movimento, pausando também ao receber foco ou ponteiro. Os accordions do FAQ usam `<details>` e `<summary>` nativos, os cartões de jogos são `<article>` não interativos fora da ordem de tabulação, e números decorativos de fundo ficam em pseudoelementos CSS (`::after`) para não interferir na árvore de acessibilidade.

### Identidade visual

O visual segue o guia da marca em [docs/style-guide.md](docs/style-guide.md) e as especificações registradas em [DESIGN.md](DESIGN.md). O layout usa propriedades CSS customizadas em `src/styles/global.css` e estilos com escopo por componente, sem bibliotecas externas de UI, combinando fundo escuro (`#0e0e10`), acentos em amarelo, ciano e rosa, bordas sólidas e sombras secas deslocadas.

### Desempenho e descoberta por agentes

As rotas públicas (`/`, `/404`, `/admin` e `/llms.txt`) são pré-renderizadas em HTML estático, enquanto o adaptador da Vercel mantém as rotas de autenticação sob demanda. As capas dos jogos passam pelo pipeline de imagens do Astro (`astro:assets`), e as fontes `Archivo Black` e `Poppins` são empacotadas localmente via Fontsource com preload no `<head>`.

Os metadados incluem Open Graph, Twitter Cards, grafo JSON-LD (`WebSite`, `WebPage`, `GameStore`, `Event` e `FAQPage`), `sitemap.xml` e endpoint `/llms.txt` no formato do `llmstxt.org`. Cabeçalhos de cache e segurança ficam em `vercel.json`. Conforme registrado em [DESIGN.md](DESIGN.md), a página atingiu 100 em Acessibilidade, Boas Práticas, SEO e Agentic Browsing, e 98 em Performance no Lighthouse.

### Conteúdo e CMS

Horários, agenda semanal, passes de boardgame, catálogo de jogos e perguntas frequentes ficam centralizados em `src/data/site.json`. A equipe da loja pode editar esses dados pelo Decap CMS em `/admin`, autenticado via OAuth do GitHub (`astro-decap-cms-oauth`).

## Stack

- Astro 7 (`output: 'server'` com `@astrojs/vercel`) e TypeScript em modo estrito
- HTML e CSS nativos com tokens próprios e `@fontsource/archivo-black` e `@fontsource/poppins`
- `blip-chat-widget` empacotado localmente para o chatbot flutuante da Blip
- Decap CMS (`/admin`) com `astro-decap-cms-oauth`

## Como rodar localmente

O projeto usa Node 24 (definido em `.nvmrc`) e `pnpm`.

```bash
nvm use
pnpm install
cp .env.example .env
pnpm dev
```

O servidor local abre por padrão em `http://localhost:4321`. Para rodar em background durante o desenvolvimento:

```bash
pnpm exec astro dev --background
pnpm exec astro dev status
pnpm exec astro dev logs
pnpm exec astro dev stop
```

Para validar tipos, links e build de produção:

```bash
pnpm check
pnpm build
```

## Variáveis de ambiente

Consulte [.env.example](.env.example). Nunca versione chaves ou segredos reais no repositório.

| Variável | Uso | Obrigatória |
|---|---|---|
| `PUBLIC_SITE_URL` | URL canônica para SEO, Open Graph e JSON-LD | Não (padrão `https://jokenpo.cards`) |
| `OAUTH_GITHUB_CLIENT_ID` | Client ID do app OAuth para o Decap CMS | Apenas para usar `/admin` |
| `OAUTH_GITHUB_CLIENT_SECRET` | Secret do app OAuth para o Decap CMS | Apenas para usar `/admin` |
| `PUBLIC_BLIP_APP_KEY` | App Key do canal Blip Chat | Apenas para exibir o chat |
| `PUBLIC_BLIP_COMMON_URL` | URL dedicada do contrato no Blip, se houver | Não |

Sem `OAUTH_GITHUB_CLIENT_ID` e `OAUTH_GITHUB_CLIENT_SECRET`, o OAuth fica desativado localmente. Enquanto `PUBLIC_BLIP_APP_KEY` estiver vazia, o botão do Blip Chat não é renderizado. Ao configurar o Blip, libere os domínios do site (`localhost` e `jokenpo.cards`) em `Canais > Blip Chat > Configurações` no portal da Blip.

## Estrutura do repositório

| Caminho | Responsabilidade |
|---|---|
| `src/pages/index.astro` | Composição das seções da landing page |
| `src/pages/admin.astro` | Painel do Decap CMS em `/admin` |
| `src/pages/llms.txt.ts` | Geração do arquivo `/llms.txt` a partir de `site.json` |
| `src/pages/404.astro` | Página de erro 404 |
| `src/layouts/BaseLayout.astro` | Metadados, SEO, JSON-LD, estrutura base e inclusão do chat |
| `src/components/` | Seções da página e componentes reutilizáveis (`Header`, `Hero`, `GamesSection`, `AgendaSection`, `BlipChatWidget` e demais seções) |
| `src/styles/` | Declarações `@font-face` (`fonts.css`) e tokens/estilos globais (`global.css`) |
| `src/data/site.json` | Fonte de dados pública exibida no site |
| `src/assets/games/` | Capas locais dos jogos otimizadas no build |
| `public/` | Vetores SVG da marca, `og-image.png`, `site.webmanifest`, `robots.txt`, `sitemap.xml` e configuração do CMS em `admin/` |
| `docs/` | Documentação da marca (`style-guide.md`, `brand-content.md`, `ui-ux-guidelines.md`) e capturas do site em `images/` |
| `vercel.json` | Cabeçalhos HTTP de segurança, cache e descoberta |

## Agentes

Para fluxos automatizados e regras de contribuição por agentes neste repositório, consulte [AGENTS.md](AGENTS.md).
