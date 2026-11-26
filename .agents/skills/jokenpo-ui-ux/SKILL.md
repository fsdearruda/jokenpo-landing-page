---
name: jokenpo-ui-ux
description: Fluxo de UI/UX para os dois repositórios da Jokenpo (landing/loja em Astro e PDV em Next.js). Use ao criar ou mudar tela, componente, CSS, layout, estado de interação, formulário, texto de interface ou animação, e ao revisar, auditar acessibilidade ou "deixar mais bonito" uma página. Não use para peças de rede social nem para lógica sem interface.
---

# UI/UX da Jokenpo

Este é um fluxo de trabalho, não um manual de design. Os fatos (tokens, fontes, cores, regras de marca)
moram nos arquivos do projeto e eles ganham de qualquer coisa escrita aqui.

## 0. Explore o projeto antes de desenhar

Descubra em qual repositório você está e leia só o que a tarefa pede:

| Repositório | Leia sempre | Leia se a tarefa tocar |
|---|---|---|
| Landing/loja (`jokenpo-landing-page`) | `DESIGN.md`, `docs/ui-ux-guidelines.md`, tokens em `src/styles/global.css` | textos: `docs/brand-content.md` · conteúdo editável: `src/data/site.json` |
| PDV (`jokenpo-pdv`) | `CLAUDE.md`, tokens em `src/app/globals.css` | regras de negócio que aparecem na tela (sem fiado, crédito da loja, boardgame alugado) |

Depois abra o componente mais parecido com o que você vai fazer e reaproveite a estrutura dele.
Não crie cor, raio, sombra, duração ou fonte nova se já existe token.

## 1. Defina antes de escrever código

Responda em uma linha cada (no seu raciocínio, não precisa mostrar):

- **Quem usa e onde.** Landing: visitante no celular, rede móvel, primeira visita. PDV: operador no PC da loja,
  com pressa, às vezes no toque, cliente esperando no balcão.
- **Ação principal da tela.** Uma só. Ela recebe o destaque visual (botão amarelo na landing e no PDV).
- **Estados.** Liste os que existem: padrão, hover, foco, pressionado, desabilitado, carregando, vazio, erro,
  sucesso, conteúdo longo (nome de produto enorme, preço com 4 dígitos, 0 itens, 200 itens).

## 2. Construa com as regras que agentes mais erram

1. **Elemento certo.** Navegação é `<a href>`; ação é `<button type="button">`. Nada de `div` clicável.
   Prefira nativo (`<details>`, `<dialog>`, `<label>`) a ARIA.
2. **Foco visível e não coberto.** Use o anel de foco que já existe no repo; header fixo não pode cobrir o
   elemento focado (`scroll-padding-top`).
3. **Alvo de toque ≥ 44px** em botões, chips e ações do PDV; ≥ 24px no mínimo absoluto.
4. **Texto.** `rem`/`clamp()`, nunca abaixo de `0.75rem` na landing; input com `font-size` ≥ 16px no celular
   (evita zoom do iOS). Nunca bloqueie zoom nem colar.
5. **Números.** `font-variant-numeric: tabular-nums` em preço, hora, estoque e contagem. Dinheiro com
   `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })` e sempre 2 casas no mesmo contexto.
   Na loja, o preço do PDV é o do cartão; o desconto no Pix vem do PDV, não é calculado na tela.
6. **Cor não é a única pista.** Estado ativo, estoque baixo e erro levam texto, ícone ou forma também.
   Contraste 4.5:1 em texto, 3:1 em texto grande e bordas de controle.
7. **Movimento.** Anime só `transform` e `opacity`; nunca `transition: all`. Tudo atrás de
   `prefers-reduced-motion: no-preference`; hover atrás de `@media (hover: hover)`.
8. **Assíncrono.** Botão nunca fica sem texto: mantém o rótulo ou troca por um de progresso com `…`
   ("Enviando…"), e fica desabilitado contra clique duplo. Erro aparece perto de onde aconteceu e diz como resolver. Ação destrutiva pede confirmação ou
   oferece desfazer. Mensagens dinâmicas em `aria-live="polite"`.
