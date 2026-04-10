-- =============================================
-- TABELA 6: MANUTENÇÃO DE VEÍCULOS
-- =============================================
-- Roda isso no SQL Editor do Supabase (supabase.com > seu projeto > SQL Editor)

CREATE TABLE IF NOT EXISTS manutencao_veiculos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  placa TEXT NOT NULL UNIQUE,
  admins TEXT,
  emails_admin TEXT,
  gerentes TEXT,
  emails_gerente TEXT,
  status TEXT DEFAULT 'aguardando envio',
  servicos TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE manutencao_veiculos ENABLE ROW LEVEL SECURITY;

-- Todos os usuários autenticados podem ver/editar
CREATE POLICY "Acesso manutencao para autenticados" ON manutencao_veiculos
  FOR ALL USING (auth.role() = 'authenticated');

-- Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE manutencao_veiculos;
