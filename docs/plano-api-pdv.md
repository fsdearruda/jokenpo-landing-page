# API entre o site e o PDV da loja

Status: **implementado em desenvolvimento** (25/11/2026), nas branches
`feat/api-pdv` (este repositório) e `feat/api-site` (`jokenpo-pdv`). Ainda falta
criar o banco de produção e configurar as variáveis (seção 8).

O lado do PDV está documentado em `docs/API-SITE.md` do repositório `jokenpo-pdv`.

---

## 1. Decisões

| Tema | Decisão |
|---|---|
| Arquitetura | O PC da loja **só faz chamadas de saída** para o site. O site guarda num Postgres (Neon pela Vercel) uma cópia do catálogo e uma fila de pedidos. Nenhuma porta da loja fica aberta para a internet |
| Fonte da verdade | O estoque do PDV. O site só desconta, provisoriamente, os pedidos que a loja ainda não confirmou |
| Conflito com o PC offline | O pedido fica **aguardando confirmação** até o PC da loja conferir o estoque. Sem internet na loja, continua aguardando. Com estoque, a loja separa as unidades. Sem estoque, o pedido é recusado e nada é separado |
| Pagamento | Pelo WhatsApp, em até **48 h depois da confirmação**. Quem marca o pagamento é a loja, no PDV. Mercado Pago online foi descartado |
| O que aparece no site | Decidido no PDV, em **Cadastros → Site**: marcar produto por produto, ou a categoria inteira, e escolher se cartas avulsas novas já entram no site |
| Acesso remoto | Via Tailscale, quem estiver fora da loja mexe no estoque pelo próprio PDV. Não existe ajuste de estoque pelo site |

## 2. Ciclo do pedido

```
Site                                PC da loja (PDV)
────                                ────────────────
Cliente faz o pedido
  AGUARDANDO_CONFIRMACAO  ───────▶  aplica ao ligar ou no próximo ciclo (15 s)
  (unidades seguras no site)          ├─ tem estoque → separa (estoqueReservado)
                                      │     PAGAMENTO_PENDENTE (48 h)
                                      └─ não tem    → RECUSADO
Cliente paga por Pix no WhatsApp
                                    "Receber pagamento" abre a comanda do pedido
                                    (a reserva vira venda); pagamento pela tela normal
                                    comanda fechada → PAGO
                                    retirada → ENTREGUE
                                    48 h sem pagamento → EXPIRADO (estoque volta)
                                    loja cancela → CANCELADO (estoque volta)
```

O cliente acompanha o status na própria sacola de `/produtos`. O pedido fica
salvo no navegador e é consultado a cada 20 s em `GET /api/pdv/pedidos/:id`.

## 3. Quanto aparece disponível no site

```
disponível no site = disponível no PDV (estoque − reservado, na última foto)
                   − itens dos pedidos que a última foto ainda não inclui
```

"Ainda não inclui" quer dizer: pedido com evento depois de
`pdv_sync.eventos_aplicados_ate`, e que não foi recusado, cancelado nem
expirado. Cada envio do PDV informa até qual evento já aplicou. Assim a reserva
nunca é descontada duas vezes. A criação de pedido trava a linha `pdv_sync`, então
dois clientes não conseguem pegar a mesma última unidade.

## 4. Sincronização (o PC da loja chama)

Cada requisição leva `X-Pdv-Timestamp` e
`X-Pdv-Assinatura = HMAC-SHA256(PDV_SYNC_TOKEN, ts\nMÉTODO\ncaminho?query\ncorpo)`,
e vale por 5 minutos.

| Rota | O que faz |
|---|---|
| `GET /api/pdv-sync/eventos?depois=&limite=` | Pedidos criados no site, em ordem (inclui os já aplicados; o PDV é idempotente) |
| `POST /api/pdv-sync/eventos/ack` | Resultado de cada evento (`APLICADO` com status do pedido, ou `RECUSADO`) |
| `POST /api/pdv-sync/estoque` | Foto do estoque (completa ou só o que mudou), `eventosAplicadosAte` e status dos pedidos alterados na loja |

Ciclo do worker no PDV (`src/server/site-sync.ts`):

1. aplica os eventos novos e confirma em lotes de 50;
2. expira pedidos com prazo vencido;
3. envia o estoque.

Na subida do servidor, e depois de qualquer falha, o envio é a **foto completa**.
Isso cobre o PC desligado e também a internet caída com o PC ligado. Com tudo
normal, o ciclo roda a cada 15 s mandando só o que mudou, e a cada 10 min manda a
foto completa. Sem resposta do site, as tentativas vão espaçando de 15 s até 5 min.

## 5. Arquivos neste repositório

