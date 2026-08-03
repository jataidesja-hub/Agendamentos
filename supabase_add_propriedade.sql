-- Adiciona coluna propriedade na frota_veiculos
ALTER TABLE frota_veiculos ADD COLUMN IF NOT EXISTS propriedade TEXT;
