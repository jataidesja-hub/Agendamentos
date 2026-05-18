"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { PlusIcon, ClipboardDocumentCheckIcon, EyeIcon, TrashIcon, ArrowDownTrayIcon } from "@heroicons/react/24/outline";
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
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [veiculos, setVeiculos] = useState<any[]>([]);
  const [novoProjeto, setNovoProjeto] = useState("");
  const [selectedPlacas, setSelectedPlacas] = useState<string[]>([]);
  const [savingProject, setSavingProject] = useState(false);

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
    checkMaster();
    load();
  }, []);

  const checkMaster = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase
      .from("perfis_acesso")
      .select("master")
      .eq("email", session.user.email)
      .single();
    if (data?.master) {
      setIsMaster(true);
    }
  };

  const loadVeiculos = async () => {
    const { data } = await supabase.from("frota_veiculos").select("placa, projeto").order("placa");
    if (data) {
      setVeiculos(data);
    }
  };

  const openProjectModal = () => {
    loadVeiculos();
    setSelectedPlacas([]);
    setNovoProjeto("");
    setShowProjectModal(true);
  };

  const saveProjectLink = async () => {
    if (!novoProjeto.trim()) {
      toast.error("Digite o nome do projeto");
      return;
    }
    if (selectedPlacas.length === 0) {
      toast.error("Selecione pelo menos um veículo");
      return;
    }
    setSavingProject(true);
    try {
      const { error } = await supabase
        .from("frota_veiculos")
        .update({ projeto: novoProjeto.trim() })
        .in("placa", selectedPlacas);
      
      if (error) throw error;
      toast.success("Veículos vinculados com sucesso!");
      setShowProjectModal(false);
      load(); // Reload checklists to update project names if necessary
    } catch (e: any) {
      toast.error("Erro ao vincular veículos");
    } finally {
      setSavingProject(false);
    }
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
    c.placa?.toLowerCase().includes(search.toLowerCase()) ||
    c.condutor?.toLowerCase().includes(search.toLowerCase()) ||
    c.projeto?.toLowerCase().includes(search.toLowerCase())
  );

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
          {isMaster && (
            <button
              onClick={openProjectModal}
              className="flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg transition-all active:scale-95"
            >
              Vincular Projetos
            </button>
          )}
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtrado.map(item => (
            <div
              key={item.id}
              className="bg-white/70 dark:bg-gray-800/70 backdrop-blur border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-black text-gray-900 dark:text-white text-lg tracking-wide">{item.placa}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 font-medium truncate">{item.condutor || "—"}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 truncate">{item.projeto || "—"}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => router.push(`/dashboard/checklist/${item.id}`)}
                    className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-colors"
                  >
                    <EyeIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDownloadPdf(item.id)}
                    disabled={gerandoPdfId === item.id}
                    className="p-2 rounded-xl bg-green-50 dark:bg-green-900/30 text-[#0b7336] dark:text-green-400 hover:bg-green-100 transition-colors disabled:opacity-50"
                    title="Baixar PDF"
                  >
                    {gerandoPdfId === item.id
                      ? <div className="w-4 h-4 border-2 border-[#0b7336] border-t-transparent rounded-full animate-spin" />
                      : <ArrowDownTrayIcon className="w-4 h-4" />
                    }
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-2 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 hover:bg-red-100 transition-colors"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/50 flex items-center justify-between text-xs text-gray-500 dark:text-gray-500">
                <span>KM: <span className="font-bold text-gray-700 dark:text-gray-300">{item.km_inspecao || "—"}</span></span>
                <span>{item.data_inspecao ? new Date(item.data_inspecao + "T12:00:00").toLocaleDateString("pt-BR") : "—"}</span>
              </div>
              {item.local_inspecao && (
                <p className="text-xs text-gray-400 dark:text-gray-600 mt-1 truncate">{item.local_inspecao}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal de Projetos */}
      {showProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-[2rem] shadow-2xl w-full max-w-2xl border border-gray-100 dark:border-gray-800 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-xl font-black text-gray-900 dark:text-white">Vincular Veículos a Projeto</h2>
              <p className="text-sm text-gray-500 mt-1">Defina o nome do projeto e selecione os veículos.</p>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto space-y-6">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">Nome do Projeto</label>
                <input
                  type="text"
                  value={novoProjeto}
                  onChange={e => setNovoProjeto(e.target.value.toUpperCase())}
                  placeholder="EX: AGUA VERMELHA"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none uppercase"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Selecione os Veículos ({selectedPlacas.length})</label>
                  <button 
                    onClick={() => {
                      if (selectedPlacas.length === veiculos.length) setSelectedPlacas([]);
                      else setSelectedPlacas(veiculos.map(v => v.placa));
                    }}
                    className="text-xs text-indigo-600 font-bold hover:underline"
                  >
                    {selectedPlacas.length === veiculos.length ? "Desmarcar Todos" : "Marcar Todos"}
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {veiculos.map(v => (
                    <label key={v.placa} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedPlacas.includes(v.placa) ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                        checked={selectedPlacas.includes(v.placa)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedPlacas(p => [...p, v.placa]);
                          else setSelectedPlacas(p => p.filter(pl => pl !== v.placa));
                        }}
                      />
                      <div>
                        <p className="text-sm font-black text-gray-900 dark:text-white">{v.placa}</p>
                        <p className="text-[10px] text-gray-500 truncate max-w-[100px]">{v.projeto || "Sem projeto"}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3 bg-gray-50 dark:bg-gray-900/50 rounded-b-[2rem]">
              <button
                onClick={() => setShowProjectModal(false)}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveProjectLink}
                disabled={savingProject}
                className="px-5 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 transition-all"
              >
                {savingProject && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Salvar Vínculos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
