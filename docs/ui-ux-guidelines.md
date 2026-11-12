# Diretrizes de UI/UX

Regras compactas para manter a landing page consistente, acessível e fácil de
evoluir. Aplicam-se a novas páginas, componentes, estilos e interações.

## Interação

- Todo link e botão deve funcionar com teclado e ter nome acessível.
- Use `<a href>` para navegação e `<button type="button">` para ações.
- Diferencie hover, foco e pressionamento; nunca remova o foco visível.
- Use `:focus-visible` com contraste mínimo de 3:1.
- Respeite `prefers-reduced-motion`; animações persistentes devem ter pausa.
- Prefira transições de `transform` e `opacity`.
- Em botões circulares com rotação (ex.: toggle `+` / `×` de FAQ), **nunca use caracteres de texto**, pois a linha de base da fonte desloca o centro de rotação; use sempre SVG inline com geometria simétrica centralizada no viewBox.
- Em accordions (`<details>`), garanta respiro visual suficiente (`padding-top` e `padding-bottom` de no mínimo `1rem` a `1.25rem`) e divisória sutil entre o `<summary>` e o corpo da resposta.

## Navegação

- Mantenha uma única árvore `<nav aria-label="Navegação principal">`.
- A navegação deve funcionar em telas estreitas e largas sem depender apenas
  de hover.
- O menu mobile deve ser alcançável por teclado, fechar com o comportamento
  nativo disponível e não esconder links sem alternativa.
- Links para seções devem apontar para IDs únicos e usar `aria-current` na
  seção ativa.
- O estado ativo não pode depender somente de cor; use também sublinhado,
  peso ou forma.

## Layout e tipografia

- Use `rem`, `em` e `clamp()` para texto; evite `px` em `font-size`.
- Use `line-height` sem unidade e permita que caixas cresçam com o texto.
- Use `text-wrap: balance` em títulos e `text-wrap: pretty` em parágrafos.
- Mantenha textos corridos em aproximadamente 60–80 caracteres por linha.
- Teste zoom de 200% e viewport de 320px sem perda de conteúdo.
- Não use `white-space: nowrap` em frases ou conteúdo editorial.
- **Redução de redundância e layout de ações:** evite repetir blocos genéricos de links para redes sociais/comunidade em seções específicas (como "Visite") quando já existirem na Hero, Agenda e Rodapé. Em seções com mapas, posicione o botão de traçar rota centralizado logo abaixo da prévia do mapa tanto no desktop quanto no mobile.
- **Modo mobile enxuto:** em viewports `<= 800px`, oculte elementos puramente decorativos (`.hero-stage`, `.about-note`, `.scroll-cue`) com `display: none` para evitar rolagem vertical excessiva.

## Cores e contraste

- Texto normal: contraste mínimo de 4.5:1.
- Texto grande e componentes: contraste mínimo de 3:1.
- Não comunique estado apenas com cor.
- Preserve alternativas em `forced-colors: active`.
- Use os tokens existentes (`--ink`, `--mist`, `--yellow`, `--cyan`,
  `--pink`) antes de criar novas cores.
- **Marcas d'água numéricas e elementos decorativos:** números gigantes de fundo (`01`, `02`) não devem ser renderizados como texto DOM comum, pois validadores de acessibilidade (Axe/Lighthouse) avaliarão contraste de texto. Implemente-os como pseudoelementos CSS (`::after` com `attr(data-watermark)`) com `pointer-events: none; user-select: none;`.
- **Pílulas e badges sobre superfícies coloridas:** garanta contraste superior a 4.5:1 com bordas e fundos de alta opacidade (ex.: `border: 1.5px solid oklch(0.16 0.006 285 / 0.28); background: oklch(1 0 0 / 0.24); color: var(--ink)`).

## Fontes e imagens

- Mantenha Poppins para texto/UI e Archivo Black para títulos.
- Use `font-size-adjust: from-font` em títulos display para evitar layout shifts durante o carregamento de fontes.
- Imagens informativas precisam de `alt`; imagens decorativas usam `alt=""`.
- Defina `width` e `height` nas imagens para evitar layout shift.
- Use `<Image />` do Astro para imagens locais quando possível.
- Imagens abaixo da dobra e mapas devem usar `loading="lazy"`.
- Pré-carregue arquivos WOFF2 críticos no `<head>` via `<link rel="preload" as="font" type="font/woff2" crossorigin="anonymous">`.

## IA e Descoberta por Agentes (Agentic Browsing & SEO)

- Mantenha `/llms.txt` formatado estritamente conforme a especificação do [llmstxt.org](https://llmstxt.org/) com links em Markdown canônico (`- [Título](url): descrição`). Links soltos ou texto puro sem formato `[Nome](url)` reprovam na auditoria de Agentic Browsing do Lighthouse.
- Mantenha dados estruturados JSON-LD unificados em grafo (`@graph`) contendo `WebSite`, `WebPage`, `GameStore` (`LocalBusiness`), `Event` recorrente semanal e `FAQPage`.

## Checklist antes de concluir

- [ ] Navegação funciona com teclado, toque e mouse (consulte `frontend-a11y`).
- [ ] Foco, hover e pressionamento são perceptíveis.
- [ ] Movimento reduzido foi respeitado.
- [ ] Contraste e alto contraste foram considerados (audite com `wcag-audit-patterns`).
- [ ] Layout funciona com zoom e em 320px sem quebras.
- [ ] `alt`, nomes acessíveis e dimensões das imagens estão corretos (evite layout shifts com `core-web-vitals`).
- [ ] **Garantir deslop (`frontend-design-deslop`)**: remover padrões e clichês visuais de IA (gradientes genéricos roxo/azul, cards flutuantes sem propósito, cantos excessivamente arredondados e sombras artificiais), preservando a identidade em `docs/style-guide.md` e revisando com `interface-review`.
- [ ] `pnpm check` e `pnpm build` passam.
