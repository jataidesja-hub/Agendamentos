-- Remove estrutura anterior (se existir)
DROP TABLE IF EXISTS public.projeto_contatos CASCADE;

-- Tabela de contatos (sem vínculo direto com projeto)
CREATE TABLE IF NOT EXISTS public.contatos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  email text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('admin', 'gerente')),
  created_at timestamptz DEFAULT now()
);

-- Tabela de junção: contato <-> projeto (muitos para muitos)
CREATE TABLE IF NOT EXISTS public.contato_projetos (
  contato_id uuid NOT NULL REFERENCES public.contatos(id) ON DELETE CASCADE,
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  PRIMARY KEY (contato_id, projeto_id)
);

-- RLS
ALTER TABLE public.contatos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contato_projetos ENABLE ROW LEVEL SECURITY;

-- Policies para contatos
CREATE POLICY "ver contatos" ON public.contatos FOR SELECT TO authenticated USING (true);
CREATE POLICY "inserir contatos" ON public.contatos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "atualizar contatos" ON public.contatos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "deletar contatos" ON public.contatos FOR DELETE TO authenticated USING (true);

-- Policies para contato_projetos
CREATE POLICY "ver contato_projetos" ON public.contato_projetos FOR SELECT TO authenticated USING (true);
CREATE POLICY "inserir contato_projetos" ON public.contato_projetos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "deletar contato_projetos" ON public.contato_projetos FOR DELETE TO authenticated USING (true);

-- Update policy para projetos (se ainda não existir)
DO $$ BEGIN
  CREATE POLICY "atualizar projetos" ON public.projetos FOR UPDATE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
