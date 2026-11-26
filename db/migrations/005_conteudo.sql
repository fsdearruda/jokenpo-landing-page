-- Conteúdo da vitrine editado no PDV (nome no site, descrição, slug, destaque, fotos no Vercel Blob, ordem da seção)
-- e o acréscimo do cartão definido no PDV. Só acrescenta colunas: o deploy anterior continua funcionando.
ALTER TABLE pdv_produto ADD COLUMN IF NOT EXISTS nome_site text;
ALTER TABLE pdv_produto ADD COLUMN IF NOT EXISTS descricao text;
ALTER TABLE pdv_produto ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE pdv_produto ADD COLUMN IF NOT EXISTS destaque boolean NOT NULL DEFAULT false;
ALTER TABLE pdv_produto ADD COLUMN IF NOT EXISTS fotos jsonb NOT NULL DEFAULT '[]';
ALTER TABLE pdv_produto ADD COLUMN IF NOT EXISTS ordem_grupo integer;
CREATE INDEX IF NOT EXISTS pdv_produto_slug ON pdv_produto (slug) WHERE visivel;
-- null = o PDV ainda não mandou: vale a taxa do CMS
ALTER TABLE pdv_sync ADD COLUMN IF NOT EXISTS acrescimo_cartao_bp integer;
