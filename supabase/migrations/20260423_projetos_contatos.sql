-- Tabela de projetos gerenciados manualmente
CREATE TABLE IF NOT EXISTS public.projetos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

-- Tabela de contatos (admins e gerentes)
CREATE TABLE IF NOT EXISTS public.projeto_contatos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  nome text NOT NULL,
  email text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('admin', 'gerente')),
  created_at timestamptz DEFAULT now()
);

-- Habilita RLS (ajuste as policies conforme necessário)
ALTER TABLE public.projetos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projeto_contatos ENABLE ROW LEVEL SECURITY;

-- Policies permissivas para usuários autenticados
CREATE POLICY "Usuários autenticados podem ver projetos"
  ON public.projetos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuários autenticados podem inserir projetos"
  ON public.projetos FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem deletar projetos"
  ON public.projetos FOR DELETE TO authenticated USING (true);

CREATE POLICY "Usuários autenticados podem ver contatos"
  ON public.projeto_contatos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuários autenticados podem inserir contatos"
  ON public.projeto_contatos FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem deletar contatos"
  ON public.projeto_contatos FOR DELETE TO authenticated USING (true);
