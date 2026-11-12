## Repository workflow

Before changing code:

1. Read `README.md` for setup, structure and validation commands.
2. Read `docs/style-guide.md` for visual and editorial rules.
3. Read `docs/ui-ux-guidelines.md` before changing UI or interaction behavior.
4. Read `docs/brand-content.md` for public business information.
5. Treat `src/data/site.json` as the source of truth for landing-page content.
6. For any UI changes, apply **deslop** (`frontend-design-deslop`) to prevent generic AI UI patterns.

Keep changes focused. Do not edit generated files in `dist/`, `.vercel/` or
`.astro/`. Run `pnpm check` and `pnpm build` after code changes. Report changed
files, validation results and unresolved placeholders.

## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)

## Agent skills & triggers

Este repositório possui skills instaladas em `.agents/skills/`. Ative e consulte as instruções da respectiva skill (`SKILL.md`) antes e durante as seguintes tarefas:

### 1. Astro, Web nativa & Vercel
- **`astro-guidance`**: Ao criar/editar componentes `.astro`, layouts, manipulação de imagens com `<Image />` ou lógica de roteamento/SSR.
- **`modern-web-guidance`**: Ao planejar componentes interativos HTML/CSS modernos nativos (`<dialog>`, popover, navegação por âncoras, scroll-driven animations).
- **`vercel-optimize`**: Ao alterar rotas serverless, headers de cache, otimizar bundle ou investigar performance na Vercel.

### 2. Acessibilidade (A11y) & WCAG
- **`frontend-a11y`**: Ao implementar ou alterar navegação por teclado, estados de foco (`:focus-visible`), atributos ARIA e marcação semântica.
- **`wcag-audit-patterns`**: Antes de concluir modificações de UI, para auditar contraste de cores, compatibilidade com leitores de tela e conformidade WCAG 2.1/2.2.

### 3. Performance, Core Web Vitals & Lighthouse
- **`web-quality-audit`**: Ao auditar a landing page de ponta a ponta (qualidade web, SEO, segurança e CWV).
- **`core-web-vitals`**: Ao investigar ou corrigir métricas de LCP (Largest Contentful Paint), CLS (Layout Shift) ou INP.
- **`perf-astro`**: Ao otimizar carregamento de fontes locais (Fontsource), CSS crítico ou buscar pontuação 95+ no Lighthouse.

### 4. UI/UX, Design & Conteúdo de Conversão
- **`frontend-design-deslop`**: Ao desenhar ou estilizar componentes e seções, evitando padrões visuais genéricos de IA e mantendo fidelidade a `docs/style-guide.md`.
- **`copywriting-cta`**: Ao criar ou revisar botões de ação e chamadas para conversão (WhatsApp, Instagram, visitas à loja física).
- **`event-landing-page`**: Ao atualizar ou reprojetar a seção de agenda semanal e torneios da loja.
- **`interface-review`**: Ao fazer revisões heurísticas de layout, consistência e usabilidade.

### 5. SEO & Presença Local
- **`seo-schema-local-business`**: Ao alterar dados cadastrais da loja em `src/data/site.json` ou schemas JSON-LD (`LocalBusiness`, eventos, horários).
- **`local-seo`**: Ao trabalhar visibilidade em buscas geográficas (Natal/RN, Google Maps e Local Pack).
- **`astro-seo`**: Ao revisar metadados no `<head>`, Open Graph e tags canônicas no layout base.
