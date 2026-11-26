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
| `db/migrations/*.sql`, `scripts/db-migrate.mjs` | Tabelas `pdv_produto`, `pdv_pedido`, `pdv_evento`, `pdv_sync`, `pdv_limite_ip`. Aplicadas no build da Vercel (`vercel-build`); à mão: `pnpm db:migrate`. Só acrescentar (IF NOT EXISTS), nunca renomear ou apagar |
| `src/lib/db.ts` | Conexão (`postgres`, sem prepared statements, compatível com o pooler do Neon) |
| `src/lib/pdv/cloud.ts` | `CloudPdvClient` (catálogo, estoque, criar e buscar pedido) e as operações da sincronização |
| `src/lib/pdv/estoque.ts` | Regras puras do disponível no site e do selo de promoção (testadas) |
| `src/lib/pdv/sync-auth.ts` | Confere a assinatura do PC da loja |
| `src/lib/pdv/fotos.ts`, `src/pages/api/pdv-sync/foto.ts` | Fotos de produto enviadas pelo PDV, guardadas no Vercel Blob (`jokenpo-fotos`, público, `gru1`, uma pasta por ambiente) |
| `src/lib/pdv/limite.ts` | Limite de pedidos por IP |
| `src/pages/api/pdv-sync/*` | Rotas chamadas pelo PC da loja |
| `src/lib/pdv/index.ts`, `types.ts` | Acesso ao PDV (`getPdv`), `PEDIDOS_NO_SITE` e contrato público das rotas `/api/pdv/*` |
| `src/lib/vitrine.ts` | Seções da vitrine: uma por grupo de categoria do PDV, destaques primeiro, nome/descrição/fotos do PDV |
| `src/pages/loja/[slug].astro`, `src/pages/sitemap.xml.ts` | Página de cada produto (slug criado no PDV) e sitemap com essas páginas |
| `src/pages/loja.astro` | Sempre sob demanda (`prerender = false`), com `s-maxage=60, stale-while-revalidate=600` na CDN |

## Ambientes

| | Production | Preview e Development |
|---|---|---|
| Postgres Neon (plano gratuito, `sa-east-1`) | `jokenpo-pdv-ponte` | `jokenpo-pdv-ponte-preview` |
| `DATABASE_URL` e afins | integração da Vercel | integração da Vercel |
| `PDV_SYNC_TOKEN` | cópia local em `~/.config/jokenpo/site-sync-token` (vai para o PC da loja) | outro valor: `~/.config/jokenpo/site-sync-token-preview` |
| `PEDIDOS_NO_SITE` | não definido (= `true`) | não definido |
| `BLOB_READ_WRITE_TOKEN` | integração do Vercel Blob | integração do Vercel Blob |

`vercel env pull` em desenvolvimento aponta para o banco de preview. Funções da Vercel em `gru1`
(`vercel.json`), ao lado dos bancos. Segredos lidos em tempo de execução via `astro:env` (`getSecret`).

## Produção

Ligado desde 25/11/2026: o PC da loja sincroniza e `/loja` usa o catálogo do PDV (é a única fonte desde a fase 4: sem `products.json`, sem mock e sem conteúdo de produto no CMS). Fotos de produto
otimizadas pelo `/_vercel/image` (`imagesConfig` no `astro.config.mjs`) a partir do Blob.

## Cartas avulsas

Entram no site só marcadas à mão no PDV. Aparecem como cartão de texto (jogo, carta, coleção, número, condição,
idioma) e ganham filtros em `/loja` quando há mais de uma opção. Imagem das APIs de cartas não vai para o site
(licença para software e conteúdo de fã); foto tirada pela loja vai.

## Loja sem conexão

A regra (`lojaOffline` em `src/lib/pdv/estoque.ts`) olha o último envio de estoque **aceito**
(`pdv_sync.ultimo_estoque_em`), não só o último contato. A loja conta como offline quando:

- nenhum estoque foi aceito há mais de 6 h (`LOJA_OFFLINE_HORAS`; PC desligado, internet fora); ou
- o PC segue falando com o site (buscando pedidos), mas nenhum estoque é aceito há mais de 30 min
  (`ESTOQUE_PARADO_MINUTOS`; envio recusado, por exemplo relógio do PC atrasado). O PC manda a foto completa a
  cada 10 min, então esse silêncio é falha, não falta de mudança.

Offline, `/loja` continua mostrando o catálogo, mas a sacola manda o pedido pelo WhatsApp, e
`POST /api/pdv/pedidos` responde `LOJA_OFFLINE` (503) para quem estiver com a página em cache.

## Banco fora do ar

`/loja` e `/loja/<produto>` respondem 503 com `Cache-Control: no-store` quando o Postgres falha. A resposta não
entra no cache, então a CDN segue servindo a última página boa (dentro do `stale-while-revalidate`), e o
buscador não recebe 404 de produto que existe.

## Alertas

O Vercel Schedules `saude-pdv` (`vercel.json`) chama `GET /api/pdv-sync/saude` às :30, das 14h30 às 21h30
de segunda a sábado (America/Fortaleza; fora do horário o PC pode estar desligado), com
`Authorization: Bearer $CRON_SECRET`. A rota aponta três problemas (`src/lib/pdv/saude.ts`), cada um depois de
30 min: PC sem contato, PC conectado com o estoque recusado e pedido esperando o PC. Ela manda e-mail pelo
Resend para contato@jokenpo.cards só quando a lista muda (aparece problema ou volta ao normal), guardando o já
avisado em `pdv_sync.alerta_chave`. Se o envio falhar, nada é gravado e a próxima checagem tenta de novo.

É alvo `path` (e não função privada) porque o Astro junta todas as rotas numa função só. Testar em produção:
`vercel schedules invoke saude-pdv`.

## Robôs

`POST /api/pdv/pedidos` passa pelo Vercel BotID (nível Basic, grátis): a sacola chama `initBotId` só quando o
pedido no site está ligado, e a rota responde `ACESSO_NEGADO` (403) para robô. Se o serviço falhar, a venda
segue (o limite por IP e por telefone continua). Em dev e fora da Vercel o BotID responde humano.

## Pendências conhecidas

- Sem Content-Security-Policy: o widget do Blip e o Decap CMS precisam de testes. Começar com
  `Content-Security-Policy-Report-Only`.
- `Hero` e `ExtrasSection` usam `set:html` com texto do `site.json`, editado só por quem tem acesso ao repositório.