9. **Formulário.** Todo campo tem `<label>`; `type`, `inputmode` e `autocomplete` corretos; placeholder é
   exemplo, não rótulo; no envio, foque o primeiro erro.
10. **Imagem.** `width`/`height` ou `aspect-ratio` sempre; `alt` descritivo ou `alt=""` se decorativa;
    `loading="lazy"` abaixo da dobra. Na landing use `<Image />` do Astro para imagem local.
11. **Estado na URL** (landing/loja): filtro, aba e página vão para a query string, para o link ser compartilhável
    e o voltar funcionar.

Regras completas por tema, com fonte: [references/regras.md](references/regras.md).

## 3. Revise o visual contra "cara de IA"

Antes de mostrar, leia [references/anti-slop.md](references/anti-slop.md) e corrija o que aparecer.
Atenção: a marca Arcade 2.0 usa de propósito título em caixa alta, sombra dura deslocada, rotação e
CMY neon. Listas genéricas de "slop" que proíbem isso **não** valem aqui; o `DESIGN.md` vence.
Se você escreveu texto (rótulo, aviso, FAQ, chamada), revise também com
[Texto de interface](references/regras.md#texto-de-interface) e `docs/brand-content.md`.

## 4. Verifique em ciclo até passar

Copie e marque:

```
- [ ] Teclado: Tab percorre só o que é interativo, na ordem visual; Esc fecha menu/diálogo; foco sempre visível
- [ ] 320px de largura e zoom de 200%: nada cortado, sem rolagem horizontal
- [ ] Todos os estados do passo 1 existem e foram vistos (inclusive vazio, erro e texto longo)
- [ ] prefers-reduced-motion: reduce e forced-colors: active não quebram nada
- [ ] Nenhum token novo sem necessidade; nenhuma cor/raio/sombra solta
- [ ] Landing: pnpm check && pnpm test && pnpm build (+ pnpm test:integracao se tocar banco ou /api)
- [ ] PDV: npm run build (e os testes do repo, se a mudança tocar lógica)
```

Se der para rodar o app, olhe a tela de verdade (servidor de dev + navegador/preview) em largura de celular
e de desktop. Falhou algum item: corrija e refaça a lista inteira. Mudança visível na landing que possa
afetar Performance/Acessibilidade: rode `pnpm lighthouse` com o dev ativo (meta 95+ nas quatro categorias).

## 5. Relate

Arquivos alterados, o que foi verificado (e como), o que não deu para verificar e placeholders pendentes.

## Exemplo: envio do pedido da sacola (landing)

O modelo real está em `src/components/loja/Sacola.astro` (marcação) e `src/scripts/loja.ts` (envio).
Ao criar outro fluxo assíncrono, copie este formato:

```ts
orderForm.addEventListener('submit', async (event) => {
	event.preventDefault();
	errorEl.hidden = true;
	// Validação antes da rede: a mensagem diz como corrigir e o foco vai para o campo
	if (nome.length < 2) return showError('Coloca seu nome pra gente achar o pedido no balcão.', nameInput);

	submit.disabled = true;           // sem clique duplo
	submit.textContent = 'Enviando…'; // o botão nunca fica sem texto
	try {
		const response = await fetch('/api/pdv/pedidos', { method: 'POST', /* ... */ });
		if (!response.ok) {
			// Cada código de erro vira uma frase com saída: ajusta a sacola, aponta o campo ou sugere o WhatsApp
			return showError('Não deu pra enviar agora. Tenta de novo em instantes ou chama a gente no WhatsApp.');
		}
		// sucesso: estado do pedido em um <p role="status">, anunciado ao leitor de tela
	} finally {
		// restaura o botão
	}
});
```

Por que está certo: validação com mensagem acionável na voz da marca, foco no campo com erro, botão protegido
e com texto de progresso, erro do servidor traduzido em próximo passo e status anunciado. Na sacola, a palavra é
"sacola", não "carrinho".
