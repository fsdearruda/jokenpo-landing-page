-- Promoção vigente no canal site, enviada pelo PDV: {id, nome, precoOriginalCentavos, terminaEm}.
-- null = sem promoção. O preço promocional já vem em preco_centavos.
ALTER TABLE pdv_produto ADD COLUMN IF NOT EXISTS promocao jsonb;
