-- Execute este script no SQL Editor do seu projeto no Supabase

CREATE TABLE IF NOT EXISTS projetos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  endereco TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  detalhes_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE projetos ENABLE ROW LEVEL SECURITY;

-- Política para que usuários vejam todos os projetos (compartilhado)
-- Se desejar que cada um veja apenas o seu, mude para: auth.uid() = user_id
CREATE POLICY "Acesso total projetos para autenticados" ON projetos
  FOR ALL USING (auth.role() = 'authenticated');

-- Adicionar ao Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE projetos;
