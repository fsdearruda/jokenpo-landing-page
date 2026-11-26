-- Carta avulsa: jogo, coleção, número, condição, idioma… para os filtros e a página da carta. null = não é carta.
ALTER TABLE pdv_produto ADD COLUMN IF NOT EXISTS carta jsonb;
