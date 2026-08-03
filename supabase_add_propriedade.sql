-- Adiciona limite do cartão e flag de arquivado
ALTER TABLE frota_veiculos ADD COLUMN IF NOT EXISTS limite_cartao NUMERIC DEFAULT 0;
ALTER TABLE frota_veiculos ADD COLUMN IF NOT EXISTS arquivado BOOLEAN DEFAULT false;
