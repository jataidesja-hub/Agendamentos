-- =============================================
-- SCRIPT DE REPARO E PADRONIZAÇÃO (EXECUTE NO SQL EDITOR)
-- =============================================

-- 1. Padronizar nome da tabela de veículos
-- Se existir 'veiculos_frota', renomeia para 'frota_veiculos'
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename  = 'veiculos_frota') THEN
    ALTER TABLE veiculos_frota RENAME TO frota_veiculos;
  END IF;
END $$;

-- 2. Garantir colunas na frota_veiculos
ALTER TABLE frota_veiculos ADD COLUMN IF NOT EXISTS projeto TEXT;
ALTER TABLE frota_veiculos ADD COLUMN IF NOT EXISTS subprojeto TEXT;
ALTER TABLE frota_veiculos ADD COLUMN IF NOT EXISTS modelo TEXT;
ALTER TABLE frota_veiculos ADD COLUMN IF NOT EXISTS email_gerente TEXT;
ALTER TABLE frota_veiculos ADD COLUMN IF NOT EXISTS email_administrativo TEXT;

-- 3. Garantir UNIQUE na placa para o UPSERT funcionar
ALTER TABLE frota_veiculos DROP CONSTRAINT IF EXISTS frota_veiculos_placa_key;
ALTER TABLE frota_veiculos ADD CONSTRAINT frota_veiculos_placa_key UNIQUE (placa);

-- 4. Garantir colunas na tabela abastecimentos
ALTER TABLE abastecimentos ADD COLUMN IF NOT EXISTS tipo_frota TEXT;
ALTER TABLE abastecimentos ADD COLUMN IF NOT EXISTS modelo_veiculo TEXT;
ALTER TABLE abastecimentos ADD COLUMN IF NOT EXISTS hodometro_horimetro DECIMAL(20,2);
ALTER TABLE abastecimentos ADD COLUMN IF NOT EXISTS km_rodados DECIMAL(20,2);
ALTER TABLE abastecimentos ADD COLUMN IF NOT EXISTS km_litro DECIMAL(20,4);
ALTER TABLE abastecimentos ADD COLUMN IF NOT EXISTS valor_emissao DECIMAL(20,4);
ALTER TABLE abastecimentos ADD COLUMN IF NOT EXISTS cidade TEXT;

-- 5. Dar permissão total para usuários autenticados (caso tenha perdido)
GRANT ALL ON TABLE frota_veiculos TO authenticated;
GRANT ALL ON TABLE abastecimentos TO authenticated;
GRANT ALL ON TABLE frota_veiculos TO service_role;
GRANT ALL ON TABLE abastecimentos TO service_role;
