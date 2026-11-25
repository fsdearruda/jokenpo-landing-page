# Plano: pagamento online com Checkout Bricks (Mercado Pago)

Status: **proposta**, ainda sem implementação. Escrito em 24/11/2026 a partir do
estado de `/produtos` em 24/11/2026. Atualização: a vitrine agora envia o
pedido pelo WhatsApp da loja, sem número de reserva nem coleta de dados no
site. Este plano vale para quando o pagamento online substituir ou complementar
esse fluxo; a reserva via `POST /api/pdv/pedidos` continua disponível para isso.

Pontos marcados com **[verificar]** dependem de conferência na documentação
atual do Mercado Pago ou com assessoria jurídica antes de ir para produção.

---

## 1. Objetivo

Permitir que o cliente pague online os itens reservados em `/produtos` e
retire na loja, sem que dados de cartão passem pelos servidores da Jokenpo e
cumprindo a LGPD (Lei 13.709/2018).

Fora do escopo desta fase: entrega/frete, boleto (a reserva dura 48h, menos
que a compensação), parcelamento com juros, conta de cliente com login.

## 2. Ponto de partida

| Já existe | Onde |
|---|---|
| Catálogo extraído do PDV | `src/data/products.json`, `scripts/extract-products.mjs` |
| Contrato do PDV (`PdvClient`) | `src/lib/pdv/types.ts` |
| PDV simulado com reserva, venda, cancelamento e expiração | `src/lib/pdv/mock.ts` |
| Rotas `GET /api/pdv/estoque`, `POST /api/pdv/pedidos`, `.../confirmar`, `.../cancelar` | `src/pages/api/pdv/` |

O mock já modela o ciclo que o pagamento precisa: `RESERVA` → `VENDA`
(pagamento aprovado) ou `LIBERACAO` (recusado, cancelado ou expirado).

**Pré-requisito:** trocar o mock por um cliente HTTP da API real do PDV
(`HttpPdvClient` implementando a mesma interface). Sem isso, um pagamento
aprovado não baixa o estoque de verdade.

## 3. Arquitetura

```
Navegador                      Vercel (Astro, rotas sob demanda)            Mercado Pago / PDV
─────────                      ─────────────────────────────────            ──────────────────
1. Sacola → "Pagar agora" ──▶  POST /api/checkout/pedidos
                               · recalcula preços pelo PDV
                               · pdv.criarPedido() (RESERVA)        ──────▶ PDV
                          ◀──  { pedidoId, totalCentavos }
2. Carrega SDK v2 e monta
   Payment Brick com o
   total vindo do servidor
3. onSubmit(formData) ─────▶  POST /api/checkout/pagamentos
                               · confere pedido ABERTO e total
                               · POST /v1/payments                  ──────▶ Mercado Pago
                                 X-Idempotency-Key = pedidoId
                                 external_reference = pedidoId
                          ◀──  { paymentId, status }
4. Status Screen Brick
   (aprovado, pendente Pix
   com QR, recusado)
                               POST /api/webhooks/mercadopago       ◀────── notificação
                               · valida x-signature (HMAC)
                               · GET /v1/payments/{id}              ──────▶ Mercado Pago
                               · approved  → pdv.confirmarPagamento ──────▶ PDV (VENDA)
                               · rejected/cancelled/expired
                                           → pdv.cancelarPedido     ──────▶ PDV (LIBERACAO)
```

Regras que não podem ser quebradas:

1. **O valor sempre vem do servidor.** O total é recalculado a partir do PDV
   em cada passo; o `amount` enviado pelo navegador é ignorado.
2. **O webhook é a fonte da verdade.** A resposta síncrona do passo 3 só muda
   a tela; o estoque só vira `VENDA` depois que o webhook confirma, consultando
   o pagamento pela API (nunca confiando só no corpo da notificação).
3. **Idempotência.** `X-Idempotency-Key` em `POST /v1/payments` e webhook que
   aceita a mesma notificação várias vezes sem baixar estoque duas vezes.
4. **Pix expira antes da reserva.** `date_of_expiration` do Pix menor que
   `validoAte` do pedido (ex.: Pix 30 min, reserva 48h).

## 4. Bricks

| Brick | Uso |
|---|---|
| **Payment Brick** | Cartão de crédito, débito e Pix num só componente. Cartão é tokenizado nos campos seguros do Brick. |
| **Status Screen Brick** | Tela pós-pagamento: aprovado, QR Code e copia-e-cola do Pix pendente, recusado com motivo. |
| Wallet Brick | Opcional, depois: pagar com saldo da conta Mercado Pago. |

Configuração sugerida do Payment Brick: `paymentMethods: { creditCard: 'all',
debitCard: 'all', bankTransfer: ['pix'] }`, `maxInstallments` definido pela
loja, `locale: 'pt-BR'` e `customization.visual` com as cores da marca
(`#FFD400`, `#0E0E10`). **[verificar]** nomes exatos das chaves na versão do
SDK no momento da implementação.

