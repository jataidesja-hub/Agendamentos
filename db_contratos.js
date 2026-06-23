const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function createTable() {
  const sql = `
CREATE TABLE IF NOT EXISTS contratos_distribuidoras (
  id uuid default gen_random_uuid() primary key,
  substacao text not null,
  concessionaria text not null,
  telefone text,
  titular text,
  conta_contrato text,
  instalacao text,
  endereco text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE contratos_distribuidoras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for authenticated users on contratos_distribuidoras"
ON contratos_distribuidoras FOR ALL TO authenticated USING (true);
  `;
  
  // Actually, sending raw SQL via supabase JS client anon key usually fails if RPC isn't enabled.
  // Wait, does the project have an RPC for raw queries? Let's check.
}
createTable();
