-- =============================================
-- ATUALIZAÇÃO: Coluna PDF na tabela de manutenção
-- =============================================
-- Roda isso no SQL Editor do Supabase

-- 1. Adicionar coluna pdf_url na tabela existente
ALTER TABLE manutencao_veiculos ADD COLUMN IF NOT EXISTS pdf_url TEXT;

-- 2. Criar bucket de storage para os PDFs (rode isso separadamente se der erro)
INSERT INTO storage.buckets (id, name, public)
VALUES ('manutencao-pdfs', 'manutencao-pdfs', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Policy para upload (usuários autenticados)
CREATE POLICY "Autenticados podem fazer upload de PDFs" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'manutencao-pdfs' 
    AND auth.role() = 'authenticated'
  );

-- 4. Policy para leitura pública dos PDFs
CREATE POLICY "PDFs de manutencao são públicos" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'manutencao-pdfs'
  );

-- 5. Policy para deletar PDFs (usuários autenticados)
CREATE POLICY "Autenticados podem deletar PDFs" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'manutencao-pdfs' 
    AND auth.role() = 'authenticated'
  );

-- 6. Policy para atualizar PDFs (usuários autenticados)
CREATE POLICY "Autenticados podem atualizar PDFs" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'manutencao-pdfs'
    AND auth.role() = 'authenticated'
  );