## 5. Mudanças no código

| Arquivo | Mudança |
|---|---|
| `src/lib/pdv/http.ts` | `HttpPdvClient` falando com a API real do PDV |
| `src/lib/payments/mercadopago.ts` | `criarPagamento()`, `buscarPagamento()`, `validarAssinatura()` com `fetch` (sem SDK Node, para manter a função leve) |
| `src/pages/api/checkout/pedidos.ts` | Cria a reserva e devolve total recalculado |
| `src/pages/api/checkout/pagamentos.ts` | Recebe `formData` do Brick e chama `/v1/payments` |
| `src/pages/api/webhooks/mercadopago.ts` | Valida `x-signature`, consulta o pagamento e atualiza o PDV |
| `src/pages/produtos/pagamento.astro` (ou `<dialog>` em `/produtos`) | Monta Payment Brick e Status Screen Brick |
| `src/pages/privacidade.astro` | Política de privacidade (seção 7) |
| `vercel.json` | CSP com os domínios do Mercado Pago (seção 6) |
| `.env.example`, `src/env.d.ts` | Novas variáveis abaixo |

Variáveis:

| Variável | Onde | Observação |
|---|---|---|
| `PUBLIC_MP_PUBLIC_KEY` | Navegador | Chave pública; inicia o SDK |
| `MP_ACCESS_TOKEN` | Servidor | Nunca com prefixo `PUBLIC_`; separar teste e produção |
| `MP_WEBHOOK_SECRET` | Servidor | Assinatura secreta do webhook, gerada no painel |
| `PDV_API_URL`, `PDV_API_TOKEN` | Servidor | API real do PDV |

## 6. Segurança

- **PCI:** com o Brick, número, validade e CVV do cartão ficam nos campos
  hospedados pelo Mercado Pago e viram token. O servidor só recebe o token,
  o que mantém a loja no menor escopo de PCI DSS. **[verificar]** questionário
  aplicável (SAQ A) com o Mercado Pago.
- **Webhook:** validar `x-signature` montando o manifesto
  `id:{data.id};request-id:{x-request-id};ts:{ts};` e comparando o HMAC-SHA256
  com `v1` em tempo constante; rejeitar `ts` antigo (ex.: mais de 5 min).
  **[verificar]** formato atual do manifesto na documentação de notificações.
- **CSP** (hoje não existe CSP no `vercel.json`; criar junto):
  `script-src 'self' https://sdk.mercadopago.com https://www.mercadopago.com https://http2.mlstatic.com`,
  `frame-src https://www.mercadopago.com.br https://www.mercadolibre.com`,
  `connect-src 'self' https://api.mercadopago.com https://api.mercadolibre.com`.
  **[verificar]** lista completa de domínios do SDK v2 e do script de antifraude,
  testando com `Content-Security-Policy-Report-Only` antes de aplicar.
- **Abuso:** limite de requisições por IP em `POST /api/checkout/*`, limite de
  itens por pedido (já existe no mock: 5 por item) e expiração de reservas.
- **Segredos:** `MP_ACCESS_TOKEN` só no ambiente da Vercel; credenciais de
  teste em Preview e produção só em Production.
- **Logs:** registrar `pedidoId`, `paymentId`, `status`. Nunca o corpo do
  `formData`, e-mail, CPF ou token de cartão.

## 7. LGPD

### 7.1 Papéis

| Agente | Papel | Observação |
|---|---|---|
| Jokenpo (MEI) | Controladora | Decide a finalidade: vender e entregar no balcão |
| Mercado Pago | Controlador independente no processamento do pagamento e antifraude **[verificar]** nos termos de uso vigentes | Tem política de privacidade própria; citar na nossa |
| Vercel | Operadora (hospedagem) | Servidores fora do Brasil → transferência internacional |
| Fornecedor do PDV | Operador | Contrato precisa de cláusula de proteção de dados |

### 7.2 Mapa de dados

| Dado | Quem coleta | Finalidade | Base legal (art. 7º) | Onde fica | Retenção |
|---|---|---|---|---|---|
| Nome e WhatsApp | Site | Identificar a reserva no balcão e avisar | V: execução de contrato / procedimentos preliminares | PDV (`Pedido.nomeContato`, `telefoneContato`) | Reserva não paga: apagar ou anonimizar em até 30 dias. Paga: junto com o pedido |
| E-mail e CPF do pagador | Payment Brick | Exigidos pelo Mercado Pago para o pagamento (CPF no Pix) | V: execução de contrato | Mercado Pago. **Não guardar no nosso banco** | Conforme política do Mercado Pago |
| Dados do cartão | Payment Brick (campos seguros) | Pagamento | V | Só no Mercado Pago (token) | Não armazenado pela Jokenpo |
| `paymentId`, status, valor | Servidor | Conciliação, estorno, obrigação fiscal | II: obrigação legal; V | PDV (`Pagamento.autorizacao`) | 5 anos (prazo fiscal) **[verificar]** com contador |
| IP, user agent, fingerprint do dispositivo | Script de segurança do Mercado Pago | Prevenção a fraude | IX: legítimo interesse (do Mercado Pago) | Mercado Pago | Conforme política do Mercado Pago |

