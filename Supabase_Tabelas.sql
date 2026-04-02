-- =============================================
-- TABELA 1: PLANOS DE AÇÃO (Lista de Tarefas)
-- =============================================
-- Roda isso no SQL Editor do Supabase (supabase.com > seu projeto > SQL Editor)

CREATE TABLE IF NOT EXISTS planos_acao (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  prazo DATE NOT NULL,
  "horaOpcional" TEXT,
  status TEXT DEFAULT 'Pendente',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE planos_acao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios veem seus proprios planos" ON planos_acao
  FOR ALL USING (auth.uid() = user_id);


-- =============================================
-- TABELA 2: VEÍCULOS / CHAVES DA FROTA
-- =============================================

CREATE TABLE IF NOT EXISTS frota_veiculos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  identificacao TEXT NOT NULL,
  placa TEXT NOT NULL,
  status TEXT DEFAULT 'Disponível',
  funcionario_atual TEXT,
  pegou_em TIMESTAMPTZ,
  ultima_devolucao TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE frota_veiculos ENABLE ROW LEVEL SECURITY;

-- Todos os usuários autenticados podem ver/editar (recurso compartilhado da empresa)
CREATE POLICY "Acesso frota para autenticados" ON frota_veiculos
  FOR ALL USING (auth.role() = 'authenticated');


-- =============================================
-- TABELA 3: FUNCIONÁRIOS (para selecionar quem pegou a chave)
-- =============================================

CREATE TABLE IF NOT EXISTS funcionarios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE funcionarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso funcionarios para autenticados" ON funcionarios
  FOR ALL USING (auth.role() = 'authenticated');


-- =============================================
-- TABELA 4: HISTÓRICO DE CHAVES (cada retirada/devolução)
-- =============================================

CREATE TABLE IF NOT EXISTS historico_chaves (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  veiculo_id UUID REFERENCES frota_veiculos(id) ON DELETE CASCADE,
  funcionario TEXT NOT NULL,
  tipo TEXT NOT NULL,  -- 'RETIRADA' ou 'DEVOLUCAO'
  data_hora TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE historico_chaves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso historico para autenticados" ON historico_chaves
  FOR ALL USING (auth.role() = 'authenticated');
