-- Ponte entre o site e o PDV da loja (docs/plano-api-pdv.md).
-- O PDV é a fonte da verdade do estoque; aqui ficam a cópia pública do catálogo
-- e os pedidos feitos no site até a loja confirmar.

-- Cópia do estoque enviada pelo PDV (POST /api/pdv-sync/estoque)
CREATE TABLE IF NOT EXISTS pdv_produto (
	produto_id     text PRIMARY KEY,                 -- Produto.id no PDV
	sku            text,
	nome           text NOT NULL,
	categoria      text,
	grupo          text,
	preco_centavos integer NOT NULL CHECK (preco_centavos >= 0),
	disponivel     integer NOT NULL CHECK (disponivel >= 0), -- estoque - reservado, no PDV
	visivel        boolean NOT NULL,                 -- marcado para o site em Cadastros → Site
	atualizado_em  timestamptz NOT NULL,             -- no PDV
	recebido_em    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pdv_produto_visivel ON pdv_produto (visivel);

-- Pedidos feitos no site. Status: AGUARDANDO_CONFIRMACAO (ainda não chegou à loja),
-- PAGAMENTO_PENDENTE, PAGO, ENTREGUE, RECUSADO, CANCELADO, EXPIRADO.
CREATE TABLE IF NOT EXISTS pdv_pedido (
	id                 uuid PRIMARY KEY,
	numero             serial UNIQUE,                -- número que o cliente vê
	status             text NOT NULL,
	itens              jsonb NOT NULL,               -- [{produtoId, descricao, quantidade, precoUnitarioCentavos, totalCentavos}]
	total_centavos     integer NOT NULL,
	nome_contato       text NOT NULL,
	telefone_contato   text NOT NULL,
	contato_mascarado  boolean NOT NULL DEFAULT false, -- LGPD: só primeiro nome e 4 dígitos depois que a loja recebeu
	evento_id          bigint,
	numero_pdv         integer,
	valido_ate         timestamptz,                  -- prazo de pagamento (48 h depois da confirmação na loja)
	motivo             text,
	criado_em          timestamptz NOT NULL DEFAULT now(),
	atualizado_em      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pdv_pedido_status ON pdv_pedido (status, evento_id);

-- Fila site → PDV. O PDV busca em ordem (GET /api/pdv-sync/eventos) e confirma (ack).
CREATE TABLE IF NOT EXISTS pdv_evento (
	id          bigserial PRIMARY KEY,
	tipo        text NOT NULL,
	pedido_id   uuid NOT NULL REFERENCES pdv_pedido (id),
	payload     jsonb NOT NULL,
	criado_em   timestamptz NOT NULL DEFAULT now(),
	aplicado_em timestamptz,
	resultado   jsonb
);

-- Estado da sincronização (linha única)
CREATE TABLE IF NOT EXISTS pdv_sync (
	id                      smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
	pdv_seq                 bigint NOT NULL DEFAULT 0,
	eventos_aplicados_ate   bigint NOT NULL DEFAULT 0, -- eventos até aqui já estão nos números de pdv_produto
	ultimo_contato_em       timestamptz,
	ultima_foto_completa_em timestamptz
);
INSERT INTO pdv_sync (id) VALUES (1) ON CONFLICT DO NOTHING;
