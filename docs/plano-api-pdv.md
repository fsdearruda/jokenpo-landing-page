# Integração com o PDV: operação do site

O protocolo (ciclo do pedido, cálculo do disponível, rotas, assinatura, promoções, conflitos e
segurança) está em **`docs/API-SITE.md` do repositório `jokenpo-pdv`**, que é o dono do contrato.
Aqui fica só o que é do site: arquivos, variáveis, banco e deploy.

## Contrato

`src/lib/pdv/sync.ts` e `contract-fixtures/` são **cópias** do PDV. Nunca edite à mão:

```bash
pnpm sync:contract   # copia do PDV (PDV_REPO_DIR no .env.local) e atualiza contract.lock.json
pnpm check           # falha se a cópia foi editada
```

No CI, `pnpm sync:contract --remote` compara com o `main` do PDV (precisa do segredo
`PDV_CONTRACT_TOKEN`, token de leitura do repositório do PDV) e roda também uma vez por dia.

## Arquivos

| Arquivo | Papel |
|---|---|
| `db/migrations/*.sql`, `scripts/db-migrate.mjs` | Tabelas `pdv_produto`, `pdv_pedido`, `pdv_evento`, `pdv_sync`, `pdv_limite_ip` (`pnpm db:migrate`) |
| `src/lib/db.ts` | Conexão (`postgres`, sem prepared statements, compatível com o pooler do Neon) |
| `src/lib/pdv/cloud.ts` | `CloudPdvClient` (catálogo, estoque, criar e buscar pedido) e as operações da sincronização |
| `src/lib/pdv/estoque.ts` | Regras puras do disponível no site e do selo de promoção (testadas) |
| `src/lib/pdv/sync-auth.ts` | Confere a assinatura do PC da loja |
| `src/lib/pdv/limite.ts` | Limite de pedidos por IP |
| `src/pages/api/pdv-sync/*` | Rotas chamadas pelo PC da loja |
| `src/lib/pdv/index.ts`, `types.ts`, `mock.ts` | `PUBLIC_PDV_MODE = live \| mock \| off`, contrato público e mock |
| `src/lib/vitrine.ts` | Seções da vitrine |
| `astro.config.mjs` | Com `PUBLIC_PDV_MODE=live`, `/loja` vira rota sob demanda (`s-maxage=60`) |

## Ambientes

| | Production | Preview e Development |
|---|---|---|
| Postgres Neon (plano gratuito, `sa-east-1`) | `jokenpo-pdv-ponte` | `jokenpo-pdv-ponte-preview` |
| `DATABASE_URL` e afins | integração da Vercel | integração da Vercel |
| `PDV_SYNC_TOKEN` | cópia local em `~/.config/jokenpo/site-sync-token` (vai para o PC da loja) | outro valor: `~/.config/jokenpo/site-sync-token-preview` |
| `PUBLIC_PDV_MODE` | não definido até o passo 4 abaixo | `live` (só Preview) |

`vercel env pull` em desenvolvimento aponta para o banco de preview. Funções da Vercel em `gru1`
(`vercel.json`), ao lado dos bancos. Segredos lidos em tempo de execução via `astro:env` (`getSecret`).

## Ligar em produção

1. No PC da loja, rodar `scripts\loja\atualizar.cmd` (aplica a migração do PDV).
2. No `.env` do PC: `SITE_SYNC_URL="https://jokenpo.cards"` e `SITE_SYNC_TOKEN` com o token de produção.
   Reiniciar e marcar os produtos em Cadastros → Site.
3. Conferir na aba Pedidos o selo "Site sincronizado".
4. `vercel env add PUBLIC_PDV_MODE production` com `live` e novo deploy. Até a primeira sincronização,
   a vitrine usa o catálogo do build com pedido pelo WhatsApp, então ligar antes não quebra a página.

## Pendências conhecidas

- Sem Content-Security-Policy: o widget do Blip e o Decap CMS precisam de testes. Começar com
  `Content-Security-Policy-Report-Only`.
- `Hero` e `ExtrasSection` usam `set:html` com texto do `site.json`, editado só por quem tem acesso ao repositório.
- Lighthouse do modo `live` (página sob demanda) só dá para medir depois do deploy.
