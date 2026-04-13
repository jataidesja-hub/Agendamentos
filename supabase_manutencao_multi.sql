-- =============================================
-- MIGRACAO: Múltiplas Manutenções por Veículo
-- =============================================

-- 1. Criar tabela base para os contatos (Excel)
-- Evita duplicar informações de Adm/Gerente e mantém um cadastro único por placa
CREATE TABLE IF NOT EXISTS manutencao_frota_base (
  placa TEXT PRIMARY KEY,
  admins TEXT,
  emails_admin TEXT,
  gerentes TEXT,
  emails_gerente TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Copiar dados atuais para a tabela base (apenas o que for único)
INSERT INTO manutencao_frota_base (placa, admins, emails_admin, gerentes, emails_gerente)
SELECT DISTINCT ON (placa) placa, admins, emails_admin, gerentes, emails_gerente
FROM manutencao_veiculos
ON CONFLICT (placa) DO NOTHING;

-- 2. Remover a restrição UNIQUE da placa na tabela de processos
-- Isso permite que a mesma placa apareça várias vezes no Kanban
ALTER TABLE manutencao_veiculos DROP CONSTRAINT IF EXISTS manutencao_veiculos_placa_key;

-- 3. Habilitar RLS na nova tabela
ALTER TABLE manutencao_frota_base ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso total para autenticados" ON manutencao_frota_base
  FOR ALL USING (auth.role() = 'authenticated');

-- 4. Notificações para Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE manutencao_frota_base;
