-- Kits: componentes enviados pelo PDV, para o site descontar os pedidos pendentes de cada componente.
ALTER TABLE pdv_produto ADD COLUMN IF NOT EXISTS componentes jsonb; -- [{produtoId, quantidade, disponivel}] só em kit

-- Limite de pedidos por IP (o IP não é guardado: só um hash com o segredo do site).
CREATE TABLE IF NOT EXISTS pdv_limite_ip (
	chave    text NOT NULL,
	janela   timestamptz NOT NULL,
	contagem integer NOT NULL DEFAULT 0,
	PRIMARY KEY (chave, janela)
);
