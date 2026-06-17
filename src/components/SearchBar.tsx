"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MagnifyingGlassIcon, XMarkIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import { supabase } from "@/lib/supabase";

interface Result {
  id: string;
  label: string;
  sublabel?: string;
  badge?: string;
  badgeColor?: string;
  href?: string;
}

const PAGE_CONFIG: Record<string, { label: string; search: (q: string) => Promise<Result[]> }> = {
  "/dashboard/cot": {
    label: "Portal COT",
    search: async (q) => {
      const { data } = await supabase
        .from("cot_tarefas")
        .select("id, atividade, nome_projeto, status, numero_documento")
        .or(`atividade.ilike.%${q}%,nome_projeto.ilike.%${q}%,numero_documento.ilike.%${q}%`)
        .eq("arquivada", false)
        .limit(8);
      return (data || []).map(d => ({
        id: d.id,
        label: d.atividade,
        sublabel: d.nome_projeto,
        badge: d.status,
        badgeColor: d.status === "em_execucao" ? "bg-yellow-500" : d.status === "concluida" ? "bg-emerald-500" : "bg-blue-500",
      }));
    },
  },
  "/dashboard/multas": {
    label: "Multas",
    search: async (q) => {
      const { data } = await supabase
        .from("multas")
        .select("id, placa, auto_infracao, status, condutor_identificado")
        .or(`placa.ilike.%${q}%,auto_infracao.ilike.%${q}%,condutor_identificado.ilike.%${q}%`)
        .limit(8);
      return (data || []).map(d => ({
        id: d.id,
        label: d.placa,
        sublabel: `Auto: ${d.auto_infracao}${d.condutor_identificado ? ` · ${d.condutor_identificado}` : ""}`,
        badge: d.status,
        badgeColor: "bg-rose-500",
      }));
    },
  },
  "/dashboard/veiculos": {
    label: "Veículos",
    search: async (q) => {
      const { data } = await supabase
        .from("frota_veiculos")
        .select("id, placa, modelo, projeto, status")
        .or(`placa.ilike.%${q}%,modelo.ilike.%${q}%,projeto.ilike.%${q}%`)
        .limit(8);
      return (data || []).map(d => ({
        id: d.id,
        label: d.placa,
        sublabel: `${d.modelo || ""} · ${d.projeto || ""}`,
        badge: d.status,
        badgeColor: d.status === "Ativo" ? "bg-emerald-500" : "bg-gray-500",
      }));
    },
  },
  "/dashboard/compras": {
    label: "Compras",
    search: async (q) => {
      const { data } = await supabase
        .from("compras")
        .select("id, descricao, solicitante, status")
        .or(`descricao.ilike.%${q}%,solicitante.ilike.%${q}%`)
        .limit(8);
      return (data || []).map(d => ({
        id: d.id,
        label: d.descricao,
        sublabel: d.solicitante,
        badge: d.status,
        badgeColor: "bg-indigo-500",
      }));
    },
  },
  "/dashboard/manutencao": {
    label: "Manutenção",
    search: async (q) => {
      const { data } = await supabase
        .from("manutencao")
        .select("id, descricao, placa, status")
        .or(`descricao.ilike.%${q}%,placa.ilike.%${q}%`)
        .limit(8);
      return (data || []).map(d => ({
        id: d.id,
        label: d.descricao || d.placa,
        sublabel: d.placa,
        badge: d.status,
        badgeColor: "bg-orange-500",
      }));
    },
  },
  "/dashboard/chaves": {
    label: "Controle de Chaves",
    search: async (q) => {
      const { data } = await supabase
        .from("chaves")
        .select("id, nome, localizacao, responsavel")
        .or(`nome.ilike.%${q}%,localizacao.ilike.%${q}%,responsavel.ilike.%${q}%`)
        .limit(8);
      return (data || []).map(d => ({
        id: d.id,
        label: d.nome,
        sublabel: `${d.localizacao || ""} · ${d.responsavel || ""}`,
      }));
    },
  },
  "/dashboard/informacoes": {
    label: "Informações",
    search: async (q) => {
      const [s1, s2, s3] = await Promise.all([
        supabase.from("info_senhas").select("id, aplicativo_sistema, id_usuario").ilike("aplicativo_sistema", `%${q}%`).limit(4),
        supabase.from("info_transformadores").select("id, se, concessao").or(`se.ilike.%${q}%,concessao.ilike.%${q}%`).limit(4),
        supabase.from("info_agenda_yealink").select("id, display_name, office_number").or(`display_name.ilike.%${q}%,office_number.ilike.%${q}%`).limit(4),
      ]);
      return [
        ...(s1.data || []).map(d => ({ id: d.id, label: d.aplicativo_sistema, sublabel: d.id_usuario, badge: "Senha", badgeColor: "bg-indigo-500" })),
        ...(s2.data || []).map(d => ({ id: d.id, label: d.se, sublabel: d.concessao, badge: "Trafo", badgeColor: "bg-amber-500" })),
        ...(s3.data || []).map(d => ({ id: d.id, label: d.display_name, sublabel: d.office_number, badge: "Yealink", badgeColor: "bg-emerald-500" })),
      ];
    },
  },
  "/dashboard/telecom": {
    label: "Controle Telecom",
    search: async (q) => {
      const { data } = await supabase
        .from("telecom")
        .select("id, descricao, operadora, status")
        .or(`descricao.ilike.%${q}%,operadora.ilike.%${q}%`)
        .limit(8);
      return (data || []).map(d => ({
        id: d.id,
        label: d.descricao,
        sublabel: d.operadora,
        badge: d.status,
        badgeColor: "bg-purple-500",
      }));
    },
  },
};

