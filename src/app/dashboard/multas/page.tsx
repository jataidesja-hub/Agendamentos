"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "react-hot-toast";
import {
  ClipboardDocumentCheckIcon,
  PlusIcon,
  ArchiveBoxArrowDownIcon,
  ArrowPathIcon,
  DocumentIcon,
  DocumentArrowUpIcon,
  CheckCircleIcon,
  XMarkIcon,
  PencilIcon,
  TrashIcon
} from "@heroicons/react/24/outline";
import JSZip from "jszip";
import { saveAs } from "file-saver";

type MultaStatus = "pendente" | "identificada" | "enviada_rh";

interface Multa {
  id: string;
  placa: string;
  auto_infracao: string;
  status: MultaStatus;
  arquivos_iniciais: string[];
  arquivos_retorno: string[];
  gestor_cobrado: string | null;
  observacao_retorno: string | null;
  data_enviada_rh: string | null;
  created_at: string;
}

export default function MultasPage() {
  const [multas, setMultas] = useState<Multa[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"new" | "edit_initial" | "identify">("new");
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form state
  const [placa, setPlaca] = useState("");
  const [autoInfracao, setAutoInfracao] = useState("");
  const [gestor, setGestor] = useState("");
  const [obs, setObs] = useState("");
  const [filesToAdd, setFilesToAdd] = useState<File[]>([]);
  const [existingIniciais, setExistingIniciais] = useState<string[]>([]);
  const [existingRetorno, setExistingRetorno] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Tabs: pendente | identificada | enviada_rh
  const [activeTab, setActiveTab] = useState<MultaStatus>("pendente");

  useEffect(() => {
    fetchMultas();
  }, []);

  async function fetchMultas() {
    setLoading(true);
    const { data, error } = await supabase
      .from("multas")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (error) {
      toast.error("Erro ao carregar multas");
    } else {
      setMultas(data || []);
    }
    setLoading(false);
  }

  const { pendentes, identificadas, enviadas } = useMemo(() => {
    return {
      pendentes: multas.filter((m) => m.status === "pendente"),
      identificadas: multas.filter((m) => m.status === "identificada"),
      enviadas: multas.filter((m) => m.status === "enviada_rh"),
    };
  }, [multas]);

  const displayedMultas = useMemo(() => {
    if (activeTab === "pendente") return pendentes;
    if (activeTab === "identificada") return identificadas;
    return enviadas;
  }, [activeTab, pendentes, identificadas, enviadas]);

  function openNewModal() {
    setModalMode("new");
    setEditingId(null);
    setPlaca("");
    setAutoInfracao("");
    setGestor("");
    setObs("");
    setFilesToAdd([]);
    setExistingIniciais([]);
    setExistingRetorno([]);
    setModalOpen(true);
  }

  function openIdentifyModal(m: Multa) {
    setModalMode("identify");
    setEditingId(m.id);
    setPlaca(m.placa);
    setAutoInfracao(m.auto_infracao);
    setGestor(m.gestor_cobrado || "");
    setObs(m.observacao_retorno || "");
    setFilesToAdd([]);
    setExistingIniciais(m.arquivos_iniciais || []);
    setExistingRetorno(m.arquivos_retorno || []);
    setModalOpen(true);
  }

  function openEditInitialModal(m: Multa) {
    setModalMode("edit_initial");
    setEditingId(m.id);
    setPlaca(m.placa);
    setAutoInfracao(m.auto_infracao);
    setFilesToAdd([]);
    setExistingIniciais(m.arquivos_iniciais || []);
    setExistingRetorno([]);
    setModalOpen(true);
  }

  async function uploadFiles(files: File[], prefix: string): Promise<string[]> {
    const urls: string[] = [];
    for (const file of files) {
      // Remover acentos e caracteres especiais do nome do arquivo
      const safeName = file.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove acentos
        .replace(/[^a-zA-Z0-9.\-]/g, "_"); // Substitui espaços e caracteres não alfanuméricos por underline
      
      const fileName = `${prefix}_${Date.now()}_${safeName}`;
      
      const { data, error } = await supabase.storage
        .from("multas")
        .upload(fileName, file, { cacheControl: "3600", upsert: false });
        
      if (error) {
        console.error("Erro upload:", error);
        toast.error(`Erro ao subir arquivo ${file.name}`);
      } else if (data?.path) {
        urls.push(data.path);
      }
    }
    return urls;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!placa || !autoInfracao) return toast.error("Preencha placa e auto");
    
    setIsSaving(true);
    try {
      if (modalMode === "identify" && editingId) {
        // Modo identificação
        const m = multas.find(x => x.id === editingId);
        if (!m) throw new Error("Multa não encontrada");

        let novasUrlsRetorno = [...existingRetorno];
        if (filesToAdd.length > 0) {
          const up = await uploadFiles(filesToAdd, `retorno_${placa}`);
          novasUrlsRetorno = [...novasUrlsRetorno, ...up];
        }

        const { error } = await supabase.from("multas").update({
          gestor_cobrado: gestor,
          observacao_retorno: obs,
          arquivos_retorno: novasUrlsRetorno,
          status: "identificada",
          updated_at: new Date().toISOString()
        }).eq("id", editingId);

        if (error) throw error;
        toast.success("Multa identificada!");
      } else if (modalMode === "edit_initial" && editingId) {
        // Modo editar dados iniciais
        const m = multas.find(x => x.id === editingId);
        if (!m) throw new Error("Multa não encontrada");

        let novasUrlsIniciais = [...existingIniciais];
        if (filesToAdd.length > 0) {
          const up = await uploadFiles(filesToAdd, `inicial_${placa}`);
          novasUrlsIniciais = [...novasUrlsIniciais, ...up];
        }

        const { error } = await supabase.from("multas").update({
          placa,
          auto_infracao: autoInfracao,
          arquivos_iniciais: novasUrlsIniciais,
          updated_at: new Date().toISOString()
        }).eq("id", editingId);

        if (error) throw error;
        toast.success("Multa atualizada!");
      } else {
        // Modo criação
        let novasUrlsIniciais: string[] = [];
        if (filesToAdd.length > 0) {
          novasUrlsIniciais = await uploadFiles(filesToAdd, `inicial_${placa}`);
        }

        const { error } = await supabase.from("multas").insert({
          placa,
          auto_infracao: autoInfracao,
          arquivos_iniciais: novasUrlsIniciais
        });
        if (error) throw error;
        toast.success("Multa registrada!");
      }
      setModalOpen(false);
      fetchMultas();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setIsSaving(false);
    }
  }

  async function revertStatus(m: Multa) {
    const confirmRevert = window.confirm(`Deseja reverter o status da multa ${m.placa}?`);
    if (!confirmRevert) return;

    let newStatus: MultaStatus = "pendente";
    let updates: any = { updated_at: new Date().toISOString() };

    if (m.status === "enviada_rh") {
      newStatus = "identificada";
      updates.data_enviada_rh = null;
    } else if (m.status === "identificada") {
      newStatus = "pendente";
    }

    updates.status = newStatus;

    try {
      const { error } = await supabase.from("multas").update(updates).eq("id", m.id);
      if (error) throw error;
      toast.success(`Status revertido para ${newStatus}`);
      fetchMultas();
    } catch (err: any) {
      toast.error("Erro ao reverter status");
    }
  }

  async function deleteMulta(id: string) {
    if (!window.confirm("Tem certeza que deseja EXCLUIR esta multa? Esta ação não pode ser desfeita.")) return;
    try {
      const { error } = await supabase.from("multas").delete().eq("id", id);
      if (error) throw error;
      toast.success("Multa excluída com sucesso!");
      fetchMultas();
    } catch (err: any) {
      toast.error("Erro ao excluir multa");
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      // Append files or replace. Let's append to allow multiple drops.
      setFilesToAdd(prev => {
        const newFiles = Array.from(e.dataTransfer.files);
        // Avoid duplicates by name (basic check)
        const existingNames = new Set(prev.map(f => f.name));
        const filtered = newFiles.filter(f => !existingNames.has(f.name));
        return [...prev, ...filtered];
      });
    }
  }

  async function exportZip() {
    if (identificadas.length === 0) return toast.error("Nenhuma multa identificada para exportar");
    setIsExporting(true);
    
    try {
      const zip = new JSZip();
      let hasFiles = false;

      // Iterar sobre cada multa identificada
      for (const m of identificadas) {
        const folderName = `${m.placa.toUpperCase()} - ${m.auto_infracao}`;
        const folder = zip.folder(folderName);
        
        if (!folder) continue;

        // Função auxiliar para baixar e adicionar arquivo ao zip
        const addFileToZip = async (filePath: string, prefixName: string) => {
          const { data, error } = await supabase.storage.from("multas").download(filePath);
          if (data && !error) {
            const ext = filePath.split(".").pop() || "pdf";
            const nomeFinal = `${prefixName}_${filePath.split("_").pop()}`;
            folder.file(nomeFinal, data);
            hasFiles = true;
          }
        };

        // Baixar arquivos iniciais
        for (const path of (m.arquivos_iniciais || [])) {
          await addFileToZip(path, "INICIAL");
        }
        
        // Baixar arquivos de retorno
        for (const path of (m.arquivos_retorno || [])) {
          await addFileToZip(path, "RETORNO");
        }
      }

      if (!hasFiles) {
        toast.error("Nenhum arquivo encontrado para baixar nas multas selecionadas.");
        setIsExporting(false);
        return;
      }

      // Gerar e baixar ZIP
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `Multas_RH_${new Date().toISOString().split("T")[0]}.zip`);

      // Marcar todas como enviadas
      const ids = identificadas.map(m => m.id);
      await supabase.from("multas").update({ 
        status: "enviada_rh", 
        data_enviada_rh: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).in("id", ids);

      toast.success("Arquivo ZIP gerado e multas marcadas como enviadas!");
      fetchMultas();
      setActiveTab("enviada_rh");

    } catch (err) {
      toast.error("Erro ao gerar ZIP");
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  }

  async function getPublicUrlAndOpen(path: string) {
    const { data } = await supabase.storage.from("multas").createSignedUrl(path, 3600);
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    } else {
      toast.error("Erro ao abrir arquivo");
    }
  }

  return (
    <div className="h-full flex flex-col p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
            <ClipboardDocumentCheckIcon className="w-8 h-8 text-rose-500" />
            Gestão de Multas
          </h1>
          <p className="text-gray-500 dark:text-gray-400 font-medium mt-1">
            Controle de infrações, identificação de condutores e exportação para RH
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {activeTab === "identificada" && (
            <button 
              onClick={exportZip} disabled={isExporting || identificadas.length === 0}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg transition-all"
            >
              {isExporting ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <ArchiveBoxArrowDownIcon className="w-5 h-5" />}
              Exportar para RH (ZIP)
            </button>
          )}
          <button 
            onClick={openNewModal}
            className="flex items-center gap-2 bg-[#0b7336] hover:bg-[#095c2b] text-white px-5 py-2.5 rounded-xl font-bold shadow-lg transition-all"
          >
            <PlusIcon className="w-5 h-5" />
            Nova Multa
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b border-gray-200 dark:border-gray-800 pb-2 overflow-x-auto">
        {(["pendente", "identificada", "enviada_rh"] as MultaStatus[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
              activeTab === tab
                ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm ring-1 ring-gray-200 dark:ring-gray-700"
                : "text-gray-500 hover:bg-white/50 dark:hover:bg-gray-800/50"
            }`}
          >
            {tab === "pendente" && `Pendentes (${pendentes.length})`}
            {tab === "identificada" && `Identificadas (${identificadas.length})`}
            {tab === "enviada_rh" && `Enviadas ao RH (${enviadas.length})`}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="flex-1 bg-white dark:bg-gray-900 rounded-[1.5rem] border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <ArrowPathIcon className="w-8 h-8 text-rose-500 animate-spin" />
          </div>
        ) : displayedMultas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-400">
            <CheckCircleIcon className="w-12 h-12 text-gray-300 dark:text-gray-700" />
            <p className="font-bold">Nenhuma multa nesta categoria</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Placa</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Auto da Infração</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Gestor</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Anexos Iniciais</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Anexos de Retorno</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Ações</th>
                </tr>
              </thead>
              <tbody>
                {displayedMultas.map(m => (
                  <tr key={m.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-sm text-gray-900 dark:text-white uppercase">
                      {m.placa}
                    </td>
                    <td className="px-6 py-4 font-mono text-sm text-gray-600 dark:text-gray-300">
                      {m.auto_infracao}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 font-bold">
                      {m.gestor_cobrado || "—"}
                    </td>
                    <td className="px-6 py-4">
                      {m.arquivos_iniciais && m.arquivos_iniciais.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {m.arquivos_iniciais.map((path, i) => (
                            <button key={i} onClick={() => getPublicUrlAndOpen(path)} className="flex items-center gap-1 text-[10px] bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 px-2 py-1 rounded-lg border border-rose-200 dark:border-rose-800 hover:scale-105 transition-transform">
                              <DocumentIcon className="w-3 h-3" /> Ver {i + 1}
                            </button>
                          ))}
                        </div>
                      ) : <span className="text-gray-400 text-xs">—</span>}
                    </td>
                    <td className="px-6 py-4">
                      {m.arquivos_retorno && m.arquivos_retorno.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {m.arquivos_retorno.map((path, i) => (
                            <button key={i} onClick={() => getPublicUrlAndOpen(path)} className="flex items-center gap-1 text-[10px] bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800 hover:scale-105 transition-transform">
                              <DocumentIcon className="w-3 h-3" /> Ver {i + 1}
                            </button>
                          ))}
                        </div>
                      ) : <span className="text-gray-400 text-xs">—</span>}
                    </td>
                    <td className="px-6 py-4">
                      {m.status === "pendente" && (
                        <div className="flex items-center gap-2">
                          <button onClick={() => openIdentifyModal(m)} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors">
                            Identificar / Retorno
                          </button>
                          <button onClick={() => openEditInitialModal(m)} title="Editar Dados Iniciais" className="p-1.5 text-gray-400 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                            <PencilIcon className="w-4 h-4" />
                          </button>
                          <button onClick={() => deleteMulta(m.id)} title="Excluir Multa" className="p-1.5 text-gray-400 hover:text-red-600 bg-gray-100 hover:bg-red-50 rounded-lg transition-colors">
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                      {m.status === "identificada" && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-emerald-500 bg-emerald-50 px-3 py-1.5 rounded-lg">Pronta p/ RH</span>
                          <button onClick={() => revertStatus(m)} title="Reverter para Pendente" className="text-gray-400 hover:text-rose-500 transition-colors">
                            <ArrowPathIcon className="w-4 h-4" />
                          </button>
                          <button onClick={() => openEditInitialModal(m)} title="Editar Dados Iniciais" className="p-1.5 text-gray-400 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                            <PencilIcon className="w-4 h-4" />
                          </button>
                          <button onClick={() => deleteMulta(m.id)} title="Excluir Multa" className="p-1.5 text-gray-400 hover:text-red-600 bg-gray-100 hover:bg-red-50 rounded-lg transition-colors">
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                      {m.status === "enviada_rh" && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg">Enviada em {m.data_enviada_rh ? new Date(m.data_enviada_rh).toLocaleDateString() : ""}</span>
                          <button onClick={() => revertStatus(m)} title="Reverter para Identificada" className="text-gray-400 hover:text-rose-500 transition-colors">
                            <ArrowPathIcon className="w-4 h-4" />
                          </button>
                          <button onClick={() => openEditInitialModal(m)} title="Editar Dados Iniciais" className="p-1.5 text-gray-400 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                            <PencilIcon className="w-4 h-4" />
                          </button>
                          <button onClick={() => deleteMulta(m.id)} title="Excluir Multa" className="p-1.5 text-gray-400 hover:text-red-600 bg-gray-100 hover:bg-red-50 rounded-lg transition-colors">
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Nova/Editar */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between px-7 py-5 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-xl font-black text-gray-900 dark:text-white">
                {modalMode === "identify" ? "Informar Retorno (Identificar)" : modalMode === "edit_initial" ? "Editar Multa" : "Nova Multa"}
              </h2>
              <button onClick={() => setModalOpen(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-7 space-y-5">
              {modalMode === "new" || modalMode === "edit_initial" ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Placa</label>
                      <input type="text" required value={placa} onChange={e => setPlaca(e.target.value)} 
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-rose-500 outline-none uppercase" 
                        placeholder="ABC1234" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Auto da Infração</label>
                      <input type="text" required value={autoInfracao} onChange={e => setAutoInfracao(e.target.value)} 
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-rose-500 outline-none" 
                        placeholder="Nº do Auto" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Anexos Atuais</label>
                    {existingIniciais.length > 0 ? (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {existingIniciais.map((path, idx) => (
                          <div key={idx} className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700">
                            <button type="button" onClick={() => getPublicUrlAndOpen(path)} className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1">
                              <DocumentIcon className="w-3 h-3" /> Ver {idx + 1}
                            </button>
                            <button type="button" onClick={() => setExistingIniciais(prev => prev.filter((_, i) => i !== idx))} className="text-gray-400 hover:text-red-500 ml-1" title="Remover anexo">
                              <XMarkIcon className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 mb-2">Nenhum anexo salvo.</p>
                    )}
                    
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Adicionar Novos (PDF/Imagem)</label>
                    <label 
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                        isDragging ? "border-rose-500 bg-rose-50" : "border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <DocumentArrowUpIcon className={`w-6 h-6 mb-2 ${isDragging ? "text-rose-500" : "text-gray-400"}`} />
                        <p className="text-xs text-gray-500 font-bold">{filesToAdd.length > 0 ? `${filesToAdd.length} arquivo(s) selecionado(s)` : "Arraste e solte ou clique para anexar"}</p>
                      </div>
                      <input type="file" multiple className="hidden" onChange={e => setFilesToAdd(prev => {
                        const newFiles = Array.from(e.target.files || []);
                        const existingNames = new Set(prev.map(f => f.name));
                        const filtered = newFiles.filter(f => !existingNames.has(f.name));
                        return [...prev, ...filtered];
                      })} />
                    </label>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 mb-4 flex gap-4 items-center">
                    <div>
                      <p className="text-[10px] text-gray-500 font-black uppercase">Placa</p>
                      <p className="font-bold text-gray-900">{placa}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 font-black uppercase">Auto</p>
                      <p className="font-bold text-gray-900">{autoInfracao}</p>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Gestor Responsável</label>
                    <input type="text" required value={gestor} onChange={e => setGestor(e.target.value)} 
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                      placeholder="Nome do Gestor" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Observações do Retorno</label>
                    <textarea value={obs} onChange={e => setObs(e.target.value)} rows={2}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none" 
                      placeholder="Ex: Condutor já foi identificado e assinou..." />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Anexos de Retorno Atuais</label>
                    {existingRetorno.length > 0 ? (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {existingRetorno.map((path, idx) => (
                          <div key={idx} className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700">
                            <button type="button" onClick={() => getPublicUrlAndOpen(path)} className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                              <DocumentIcon className="w-3 h-3" /> Ver {idx + 1}
                            </button>
                            <button type="button" onClick={() => setExistingRetorno(prev => prev.filter((_, i) => i !== idx))} className="text-gray-400 hover:text-red-500 ml-1" title="Remover anexo">
                              <XMarkIcon className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 mb-2">Nenhum anexo de retorno salvo.</p>
                    )}

                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Adicionar Novos (PDF/Imagem)</label>
                    <label 
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                        isDragging ? "border-indigo-500 bg-indigo-50" : "border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <DocumentArrowUpIcon className={`w-6 h-6 mb-2 ${isDragging ? "text-indigo-500" : "text-gray-400"}`} />
                        <p className="text-xs text-gray-500 font-bold">{filesToAdd.length > 0 ? `${filesToAdd.length} arquivo(s) selecionado(s)` : "Arraste e solte ou clique para anexar de retorno"}</p>
                      </div>
                      <input type="file" multiple className="hidden" onChange={e => setFilesToAdd(prev => {
                        const newFiles = Array.from(e.target.files || []);
                        const existingNames = new Set(prev.map(f => f.name));
                        const filtered = newFiles.filter(f => !existingNames.has(f.name));
                        return [...prev, ...filtered];
                      })} />
                    </label>
                  </div>
                </>
              )}
              
              <button type="submit" disabled={isSaving} className="w-full bg-rose-600 hover:bg-rose-700 text-white font-black py-3 rounded-xl shadow-lg transition-all flex justify-center items-center gap-2">
                {isSaving ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <CheckCircleIcon className="w-5 h-5" />}
                {modalMode === "identify" ? "Salvar Identificação" : modalMode === "edit_initial" ? "Salvar Edição" : "Registrar Multa"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
