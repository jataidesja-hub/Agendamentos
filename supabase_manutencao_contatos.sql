-- =============================================
-- GESTÃO DE CONTATOS DE EMAIL POR PROJETO
-- Manutenção de Frota — rodar no SQL Editor do Supabase
-- =============================================

-- 1. Tabela de contatos (ADM / Gerente)
CREATE TABLE IF NOT EXISTS manutencao_contatos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  papel TEXT NOT NULL CHECK (papel IN ('adm', 'gerente')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE manutencao_contatos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso total contatos para autenticados" ON manutencao_contatos
  FOR ALL USING (auth.role() = 'authenticated');

ALTER PUBLICATION supabase_realtime ADD TABLE manutencao_contatos;

-- 2. Tabela de junção: contato <-> projeto (N:N)
CREATE TABLE IF NOT EXISTS manutencao_contato_projetos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contato_id UUID NOT NULL REFERENCES manutencao_contatos(id) ON DELETE CASCADE,
  projeto_id UUID NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
  UNIQUE(contato_id, projeto_id)
);

ALTER TABLE manutencao_contato_projetos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso total contato_projetos para autenticados" ON manutencao_contato_projetos
  FOR ALL USING (auth.role() = 'authenticated');

ALTER PUBLICATION supabase_realtime ADD TABLE manutencao_contato_projetos;

-- 3. Adicionar coluna projeto_id na tabela base de placas
ALTER TABLE manutencao_frota_base
  ADD COLUMN IF NOT EXISTS projeto_id UUID REFERENCES projetos(id);
