-- Torna opcionais todas as colunas extras da tabela projetos
-- que não são gerenciadas pelo novo módulo de projetos

ALTER TABLE public.projetos ALTER COLUMN endereco DROP NOT NULL;
ALTER TABLE public.projetos ALTER COLUMN endereco SET DEFAULT '';

ALTER TABLE public.projetos ALTER COLUMN latitude DROP NOT NULL;
ALTER TABLE public.projetos ALTER COLUMN latitude SET DEFAULT 0;

ALTER TABLE public.projetos ALTER COLUMN longitude DROP NOT NULL;
ALTER TABLE public.projetos ALTER COLUMN longitude SET DEFAULT 0;

-- Torna nullable qualquer outra coluna numérica ou texto que possa existir
DO $$
DECLARE
  col RECORD;
BEGIN
  FOR col IN
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'projetos'
      AND is_nullable = 'NO'
      AND column_name NOT IN ('id', 'nome', 'created_at')
  LOOP
    EXECUTE format(
      'ALTER TABLE public.projetos ALTER COLUMN %I DROP NOT NULL',
      col.column_name
    );
  END LOOP;
END $$;