// Fallback: busca global em múltiplas tabelas
async function globalSearch(q: string): Promise<Result[]> {
  const results: Result[] = [];
  const tasks = [
    supabase.from("cot_tarefas").select("id, atividade, nome_projeto").ilike("atividade", `%${q}%`).limit(3),
    supabase.from("frota_veiculos").select("id, placa, modelo").ilike("placa", `%${q}%`).limit(3),
    supabase.from("multas").select("id, placa, auto_infracao").ilike("placa", `%${q}%`).limit(3),
  ];
  const [cot, veic, multas] = await Promise.all(tasks);
  (cot.data || []).forEach(d => results.push({ id: d.id, label: d.atividade, sublabel: d.nome_projeto, badge: "COT", badgeColor: "bg-green-600" }));
  (veic.data || []).forEach(d => results.push({ id: d.id, label: d.placa, sublabel: d.modelo, badge: "Veículo", badgeColor: "bg-blue-500" }));
  (multas.data || []).forEach(d => results.push({ id: d.id, label: d.placa, sublabel: d.auto_infracao, badge: "Multa", badgeColor: "bg-rose-500" }));
  return results;
}

export default function SearchBar() {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pageConfig = PAGE_CONFIG[pathname];

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim() || q.length < 2) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const res = pageConfig ? await pageConfig.search(q) : await globalSearch(q);
      setResults(res);
      setOpen(true);
    } catch { setResults([]); }
    finally { setLoading(false); }
  }, [pageConfig]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(query), 350);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query, doSearch]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const clear = () => { setQuery(""); setResults([]); setOpen(false); };

  return (
    <div ref={ref} className="relative w-full max-w-[200px] md:max-w-md hidden sm:block">
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
        <MagnifyingGlassIcon className={`h-5 w-5 transition-colors ${loading ? "text-[#0b7336] animate-pulse" : "text-gray-400"}`} />
      </div>
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        className="block w-full pl-11 pr-10 py-2.5 md:py-3 bg-white/50 dark:bg-gray-800/50 backdrop-blur-md border-0 rounded-2xl text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-[#0b7336] shadow-sm transition-all duration-300 text-sm"
        placeholder={pageConfig ? `Pesquisar em ${pageConfig.label}…` : "Pesquisar…"}
      />
      {query && (
        <button onClick={clear} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600">
          <XMarkIcon className="h-4 w-4" />
        </button>
      )}

      {open && (
        <div className="absolute top-full mt-2 left-0 w-full min-w-[320px] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 z-[9999] overflow-hidden">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-gray-400 font-medium">Nenhum resultado encontrado</div>
          ) : (
            <>
              <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  {pageConfig?.label || "Resultados"} · {results.length} encontrado{results.length !== 1 ? "s" : ""}
                </span>
              </div>
              <ul className="max-h-80 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800">
                {results.map((r, i) => (
                  <li key={`${r.id}-${i}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/60 cursor-pointer transition-colors group"
                    onClick={clear}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{r.label}</p>
                      {r.sublabel && <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{r.sublabel}</p>}
                    </div>
                    {r.badge && (
                      <span className={`flex-shrink-0 text-[9px] font-black text-white px-2 py-0.5 rounded-full ${r.badgeColor}`}>
                        {r.badge}
                      </span>
                    )}
                    <ArrowRightIcon className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 flex-shrink-0" />
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
