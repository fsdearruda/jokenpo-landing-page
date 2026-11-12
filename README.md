# Jokenpo landing page

Landing page da Jokenpo, loja de card games e jogos de tabuleiro em Natal/RN.
O projeto usa Astro 7, TypeScript e deploy server-side na Vercel.

## Comece aqui

Antes de editar:

1. Leia este arquivo (`README.md`).
2. Leia `AGENTS.md` para regras de desenvolvimento e fluxo do repositório.
3. Leia `docs/style-guide.md` para decisões visuais, paleta e identidade da marca.
4. Leia `docs/ui-ux-guidelines.md` antes de alterar qualquer elemento de UI/UX.
5. Leia `docs/brand-content.md` para dados operacionais e referência editorial.
6. Confira `src/data/site.json`, a fonte dos dados exibidos na landing page.

## Desenvolvimento

Requisitos: Node 24 (veja `.nvmrc`) e pnpm. A Vercel executa as funções em
Node 24; usar a mesma versão localmente evita diferenças entre desenvolvimento
e produção.

```bash
nvm use
pnpm install
astro dev --background
```

Comandos do servidor:

```bash
astro dev status
astro dev logs
astro dev stop
```

Validação mínima antes de concluir:

```bash
pnpm check
pnpm build
```

## Estrutura

| Caminho | Responsabilidade |
|---|---|
| `src/pages/index.astro` | Composição das seções da landing page |
| `src/pages/404.astro` | Página de erro |
| `src/layouts/BaseLayout.astro` | `<head>` (SEO, Open Graph, JSON-LD), cabeçalho, `<main>` e rodapé |
| `src/components/` | Seções (`Hero`, `GamesSection`, `AgendaSection`…) e componentes reutilizáveis (`SectionHeading`, `ArrowIcon`) |
| `src/styles/fonts.css` | Declarações `@font-face` locais (`Poppins` e `Archivo Black` via Fontsource) |
| `src/styles/global.css` | Tokens de cor, tipografia base e padrões compartilhados (botões, `.section`, `.eyebrow`) |
| `src/data/site.json` | Conteúdo público usado pela página |
| `public/` | Imagens, SVGs, manifest e arquivos públicos |
| `docs/brand-content.md` | Referência editorial e informações da loja |
| `docs/ui-ux-guidelines.md` | Regras compactas de UI/UX para agentes |
| `docs/style-guide.md` | Identidade visual, tokens e especificações de estilo |
| `astro.config.mjs` | Configuração do Astro e da Vercel |

Não edite arquivos gerados em `dist/`, `.vercel/` ou `.astro/`.

## Regras para alterações

- Prefira editar `src/data/site.json` quando a mudança for apenas conteúdo.
- Use `<Image />` do Astro para imagens locais sempre que possível.
- Mantenha `alt`, dimensões das imagens, navegação por teclado e suporte a
  `prefers-reduced-motion`.
- Preserve o tom informal em português brasileiro, sem emojis.
- Não coloque credenciais no código. Use `.env` local e variáveis da Vercel.
- Evite refatorações amplas; faça mudanças pequenas e relacionadas ao pedido.
- Ao adicionar UI, confira responsividade, foco, contraste e zoom de 200%.

## Conteúdo e CMS

O conteúdo editável da landing fica em `src/data/site.json`. O Decap CMS de
produção está em `https://dashboard.jokenpo.cards/admin`.

Variáveis usadas em produção:

```env
PUBLIC_SITE_URL=https://jokenpo.cards
OAUTH_GITHUB_CLIENT_ID=...
OAUTH_GITHUB_CLIENT_SECRET=...
```

O OAuth fica desativado localmente sem essas credenciais. Nunca versione os
valores reais.

## Checklist para agentes de código

1. Entender o pedido e localizar o arquivo responsável.
2. Identificar e consultar as **skills relevantes** do projeto em `.agents/skills/` (veja a matriz de gatilhos em `AGENTS.md`).
3. Ler o contexto antes de editar; reutilizar padrões existentes.
4. Fazer a menor alteração que resolve o problema.
5. **Garantir o uso de deslop em UI**: consultar obrigatoriamente `frontend-design-deslop` ao criar ou alterar componentes visuais para eliminar clichês de IA (gradientes roxo/azul genéricos, cantos excessivamente arredondados, sombras artificiais) e preservar os tokens da marca (`docs/style-guide.md`).
6. Rodar `pnpm check` e `pnpm build`.
7. Informar arquivos alterados, validações executadas e pendências.
8. Criar um commit descritivo quando solicitado.

Para informações públicas da marca, consulte `docs/brand-content.md`. Para
decisões visuais, consulte `docs/style-guide.md`. Para catálogo e gatilhos de skills,
consulte `AGENTS.md`.
