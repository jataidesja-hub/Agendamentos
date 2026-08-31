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
  TrashIcon,
  ChartBarIcon,
  UserIcon,
  TruckIcon,
  CurrencyDollarIcon,
} from "@heroicons/react/24/outline";
import JSZip from "jszip";
import { saveAs } from "file-saver";

type MultaStatus = "pendente" | "identificada" | "enviada_rh" | "sem_assinatura";

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
  prazo_indicacao_condutor: string | null;
  valor_multa: number | null;
  condutor_identificado: string | null;
  locadora: string | null;
  created_at: string;
}

interface Veiculo {
  placa: string;
  projeto: string | null;
  modelo: string | null;
}

export default function MultasPage() {
  const [multas, setMultas] = useState<Multa[]>([]);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"new" | "edit" | "identify">("new");
  const [filesToAddRetorno, setFilesToAddRetorno] = useState<File[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [placa, setPlaca] = useState("");
  const [autoInfracao, setAutoInfracao] = useState("");
  const [gestor, setGestor] = useState("");
  const [obs, setObs] = useState("");
  const [prazoIndicacao, setPrazoIndicacao] = useState("");
  const [valorMulta, setValorMulta] = useState("");
  const [condutorIdentificado, setCondutorIdentificado] = useState("");
  const [filesToAdd, setFilesToAdd] = useState<File[]>([]);
  const [existingIniciais, setExistingIniciais] = useState<string[]>([]);
  const [existingRetorno, setExistingRetorno] = useState<string[]>([]);
  const [locadora, setLocadora] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Tabs: ranking é nova
  const [activeTab, setActiveTab] = useState<MultaStatus | "ranking">("pendente");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Map placa → projeto
  const projetoMap = useMemo(() => {
    const map: Record<string, string> = {};
    veiculos.forEach(v => {
      if (v.placa && v.projeto) map[v.placa.toUpperCase().trim()] = v.projeto;
    });
    return map;
  }, [veiculos]);

  function getProjeto(placaVal: string) {
    return projetoMap[placaVal.toUpperCase().trim()] || "—";
  }

  useEffect(() => {
    fetchMultas();
    fetchVeiculos();
  }, []);

  async function fetchMultas() {
    setLoading(true);
    const { data, error } = await supabase
      .from("multas")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar multas");
    else setMultas(data || []);
    setLoading(false);
  }

  async function fetchVeiculos() {
    const { data } = await supabase.from("frota_veiculos").select("placa, projeto, modelo");
    setVeiculos(data || []);
  }

  const { pendentes, identificadas, enviadas, semAssinatura } = useMemo(() => ({
    pendentes: multas.filter(m => m.status === "pendente"),
    identificadas: multas.filter(m => m.status === "identificada"),
    enviadas: multas.filter(m => m.status === "enviada_rh"),
    semAssinatura: multas.filter(m => m.status === "sem_assinatura"),
  }), [multas]);

  const displayedMultas = useMemo(() => {
    if (activeTab === "pendente") return pendentes;
    if (activeTab === "identificada") return identificadas;
    if (activeTab === "sem_assinatura") return semAssinatura;
    if (activeTab === "enviada_rh") return enviadas;
    return [];
  }, [activeTab, pendentes, identificadas, semAssinatura, enviadas]);

  // Ranking data
  const rankingProjetos = useMemo(() => {
    const map: Record<string, { count: number; valor: number; valorRecuperado: number }> = {};
    multas.forEach(m => {
      const proj = getProjeto(m.placa);
      if (!map[proj]) map[proj] = { count: 0, valor: 0, valorRecuperado: 0 };
      map[proj].count++;
      map[proj].valor += m.valor_multa || 0;
      if (m.condutor_identificado) {
        map[proj].valorRecuperado += m.valor_multa || 0;
      }
    });
    return Object.entries(map)
      .map(([proj, d]) => ({ proj, ...d }))
      .sort((a, b) => b.count - a.count);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multas, projetoMap]);

  const rankingCondutores = useMemo(() => {
    const map: Record<string, { count: number; valor: number }> = {};
    multas.forEach(m => {
      if (!m.condutor_identificado) return;
      if (!map[m.condutor_identificado]) map[m.condutor_identificado] = { count: 0, valor: 0 };
      map[m.condutor_identificado].count++;
      map[m.condutor_identificado].valor += m.valor_multa || 0;
    });
    return Object.entries(map)
      .map(([nome, d]) => ({ nome, ...d }))
      .sort((a, b) => b.count - a.count);
  }, [multas]);

  const totalValor = useMemo(() => multas.reduce((acc, m) => acc + (m.valor_multa || 0), 0), [multas]);
  const totalRecuperado = useMemo(() => multas.reduce((acc, m) => acc + (m.condutor_identificado ? (m.valor_multa || 0) : 0), 0), [multas]);

  function resetForm() {
    setPlaca(""); setAutoInfracao(""); setGestor(""); setObs("");
    setPrazoIndicacao(""); setValorMulta(""); setCondutorIdentificado(""); setLocadora("");
    setFilesToAdd([]); setFilesToAddRetorno([]);
    setExistingIniciais([]); setExistingRetorno([]);
  }

  function openNewModal() {
    setModalMode("new"); setEditingId(null); resetForm(); setModalOpen(true);
  }

  function openIdentifyModal(m: Multa) {
    setModalMode("identify"); setEditingId(m.id);
    setPlaca(m.placa); setAutoInfracao(m.auto_infracao);
    setGestor(m.gestor_cobrado || ""); setObs(m.observacao_retorno || "");
    setPrazoIndicacao(m.prazo_indicacao_condutor || "");
    setValorMulta(m.valor_multa != null ? String(m.valor_multa) : "");
    setCondutorIdentificado(m.condutor_identificado || "");
    setLocadora(m.locadora || "");
    setFilesToAdd([]); setFilesToAddRetorno([]);
    setExistingIniciais(m.arquivos_iniciais || []);
    setExistingRetorno(m.arquivos_retorno || []);
    setModalOpen(true);
  }

  function openFullEditModal(m: Multa) {
    setModalMode("edit"); setEditingId(m.id);
    setPlaca(m.placa); setAutoInfracao(m.auto_infracao);
    setGestor(m.gestor_cobrado || ""); setObs(m.observacao_retorno || "");
    setPrazoIndicacao(m.prazo_indicacao_condutor || "");
    setValorMulta(m.valor_multa != null ? String(m.valor_multa) : "");
    setCondutorIdentificado(m.condutor_identificado || "");
    setLocadora(m.locadora || "");
    setFilesToAdd([]); setFilesToAddRetorno([]);
    setExistingIniciais(m.arquivos_iniciais || []);
    setExistingRetorno(m.arquivos_retorno || []);
    setModalOpen(true);
  }

  async function uploadFiles(files: File[], prefix: string): Promise<string[]> {
    const urls: string[] = [];
    for (const file of files) {
      const safeName = file.name
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9.\-]/g, "_");
      const fileName = `${prefix}_${Date.now()}_${safeName}`;
      const { data, error } = await supabase.storage.from("multas").upload(fileName, file, { cacheControl: "3600", upsert: false });
      if (error) toast.error(`Erro ao subir arquivo ${file.name}`);
      else if (data?.path) urls.push(data.path);
    }
    return urls;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!placa || !autoInfracao) return toast.error("Preencha placa e auto");
    setIsSaving(true);
    try {
      const valorNum = valorMulta ? parseFloat(valorMulta.replace(",", ".")) : null;

      if (modalMode === "identify" && editingId) {
        let novasUrlsRetorno = [...existingRetorno];
        if (filesToAdd.length > 0) {
          const up = await uploadFiles(filesToAdd, `retorno_${placa}`);
          novasUrlsRetorno = [...novasUrlsRetorno, ...up];
        }
        const { error } = await supabase.from("multas").update({
          gestor_cobrado: gestor,
          observacao_retorno: obs,
          arquivos_retorno: novasUrlsRetorno,
          valor_multa: valorNum,
          condutor_identificado: condutorIdentificado || null,
          status: "identificada",
          updated_at: new Date().toISOString()
        }).eq("id", editingId);
        if (error) throw error;
        toast.success("Multa identificada!");

      } else if (modalMode === "edit" && editingId) {
        let novasUrlsIniciais = [...existingIniciais];
        if (filesToAdd.length > 0) {
          const up = await uploadFiles(filesToAdd, `inicial_${placa}`);
          novasUrlsIniciais = [...novasUrlsIniciais, ...up];
        }
        let novasUrlsRetorno = [...existingRetorno];
        if (filesToAddRetorno.length > 0) {
          const up = await uploadFiles(filesToAddRetorno, `retorno_${placa}`);
          novasUrlsRetorno = [...novasUrlsRetorno, ...up];
        }
        const { error } = await supabase.from("multas").update({
          placa, auto_infracao: autoInfracao,
          gestor_cobrado: gestor || null, observacao_retorno: obs || null,
          prazo_indicacao_condutor: prazoIndicacao || null,
          arquivos_iniciais: novasUrlsIniciais, arquivos_retorno: novasUrlsRetorno,
          valor_multa: valorNum,
          condutor_identificado: condutorIdentificado || null,
          locadora: locadora || null,
          updated_at: new Date().toISOString()
        }).eq("id", editingId);
        if (error) throw error;
        toast.success("Multa atualizada!");

      } else {
        let novasUrlsIniciais: string[] = [];
        if (filesToAdd.length > 0) novasUrlsIniciais = await uploadFiles(filesToAdd, `inicial_${placa}`);
        const { error } = await supabase.from("multas").insert({
          placa, auto_infracao: autoInfracao,
          prazo_indicacao_condutor: prazoIndicacao || null,
          gestor_cobrado: gestor || null,
          arquivos_iniciais: novasUrlsIniciais,
          valor_multa: valorNum,
          condutor_identificado: condutorIdentificado || null,
          locadora: locadora || null,
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
    if (!window.confirm(`Deseja reverter o status da multa ${m.placa}?`)) return;
    let newStatus: MultaStatus = "pendente";
    const updates: any = { updated_at: new Date().toISOString() };
    if (m.status === "enviada_rh") { newStatus = "identificada"; updates.data_enviada_rh = null; }
    else if (m.status === "identificada" || m.status === "sem_assinatura") newStatus = "pendente";
    updates.status = newStatus;
    try {
      const { error } = await supabase.from("multas").update(updates).eq("id", m.id);
      if (error) throw error;
      toast.success(`Status revertido`);
      fetchMultas();
    } catch { toast.error("Erro ao reverter status"); }
  }

  async function markSemAssinatura(m: Multa) {
    const obsInput = window.prompt("Observação (motivo de não ter coletado assinatura):");
    if (obsInput === null) return;
    try {
      const { error } = await supabase.from("multas").update({
        status: "sem_assinatura",
        observacao_retorno: obsInput || "Não foi possível coletar assinatura",
        updated_at: new Date().toISOString()
      }).eq("id", m.id);
      if (error) throw error;
      toast.success("Marcada como sem assinatura");
      fetchMultas();
    } catch { toast.error("Erro ao atualizar status"); }
  }

  async function deleteMulta(id: string) {
    if (!window.confirm("Tem certeza que deseja EXCLUIR esta multa?")) return;
    try {
      const { error } = await supabase.from("multas").delete().eq("id", id);
      if (error) throw error;
      toast.success("Multa excluída!");
      fetchMultas();
    } catch { toast.error("Erro ao excluir multa"); }
  }

  function handleDragOver(e: React.DragEvent) { e.preventDefault(); setIsDragging(true); }
  function handleDragLeave(e: React.DragEvent) { e.preventDefault(); setIsDragging(false); }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files?.length > 0) {
      setFilesToAdd(prev => {
        const newFiles = Array.from(e.dataTransfer.files);
        const existingNames = new Set(prev.map(f => f.name));
        return [...prev, ...newFiles.filter(f => !existingNames.has(f.name))];
      });
    }
  }

  function renderStatusPrazo(prazo: string | null) {
    if (!prazo) return "—";
    const dataPrazo = new Date(prazo);
    if (isNaN(dataPrazo.getTime())) return "—";
    const hoje = new Date();
    const hojeUTC = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const diffDays = Math.ceil((dataPrazo.getTime() - hojeUTC) / (1000 * 60 * 60 * 24));
    const dateStr = dataPrazo.toLocaleDateString("pt-BR", { timeZone: "UTC" });
    if (diffDays < 0) return <div className="flex flex-col gap-1 items-start"><span>{dateStr}</span><span className="text-[9px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-black uppercase">Vencido</span></div>;
    if (diffDays <= 7) return <div className="flex flex-col gap-1 items-start"><span>{dateStr}</span><span className="text-[9px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-black uppercase">Prestes a Vencer</span></div>;
    return <div className="flex flex-col gap-1 items-start"><span>{dateStr}</span><span className="text-[9px] bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full font-black uppercase">No Prazo</span></div>;
  }

  function formatCurrency(val: number | null) {
    if (!val) return "—";
    return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  async function exportZip() {
    const toExport = identificadas.filter(m => selectedIds.has(m.id));
    if (toExport.length === 0) return toast.error("Selecione ao menos uma multa para exportar");
    setIsExporting(true);
    try {
      const zip = new JSZip();
      let hasFiles = false;
      for (const m of toExport) {
        const folderName = `${m.placa.toUpperCase()} - ${m.auto_infracao}`;
        const folder = zip.folder(folderName);
        if (!folder) continue;
        const addFileToZip = async (filePath: string, prefixName: string) => {
          const { data, error } = await supabase.storage.from("multas").download(filePath);
          if (data && !error) { folder.file(`${prefixName}_${filePath.split("_").pop()}`, data); hasFiles = true; }
        };
        for (const path of (m.arquivos_iniciais || [])) await addFileToZip(path, "INICIAL");
        for (const path of (m.arquivos_retorno || [])) await addFileToZip(path, "RETORNO");
      }
      if (!hasFiles) { toast.error("Nenhum arquivo encontrado."); setIsExporting(false); return; }
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `Multas_RH_${new Date().toISOString().split("T")[0]}.zip`);
      const ids = toExport.map(m => m.id);
      await supabase.from("multas").update({ status: "enviada_rh", data_enviada_rh: new Date().toISOString(), updated_at: new Date().toISOString() }).in("id", ids);
      toast.success(`${toExport.length} multa(s) exportada(s)!`);
      setSelectedIds(new Set());
      fetchMultas();
      setActiveTab("enviada_rh");
    } catch (err) { toast.error("Erro ao gerar ZIP"); console.error(err); }
    finally { setIsExporting(false); }
  }

  async function getPublicUrlAndOpen(path: string) {
    const { data } = await supabase.storage.from("multas").createSignedUrl(path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else toast.error("Erro ao abrir arquivo");
  }

  const inputCls = "w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-rose-500 outline-none dark:text-white";

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
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs font-black text-rose-600 bg-rose-50 dark:bg-rose-900/20 px-3 py-1 rounded-full border border-rose-200 dark:border-rose-800">
              Total em multas: {formatCurrency(totalValor)}
            </span>
            <span className="text-xs font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800" title="Valor recuperado através da indicação de condutor">
              Recuperado: {formatCurrency(totalRecuperado)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {activeTab === "identificada" && (
            <button onClick={exportZip} disabled={isExporting || selectedIds.size === 0}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg transition-all">
              {isExporting ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <ArchiveBoxArrowDownIcon className="w-5 h-5" />}
              Exportar ({selectedIds.size})
            </button>
          )}
          <button onClick={openNewModal}
            className="flex items-center gap-2 bg-[#0b7336] hover:bg-[#095c2b] text-white px-5 py-2.5 rounded-xl font-bold shadow-lg transition-all">
            <PlusIcon className="w-5 h-5" /> Nova Multa
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b border-gray-200 dark:border-gray-800 pb-2 overflow-x-auto">
        {([
          { key: "pendente", label: `Pendentes (${pendentes.length})` },
          { key: "identificada", label: `Identificadas (${identificadas.length})` },
          { key: "sem_assinatura", label: `Sem Assinatura (${semAssinatura.length})` },
          { key: "enviada_rh", label: `Enviadas ao RH (${enviadas.length})` },
          { key: "ranking", label: "Ranking" },
        ] as { key: MultaStatus | "ranking"; label: string }[]).map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
              activeTab === tab.key
                ? tab.key === "ranking"
                  ? "bg-amber-500 text-white shadow-sm"
                  : "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm ring-1 ring-gray-200 dark:ring-gray-700"
                : "text-gray-500 hover:bg-white/50 dark:hover:bg-gray-800/50"
            }`}>
            {tab.key === "ranking" && <span className="inline-flex items-center gap-1"><ChartBarIcon className="w-4 h-4 inline" /> {tab.label}</span>}
            {tab.key !== "ranking" && tab.label}
          </button>
        ))}
      </div>

      {/* Ranking Tab */}
      {activeTab === "ranking" ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Projetos */}
          <div className="bg-white dark:bg-gray-900 rounded-[1.5rem] border border-gray-100 dark:border-gray-800 shadow-sm p-6">
            <h2 className="text-lg font-black text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <TruckIcon className="w-5 h-5 text-rose-500" /> Projetos com mais multas
            </h2>
            {rankingProjetos.length === 0 ? (
              <p className="text-gray-400 text-sm">Nenhum dado.</p>
            ) : (
              <div className="space-y-3">
                {rankingProjetos.map((r, i) => (
                  <div key={r.proj} className="flex items-center gap-3">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${
                      i === 0 ? "bg-rose-500 text-white" : i === 1 ? "bg-rose-400/80 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                    }`}>{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-bold text-gray-800 dark:text-white truncate">{r.proj}</span>
                        <span className="text-xs font-black text-rose-600 ml-2 whitespace-nowrap">{r.count} multa{r.count !== 1 ? "s" : ""}</span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
                        <div className="bg-rose-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (r.count / (rankingProjetos[0]?.count || 1)) * 100)}%` }} />
                      </div>
                      {r.valor > 0 && (
                        <div className="flex items-center gap-2 mt-0.5 text-[10px]">
                          <span className="text-gray-400">{formatCurrency(r.valor)}</span>
                          {r.valorRecuperado > 0 && (
                            <span className="text-emerald-500 font-medium">
                              (Recup. {formatCurrency(r.valorRecuperado)})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Condutores */}
          <div className="bg-white dark:bg-gray-900 rounded-[1.5rem] border border-gray-100 dark:border-gray-800 shadow-sm p-6">
            <h2 className="text-lg font-black text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <UserIcon className="w-5 h-5 text-amber-500" /> Condutores mais reincidentes
            </h2>
            {rankingCondutores.length === 0 ? (
              <p className="text-gray-400 text-sm">Nenhum condutor identificado ainda.</p>
            ) : (
              <div className="space-y-3">
                {rankingCondutores.map((r, i) => (
                  <div key={r.nome} className="flex items-center gap-3">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${
                      i === 0 ? "bg-amber-500 text-white" : i === 1 ? "bg-amber-400/80 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                    }`}>{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-bold text-gray-800 dark:text-white truncate">{r.nome}</span>
                        <span className="text-xs font-black text-amber-600 ml-2 whitespace-nowrap">{r.count} multa{r.count !== 1 ? "s" : ""}</span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
                        <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (r.count / (rankingCondutores[0]?.count || 1)) * 100)}%` }} />
                      </div>
                      {r.valor > 0 && <p className="text-[10px] text-gray-400 mt-0.5">{formatCurrency(r.valor)}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Lista */
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
                    {activeTab === "identificada" && (
                      <th className="px-4 py-4">
                        <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-indigo-600 cursor-pointer"
                          checked={identificadas.length > 0 && identificadas.every(m => selectedIds.has(m.id))}
                          onChange={e => setSelectedIds(e.target.checked ? new Set(identificadas.map(m => m.id)) : new Set())} />
                      </th>
                    )}
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Placa</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Projeto</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Locadora</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Auto da Infração</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Valor</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Condutor</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Prazo Condutor</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Gestor</th>
                    {activeTab === "sem_assinatura" && <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Observação</th>}
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Anexos Iniciais</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Anexos de Retorno</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedMultas.map(m => (
                    <tr key={m.id} className={`border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors ${activeTab === "identificada" && selectedIds.has(m.id) ? "bg-indigo-50/50 dark:bg-indigo-900/10" : ""}`}>
                      {activeTab === "identificada" && (
                        <td className="px-4 py-4">
                          <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-indigo-600 cursor-pointer"
                            checked={selectedIds.has(m.id)}
                            onChange={e => {
                              const s = new Set(selectedIds);
                              e.target.checked ? s.add(m.id) : s.delete(m.id);
                              setSelectedIds(s);
                            }} />
                        </td>
                      )}
                      <td className="px-6 py-4 font-mono font-bold text-sm text-gray-900 dark:text-white uppercase">{m.placa}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800">
                          {getProjeto(m.placa)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                        {m.locadora ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                            {m.locadora}
                          </span>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-6 py-4 font-mono text-sm text-gray-600 dark:text-gray-300">{m.auto_infracao}</td>
                      <td className="px-6 py-4 text-sm font-black text-rose-600 dark:text-rose-400 whitespace-nowrap">
                        {m.valor_multa ? formatCurrency(m.valor_multa) : <span className="text-gray-400 font-normal">—</span>}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-200">
                        {m.condutor_identificado ? (
                          <span className="flex items-center gap-1">
                            <UserIcon className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                            {m.condutor_identificado}
                          </span>
                        ) : <span className="text-gray-400 text-xs">Não identificado</span>}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-gray-700 dark:text-gray-200">{renderStatusPrazo(m.prazo_indicacao_condutor)}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 font-bold">{m.gestor_cobrado || "—"}</td>
                      {activeTab === "sem_assinatura" && (
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 max-w-[200px]">
                          <span className="truncate block" title={m.observacao_retorno || ""}>{m.observacao_retorno || "—"}</span>
                        </td>
                      )}
                      <td className="px-6 py-4">
                        {m.arquivos_iniciais?.length > 0 ? (
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
                        {m.arquivos_retorno?.length > 0 ? (
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
                          <div className="flex items-center gap-2 flex-wrap">
                            <button onClick={() => openIdentifyModal(m)} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors">Identificar / Retorno</button>
                            <button onClick={() => markSemAssinatura(m)} className="text-xs font-bold text-amber-600 hover:text-amber-800 bg-amber-50 px-3 py-1.5 rounded-lg transition-colors">Sem Assinatura</button>
                            <button onClick={() => openFullEditModal(m)} className="p-1.5 text-gray-400 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"><PencilIcon className="w-4 h-4" /></button>
                            <button onClick={() => deleteMulta(m.id)} className="p-1.5 text-gray-400 hover:text-red-600 bg-gray-100 hover:bg-red-50 rounded-lg transition-colors"><TrashIcon className="w-4 h-4" /></button>
                          </div>
                        )}
                        {m.status === "identificada" && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-emerald-500 bg-emerald-50 px-3 py-1.5 rounded-lg">Pronta p/ RH</span>
                            <button onClick={() => revertStatus(m)} className="text-gray-400 hover:text-rose-500 transition-colors"><ArrowPathIcon className="w-4 h-4" /></button>
                            <button onClick={() => openFullEditModal(m)} className="p-1.5 text-gray-400 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"><PencilIcon className="w-4 h-4" /></button>
                            <button onClick={() => deleteMulta(m.id)} className="p-1.5 text-gray-400 hover:text-red-600 bg-gray-100 hover:bg-red-50 rounded-lg transition-colors"><TrashIcon className="w-4 h-4" /></button>
                          </div>
                        )}
                        {m.status === "sem_assinatura" && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-amber-500 bg-amber-50 px-3 py-1.5 rounded-lg">Sem Assinatura</span>
                            <button onClick={() => revertStatus(m)} className="text-gray-400 hover:text-rose-500 transition-colors"><ArrowPathIcon className="w-4 h-4" /></button>
                            <button onClick={() => openFullEditModal(m)} className="p-1.5 text-gray-400 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"><PencilIcon className="w-4 h-4" /></button>
                            <button onClick={() => deleteMulta(m.id)} className="p-1.5 text-gray-400 hover:text-red-600 bg-gray-100 hover:bg-red-50 rounded-lg transition-colors"><TrashIcon className="w-4 h-4" /></button>
                          </div>
                        )}
                        {m.status === "enviada_rh" && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg">Enviada em {m.data_enviada_rh ? new Date(m.data_enviada_rh).toLocaleDateString() : ""}</span>
                            <button onClick={() => revertStatus(m)} className="text-gray-400 hover:text-rose-500 transition-colors"><ArrowPathIcon className="w-4 h-4" /></button>
                            <button onClick={() => openFullEditModal(m)} className="p-1.5 text-gray-400 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"><PencilIcon className="w-4 h-4" /></button>
                            <button onClick={() => deleteMulta(m.id)} className="p-1.5 text-gray-400 hover:text-red-600 bg-gray-100 hover:bg-red-50 rounded-lg transition-colors"><TrashIcon className="w-4 h-4" /></button>
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
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-[2rem] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between px-7 py-5 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
              <h2 className="text-xl font-black text-gray-900 dark:text-white">
                {modalMode === "identify" ? "Identificar / Retorno" : modalMode === "edit" ? "Editar Multa" : "Nova Multa"}
              </h2>
              <button onClick={() => setModalOpen(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl"><XMarkIcon className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSave} className="p-7 space-y-5">
              {modalMode === "new" ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Placa</label>
                      <input type="text" required value={placa} onChange={e => setPlaca(e.target.value)} className={inputCls} placeholder="ABC1234" />
                      {placa && <p className="text-[10px] text-green-600 font-bold mt-1">Projeto: {getProjeto(placa)}</p>}
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Auto da Infração</label>
                      <input type="text" required value={autoInfracao} onChange={e => setAutoInfracao(e.target.value)} className={inputCls} placeholder="Nº do Auto" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Valor da Multa (R$)</label>
                      <input type="number" step="0.01" min="0" value={valorMulta} onChange={e => setValorMulta(e.target.value)} className={inputCls} placeholder="0,00" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Prazo Indicação Condutor</label>
                      <input type="date" value={prazoIndicacao} onChange={e => setPrazoIndicacao(e.target.value)} className={inputCls} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Condutor (se já identificado)</label>
                      <input type="text" value={condutorIdentificado} onChange={e => setCondutorIdentificado(e.target.value)} className={inputCls} placeholder="Nome do condutor" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Gestor Responsável</label>
                      <input type="text" value={gestor} onChange={e => setGestor(e.target.value)} className={inputCls} placeholder="Nome do Gestor" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Locadora</label>
                    <input type="text" value={locadora} onChange={e => setLocadora(e.target.value)} className={inputCls} placeholder="Ex: Unidas, Localiza, Movida..." />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Anexar Multa (PDF/Imagem)</label>
                    <label onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                      className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${isDragging ? "border-rose-500 bg-rose-50" : "border-gray-300 hover:bg-gray-50"}`}>
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <DocumentArrowUpIcon className={`w-6 h-6 mb-2 ${isDragging ? "text-rose-500" : "text-gray-400"}`} />
                        <p className="text-xs text-gray-500 font-bold">{filesToAdd.length > 0 ? `${filesToAdd.length} arquivo(s)` : "Arraste ou clique"}</p>
                      </div>
                      <input type="file" multiple className="hidden" onChange={e => setFilesToAdd(prev => {
                        const newFiles = Array.from(e.target.files || []);
                        const names = new Set(prev.map(f => f.name));
                        return [...prev, ...newFiles.filter(f => !names.has(f.name))];
                      })} />
                    </label>
                  </div>
                </>
              ) : modalMode === "identify" ? (
                <>
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 mb-4 flex gap-4 items-center">
                    <div><p className="text-[10px] text-gray-500 font-black uppercase">Placa</p><p className="font-bold text-gray-900 dark:text-white">{placa}</p></div>
                    <div><p className="text-[10px] text-gray-500 font-black uppercase">Projeto</p><p className="font-bold text-green-600">{getProjeto(placa)}</p></div>
                    <div><p className="text-[10px] text-gray-500 font-black uppercase">Auto</p><p className="font-bold text-gray-900 dark:text-white">{autoInfracao}</p></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Condutor Identificado <span className="text-rose-400">*</span></label>
                      <input type="text" required value={condutorIdentificado} onChange={e => setCondutorIdentificado(e.target.value)} className={inputCls} placeholder="Nome do condutor" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Valor da Multa (R$)</label>
                      <input type="number" step="0.01" min="0" value={valorMulta} onChange={e => setValorMulta(e.target.value)} className={inputCls} placeholder="0,00" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Gestor Responsável</label>
                    <input type="text" value={gestor} onChange={e => setGestor(e.target.value)} className={inputCls} placeholder="Nome do Gestor" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Observações do Retorno</label>
                    <textarea value={obs} onChange={e => setObs(e.target.value)} rows={2} className={inputCls + " resize-none"} placeholder="Ex: Condutor já foi identificado e assinou..." />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Anexos de Retorno Atuais</label>
                    {existingRetorno.length > 0 ? (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {existingRetorno.map((path, idx) => (
                          <div key={idx} className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700">
                            <button type="button" onClick={() => getPublicUrlAndOpen(path)} className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"><DocumentIcon className="w-3 h-3" /> Ver {idx + 1}</button>
                            <button type="button" onClick={() => setExistingRetorno(prev => prev.filter((_, i) => i !== idx))} className="text-gray-400 hover:text-red-500 ml-1"><XMarkIcon className="w-4 h-4" /></button>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-xs text-gray-400 mb-2">Nenhum anexo salvo.</p>}
                    <label onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                      className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${isDragging ? "border-indigo-500 bg-indigo-50" : "border-gray-300 hover:bg-gray-50"}`}>
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <DocumentArrowUpIcon className={`w-6 h-6 mb-2 ${isDragging ? "text-indigo-500" : "text-gray-400"}`} />
                        <p className="text-xs text-gray-500 font-bold">{filesToAdd.length > 0 ? `${filesToAdd.length} arquivo(s)` : "Arraste ou clique"}</p>
                      </div>
                      <input type="file" multiple className="hidden" onChange={e => setFilesToAdd(prev => {
                        const newFiles = Array.from(e.target.files || []);
                        const names = new Set(prev.map(f => f.name));
                        return [...prev, ...newFiles.filter(f => !names.has(f.name))];
                      })} />
                    </label>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Placa</label>
                      <input type="text" required value={placa} onChange={e => setPlaca(e.target.value)} className={inputCls + " uppercase"} placeholder="ABC1234" />
                      {placa && <p className="text-[10px] text-green-600 font-bold mt-1">Projeto: {getProjeto(placa)}</p>}
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Auto da Infração</label>
                      <input type="text" required value={autoInfracao} onChange={e => setAutoInfracao(e.target.value)} className={inputCls} placeholder="Nº do Auto" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Valor da Multa (R$)</label>
                      <input type="number" step="0.01" min="0" value={valorMulta} onChange={e => setValorMulta(e.target.value)} className={inputCls} placeholder="0,00" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Prazo Indicação Condutor</label>
                      <input type="date" value={prazoIndicacao} onChange={e => setPrazoIndicacao(e.target.value)} className={inputCls} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Condutor Identificado</label>
                      <input type="text" value={condutorIdentificado} onChange={e => setCondutorIdentificado(e.target.value)} className={inputCls} placeholder="Nome do condutor" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Gestor Responsável</label>
                      <input type="text" value={gestor} onChange={e => setGestor(e.target.value)} className={inputCls} placeholder="Nome do Gestor" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Observações</label>
                    <textarea value={obs} onChange={e => setObs(e.target.value)} rows={2} className={inputCls + " resize-none"} placeholder="Observações..." />
                  </div>
                  {/* Anexos Iniciais */}
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Anexos Iniciais</label>
                    {existingIniciais.length > 0 ? (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {existingIniciais.map((path, idx) => (
                          <div key={idx} className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700">
                            <button type="button" onClick={() => getPublicUrlAndOpen(path)} className="text-xs font-bold text-rose-600 flex items-center gap-1"><DocumentIcon className="w-3 h-3" /> Ver {idx + 1}</button>
                            <button type="button" onClick={() => setExistingIniciais(prev => prev.filter((_, i) => i !== idx))} className="text-gray-400 hover:text-red-500 ml-1"><XMarkIcon className="w-4 h-4" /></button>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-xs text-gray-400 mb-2">Nenhum.</p>}
                    <label onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                      className={`flex flex-col items-center justify-center w-full h-20 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${isDragging ? "border-rose-500 bg-rose-50" : "border-gray-300 hover:bg-gray-50"}`}>
                      <div className="flex flex-col items-center justify-center py-3">
                        <DocumentArrowUpIcon className={`w-5 h-5 mb-1 ${isDragging ? "text-rose-500" : "text-gray-400"}`} />
                        <p className="text-xs text-gray-500 font-bold">{filesToAdd.length > 0 ? `${filesToAdd.length} novo(s)` : "Arraste ou clique"}</p>
                      </div>
                      <input type="file" multiple className="hidden" onChange={e => setFilesToAdd(prev => {
                        const newFiles = Array.from(e.target.files || []);
                        const names = new Set(prev.map(f => f.name));
                        return [...prev, ...newFiles.filter(f => !names.has(f.name))];
                      })} />
                    </label>
                  </div>
                  {/* Anexos Retorno */}
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Anexos de Retorno</label>
                    {existingRetorno.length > 0 ? (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {existingRetorno.map((path, idx) => (
                          <div key={idx} className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700">
                            <button type="button" onClick={() => getPublicUrlAndOpen(path)} className="text-xs font-bold text-indigo-600 flex items-center gap-1"><DocumentIcon className="w-3 h-3" /> Ver {idx + 1}</button>
                            <button type="button" onClick={() => setExistingRetorno(prev => prev.filter((_, i) => i !== idx))} className="text-gray-400 hover:text-red-500 ml-1"><XMarkIcon className="w-4 h-4" /></button>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-xs text-gray-400 mb-2">Nenhum.</p>}
                    <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed rounded-xl cursor-pointer border-gray-300 hover:bg-gray-50">
                      <div className="flex flex-col items-center justify-center py-3">
                        <DocumentArrowUpIcon className="w-5 h-5 mb-1 text-gray-400" />
                        <p className="text-xs text-gray-500 font-bold">{filesToAddRetorno.length > 0 ? `${filesToAddRetorno.length} novo(s)` : "Arraste ou clique"}</p>
                      </div>
                      <input type="file" multiple className="hidden" onChange={e => setFilesToAddRetorno(prev => {
                        const newFiles = Array.from(e.target.files || []);
                        const names = new Set(prev.map(f => f.name));
                        return [...prev, ...newFiles.filter(f => !names.has(f.name))];
                      })} />
                    </label>
                  </div>
                </>
              )}

              <button type="submit" disabled={isSaving} className="w-full bg-rose-600 hover:bg-rose-700 text-white font-black py-3 rounded-xl shadow-lg transition-all flex justify-center items-center gap-2">
                {isSaving ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <CheckCircleIcon className="w-5 h-5" />}
                {modalMode === "identify" ? "Salvar Identificação" : modalMode === "edit" ? "Salvar Edição" : "Registrar Multa"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