| Arquivo | Papel |
|---|---|
| `db/migrations/*.sql`, `scripts/db-migrate.mjs` | Tabelas `pdv_produto`, `pdv_pedido`, `pdv_evento`, `pdv_sync`, `pdv_limite_ip` (`pnpm db:migrate`) |
| `src/lib/pdv/limite.ts` | Limite de pedidos por IP |
| `src/lib/db.ts` | Conexão (`postgres`, sem prepared statements, compatível com o pooler do Neon) |
| `src/lib/pdv/cloud.ts` | `CloudPdvClient` (catálogo, estoque, criar e buscar pedido) e as operações da sincronização |
| `src/lib/pdv/sync.ts`, `src/lib/pdv/sync-auth.ts` | Contrato, validação e assinatura (cópia de `src/lib/site-sync.ts` do PDV) |
| `src/pages/api/pdv-sync/*` | Rotas chamadas pelo PC da loja |
| `src/lib/pdv/index.ts`, `types.ts`, `mock.ts` | `PUBLIC_PDV_MODE = live \| mock \| off`, contrato público e mock |
| `src/lib/vitrine.ts` | Seções da vitrine: famílias de `products.json` para os ids conhecidos, mais uma seção por categoria do PDV |
| `src/pages/produtos.astro` | Formulário de pedido (nome + WhatsApp) e painel de status na sacola |
| `astro.config.mjs` | Com `PUBLIC_PDV_MODE=live`, `/produtos` vira rota sob demanda (`s-maxage=60`); nos outros modos continua estática |

## 6. Conflitos e limites

| Situação | O que acontece |
|---|---|
| PC desligado, cliente pede | Pedido aguardando confirmação; aplicado quando o PC liga |
| Balcão vende a última unidade com a internet caída e o site aceita um pedido dela | Ao reconectar, o PDV recusa o pedido. O cliente vê "não deu" com botão para o WhatsApp, e a loja vê o pedido em Pedidos → Sem estoque |
| Kit no site | O PDV envia os componentes de cada kit com o disponível de cada um. O site desconta o pedido pendente de kit nos componentes, e kit e componente avulso no mesmo pedido disputam as mesmas unidades |
| Preço mudou no PDV depois do pedido | O pedido mantém o preço da foto usada na criação |
| Evento repetido | `Pedido.chaveExterna` único no PDV; ack idempotente; recusa sem pedido só vale na primeira vez |
| Banco do site perdido | Recriar com `pnpm db:migrate`; a próxima foto completa repõe o catálogo. Pedidos ainda não aplicados se perdem |
| PDV restaurado de um backup | Foto completa sempre é aceita, mesmo com contador menor |

## 7. Segurança e LGPD

- PC sem porta aberta; segredo só no `.env` do PDV e nas variáveis da Vercel.
- O navegador nunca recebe nome completo nem telefone, só o primeiro nome e os 4
  últimos dígitos.
- Um dia depois de a loja receber o pedido, o banco do site apaga o contato do
  evento e mascara o do pedido.
- Logs sem dados pessoais.
- Limite de 10 tentativas de pedido por IP a cada 10 min (`src/lib/pdv/limite.ts`, tabela `pdv_limite_ip`).
  O IP não é guardado, só um hash com `PDV_SYNC_TOKEN`. Se o limite falhar, a venda não é bloqueada.
  Valem também 5 unidades por item e 20 produtos por pedido.

## 8. Para ir para produção

1. Vercel → Storage → criar um Postgres Neon (região `sa-east-1`), o que preenche `DATABASE_URL`.
2. Rodar `pnpm db:migrate` com essa `DATABASE_URL`.
3. Gerar um segredo (`openssl rand -base64 32`) e colocar em `PDV_SYNC_TOKEN` na Vercel
   e em `SITE_SYNC_TOKEN` no `.env` do PC da loja, junto com `SITE_SYNC_URL="https://jokenpo.cards"`.
4. `PUBLIC_PDV_MODE=live` na Vercel (Production e Preview com bancos separados).
5. No PDV: aplicar a migração (`scripts\loja\atualizar.cmd`) e marcar os produtos em Cadastros → Site.

## 9. Testado em desenvolvimento

Com Postgres local (PGlite) para os dois bancos, o site em `astro dev` e o PDV em `next start`:

- pedido com o PDV desligado é aplicado quando o servidor do PDV sobe;
- pedido acima do disponível é barrado no site;
- venda no balcão durante a queda faz o pedido ser recusado sem separar nada;
- reaplicar a fila inteira não duplica pedido nem reserva;
- receber, fechar a comanda e entregar levam o status do site a `PAGO`/`ENTREGUE`;
- cancelar com a comanda aberta devolve o estoque;
- prazo de 48 h vencido expira e devolve o estoque;
- site fora do ar: o worker registra a falha e, quando o site volta, manda a foto completa;
- pedido de kit desconta os componentes no site, e kit + componente avulso no mesmo pedido é barrado quando falta unidade;
- a 11ª tentativa de pedido do mesmo IP na janela recebe 429;
- sacola, erro de validação e painel do pedido conferidos no Chromium (1366 px e 390 px), sem erro no console;
- Lighthouse do build estático, no mesmo servidor que a base `feat/pagina-produtos`: 98–100 em Performance (base 95–100) e 100 em Acessibilidade, Boas Práticas, SEO e Agentic Browsing.

Não testado: Lighthouse do modo `live` (página sob demanda) só dá para medir depois do deploy na Vercel.
