-- Tabela para Fluxo de Solicitação de Abastecimento (Solicitação -> Aprovação -> Feito)
-- e coluna opcional papel_fluxo em perfis_acesso ('adm' | 'gerente' | 'master')

ALTER TABLE perfis_acesso ADD COLUMN IF NOT EXISTS papel_fluxo TEXT DEFAULT 'adm';

CREATE TABLE IF NOT EXISTS fluxos_abastecimento (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  placa TEXT,
  cartao TEXT,
  projeto TEXT,
  justificativa TEXT NOT NULL,
  valor NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'solicitado', -- 'solicitado' | 'aprovado' | 'feito' | 'rejeitado'
  solicitado_por TEXT NOT NULL,
  solicitado_em TIMESTAMPTZ DEFAULT NOW(),
  aprovado_por TEXT,
  aprovado_em TIMESTAMPTZ,
  feito_por TEXT,
  feito_em TIMESTAMPTZ,
  observacao_fluxo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE fluxos_abastecimento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso total fluxos_abastecimento" ON fluxos_abastecimento;
CREATE POLICY "Acesso total fluxos_abastecimento" ON fluxos_abastecimento FOR ALL USING (true) WITH CHECK (true);
