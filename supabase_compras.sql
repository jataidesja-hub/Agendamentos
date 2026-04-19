-- =============================================
-- MÓDULO: GESTÃO DE COMPRAS - CYMI O&M
-- =============================================
-- Execute no SQL Editor do Supabase

-- =============================================
-- TABELA 1: PRODUTOS (catálogo)
-- =============================================
CREATE TABLE IF NOT EXISTS compras_produtos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL,
  unidade TEXT NOT NULL CHECK (unidade IN ('UND', 'SV', 'MÊS', 'KG', 'L', 'CX', 'PCT')),
  descricao TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE compras_produtos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso compras_produtos para autenticados" ON compras_produtos
  FOR ALL USING (auth.role() = 'authenticated');

-- =============================================
-- TABELA 2: FORNECEDORES
-- =============================================
CREATE TABLE IF NOT EXISTS compras_fornecedores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj_cpf TEXT,
  contato TEXT,
  email TEXT,
  telefone TEXT,
  categorias TEXT[], -- array de categorias que atende
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE compras_fornecedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso compras_fornecedores para autenticados" ON compras_fornecedores
  FOR ALL USING (auth.role() = 'authenticated');

-- =============================================
-- TABELA 3: PROCESSOS DE COMPRA
-- =============================================
CREATE TABLE IF NOT EXISTS compras_processos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_processo TEXT UNIQUE, -- ex: RC000964
  numero_requisicao TEXT,       -- ex: PCB5-47081
  numero_pedido TEXT,           -- ex: PCB5-47081
  status TEXT NOT NULL DEFAULT 'EM COTAÇÃO' CHECK (status IN (
    'EM COTAÇÃO',
    'EM APROVAÇÃO',
    'PROCESSO COM RJ',
    'LIBERADO',
    'PEDIDO EMITIDO',
    'RECEBIDO',
    'CANCELADO'
  )),
  centro_custo TEXT NOT NULL DEFAULT 'CENTRO OPERACIONAL',
  projeto TEXT,                  -- ex: O&M COMISIONADO MANTIQUEIRA
  produto_id UUID REFERENCES compras_produtos(id),
  produto_nome TEXT NOT NULL,    -- desnormalizado para histórico
  categoria TEXT NOT NULL,
  quantidade NUMERIC NOT NULL DEFAULT 1,
  unidade TEXT NOT NULL,
  responsavel_compra TEXT NOT NULL,
  solicitante TEXT,
  data_pedido DATE DEFAULT CURRENT_DATE,
  fornecedor_escolhido_id UUID REFERENCES compras_fornecedores(id),
  fornecedor_escolhido_nome TEXT,
  preco_escolhido NUMERIC,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE compras_processos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso compras_processos para autenticados" ON compras_processos
  FOR ALL USING (auth.role() = 'authenticated');

-- Sequência para número automático de processo
CREATE SEQUENCE IF NOT EXISTS compras_processo_seq START 1000;

-- =============================================
-- TABELA 4: COTAÇÕES (até 3 por processo)
-- =============================================
CREATE TABLE IF NOT EXISTS compras_cotacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  processo_id UUID NOT NULL REFERENCES compras_processos(id) ON DELETE CASCADE,
  numero_cotacao INTEGER NOT NULL CHECK (numero_cotacao IN (1, 2, 3)),
  fornecedor_id UUID REFERENCES compras_fornecedores(id),
  fornecedor_nome TEXT NOT NULL,
  preco NUMERIC,
  prazo TEXT,           -- ex: IMEDIATO, 7 DIAS, 30 DIAS
  condicao_pagamento TEXT, -- ex: À VISTA, 30/60/90
  validade_cotacao DATE,
  observacoes TEXT,
  selecionada BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(processo_id, numero_cotacao)
);

ALTER TABLE compras_cotacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso compras_cotacoes para autenticados" ON compras_cotacoes
  FOR ALL USING (auth.role() = 'authenticated');

-- =============================================
-- CATEGORIAS PADRÃO (insert inicial)
-- =============================================
-- Útil para autocomplete no frontend
-- Não é uma tabela, apenas referência:
-- FRETES E CARRETOS, INFORMATICA, UNIFORMES, MANUT. MAQ. EQUIP.,
-- EPI, CONSULTORIA, ESCRITORIO, LINHA VIVA, RH, SEGURANÇA,
-- VEICULOS, CARPITARIA E SERRALHERIA, CANTINA CANTEIRO,
-- DEDETIZAÇÃO LIMPEZAS, ATIVO FIXO, ANALISES LABORATORIAIS,
-- TREINAMENTOS

-- =============================================
-- TRIGGERS: updated_at automático
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_compras_produtos_updated_at
  BEFORE UPDATE ON compras_produtos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_compras_fornecedores_updated_at
  BEFORE UPDATE ON compras_fornecedores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_compras_processos_updated_at
  BEFORE UPDATE ON compras_processos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_compras_cotacoes_updated_at
  BEFORE UPDATE ON compras_cotacoes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
