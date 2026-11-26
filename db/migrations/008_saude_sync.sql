-- Quando o site aceitou o último envio de estoque do PDV (relógio do site). O "último contato" também conta
-- buscas de pedidos: com o estoque sendo recusado e as buscas funcionando, a loja parecia online com estoque velho.
ALTER TABLE pdv_sync ADD COLUMN IF NOT EXISTS ultimo_estoque_em timestamptz;
UPDATE pdv_sync SET ultimo_estoque_em = ultimo_contato_em WHERE ultimo_estoque_em IS NULL;

-- Problemas da sincronização já avisados por e-mail (ex.: 'ESTOQUE_PARADO,PEDIDOS_PARADOS'; '' = tudo certo).
-- A checagem de hora em hora só manda e-mail quando isso muda.
ALTER TABLE pdv_sync ADD COLUMN IF NOT EXISTS alerta_chave text NOT NULL DEFAULT '';
