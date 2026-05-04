-- =============================================
-- SISTEMA DE MONITORAMENTO DE ÔNIBUS
-- Rodar no Supabase SQL Editor
-- =============================================

-- Perfis (passageiro ou motorista)
CREATE TABLE IF NOT EXISTS onibus_perfis (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('passageiro', 'motorista')),
  nome TEXT NOT NULL,
  telefone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dados extras de passageiros
CREATE TABLE IF NOT EXISTS onibus_usuarios (
  id UUID PRIMARY KEY REFERENCES onibus_perfis(id) ON DELETE CASCADE,
  endereco TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION
);

-- Dados extras de motoristas
CREATE TABLE IF NOT EXISTS onibus_motoristas (
  id UUID PRIMARY KEY REFERENCES onibus_perfis(id) ON DELETE CASCADE,
  veiculo TEXT
);

-- Rotas
CREATE TABLE IF NOT EXISTS onibus_rotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  cor TEXT DEFAULT '#0b7336',
  ativa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pontos de parada por rota
CREATE TABLE IF NOT EXISTS onibus_pontos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rota_id UUID REFERENCES onibus_rotas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Posições em tempo real (upsert por referencia_id)
CREATE TABLE IF NOT EXISTS onibus_posicoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referencia_id UUID UNIQUE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('motorista', 'passageiro')),
  nome TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  velocidade DOUBLE PRECISION DEFAULT 0,
  rota_ativa_id UUID REFERENCES onibus_rotas(id),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Viagens
CREATE TABLE IF NOT EXISTS onibus_viagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rota_id UUID REFERENCES onibus_rotas(id),
  motorista_id UUID REFERENCES onibus_perfis(id),
  iniciada_em TIMESTAMPTZ DEFAULT NOW(),
  encerrada_em TIMESTAMPTZ,
  ativa BOOLEAN DEFAULT true
);

-- RLS: libera tudo para simplificar (ajuste conforme necessário)
ALTER TABLE onibus_perfis    ENABLE ROW LEVEL SECURITY;
ALTER TABLE onibus_usuarios  ENABLE ROW LEVEL SECURITY;
ALTER TABLE onibus_motoristas ENABLE ROW LEVEL SECURITY;
ALTER TABLE onibus_rotas     ENABLE ROW LEVEL SECURITY;
ALTER TABLE onibus_pontos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE onibus_posicoes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE onibus_viagens   ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'onibus_perfis' AND policyname = 'onibus_perfis_all') THEN
    CREATE POLICY onibus_perfis_all    ON onibus_perfis    FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'onibus_usuarios' AND policyname = 'onibus_usuarios_all') THEN
    CREATE POLICY onibus_usuarios_all  ON onibus_usuarios  FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'onibus_motoristas' AND policyname = 'onibus_motoristas_all') THEN
    CREATE POLICY onibus_motoristas_all ON onibus_motoristas FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'onibus_rotas' AND policyname = 'onibus_rotas_all') THEN
    CREATE POLICY onibus_rotas_all     ON onibus_rotas     FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'onibus_pontos' AND policyname = 'onibus_pontos_all') THEN
    CREATE POLICY onibus_pontos_all    ON onibus_pontos    FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'onibus_posicoes' AND policyname = 'onibus_posicoes_all') THEN
    CREATE POLICY onibus_posicoes_all  ON onibus_posicoes  FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'onibus_viagens' AND policyname = 'onibus_viagens_all') THEN
    CREATE POLICY onibus_viagens_all   ON onibus_viagens   FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Habilita Realtime nas tabelas de posição e viagens
ALTER PUBLICATION supabase_realtime ADD TABLE onibus_posicoes;
ALTER PUBLICATION supabase_realtime ADD TABLE onibus_viagens;
