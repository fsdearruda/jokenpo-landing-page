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

## Cores e contraste

- Texto normal: contraste mínimo de 4.5:1.
- Texto grande e componentes: contraste mínimo de 3:1.
- Não comunique estado apenas com cor.
- Preserve alternativas em `forced-colors: active`.
- Use os tokens existentes (`--ink`, `--mist`, `--yellow`, `--cyan`,
  `--pink`) antes de criar novas cores.

## Fontes e imagens

- Mantenha Poppins para texto/UI e Archivo Black para títulos.
- Use `font-size-adjust: from-font` quando houver fallback de fonte web.
- Imagens informativas precisam de `alt`; imagens decorativas usam `alt=""`.
- Defina `width` e `height` nas imagens para evitar layout shift.
- Use `<Image />` do Astro para imagens locais quando possível.
- Imagens abaixo da dobra e mapas devem usar `loading="lazy"`.

## Checklist antes de concluir

- [ ] Navegação funciona com teclado, toque e mouse (consulte `frontend-a11y`).
- [ ] Foco, hover e pressionamento são perceptíveis.
- [ ] Movimento reduzido foi respeitado.
- [ ] Contraste e alto contraste foram considerados (audite com `wcag-audit-patterns`).
- [ ] Layout funciona com zoom e em 320px sem quebras.
- [ ] `alt`, nomes acessíveis e dimensões das imagens estão corretos (evite layout shifts com `core-web-vitals`).
- [ ] **Garantir deslop (`frontend-design-deslop`)**: remover padrões e clichês visuais de IA (gradientes genéricos roxo/azul, cards flutuantes sem propósito, cantos excessivamente arredondados e sombras artificiais), preservando a identidade em `docs/style-guide.md` e revisando com `interface-review`.
- [ ] `pnpm check` e `pnpm build` passam.
