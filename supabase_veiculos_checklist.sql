CREATE TABLE IF NOT EXISTS veiculos_checklist_permitidos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  placa TEXT NOT NULL UNIQUE,
  projeto TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE veiculos_checklist_permitidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso total aos autenticados para veiculos_checklist_permitidos" ON veiculos_checklist_permitidos
  FOR ALL USING (auth.role() = 'authenticated');

GRANT ALL ON TABLE veiculos_checklist_permitidos TO authenticated;
GRANT ALL ON TABLE veiculos_checklist_permitidos TO service_role;
