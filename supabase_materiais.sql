-- Criação das tabelas para controle de materiais

CREATE TABLE IF NOT EXISTS materiais (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  unidade TEXT NOT NULL DEFAULT 'un',
  estoque_minimo NUMERIC NOT NULL DEFAULT 0,
  quantidade_atual NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS movimentacoes_materiais (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  material_id UUID REFERENCES materiais(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  quantidade NUMERIC NOT NULL,
  placa_veiculo TEXT,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE materiais ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimentacoes_materiais ENABLE ROW LEVEL SECURITY;

-- Como a página /materiais é pública, precisamos de policies públicas (anon) e autenticadas.
-- ATENÇÃO: Em produção, se a URL for pública sem login, o role 'anon' precisa de acesso.
CREATE POLICY "Acesso total aos materiais (public)" ON materiais FOR ALL USING (true);
CREATE POLICY "Acesso total as movimentacoes (public)" ON movimentacoes_materiais FOR ALL USING (true);

-- Trigger para atualizar a quantidade do material ao inserir movimentação
CREATE OR REPLACE FUNCTION atualiza_estoque_material()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tipo = 'entrada' THEN
    UPDATE materiais SET quantidade_atual = quantidade_atual + NEW.quantidade, updated_at = NOW() WHERE id = NEW.material_id;
  ELSIF NEW.tipo = 'saida' THEN
    UPDATE materiais SET quantidade_atual = quantidade_atual - NEW.quantidade, updated_at = NOW() WHERE id = NEW.material_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_atualiza_estoque ON movimentacoes_materiais;
CREATE TRIGGER trigger_atualiza_estoque
AFTER INSERT ON movimentacoes_materiais
FOR EACH ROW
EXECUTE FUNCTION atualiza_estoque_material();
