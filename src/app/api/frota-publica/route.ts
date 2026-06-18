import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ projetos: [], placas: [] });

  const supabase = createClient(url, key);
  const { searchParams } = new URL(req.url);
  const projeto = searchParams.get("projeto");

  if (projeto) {
    const { data } = await supabase
      .from("frota_veiculos")
      .select("placa")
      .eq("projeto", projeto)
      .not("placa", "is", null);
    const placas = [...new Set((data || []).map((r: any) => r.placa).filter(Boolean))].sort();
    return NextResponse.json({ placas });
  }

  const { data } = await supabase
    .from("frota_veiculos")
    .select("projeto")
    .not("projeto", "is", null);
  const projetos = [...new Set((data || []).map((r: any) => r.projeto).filter(Boolean))].sort();
  return NextResponse.json({ projetos });
}