Minimização: o site não pede CPF nem e-mail no próprio formulário; quem pede é
o Brick, só no momento de pagar. O retorno das APIs para o navegador continua
mascarado como no mock (primeiro nome e 4 últimos dígitos do telefone).

### 7.3 Transparência e direitos

- Criar `/privacidade` com: quem é a controladora (nome, CNPJ, endereço),
  dados coletados e por quê (tabela 7.2 em linguagem simples), com quem são
  compartilhados (Mercado Pago, Vercel, PDV), transferência internacional,
  prazos de retenção e como exercer os direitos do art. 18 (acesso, correção,
  eliminação, portabilidade, informação sobre compartilhamento).
- Aviso curto junto ao botão de pagar, com link para `/privacidade` e para a
  política do Mercado Pago. Não usar caixa de consentimento: a base é execução
  de contrato, e pedir consentimento sugeriria que dá para recusar e ainda assim comprar.
- **Canal do titular:** `contato@jokenpo.cards`, com resposta em até 15 dias
  (art. 19, II). Agentes de tratamento de pequeno porte podem dispensar o
  encarregado (Resolução CD/ANPD nº 2/2022), mas o canal é obrigatório.
  **[verificar]** enquadramento da loja.
- Marketing (ofertas no WhatsApp) fica fora deste fluxo. Se um dia existir,
  precisa de consentimento separado, opcional e desmarcado por padrão.

### 7.4 Segurança e incidentes

- Medidas do art. 46: HTTPS (já na Vercel), segredos fora do código, acesso ao
  PDV com usuário individual, logs sem dados pessoais (seção 6).
- Incidente com risco relevante: comunicar ANPD e titulares (art. 48). A
  Resolução CD/ANPD nº 15/2024 fixa prazo de 3 dias úteis **[verificar]**.
  Manter um registro simples de incidentes, mesmo os não comunicados.
- Transferência internacional (Vercel, possivelmente Mercado Pago): apoiar em
  cláusulas-padrão contratuais (Resolução CD/ANPD nº 19/2024) e citar na política.
  **[verificar]** se os termos da Vercel já incluem as cláusulas da ANPD.

### 7.5 Consumidor

O CDC (art. 49) dá direito de arrependimento em compras fora do
estabelecimento. Com retirada na loja, a aplicação é discutível: definir a
política de cancelamento e reembolso antes de lançar e publicar junto da
política de privacidade. **[verificar]** com assessoria jurídica.

## 8. Fases

| Fase | Entrega | Critério de aceite |
|---|---|---|
| 0. Decisões | Formas de pagamento, parcelas, política de cancelamento, contrato do PDV | Itens da seção 10 resolvidos |
| 1. PDV real | `HttpPdvClient`, `PUBLIC_PDV_MODE=live` | Reserva feita no site aparece no PDV da loja e libera ao expirar |
| 2. Privacidade | `/privacidade`, aviso no checkout, rotina de limpeza de reservas não pagas | Política publicada e linkada no rodapé |
| 3. Checkout sandbox | Payment Brick + Status Screen + `/api/checkout/*` com credenciais de teste | Cartão aprovado, cartão recusado e Pix pendente → aprovado testados com os usuários de teste |
| 4. Webhook | Validação de assinatura, idempotência, `VENDA`/`LIBERACAO` | Notificação repetida não baixa estoque duas vezes; assinatura inválida retorna 401 |
| 5. Produção | CSP aplicada, credenciais de produção, monitoramento | Compra real de valor baixo, estorno pelo painel e conferência no PDV |

## 9. Desempenho e acessibilidade

- Carregar `https://sdk.mercadopago.com/js/v2` só quando o cliente clicar em
  "Pagar agora", nunca no carregamento de `/produtos`, para manter o
  Lighthouse em 95+.
- O Brick roda em iframes do Mercado Pago: testar navegação por teclado,
  leitor de tela e zoom de 200% dentro dele e registrar o que não for
  controlável pela loja.
- Manter a reserva sem pagamento (pagar no balcão) como alternativa.

## 10. Decisões pendentes

1. Formas de pagamento aceitas online e número máximo de parcelas (o
   `docs/brand-content.md` ainda lista bandeiras e Pix como pendência).
2. Taxas do Mercado Pago: repassar, absorver ou ter preço diferente online.
3. Política de cancelamento, troca e reembolso.
4. Emissão de nota: o PDV já tem `DocumentoFiscal` (NFC-e); confirmar se a
   venda online sai pelo mesmo fluxo.
5. Prazo de retenção de reservas não pagas (proposta: 30 dias).
6. Quem na loja responde o canal do titular.
