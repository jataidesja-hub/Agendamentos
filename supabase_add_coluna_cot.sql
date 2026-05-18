-- Adiciona a coluna numero_doc_ext à tabela cot_tarefas
ALTER TABLE IF EXISTS public.cot_tarefas 
ADD COLUMN IF NOT EXISTS numero_doc_ext text;
