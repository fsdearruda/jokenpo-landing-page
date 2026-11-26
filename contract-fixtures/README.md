# Exemplos de mensagens da sincronização com o site

Mensagens reais do protocolo (`src/lib/site-sync.ts`, `docs/API-SITE.md`). Os testes dos dois
repositórios leem estes arquivos: o PDV confere que gera e aceita este formato, e o site confere
que aceita o que o PDV manda. O site copia esta pasta com `pnpm sync:contract`.

| Arquivo | Rota | Quem manda |
|---|---|---|
| `envio-estoque.json` | `POST /api/pdv-sync/estoque` | PDV (foto completa com kit, promoção, conteúdo da vitrine, regras da loja e pedido) |
| `envio-estoque-pdv-antigo.json` | `POST /api/pdv-sync/estoque` | PDV de versão anterior (sem `promocao`, `conteudo` e `loja`): o site precisa continuar aceitando |
| `envio-foto.json` | `POST /api/pdv-sync/foto` | PDV (foto de produto em base64) |
| `eventos.json` | resposta de `GET /api/pdv-sync/eventos` | Site |
| `ack.json` | `POST /api/pdv-sync/eventos/ack` | PDV |

Campo novo no contrato: acrescente aqui um exemplo com o campo e mantenha um exemplo sem ele.
