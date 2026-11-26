# Regras de UI/UX por tema

Consulte só a seção que a tarefa pede. O que estiver em `DESIGN.md`, `docs/ui-ux-guidelines.md` ou no
`CLAUDE.md` do PDV vence este arquivo.

Sumário: [Interação](#interação) · [Formulários](#formulários) · [Layout e tipografia](#layout-e-tipografia) ·
[Conteúdo e estados](#conteúdo-e-estados) · [Texto de interface](#texto-de-interface) · [Movimento](#movimento) ·
[Acessibilidade](#acessibilidade) · [Performance percebida](#performance-percebida) ·
[Revisão heurística](#revisão-heurística) · [PDV (balcão)](#pdv-balcão) · [Fontes](#fontes)

## Interação

- Hover, foco e pressionado precisam ser diferentes entre si; estado interativo tem mais contraste que o repouso.
- Link abre com Ctrl/Cmd+clique e botão do meio: por isso navegação é `<a>`.
- Ícone sem texto tem `aria-label`; botão de toggle tem `aria-pressed` ou `aria-expanded`.
- Item de menu que abre outra etapa termina com reticências (`Renomear…`); use o caractere `…`.
- Spinner: espere ~150–300 ms antes de mostrar e mantenha por ≥ 300 ms para não piscar.
- Atualização otimista: se falhar, desfaça e mostre o erro.
- Menu e diálogo: fecham com Esc e clique fora; o foco volta para quem abriu.

## Formulários

- Deixe enviar incompleto para mostrar a validação; não bloqueie digitação.
- Erro ao lado do campo, ligado por `aria-describedby`; foque o primeiro erro no envio.
- `autocomplete` certo (`name`, `email`, `tel`, `postal-code`); `inputmode="numeric"` para CEP e quantidade.
- Telefone e CEP brasileiros: aceite com e sem máscara; formate depois, não durante a digitação.
- Enter envia formulário de um campo; em textarea, Enter quebra linha.

## Layout e tipografia

- Linha de texto corrido com 60–80 caracteres (`max-inline-size: 65ch`).
- `text-wrap: balance` em títulos, `text-wrap: pretty` em parágrafos; nada de `white-space: nowrap` em frase.
- `line-height` sem unidade; caixas crescem com o texto (sem altura fixa em card com texto).
- Raio aninhado: raio interno ≤ raio externo menos o padding.
- Não aninhe card dentro de card. Espaçamento interno de um grupo < espaçamento entre grupos.
- Teste larguras 320, 390, 800 (quebra da landing), 1280 e ultra-wide.
- Unidades com espaço inseparável (`10&nbsp;min`, `R$&nbsp;20`).

## Conteúdo e estados

- Toda tela tem estado vazio com próximo passo ("Nenhum produto nesta categoria. Ver todos").
- Erro diz o que houve e como resolver, sem pedir desculpas e sem código técnico para o cliente.
- Skeleton tem o mesmo formato do conteúdo final.
- Voz da marca: português brasileiro, segunda pessoa, direto ("vem jogar"); sentence case em botões e rótulos
  de interface (os títulos display da marca são a exceção). Sem emoji na interface.
- Datas e horas no formato brasileiro (`14h às 22h`, `qua, 3 dez`).

## Texto de interface

Texto gerado por IA tem cara própria, igual ao visual. Ao escrever ou revisar rótulo, aviso, FAQ ou chamada:

- Diga o fato. Corte o contraste encenado ("Não é só uma loja, é uma experiência"), a frase de efeito no fim
  do parágrafo e a introdução antes do ponto ("Sabe aquele momento em que…").
- Sem trincas por hábito ("rápido, fácil e divertido"): liste quantos itens existirem.
- Sem inflação e jargão de venda ("incrível", "único", "revolucionário", "experiência imersiva"). Prefira o
  dado concreto: horário, preço, quantos jogadores, onde fica.
- Travessão não é conectivo universal; use ponto, vírgula ou dois-pontos.
- Negrito só no que o leitor precisa achar de relance (horário, preço), não em cada item.
- Não comece frases seguidas do mesmo jeito nem repita no texto o título que está logo acima.
- Sujeito claro e voz ativa: "Seu pedido foi enviado" em vez de "O envio foi realizado".

## Movimento

- Duração e easing vêm dos tokens (`--duration-*`, `--ease-*` na landing).
- Uma animação com propósito vale mais que fade em toda seção.
- Movimento contínuo (marquee, carrossel) tem botão de pausar e pausa em hover/foco (WCAG 2.2.2).
- Animações interrompíveis; nunca anime `width`, `height`, `top`, `left` (use `transform`).

## Acessibilidade

Alvo: WCAG 2.2 AA. Os critérios que mais escapam:

- 1.4.3/1.4.11: contraste de texto (4.5:1) e de bordas e ícones de controle (3:1).
- 1.4.10: reflow em 320px sem rolagem horizontal; 1.4.4: zoom de 200%.
- 2.4.7 e 2.4.11: foco visível e não encoberto por header fixo, banner ou widget de chat.
- 2.5.8: alvo mínimo de 24×24px (o projeto pede 44px).
- 3.3.1/3.3.3: erro identificado em texto, com sugestão de correção.
- 4.1.3: mensagem de status anunciada (`role="status"`).
- Decoração (marca d'água, números gigantes) fica em pseudoelemento ou `aria-hidden`, fora da árvore de acessibilidade.
- `forced-colors: active`: bordas e foco continuam visíveis (`outline` transparente como reserva).

## Performance percebida

- Imagem com dimensão definida; só pré-carregue o que está acima da dobra.
- Fonte crítica em WOFF2 com `preload`; `font-size-adjust: from-font` contra salto de layout.
- Listas longas: pagine ou virtualize. POST/PATCH devem responder rápido; se não, mostre progresso.
- Core Web Vitals (limites "bom"): LCP ≤ 2,5 s, CLS ≤ 0,1, INP ≤ 200 ms.
  - LCP: a imagem principal não é lazy, tem `fetchpriority="high"` e vem otimizada; nada de fonte ou script
    bloqueando antes dela.
  - CLS: reserve espaço para imagem, banner, widget de chat e conteúdo que chega depois (estoque, sacola).
  - INP: handler de clique faz pouco trabalho síncrono; mostre o feedback primeiro e processe depois.

## Revisão heurística

Ao revisar uma tela pronta, passe por estas perguntas (heurísticas de Nielsen) e anote o que falhar:

1. O sistema mostra o que está acontecendo (carregando, enviado, esgotado)?
2. Usa as palavras do cliente ("sacola", "Passe da Tarde"), não as do código?
3. Dá para voltar, desfazer ou cancelar?
4. O mesmo padrão significa a mesma coisa em todas as telas (botão amarelo = ação principal)?
5. A tela evita o erro antes de precisar explicá-lo?
6. A informação para decidir está visível, sem depender de memória?
7. Há atalho para quem repete a tarefa (principalmente no PDV)?
8. Tem só o necessário? O que sobra compete com a ação principal.
9. A mensagem de erro diz o que houve e como sair?
10. A ajuda está no ponto em que a dúvida aparece?

## PDV (balcão)

- Velocidade do operador é a métrica: a ação mais frequente fica a um clique/toque, sem diálogo no caminho.
- Ação destrutiva (cancelar comanda, estornar) pede confirmação clara ou permite desfazer; nada de confirmar
  ações rotineiras.
- Atalhos de teclado para ações frequentes não substituem o botão visível.
- Valores monetários sempre alinhados à direita em coluna, `tabular-nums`, 2 casas.
- Regras do negócio aparecem na interface: não existe fiado (nunca mostrar opção); crédito da loja aparece como
  um saldo só; consumo do dono fica visualmente distinto de venda.
- O PDV usa `14px` de base e anel de foco ciano (`globals.css`); não traga escala da landing para lá.

## Fontes

- Vercel Web Interface Guidelines: https://github.com/vercel-labs/web-interface-guidelines
- Anthropic `frontend-design`: https://github.com/anthropics/skills/tree/main/skills/frontend-design
- Impeccable (pbakaus): https://github.com/pbakaus/impeccable
- WCAG 2.2: https://www.w3.org/TR/WCAG22/ · Laws of UX: https://lawsofux.com
- Core Web Vitals: https://web.dev/articles/vitals · Heurísticas de Nielsen: https://www.nngroup.com/articles/ten-usability-heuristics/
- Padrões de texto de IA (adaptado): https://github.com/blader/humanizer
