# Jokenpo landing page

Landing page da Jokenpo, loja de card games e jogos de tabuleiro em Natal/RN.
O projeto usa Astro 7, TypeScript e deploy server-side na Vercel.

## Comece aqui

Antes de editar:

1. Leia este arquivo.
2. Leia `AGENTS.md` para regras de desenvolvimento.
3. Leia `jokenpo-style-guide.md` para decisões visuais e de conteúdo.
4. Leia `docs/ui-ux-guidelines.md` antes de alterar UI.
5. Confira `src/data/site.json`, a fonte dos dados exibidos na landing page.

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
| `src/pages/index.astro` | Landing page, layout, interações e estilos |
| `src/pages/404.astro` | Página de erro |
| `src/components/` | Componentes Astro reutilizáveis |
| `src/data/site.json` | Conteúdo público usado pela página |
| `public/` | Imagens, SVGs, manifest e arquivos públicos |
| `docs/brand-content.md` | Referência editorial e informações da loja |
| `docs/ui-ux-guidelines.md` | Regras compactas de UI/UX para agentes |
| `jokenpo-style-guide.md` | Identidade visual para novas peças |
| `astro.config.mjs` | Configuração do Astro e da Vercel |

Não edite arquivos gerados em `dist/`, `.vercel/` ou `.astro/`.

## Regras para alterações

- Prefira editar `src/data/site.json` quando a mudança for apenas conteúdo.
- Use `<Image />` do Astro para imagens locais sempre que possível.
- Mantenha `alt`, dimensões das imagens, navegação por teclado e suporte a
  `prefers-reduced-motion`.
- Preserve o tom informal em português brasileiro, sem emojis.
- Não publique o CNPJ enquanto o rodapé ainda usar o placeholder.
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
2. Ler o contexto antes de editar; reutilizar padrões existentes.
3. Fazer a menor alteração que resolve o problema.
4. Rodar `pnpm check` e `pnpm build`.
5. Informar arquivos alterados, validações executadas e pendências.
6. Criar um commit descritivo quando solicitado.

Para informações públicas da marca, consulte `docs/brand-content.md`. Para
decisões visuais, consulte `jokenpo-style-guide.md`.
