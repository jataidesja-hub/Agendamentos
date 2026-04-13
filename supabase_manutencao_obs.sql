-- Adicionar coluna para observação da aprovação
ALTER TABLE manutencao_veiculos ADD COLUMN IF NOT EXISTS obs_aprovacao TEXT;
