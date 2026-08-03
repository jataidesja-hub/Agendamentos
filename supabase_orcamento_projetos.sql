-- Tabela de orçamento por projeto
CREATE TABLE IF NOT EXISTS orcamento_projetos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  projeto TEXT NOT NULL UNIQUE,
  valor_locacao NUMERIC DEFAULT 0,
  valor_combustivel NUMERIC DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE orcamento_projetos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso orcamento para autenticados" ON orcamento_projetos
  FOR ALL USING (auth.role() = 'authenticated');
GRANT ALL ON TABLE orcamento_projetos TO authenticated;
GRANT ALL ON TABLE orcamento_projetos TO service_role;
