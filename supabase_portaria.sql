-- Tabelas para o módulo de Portaria (Entrada/Saída, Cadastros e Vigilantes)

CREATE TABLE IF NOT EXISTS portaria_vigilantes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  usuario TEXT NOT NULL UNIQUE,
  senha TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portaria_cadastros (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  documento TEXT, -- CPF ou RG
  tipo_pessoa TEXT NOT NULL DEFAULT 'funcionario', -- 'funcionario' | 'terceiro'
  empresa TEXT,
  placa TEXT,
  tipo_veiculo TEXT DEFAULT 'empresa', -- 'proprio' | 'empresa' | 'sem_veiculo'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portaria_movimentacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo_movimento TEXT NOT NULL, -- 'entrada' | 'saida'
  tipo_pessoa TEXT NOT NULL, -- 'funcionario' | 'terceiro'
  cadastro_id UUID REFERENCES portaria_cadastros(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  documento TEXT,
  empresa TEXT,
  placa TEXT,
  tipo_veiculo TEXT, -- 'proprio' | 'empresa' | 'sem_veiculo'
  data_hora TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  vigilante_usuario TEXT NOT NULL,
  vigilante_nome TEXT,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE portaria_vigilantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE portaria_cadastros ENABLE ROW LEVEL SECURITY;
ALTER TABLE portaria_movimentacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso total portaria_vigilantes" ON portaria_vigilantes;
CREATE POLICY "Acesso total portaria_vigilantes" ON portaria_vigilantes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso total portaria_cadastros" ON portaria_cadastros;
CREATE POLICY "Acesso total portaria_cadastros" ON portaria_cadastros FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso total portaria_movimentacoes" ON portaria_movimentacoes;
CREATE POLICY "Acesso total portaria_movimentacoes" ON portaria_movimentacoes FOR ALL USING (true) WITH CHECK (true);

-- Vigilante inicial padrão (usuario: portaria / senha: 1234)
INSERT INTO portaria_vigilantes (nome, usuario, senha, ativo)
VALUES ('Vigilante Padrão', 'portaria', '1234', true)
ON CONFLICT (usuario) DO NOTHING;
