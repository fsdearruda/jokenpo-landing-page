-- Segurança: limite de pedidos em aberto por WhatsApp e por IP, e envio do PDV sempre mais novo.
ALTER TABLE pdv_pedido ADD COLUMN IF NOT EXISTS ip_hash text; -- hash do IP com o segredo do site (o IP não é guardado)
CREATE INDEX IF NOT EXISTS pdv_pedido_telefone_aberto ON pdv_pedido (telefone_contato) WHERE status IN ('AGUARDANDO_CONFIRMACAO', 'PAGAMENTO_PENDENTE');
CREATE INDEX IF NOT EXISTS pdv_pedido_ip_aberto ON pdv_pedido (ip_hash) WHERE status IN ('AGUARDANDO_CONFIRMACAO', 'PAGAMENTO_PENDENTE');
-- Último `geradoEm` aceito: um envio capturado e reenviado (mesmo dentro dos 5 min da assinatura) é recusado
ALTER TABLE pdv_sync ADD COLUMN IF NOT EXISTS ultimo_gerado_em timestamptz;
