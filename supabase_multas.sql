-- Habilitar a extensão pgcrypto para UUID se não existir
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Criar tabela de multas
CREATE TABLE IF NOT EXISTS public.multas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    placa VARCHAR(20) NOT NULL,
    auto_infracao VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'pendente', -- pendente, identificada, enviada_rh
    arquivos_iniciais JSONB DEFAULT '[]', -- Lista de caminhos no storage (PDF inicial)
    arquivos_retorno JSONB DEFAULT '[]',  -- Lista de caminhos no storage (PDF de retorno)
    gestor_cobrado VARCHAR(255),
    observacao_retorno TEXT,
    data_enviada_rh TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Configurar RLS (Row Level Security) para permitir acesso de qualquer usuário logado ou anônimo, conforme seu ambiente
ALTER TABLE public.multas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura para todos na tabela multas" 
ON public.multas FOR SELECT 
USING (true);

CREATE POLICY "Permitir inserção para todos na tabela multas" 
ON public.multas FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Permitir atualização para todos na tabela multas" 
ON public.multas FOR UPDATE 
USING (true);

CREATE POLICY "Permitir deleção para todos na tabela multas" 
ON public.multas FOR DELETE 
USING (true);

-- Criar o bucket de storage para multas
INSERT INTO storage.buckets (id, name, public) 
VALUES ('multas', 'multas', true)
ON CONFLICT (id) DO NOTHING;

-- Criar politicas para o storage (permitir tudo por enquanto para facilitar)
CREATE POLICY "Permitir leitura pública do bucket multas" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'multas');

CREATE POLICY "Permitir upload no bucket multas" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'multas');

CREATE POLICY "Permitir update no bucket multas" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'multas');

CREATE POLICY "Permitir delete no bucket multas" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'multas');
