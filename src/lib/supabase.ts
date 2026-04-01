import { createClient } from '@supabase/supabase-js';

// Usar um placeholder caso a variável não exista no momento do "build" na Vercel
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sua-url-do-supabase.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sua-chave-anonima';

export const supabase = createClient(supabaseUrl, supabaseKey);
