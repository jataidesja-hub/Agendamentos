-- =============================================
-- TABELA: PERFIS DE ACESSO (Configuração de Telas)
-- =============================================
CREATE TABLE IF NOT EXISTS perfis_acesso (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  telas_acesso TEXT[] DEFAULT ARRAY[]::TEXT[], -- Array de strings com IDs das telas
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ativar RLS
ALTER TABLE perfis_acesso ENABLE ROW LEVEL SECURITY;

-- Permitir leitura/escrita para usuários autenticados (ou apenas o admin se preferir)
CREATE POLICY "Acesso perfis para autenticados" ON perfis_acesso
  FOR ALL USING (auth.role() = 'authenticated');

-- =============================================
-- TABELA: VEÍCULOS DA FROTA (Cadastro Geral)
-- =============================================
CREATE TABLE IF NOT EXISTS veiculos_frota (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  placa TEXT NOT NULL UNIQUE,
  modelo TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE veiculos_frota ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso veiculos para autenticados" ON veiculos_frota
  FOR ALL USING (auth.role() = 'authenticated');

-- =============================================
-- TABELA: PROJETOS (Incluindo Fazendas/Torres)
-- =============================================
-- Nota: A tabela 'projetos' já existia, mas vamos garantir as colunas extras
CREATE TABLE IF NOT EXISTS projetos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  endereco TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  detalhes_json JSONB DEFAULT '{}'::jsonb, -- Aqui guardamos: tipo (fazenda/projeto), status, veiculo
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE projetos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso projetos para autenticados" ON projetos
  FOR ALL USING (auth.role() = 'authenticated');

-- =============================================
-- HABILITAR REALTIME
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE perfis_acesso;
ALTER PUBLICATION supabase_realtime ADD TABLE veiculos_frota;
ALTER PUBLICATION supabase_realtime ADD TABLE projetos;
