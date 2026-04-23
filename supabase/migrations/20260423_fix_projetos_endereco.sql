-- Torna a coluna "endereco" opcional (aceita nulo ou string vazia)
ALTER TABLE public.projetos ALTER COLUMN endereco DROP NOT NULL;
ALTER TABLE public.projetos ALTER COLUMN endereco SET DEFAULT '';
