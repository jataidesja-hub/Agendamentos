-- =============================================
-- ATUALIZAÇÃO: Veículos e Abastecimentos (Novas Colunas e Importação)
-- =============================================

-- 1. Atualizar frota_veiculos com Projeto e Subprojeto (Base)
ALTER TABLE frota_veiculos ADD COLUMN IF NOT EXISTS projeto TEXT;
ALTER TABLE frota_veiculos ADD COLUMN IF NOT EXISTS subprojeto TEXT;

-- 2. Atualizar abastecimentos com campos completos do relatório
-- Usando DECIMAL para campos numéricos para garantir precisão
ALTER TABLE abastecimentos ADD COLUMN IF NOT EXISTS tipo_frota TEXT;
ALTER TABLE abastecimentos ADD COLUMN IF NOT EXISTS modelo_veiculo TEXT;
ALTER TABLE abastecimentos ADD COLUMN IF NOT EXISTS hodometro_horimetro DECIMAL(10,2);
ALTER TABLE abastecimentos ADD COLUMN IF NOT EXISTS km_rodados DECIMAL(10,2);
ALTER TABLE abastecimentos ADD COLUMN IF NOT EXISTS km_litro DECIMAL(10,4);
ALTER TABLE abastecimentos ADD COLUMN IF NOT EXISTS valor_emissao DECIMAL(10,4);
ALTER TABLE abastecimentos ADD COLUMN IF NOT EXISTS cidade TEXT;

-- Ajustar tipo de data se necessário (usualmente datetime no relatório)
-- ALTER TABLE abastecimentos ALTER COLUMN data_transacao TYPE TIMESTAMPTZ; 
-- ^ Manteremos o tratamento de data no código para evitar problemas de cast direto
