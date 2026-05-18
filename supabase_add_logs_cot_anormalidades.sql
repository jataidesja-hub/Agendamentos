ALTER TABLE IF EXISTS public.cot_tarefas ADD COLUMN IF NOT EXISTS last_modified_by text;
ALTER TABLE IF EXISTS public.anormalidades ADD COLUMN IF NOT EXISTS last_modified_by text;
