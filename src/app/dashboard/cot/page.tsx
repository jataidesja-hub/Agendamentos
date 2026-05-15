"use client";

import { useState, useEffect, useMemo } from "react";
import {
  PlusIcon,
  XMarkIcon,
  PencilSquareIcon,
  TrashIcon,
  FunnelIcon,
  ArrowPathIcon,
  CalendarDaysIcon,
  DocumentTextIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PlayIcon,
} from "@heroicons/react/24/outline";
import { CheckIcon } from "@heroicons/react/24/solid";
import { toast } from "react-hot-toast";
import { supabase } from "@/lib/supabase";

type TipoAtividade = "diaria" | "continua";
type StatusDiaria = "iniciada" | "em_execucao" | "interrompida" | "concluida";
type StatusContinua = "iniciada" | "em_execucao" | "concluida";
type StatusTarefa = StatusDiaria | StatusContinua;

interface CotTarefa {
  id: string;
  nome_projeto: string;
  atividade: string;
  numero_documento: string | null;
  observacao: string | null;
  data_fim: string | null;
  tipo_atividade: TipoAtividade;
  status: StatusTarefa;
  created_at: string;
  updated_at: string;
}

const STATUS_DIARIA: { id: StatusDiaria; label: string; badge: string; dot: string; icon: any }[] = [
  { id: "iniciada",     label: "Iniciada",     badge: "bg-sky-500/15 text-sky-400 border-sky-500/30",          dot: "bg-sky-400",     icon: PlayIcon },
  { id: "em_execucao",  label: "Em execução",  badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",    dot: "bg-amber-400",   icon: ClockIcon },
  { id: "interrompida", label: "Interrompida", badge: "bg-rose-500/15 text-rose-400 border-rose-500/30",       dot: "bg-rose-400",    icon: ExclamationTriangleIcon },
  { id: "concluida",    label: "Concluída",    badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", dot: "bg-emerald-400", icon: CheckCircleIcon },
];

const STATUS_CONTINUA: { id: StatusContinua; label: string; badge: string; dot: string; icon: any }[] = [
  { id: "iniciada",    label: "Iniciada",    badge: "bg-sky-500/15 text-sky-400 border-sky-500/30",           dot: "bg-sky-400",     icon: PlayIcon },
  { id: "em_execucao", label: "Em execução", badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",     dot: "bg-amber-400",   icon: ClockIcon },
  { id: "concluida",   label: "Concluída",   badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", dot: "bg-emerald-400", icon: CheckCircleIcon },
];

function getStatusList(tipo: TipoAtividade) {
  return tipo === "diaria" ? STATUS_DIARIA : STATUS_CONTINUA;
}

function getStatusInfo(tipo: TipoAtividade, status: StatusTarefa) {
  return getStatusList(tipo).find(s => s.id === status) ?? getStatusList(tipo)[0];
}

const TIPO_COLORS = {
  diaria:   "bg-orange-500/15 text-orange-400 border-orange-500/30",
  continua: "bg-teal-500/15 text-teal-400 border-teal-500/30",
};

const TIPO_LABELS = { diaria: "Diária", continua: "Contínua" };

const EMPTY_FORM = {
  nome_projeto: "",
  atividade: "",
  numero_documento: "",
  observacao: "",
  data_fim: "",
  status: "iniciada" as StatusTarefa,
};

export default function CotPage() {
  const [tarefas, setTarefas] = useState<CotTarefa[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modalStep, setModalStep] = useState<0 | 1 | 2>(0); // 0=fechado, 1=escolher tipo, 2=form
  const [tipoSelecionado, setTipoSelecionado] = useState<TipoAtividade>("diaria");
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [openStatusId, setOpenStatusId] = useState<string | null>(null);

  // Filtros
  const [filtroTipo, setFiltroTipo] = useState<TipoAtividade | "todos">("todos");
  const [filtroStatus, setFiltroStatus] = useState<StatusTarefa | "todos">("todos");

  useEffect(() => {
    const fechar = () => setOpenStatusId(null);
    document.addEventListener("click", fechar);
    return () => document.removeEventListener("click", fechar);
  }, []);

  useEffect(() => {
    loadTarefas();
    const channel = supabase
      .channel("realtime_cot")
      .on("postgres_changes", { event: "*", schema: "public", table: "cot_tarefas" }, () => loadTarefas(true))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadTarefas = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data, error } = await supabase
        .from("cot_tarefas")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      setTarefas(data || []);
    } catch {
      toast.error("Erro ao carregar tarefas.");
    } finally {
      setLoading(false);
    }
  };

  const abrirNova = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setModalStep(1);
  };

  const abrirEdicao = (t: CotTarefa) => {
    setEditId(t.id);
    setTipoSelecionado(t.tipo_atividade);
    setForm({
      nome_projeto: t.nome_projeto,
      atividade: t.atividade,
      numero_documento: t.numero_documento ?? "",
      observacao: t.observacao ?? "",
      data_fim: t.data_fim ?? "",
      status: t.status,
    });
    setModalStep(2);
  };

  const confirmarTipo = (tipo: TipoAtividade) => {
    setTipoSelecionado(tipo);
    setForm(prev => ({ ...prev, status: "iniciada" }));
    setModalStep(2);
  };

  const fecharModal = () => {
    setModalStep(0);
    setEditId(null);
    setForm(EMPTY_FORM);
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome_projeto.trim() || !form.atividade.trim()) {
      toast.error("Projeto e Atividade são obrigatórios.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        nome_projeto: form.nome_projeto.trim(),
        atividade: form.atividade.trim(),
        numero_documento: form.numero_documento.trim() || null,
        observacao: form.observacao.trim() || null,
        data_fim: form.data_fim || null,
        tipo_atividade: tipoSelecionado,
        status: form.status,
        updated_at: new Date().toISOString(),
      };
      if (editId) {
        const { error } = await supabase.from("cot_tarefas").update(payload).eq("id", editId);
        if (error) throw error;
        toast.success("Tarefa atualizada!");
      } else {
        const { error } = await supabase.from("cot_tarefas").insert(payload);
        if (error) throw error;
        toast.success("Tarefa criada!");
      }
      fecharModal();
      loadTarefas();
    } catch {
      toast.error("Erro ao salvar tarefa.");
    } finally {
      setSaving(false);
    }
  };

  const excluir = async (id: string) => {
    if (!window.confirm("Deseja excluir esta tarefa?")) return;
    try {
      const { error } = await supabase.from("cot_tarefas").delete().eq("id", id);
      if (error) throw error;
      toast.success("Tarefa excluída!");
      loadTarefas();
    } catch {
      toast.error("Erro ao excluir.");
    }
  };

  const alterarStatus = async (id: string, tipo: TipoAtividade, novoStatus: StatusTarefa) => {
    try {
      const { error } = await supabase
        .from("cot_tarefas")
        .update({ status: novoStatus, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      setTarefas(prev => prev.map(t => t.id === id ? { ...t, status: novoStatus } : t));
    } catch {
      toast.error("Erro ao atualizar status.");
    }
  };

  const tarefasFiltradas = useMemo(() => {
    return tarefas.filter(t => {
      if (filtroTipo !== "todos" && t.tipo_atividade !== filtroTipo) return false;
      if (filtroStatus !== "todos" && t.status !== filtroStatus) return false;
      return true;
    });
  }, [tarefas, filtroTipo, filtroStatus]);

  const totais = useMemo(() => ({
    total: tarefas.length,
    diarias: tarefas.filter(t => t.tipo_atividade === "diaria").length,
    continuas: tarefas.filter(t => t.tipo_atividade === "continua").length,
    concluidas: tarefas.filter(t => t.status === "concluida").length,
  }), [tarefas]);

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  };

  const statusOptions = tipoSelecionado === "diaria" ? STATUS_DIARIA : STATUS_CONTINUA;

  return (
    <div className="h-full flex flex-col px-4 md:px-8 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 mt-8 gap-4">
        <div>
          <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter">COT – Tarefas</h1>
          <p className="text-gray-500 text-sm mt-1 font-medium">
            Controle de atividades diárias e contínuas •{" "}
            <span className="text-[#0b7336] font-bold">{totais.total}</span> tarefas
          </p>
        </div>
        <div className="flex gap-3 flex-wrap items-center">
          <button
            onClick={() => loadTarefas()}
            className="p-3 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-2xl border border-gray-100 dark:border-gray-700 hover:bg-gray-50 transition-all shadow-sm"
            title="Atualizar"
          >
            <ArrowPathIcon className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={abrirNova}
            className="flex items-center gap-2 px-6 py-3 bg-[#0b7336] text-white rounded-2xl font-bold text-sm hover:bg-[#075a2a] transition-all shadow-xl"
          >
            <PlusIcon className="w-5 h-5" />
            Nova Tarefa
          </button>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total", value: totais.total, color: "text-gray-700 dark:text-gray-200", bg: "bg-white dark:bg-gray-800" },
          { label: "Diárias", value: totais.diarias, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-500/10" },
          { label: "Contínuas", value: totais.continuas, color: "text-teal-600 dark:text-teal-400", bg: "bg-teal-50 dark:bg-teal-500/10" },
          { label: "Concluídas", value: totais.concluidas, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
        ].map(c => (
          <div key={c.label} className={`${c.bg} rounded-2xl px-5 py-4 border border-gray-100 dark:border-gray-700 shadow-sm`}>
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">{c.label}</p>
            <p className={`text-3xl font-black mt-1 ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-5 items-center">
        <FunnelIcon className="w-4 h-4 text-gray-400" />
        <div className="flex gap-1.5 bg-white dark:bg-gray-800 rounded-xl p-1 border border-gray-100 dark:border-gray-700">
          {(["todos", "diaria", "continua"] as const).map(v => (
            <button key={v}
              onClick={() => setFiltroTipo(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filtroTipo === v ? "bg-[#0b7336] text-white shadow" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}
            >
              {v === "todos" ? "Todos" : v === "diaria" ? "Diárias" : "Contínuas"}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 bg-white dark:bg-gray-800 rounded-xl p-1 border border-gray-100 dark:border-gray-700">
          {(["todos", "iniciada", "em_execucao", "interrompida", "concluida"] as const).map(v => (
            <button key={v}
              onClick={() => setFiltroStatus(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filtroStatus === v ? "bg-[#0b7336] text-white shadow" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}
            >
              {v === "todos" ? "Todos" : v === "em_execucao" ? "Em execução" : v === "iniciada" ? "Iniciada" : v === "interrompida" ? "Interrompida" : "Concluída"}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela de tarefas */}
      <div className="flex-1 bg-white dark:bg-gray-900 rounded-[1.5rem] border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <ArrowPathIcon className="w-8 h-8 text-[#0b7336] animate-spin" />
          </div>
        ) : tarefasFiltradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-400">
            <DocumentTextIcon className="w-12 h-12" />
            <p className="font-bold">Nenhuma tarefa encontrada</p>
            <p className="text-sm">Clique em "Nova Tarefa" para começar</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  {[
                    { label: "Tipo",         align: "text-center" },
                    { label: "Projeto",      align: "text-left" },
                    { label: "Atividade",    align: "text-left" },
                    { label: "Nº Documento", align: "text-center" },
                    { label: "Data Fim",     align: "text-center" },
                    { label: "Status",       align: "text-center" },
                    { label: "Obs.",         align: "text-left" },
                    { label: "Ações",        align: "text-center" },
                  ].map(h => (
                    <th key={h.label} className={`${h.align} px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap`}>
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tarefasFiltradas.map(t => {
                  const statusInfo = getStatusInfo(t.tipo_atividade, t.status);
                  const StatusIcon = statusInfo.icon;
                  return (
                    <tr key={t.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50/40 dark:hover:bg-gray-800/30 transition-colors group">
                      <td className="px-5 py-5 text-center align-middle">
                        <span className={`text-[10px] font-black px-2.5 py-1.5 rounded-full border ${TIPO_COLORS[t.tipo_atividade]}`}>
                          {TIPO_LABELS[t.tipo_atividade]}
                        </span>
                      </td>
                      <td className="px-5 py-5 align-middle">
                        <p className="text-sm font-bold text-gray-800 dark:text-white min-w-[120px]">
                          {t.nome_projeto}
                        </p>
                      </td>
                      <td className="px-5 py-5 align-top">
                        <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap break-words min-w-[200px] max-w-[340px] leading-relaxed">
                          {t.atividade}
                        </p>
                      </td>
                      <td className="px-5 py-5 text-center align-middle">
                        <p className="text-sm text-gray-400 dark:text-gray-400 font-mono">
                          {t.numero_documento || "—"}
                        </p>
                      </td>
                      <td className="px-5 py-5 text-center align-middle whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5 text-sm text-gray-400 dark:text-gray-400">
                          <CalendarDaysIcon className="w-4 h-4" />
                          {formatDate(t.data_fim)}
                        </div>
                      </td>
                      {/* Status — dropdown customizado */}
                      <td className="px-5 py-5 text-center align-middle">
                        <div className="relative inline-block">
                          <button
                            onClick={(e) => { e.stopPropagation(); setOpenStatusId(openStatusId === t.id ? null : t.id); }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border font-black text-[10px] transition-all hover:opacity-80 ${statusInfo.badge}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot} flex-shrink-0`} />
                            {statusInfo.label}
                            <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                          </button>
                          {openStatusId === t.id && (
                            <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 z-50 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-1.5 min-w-[150px]" onClick={e => e.stopPropagation()}>
                              {getStatusList(t.tipo_atividade).map(s => (
                                <button
                                  key={s.id}
                                  onClick={() => { alterarStatus(t.id, t.tipo_atividade, s.id); setOpenStatusId(null); }}
                                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold transition-all hover:bg-gray-800 ${t.status === s.id ? s.badge : "text-gray-400"}`}
                                >
                                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
                                  {s.label}
                                  {t.status === s.id && <CheckIcon className="w-3 h-3 ml-auto" />}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-5 align-top max-w-[220px]">
                        {t.observacao ? (
                          <p className="text-xs text-gray-400 dark:text-gray-400 whitespace-pre-wrap break-words hover:text-gray-200 transition-colors cursor-default leading-relaxed">
                            {t.observacao}
                          </p>
                        ) : (
                          <span className="text-gray-600 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-5 py-5 text-center align-middle">
                        <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => abrirEdicao(t)}
                            className="p-1.5 text-gray-400 hover:text-[#0b7336] hover:bg-green-50 dark:hover:bg-green-500/10 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <PencilSquareIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => excluir(t.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Excluir"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── MODAL ─────────────────────────────────────────────────────── */}
      {modalStep > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-[2rem] shadow-2xl w-full max-w-lg border border-gray-100 dark:border-gray-800 overflow-hidden">

            {/* Header do modal */}
            <div className="flex items-center justify-between px-7 pt-7 pb-5">
              <div>
                <h2 className="text-xl font-black text-gray-900 dark:text-white">
                  {modalStep === 1 ? "Tipo de Atividade" : editId ? "Editar Tarefa" : "Nova Tarefa"}
                </h2>
                {modalStep === 2 && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${TIPO_COLORS[tipoSelecionado]}`}>
                      {TIPO_LABELS[tipoSelecionado]}
                    </span>
                    {!editId && (
                      <button onClick={() => setModalStep(1)} className="text-xs text-gray-400 hover:text-gray-600 underline">
                        alterar tipo
                      </button>
                    )}
                  </div>
                )}
              </div>
              <button onClick={fecharModal} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Step 1: escolher tipo */}
            {modalStep === 1 && (
              <div className="px-7 pb-7 grid grid-cols-2 gap-4">
                <button
                  onClick={() => confirmarTipo("diaria")}
                  className="flex flex-col items-center gap-4 p-6 rounded-2xl border-2 border-orange-200 dark:border-orange-500/30 bg-orange-50 dark:bg-orange-500/10 hover:border-orange-400 dark:hover:border-orange-500/60 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <div className="w-14 h-14 rounded-2xl bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/30">
                    <CalendarDaysIcon className="w-7 h-7 text-white" />
                  </div>
                  <div className="text-center">
                    <p className="font-black text-orange-700 dark:text-orange-400 text-base">Diária</p>
                    <p className="text-xs text-orange-500/70 dark:text-orange-400/60 mt-1 leading-tight">
                      Iniciada · Em execução<br />Interrompida · Concluída
                    </p>
                  </div>
                </button>
                <button
                  onClick={() => confirmarTipo("continua")}
                  className="flex flex-col items-center gap-4 p-6 rounded-2xl border-2 border-teal-200 dark:border-teal-500/30 bg-teal-50 dark:bg-teal-500/10 hover:border-teal-400 dark:hover:border-teal-500/60 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <div className="w-14 h-14 rounded-2xl bg-teal-600 flex items-center justify-center shadow-lg shadow-teal-500/30">
                    <ArrowPathIcon className="w-7 h-7 text-white" />
                  </div>
                  <div className="text-center">
                    <p className="font-black text-teal-700 dark:text-teal-400 text-base">Contínua</p>
                    <p className="text-xs text-teal-500/70 dark:text-teal-400/60 mt-1 leading-tight">
                      Iniciada · Em execução<br />Concluída
                    </p>
                  </div>
                </button>
              </div>
            )}

            {/* Step 2: formulário */}
            {modalStep === 2 && (
              <form onSubmit={salvar} className="px-7 pb-7 space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">
                      Projeto <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.nome_projeto}
                      onChange={e => setForm(p => ({ ...p, nome_projeto: e.target.value }))}
                      placeholder="Nome do projeto..."
                      required
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-[#0b7336] focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">
                      Atividade <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.atividade}
                      onChange={e => setForm(p => ({ ...p, atividade: e.target.value }))}
                      placeholder="Descrição da atividade..."
                      required
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-[#0b7336] focus:border-transparent transition-all"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Nº Documento</label>
                      <input
                        type="text"
                        value={form.numero_documento}
                        onChange={e => setForm(p => ({ ...p, numero_documento: e.target.value }))}
                        placeholder="Ex: DOC-2026-001"
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-[#0b7336] focus:border-transparent transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Data de Fim</label>
                      <input
                        type="date"
                        value={form.data_fim}
                        onChange={e => setForm(p => ({ ...p, data_fim: e.target.value }))}
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-[#0b7336] focus:border-transparent transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Status</label>
                    <div className="grid grid-cols-2 gap-2">
                      {statusOptions.map(s => {
                        const SIcon = s.icon;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setForm(p => ({ ...p, status: s.id }))}
                            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                              form.status === s.id
                                ? s.badge + " ring-2 ring-offset-1 dark:ring-offset-gray-900 ring-[#0b7336]"
                                : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
                            }`}
                          >
                            <SIcon className="w-4 h-4 flex-shrink-0" />
                            {s.label}
                            {form.status === s.id && <CheckIcon className="w-3.5 h-3.5 ml-auto flex-shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Observação</label>
                    <textarea
                      value={form.observacao}
                      onChange={e => setForm(p => ({ ...p, observacao: e.target.value }))}
                      placeholder="Observações adicionais..."
                      rows={3}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-[#0b7336] focus:border-transparent transition-all resize-none"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-3.5 bg-[#0b7336] disabled:opacity-50 text-white rounded-xl font-black text-sm hover:bg-[#075a2a] transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckIcon className="w-4 h-4" />
                  )}
                  {editId ? "Salvar Alterações" : "Criar Tarefa"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
