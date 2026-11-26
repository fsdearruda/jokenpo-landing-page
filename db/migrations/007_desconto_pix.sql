-- O preço do PDV é o do cartão; o Pix tem desconto (Cadastros → Site no PDV). null = o PDV ainda não mandou.
-- A coluna acrescimo_cartao_bp (regra antiga) fica sem uso.
ALTER TABLE pdv_sync ADD COLUMN IF NOT EXISTS desconto_pix_bp integer;
