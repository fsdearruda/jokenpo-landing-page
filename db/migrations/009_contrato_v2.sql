-- Desconto no Pix que o cliente viu ao pedir (centésimos de %). Vai no evento para o PDV, que usa este na
-- mensagem de WhatsApp. null = pedido de antes desta coluna (usa o desconto atual).
ALTER TABLE pdv_pedido ADD COLUMN IF NOT EXISTS desconto_pix_bp integer;

-- Versão do contrato informada pelo PC da loja (cabeçalho X-Pdv-Versao). null = PDV anterior à versão 2.
ALTER TABLE pdv_sync ADD COLUMN IF NOT EXISTS versao_pdv integer;
