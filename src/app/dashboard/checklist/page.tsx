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
    load();
  }, []);

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
        <button
          onClick={() => router.push("/dashboard/checklist/novo")}
          className="flex items-center gap-2 px-5 py-3 bg-[#0b7336] hover:bg-[#09602c] text-white font-bold rounded-2xl shadow-lg transition-all active:scale-95"
        >
          <PlusIcon className="w-5 h-5" />
          Novo Checklist
        </button>
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
    </div>
  );
}
