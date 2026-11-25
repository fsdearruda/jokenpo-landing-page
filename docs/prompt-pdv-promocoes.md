# Prompt: promoções por evento no PDV

> Cole o texto abaixo numa sessão de agente aberta no repositório `jokenpo-pdv`.

---

Você vai criar no PDV da Jokenpo (repositório `jokenpo-pdv`) uma funcionalidade de **promoções por evento**: a loja cria uma promoção com nome e período (ex.: "Black Friday", "Semanal Pokémon", "Aniversário da loja"), escolhe os produtos e o desconto, e o preço promocional passa a valer sozinho no início e acaba sozinho no fim, no balcão e no site `jokenpo.cards`.

O PDV é a fonte da verdade do preço cobrado. O site só exibe o que o PDV manda: o preço atual, o preço antigo riscado e o selo com o nome da promoção.

Antes de mudar qualquer coisa, leia `docs/API-SITE.md`, `src/lib/site-sync.ts` (contrato da sincronização, cópia idêntica de `src/lib/pdv/sync.ts` do site) e `src/server/site-sync.ts` (worker com o ciclo de 15 s, deltas e foto completa a cada 10 min). Siga as convenções do repositório e rode os testes e o build no final.

## Cadastro da promoção

Nova tela em **Cadastros → Promoções**, com lista (ativas, agendadas, encerradas), criar, editar, duplicar e "encerrar agora".

Campos:

- **Nome**: aparece no selo do site e na comanda. Até 30 caracteres (o selo do site é pequeno).
- **Início e fim**: data e hora no fuso da loja (`America/Fortaleza`). Fim obrigatório.
- **Onde vale**: balcão e site, só site, ou só balcão.
- **Desconto**:
  - percentual sobre o preço cadastrado, arredondado ao centavo (`Math.round`);
  - ou valor fixo de desconto em reais;
  - ou preço promocional definido produto a produto.
- **Produtos**: escolha de produtos avulsos e de categorias inteiras. Mostre uma prévia com cada produto afetado, preço atual, preço na promoção e % de desconto antes de salvar.
- **Ativa**: liga e desliga sem apagar.

Validações:

- O preço promocional nunca fica abaixo de R$ 0,01 e precisa ser menor que o preço cadastrado.
- Avise (sem bloquear) quando o preço promocional ficar abaixo do custo do produto.
- Kits: a promoção vale para o preço do kit. Não mude o preço dos componentes por causa do kit.
- Um produto em duas promoções ativas ao mesmo tempo, no mesmo canal: vale o **menor preço**. Na prévia, mostre qual promoção ganhou.

## Preço efetivo

Crie uma função única de preço efetivo, `precoEfetivo(produto, canal, agora)`, usada em todo lugar que hoje lê o preço cadastrado para vender: comanda do balcão, catálogo enviado ao site e validação de preço dos pedidos do site. Não espalhe a regra.

- Sem promoção vigente: preço cadastrado.
- Com promoção vigente no canal: menor preço promocional entre as promoções ativas.
- O preço cadastrado continua intacto. Encerrada a promoção, tudo volta a ele sem ninguém mexer.

## Sincronização com o site

No `POST /api/pdv-sync/estoque`, cada produto continua com `precoCentavos`, que passa a ser o **preço efetivo no canal site**. Assim os pedidos do site, a validação de preço e o "pedido mantém o preço da foto" funcionam sem mudança.

Campo novo, opcional, em cada produto:

```ts
promocao?: {
  id: string;
  nome: string;                    // selo do site, até 30 caracteres
  precoOriginalCentavos: number;   // preço cadastrado, mostrado riscado
  terminaEm: string;               // ISO 8601
} | null;
```

- Envie `promocao` só quando há promoção vigente no canal site. Sem promoção, envie `null`, para o site limpar o selo num delta.
- **Início e fim de promoção contam como mudança de produto.** O worker precisa mandar o delta no primeiro ciclo depois do horário de início e de fim, mesmo sem nenhuma venda nem ajuste de estoque. Não espere a foto completa de 10 min.
- Editar, encerrar ou desativar uma promoção vigente também gera delta dos produtos afetados.
- Atualize `src/lib/site-sync.ts` com o tipo e a validação novos: `nome` até 30 caracteres, `precoOriginalCentavos` inteiro maior que `precoCentavos`, `terminaEm` data válida. Mantenha o arquivo idêntico ao `src/lib/pdv/sync.ts` do site, que vai receber a mesma alteração. O validador atual do site ignora campos desconhecidos, então o PDV novo funciona com o site antigo.
- Documente o campo em `docs/API-SITE.md`.

## Pedidos do site e histórico de preço

- Registre cada preço promocional no histórico de preços quando a promoção começa a valer. Assim a regra atual ("o preço do site só vale se for o atual ou um dos últimos 7 dias") aceita pedidos feitos com o preço da promoção, inclusive os confirmados depois de a promoção acabar.
- Um pedido criado no site durante a promoção mantém o preço promocional quando a loja confirma ou recebe, mesmo se a promoção já tiver acabado.

## Registro, telas e relatórios

- Cada item vendido guarda o preço cadastrado, o preço cobrado e o `id` da promoção aplicada (ou nenhum).
- A comanda e o comprovante mostram o preço cadastrado riscado, o preço promocional e o nome da promoção.
- Relatório **Vendas por promoção**: período, unidades, faturamento e desconto total concedido por promoção e por produto.
- Relatórios existentes de faturamento continuam usando o valor cobrado.

## O que não mudar

- O preço cadastrado do produto, a não ser que a loja o edite.
- A segurança da sincronização: tudo continua sendo chamada de saída do PC, assinada com HMAC.
- Taxa de cartão: está fora desta tarefa. O site calcula o preço no cartão sozinho a partir do preço que o PDV manda.

## Testes

- Percentual, valor fixo e preço por produto, incluindo arredondamento (ex.: 15% de R$ 69,90 = R$ 59,42).
- Promoção agendada começa e termina no horário certo, no fuso da loja.
- Delta enviado no início e no fim da promoção sem nenhuma outra mudança no produto.
- Promoção "só site" não muda o preço no balcão, e "só balcão" não muda o preço enviado ao site.
- Duas promoções no mesmo produto: vale o menor preço.
- Kit em promoção não altera os componentes.
- Pedido do site criado na promoção e recebido depois do fim: cobra o preço promocional.
- Encerrar agora e desativar voltam o preço e limpam `promocao` no próximo delta.
- Validação recusa preço promocional maior ou igual ao preço cadastrado e nome com mais de 30 caracteres.

No final, liste os arquivos alterados, a migração criada, o resultado dos testes e o que ficou pendente.
