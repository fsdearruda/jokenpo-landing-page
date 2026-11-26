# AGENTS.md

Landing page e loja da Jokenpo (jokenpo.cards): Astro 7, TypeScript estrito, CSS nativo, Decap CMS e
Vercel. Estrutura, rotas e variáveis: `README.md`.

## Comandos

```bash
pnpm check        # confere a cópia do contrato do PDV + astro check
pnpm test         # vitest: regras puras (contrato, estoque, Pix, saúde, conteúdo, sacola)
pnpm test:integracao  # banco em memória (PGlite): pedidos, estoque, faxina e rotas /api
pnpm build
vercel env pull .env.local          # banco e Blob de preview: sem isso a /loja fica vazia no dev
pnpm exec astro dev --background   # dev em segundo plano; `astro dev status|logs|stop`
```

Rode `pnpm check`, `pnpm test`, `pnpm test:integracao` (se mexer em banco ou rotas) e `pnpm build` depois de mudar código. Ao terminar, informe os arquivos
alterados, o resultado da validação e placeholders pendentes.

## Fontes da verdade

- Conteúdo da landing (horários, agenda, FAQ, banners, textos da página da loja): `src/data/site.json`, editado pelo CMS.
- Produtos, fotos, nomes, descrições, preço, estoque, promoções e desconto no Pix (o preço do PDV é o do cartão): só o PDV (repositório `jokenpo-pdv`), pela sincronização. Não existe catálogo no build nem no CMS.
- `src/lib/pdv/sync.ts` e `contract-fixtures/` são cópias do PDV: nunca edite; mude no PDV e rode `pnpm sync:contract`.
- Não edite gerados: `dist/`, `.vercel/`, `.astro/`.

## Leia antes, conforme a tarefa

- Interface ou interação: siga a skill `jokenpo-ui-ux` (`.agents/skills/jokenpo-ui-ux/SKILL.md`; se o seu agente
  não carrega skills, leia o arquivo direto), com `docs/ui-ux-guidelines.md` e `DESIGN.md` (tokens reais em
  `src/styles/global.css`). Evite visual genérico de IA.
- Textos públicos e dados da loja: `docs/brand-content.md`.
- Peças para redes sociais (não o site): `docs/style-guide.md`.
- Pedidos, estoque ou rotas `/api/pdv*`: `docs/plano-api-pdv.md` e o protocolo em `docs/API-SITE.md` do PDV.

## Instruções para agentes

- Este arquivo vale para qualquer agente; `CLAUDE.md` só importa ele (`@AGENTS.md`). Mude regras aqui.
- Skills ficam em `.agents/skills/<nome>/SKILL.md` (formato Agent Skills: `name` igual à pasta e `description`
  no frontmatter); `.claude/skills` é um link para essa pasta. Não duplique skill nem instale pacote que repita
  o que já está nos docs.

## Metas que não podem regredir

- Lighthouse 95+ em Performance, Acessibilidade, Boas Práticas e SEO (meça no preview da Vercel, ou com `pnpm dev` rodando e `pnpm lighthouse`).
- WCAG 2.2 AA: teclado, foco visível, `prefers-reduced-motion`, `forced-colors`.
- `src/pages/llms.txt.ts` segue o `llmstxt.org`, com links em Markdown (`- [Título](url): descrição`).
- Documentação do Astro: https://docs.astro.build
