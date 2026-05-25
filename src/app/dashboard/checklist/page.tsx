"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { PlusIcon, ClipboardDocumentCheckIcon, EyeIcon, TrashIcon, ArrowDownTrayIcon, PencilIcon, ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import { gerarChecklistPdf } from "@/lib/checklistPdf";

interface Checklist {
  id: string;
  placa: string;
  condutor: string;
  projeto: string;
  data_inspecao: string;
  km_inspecao: string;
  local_inspecao: string;
  created_at: string;
}

export default function ChecklistPage() {
  const router = useRouter();
  const [lista, setLista] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [gerandoPdfId, setGerandoPdfId] = useState<string | null>(null);
  const [isMaster, setIsMaster] = useState(false);
  const [expandedVeiculos, setExpandedVeiculos] = useState<Set<string>>(new Set());

  const handleDownloadPdf = async (id: string) => {
    setGerandoPdfId(id);
    try {
      const { data } = await supabase.from("informe_checklist").select("*").eq("id", id).single();
      if (data) await gerarChecklistPdf(data);
    } catch (e: any) {
      toast.error("Erro ao gerar PDF: " + e.message);
    } finally {
      setGerandoPdfId(null);
    }
  };

  useEffect(() => {
    fetchPerfil();
    load();
  }, []);

  const fetchPerfil = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase
      .from('perfis_acesso')
      .select('master')
      .eq('email', session.user.email)
      .single();
    if (data?.master) setIsMaster(true);
  };

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("informe_checklist")
      .select("id, placa, condutor, projeto, data_inspecao, km_inspecao, local_inspecao, created_at")
      .order("created_at", { ascending: false });
    setLista(data || []);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este checklist?")) return;
    const { error } = await supabase.from("informe_checklist").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Excluído!");
    setLista(prev => prev.filter(c => c.id !== id));
  };
  const filtrado = lista.filter(c =>
    (c.placa || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.condutor || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.projeto || "").toLowerCase().includes(search.toLowerCase())
  );

  // Group by "projeto" -> "placa" -> checklists[]
  const groupedChecklists = useMemo(() => {
    const projects: Record<string, Record<string, Checklist[]>> = {};
    filtrado.forEach(c => {
      const p = (c.projeto || "SEM PROJETO DEFINIDO").trim().toUpperCase().replace(/\s+/g, ' ');
      const v = (c.placa || "S/P").trim().toUpperCase();
      if (!projects[p]) projects[p] = {};
      if (!projects[p][v]) projects[p][v] = [];
      projects[p][v].push(c);
    });

    // Sort checklists inside each placa by date (newest first)
    for (const p in projects) {
      for (const v in projects[p]) {
        projects[p][v].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }
    }
    return projects;
  }, [filtrado]);

  const toggleVeiculo = (projeto: string, placa: string) => {
    const key = `${projeto}_${placa}`;
    setExpandedVeiculos(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white">
            Informe de Controle de Veículos
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {lista.length} checklist{lista.length !== 1 ? "s" : ""} registrado{lista.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/dashboard/checklist/novo")}
            className="flex items-center gap-2 px-5 py-3 bg-[#0b7336] hover:bg-[#09602c] text-white font-bold rounded-2xl shadow-lg transition-all active:scale-95"
          >
            <PlusIcon className="w-5 h-5" />
            Novo Checklist
          </button>
        </div>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Buscar por placa, condutor ou projeto..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full px-4 py-3 bg-white/70 dark:bg-gray-800/70 backdrop-blur border border-gray-200 dark:border-gray-700 rounded-2xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0b7336]"
      />

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#0b7336] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtrado.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <ClipboardDocumentCheckIcon className="w-16 h-16 text-gray-300 dark:text-gray-600" />
          <p className="text-gray-400 dark:text-gray-500 font-medium">Nenhum checklist encontrado</p>
          <button
            onClick={() => router.push("/dashboard/checklist/novo")}
            className="px-5 py-2 bg-[#0b7336] text-white font-bold rounded-xl text-sm"
          >
            Criar primeiro checklist
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedChecklists).sort(([a], [b]) => a.localeCompare(b)).map(([projeto, veiculosObj]) => (
            <div key={projeto} className="space-y-4">
              <h2 className="text-xl font-black text-gray-800 dark:text-gray-200 uppercase tracking-widest border-b border-gray-200 dark:border-gray-800 pb-2 flex items-center gap-2">
                {projeto} <span className="text-sm px-2 py-0.5 bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-lg">{Object.keys(veiculosObj).length} veículos</span>
              </h2>
              <div className="space-y-3">
                {Object.entries(veiculosObj).sort(([a], [b]) => a.localeCompare(b)).map(([placa, items]) => {
                  const key = `${projeto}_${placa}`;
                  const isExpanded = expandedVeiculos.has(key);
                  const maisRecente = items[0];

                  return (
                    <div key={key} className="bg-white/70 dark:bg-gray-800/70 backdrop-blur border border-gray-200/50 dark:border-gray-700/50 rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden">
                      <div 
                        onClick={() => toggleVeiculo(projeto, placa)}
                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-[#0b7336]/10 dark:bg-[#0b7336]/20 rounded-xl flex items-center justify-center">
                            <ClipboardDocumentCheckIcon className="w-5 h-5 text-[#0b7336] dark:text-[#298d4a]" />
                          </div>
                          <div>
                            <p className="font-black text-gray-900 dark:text-white text-lg tracking-wide leading-none">{placa}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-gray-500 font-bold">{items.length} checklist{items.length !== 1 ? "s" : ""}</span>
                              <span className="text-xs text-gray-300 dark:text-gray-600">•</span>
                              <span className="text-xs text-gray-400">Último: {maisRecente.data_inspecao ? new Date(maisRecente.data_inspecao + "T12:00:00").toLocaleDateString("pt-BR") : "—"}</span>
                            </div>
                          </div>
                        </div>
                        <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                          {isExpanded ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-900/20 p-4 pt-2">
                          <div className="space-y-2 mt-2">
                            {items.map(item => (
                              <div key={item.id} className="flex items-center justify-between bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-3 rounded-xl shadow-sm">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{item.data_inspecao ? new Date(item.data_inspecao + "T12:00:00").toLocaleDateString("pt-BR") : "—"}</span>
                                    <span className="text-[10px] text-gray-400 uppercase">KM: {item.km_inspecao || "—"}</span>
                                  </div>
                                  <p className="text-xs text-gray-500 truncate">{item.condutor || "Sem condutor"} {item.local_inspecao ? `• ${item.local_inspecao}` : ""}</p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button onClick={() => router.push(`/dashboard/checklist/${item.id}`)} className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-colors" title="Visualizar">
                                    <EyeIcon className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => handleDownloadPdf(item.id)} disabled={gerandoPdfId === item.id} className="p-1.5 rounded-lg bg-green-50 dark:bg-green-900/30 text-[#0b7336] dark:text-green-400 hover:bg-green-100 transition-colors disabled:opacity-50" title="Baixar PDF">
                                    {gerandoPdfId === item.id ? <div className="w-4 h-4 border-2 border-[#0b7336] border-t-transparent rounded-full animate-spin" /> : <ArrowDownTrayIcon className="w-4 h-4" />}
                                  </button>
                                  {isMaster && (
                                    <>
                                      <button onClick={() => router.push(`/dashboard/checklist/novo?id=${item.id}`)} className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 hover:bg-amber-100 transition-colors" title="Editar">
                                        <PencilIcon className="w-4 h-4" />
                                      </button>
                                      <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 hover:bg-red-100 transition-colors" title="Excluir">
                                        <TrashIcon className="w-4 h-4" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
