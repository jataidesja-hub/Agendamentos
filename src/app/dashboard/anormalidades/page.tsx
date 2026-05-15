"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  PlusIcon,
  XMarkIcon,
  PencilSquareIcon,
  TrashIcon,
  FunnelIcon,
  ArrowPathIcon,
  CalendarDaysIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  EnvelopeIcon,
  SignalIcon,
  ArchiveBoxIcon,
  ArrowLeftIcon,
  ClipboardDocumentIcon,
} from "@heroicons/react/24/outline";
import { CheckIcon } from "@heroicons/react/24/solid";
import { toast } from "react-hot-toast";
import { supabase } from "@/lib/supabase";

type StatusAnorm = "pendente" | "em_analise" | "normalizada";
type Registro = "registrada" | "nao_registrada";

interface Anormalidade {
  id: string;
  subestacao: string;
  concessao: string | null;
  ativo: string | null;
  descricao: string;
  data: string | null;
  status: StatusAnorm;
  registro: Registro;
  arquivada: boolean;
  created_at: string;
  updated_at: string;
}

const STATUS_LIST: { id: StatusAnorm; label: string; badge: string; dot: string; icon: any }[] = [
  { id: "pendente",    label: "Pendente",    badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",         dot: "bg-amber-400",   icon: ExclamationTriangleIcon },
  { id: "em_analise",  label: "Em análise",  badge: "bg-sky-500/15 text-sky-400 border-sky-500/30",               dot: "bg-sky-400",     icon: ClockIcon },
  { id: "normalizada", label: "Normalizada", badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",   dot: "bg-emerald-400", icon: CheckCircleIcon },
];

function getStatus(s: StatusAnorm) {
  return STATUS_LIST.find(x => x.id === s) ?? STATUS_LIST[0];
}

const EMPTY_FORM = {
  subestacao: "",
  concessao: "",
  ativo: "",
  descricao: "",
  data: "",
  status: "pendente" as StatusAnorm,
  registro: "nao_registrada" as Registro,
};

function formatDate(d: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

export default function AnormalidadesPage() {
  const [itens, setItens] = useState<Anormalidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [realtimePulse, setRealtimePulse] = useState(false);
  const [mostrarArquivados, setMostrarArquivados] = useState(false);

  // Seleção para relatório
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [modalEmail, setModalEmail] = useState(false);
  const [emailDest, setEmailDest] = useState("");
  const [emailCc, setEmailCc] = useState("");

  // Modal CRUD
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Dropdown status
  const [statusDropdown, setStatusDropdown] = useState<{ id: string; top: number; left: number } | null>(null);

  // Filtros
  const [filtroStatus, setFiltroStatus] = useState<StatusAnorm | "todos">("todos");
  const [filtroRegistro, setFiltroRegistro] = useState<Registro | "todos">("todos");

  const loadItens = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data, error } = await supabase
        .from("anormalidades").select("*").order("updated_at", { ascending: false });
      if (error) throw error;
      setItens(data || []);
    } catch { toast.error("Erro ao carregar anormalidades."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    loadItens();
    const channel = supabase
      .channel("realtime_anorm")
      .on("postgres_changes", { event: "*", schema: "public", table: "anormalidades" }, () => {
        setRealtimePulse(true);
        setTimeout(() => setRealtimePulse(false), 2000);
        loadItens(true);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadItens]);

  const { ativos, arquivados } = useMemo(() => {
    const base = itens.filter(i => {
      if (filtroStatus !== "todos" && i.status !== filtroStatus) return false;
      if (filtroRegistro !== "todos" && i.registro !== filtroRegistro) return false;
      return true;
    });
    const ativosList = base.filter(i => !i.arquivada)
      .sort((a, b) => {
        // Normalizadas vão para o fundo
        if (a.status === "normalizada" && b.status !== "normalizada") return 1;
        if (b.status === "normalizada" && a.status !== "normalizada") return -1;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });
    const arquivadosList = base.filter(i => i.arquivada)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    return { ativos: ativosList, arquivados: arquivadosList };
  }, [itens, filtroStatus, filtroRegistro]);

  const stats = useMemo(() => ({
    total:       itens.filter(i => !i.arquivada).length,
    pendentes:   itens.filter(i => !i.arquivada && i.status === "pendente").length,
    analise:     itens.filter(i => !i.arquivada && i.status === "em_analise").length,
    normalizadas:itens.filter(i => !i.arquivada && i.status === "normalizada").length,
    arquivadas:  itens.filter(i => i.arquivada).length,
  }), [itens]);

  const abrirNovo = () => { setEditId(null); setForm(EMPTY_FORM); setShowForm(true); };
  const abrirEdicao = (i: Anormalidade) => {
    setEditId(i.id);
    setForm({
      subestacao: i.subestacao,
      concessao: i.concessao ?? "",
      ativo: i.ativo ?? "",
      descricao: i.descricao,
      data: i.data ?? "",
      status: i.status,
      registro: i.registro ?? "nao_registrada",
    });
    setShowForm(true);
  };
  const fecharForm = () => { setShowForm(false); setEditId(null); setForm(EMPTY_FORM); };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subestacao.trim() || !form.descricao.trim()) {
      toast.error("Subestação e Descrição são obrigatórios."); return;
    }
    setSaving(true);
    try {
      const payload = {
        subestacao: form.subestacao.trim(),
        concessao: form.concessao.trim() || null,
        ativo: form.ativo.trim() || null,
        descricao: form.descricao.trim(),
        data: form.data || null,
        status: form.status,
        registro: form.registro,
        updated_at: new Date().toISOString(),
      };
      if (editId) {
        const { error } = await supabase.from("anormalidades").update(payload).eq("id", editId);
        if (error) throw error;
        toast.success("Anormalidade atualizada!");
      } else {
        const { error } = await supabase.from("anormalidades").insert(payload);
        if (error) throw error;
        toast.success("Anormalidade registrada!");
      }
      fecharForm(); loadItens();
    } catch { toast.error("Erro ao salvar."); }
    finally { setSaving(false); }
  };

  const excluir = async (id: string) => {
    if (!window.confirm("Deseja excluir esta anormalidade?")) return;
    try {
      const { error } = await supabase.from("anormalidades").delete().eq("id", id);
      if (error) throw error;
      toast.success("Excluída!"); loadItens();
    } catch { toast.error("Erro ao excluir."); }
  };

  const alterarStatus = async (id: string, novoStatus: StatusAnorm) => {
    try {
      const { error } = await supabase.from("anormalidades")
        .update({ status: novoStatus, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      setItens(prev => prev.map(i => i.id === id ? { ...i, status: novoStatus } : i));
    } catch { toast.error("Erro ao atualizar status."); }
  };

  const alterarRegistro = async (id: string, novo: Registro) => {
    try {
      const { error } = await supabase.from("anormalidades")
        .update({ registro: novo, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      setItens(prev => prev.map(i => i.id === id ? { ...i, registro: novo } : i));
    } catch { toast.error("Erro ao atualizar registro."); }
  };

  const arquivar = async (id: string) => {
    try {
      const { error } = await supabase.from("anormalidades")
        .update({ arquivada: true, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      toast.success("Arquivada!"); loadItens();
    } catch { toast.error("Erro ao arquivar."); }
  };

  // Seleção
  const toggleSelect = (id: string) => {
    setSelecionados(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleSelectAll = (lista: Anormalidade[]) => {
    const allIds = lista.map(i => i.id);
    const allSelected = allIds.every(id => selecionados.has(id));
    setSelecionados(prev => {
      const next = new Set(prev);
      allIds.forEach(id => allSelected ? next.delete(id) : next.add(id));
      return next;
    });
  };

  // Email report via mailto
  const itensSelecionados = useMemo(() =>
    itens.filter(i => selecionados.has(i.id)),
    [itens, selecionados]
  );

  const gerarCorpoEmail = () => {
    const now = new Date().toLocaleString("pt-BR");
    const linhas = itensSelecionados.map((i, idx) => {
      const s = getStatus(i.status);
      return [
        `${idx + 1}. SUBESTAÇÃO: ${i.subestacao}`,
        `   CONCESSÃO: ${i.concessao || "—"}`,
        `   ATIVO: ${i.ativo || "—"}`,
        `   DATA: ${formatDate(i.data)}`,
        `   STATUS: ${s.label}`,
        `   DESCRIÇÃO: ${i.descricao}`,
        `   REGISTRO: ${i.registro === "registrada" ? "Registrada" : "Não registrada"}`,
        "   ─────────────────────────────────────",
      ].join("\n");
    });
    return [
      `RELATÓRIO DE ANORMALIDADES`,
      `Gerado em: ${now}`,
      `Total de registros: ${itensSelecionados.length}`,
      `═══════════════════════════════════════`,
      "",
      ...linhas,
    ].join("\n");
  };

  const enviarEmail = () => {
    if (!emailDest.trim()) { toast.error("Informe o e-mail de destino."); return; }
    const assunto = encodeURIComponent(`Relatório de Anormalidades — ${new Date().toLocaleDateString("pt-BR")}`);
    const corpo = encodeURIComponent(gerarCorpoEmail());
    const cc = emailCc.trim() ? `&cc=${encodeURIComponent(emailCc.trim())}` : "";
    window.open(`mailto:${emailDest.trim()}?subject=${assunto}${cc}&body=${corpo}`);
  };

  const copiarRelatorio = () => {
    navigator.clipboard.writeText(gerarCorpoEmail())
      .then(() => toast.success("Relatório copiado!"))
      .catch(() => toast.error("Erro ao copiar."));
  };

  const inputCls = "w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all";

  const listaVisivel = mostrarArquivados ? arquivados : ativos;
  const colCount = 9;

  return (
    <div className="h-full flex flex-col px-4 md:px-8 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 mt-8 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter">Anormalidades</h1>
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest transition-all duration-500 ${
              realtimePulse
                ? "border-amber-500/50 bg-amber-500/15 text-amber-400 scale-105"
                : "border-gray-200 dark:border-gray-700 text-gray-400"
            }`}>
              <SignalIcon className={`w-3 h-3 ${realtimePulse ? "text-amber-400" : "text-gray-400"}`} />
              {realtimePulse ? "Atualizado" : "Ao vivo"}
            </div>
          </div>
          <p className="text-gray-500 text-sm mt-1 font-medium">Registro e controle de anormalidades operacionais</p>
        </div>
        <div className="flex gap-3 items-center">
          <button onClick={() => loadItens()}
            className="p-3 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-2xl border border-gray-100 dark:border-gray-700 hover:bg-gray-50 transition-all shadow-sm">
            <ArrowPathIcon className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
          </button>

          {selecionados.size > 0 && (
            <button onClick={() => setModalEmail(true)}
              className="flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-sm transition-all shadow-xl">
              <EnvelopeIcon className="w-5 h-5" />
              Enviar Relatório
              <span className="bg-white/20 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{selecionados.size}</span>
            </button>
          )}

          <button onClick={abrirNovo}
            className="flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-bold text-sm transition-all shadow-xl">
            <PlusIcon className="w-5 h-5" />
            Nova Anormalidade
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        {[
          { label: "Total",        value: stats.total,        color: "text-gray-700 dark:text-gray-200",  bg: "bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800" },
          { label: "Pendentes",    value: stats.pendentes,    color: "text-amber-500",                    bg: "bg-amber-500/8 border-amber-500/20" },
          { label: "Em análise",   value: stats.analise,      color: "text-sky-400",                      bg: "bg-sky-500/8 border-sky-500/20" },
          { label: "Normalizadas", value: stats.normalizadas, color: "text-emerald-400",                  bg: "bg-emerald-500/8 border-emerald-500/20" },
          { label: "Arquivadas",   value: stats.arquivadas,   color: "text-gray-400",                     bg: "bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800" },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl p-4 border ${s.bg} flex flex-col gap-1`}>
            <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">{s.label}</span>
            <span className={`text-3xl font-black ${s.color}`}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-4 items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center">
          <FunnelIcon className="w-4 h-4 text-gray-400" />
          <div className="flex gap-1 bg-white dark:bg-gray-800 rounded-xl p-1 border border-gray-100 dark:border-gray-700">
            {(["todos", "pendente", "em_analise", "normalizada"] as const).map(v => (
              <button key={v} onClick={() => setFiltroStatus(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filtroStatus === v ? "bg-amber-500 text-white shadow" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}>
                {v === "todos" ? "Todos" : v === "em_analise" ? "Em análise" : v === "pendente" ? "Pendente" : "Normalizada"}
              </button>
            ))}
          </div>
          <div className="flex gap-1 bg-white dark:bg-gray-800 rounded-xl p-1 border border-gray-100 dark:border-gray-700">
            {(["todos", "registrada", "nao_registrada"] as const).map(v => (
              <button key={v} onClick={() => setFiltroRegistro(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filtroRegistro === v ? "bg-indigo-600 text-white shadow" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}>
                {v === "todos" ? "Todos" : v === "registrada" ? "Registradas" : "Não registradas"}
              </button>
            ))}
          </div>
        </div>

        <button onClick={() => { setMostrarArquivados(v => !v); setSelecionados(new Set()); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold transition-all ${
            mostrarArquivados
              ? "border-gray-400 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200"
              : "border-gray-200 dark:border-gray-700 text-gray-400 hover:border-gray-300 hover:text-gray-600 dark:hover:border-gray-600"
          }`}>
          {mostrarArquivados ? <ArrowLeftIcon className="w-3.5 h-3.5" /> : <ArchiveBoxIcon className="w-3.5 h-3.5" />}
          {mostrarArquivados ? "Voltar" : "Arquivados"}
          {!mostrarArquivados && stats.arquivadas > 0 && (
            <span className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded-full text-[9px] font-black">
              {stats.arquivadas}
            </span>
          )}
        </button>
      </div>

      {/* Tabela */}
      <div className="flex-1 bg-white dark:bg-gray-900 rounded-[1.5rem] border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <ArrowPathIcon className="w-8 h-8 text-amber-500 animate-spin" />
          </div>
        ) : listaVisivel.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-400">
            <DocumentTextIcon className="w-12 h-12" />
            <p className="font-bold">{mostrarArquivados ? "Nenhuma anormalidade arquivada" : "Nenhuma anormalidade registrada"}</p>
            {!mostrarArquivados && <p className="text-sm">Clique em "Nova Anormalidade" para começar</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="px-4 py-4 w-10">
                    <input type="checkbox"
                      checked={listaVisivel.length > 0 && listaVisivel.every(i => selecionados.has(i.id))}
                      onChange={() => toggleSelectAll(listaVisivel)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                  </th>
                  {[
                    { label: "Subestação",  align: "text-left" },
                    { label: "Concessão",   align: "text-left" },
                    { label: "Ativo",       align: "text-left" },
                    { label: "Descrição",   align: "text-left" },
                    { label: "Data",        align: "text-center" },
                    { label: "Status",      align: "text-center" },
                    { label: "Registro",    align: "text-center" },
                    { label: "",            align: "text-right" },
                  ].map((h, i) => (
                    <th key={i} className={`${h.align} px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap`}>
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {listaVisivel.map(item => {
                  const st = getStatus(item.status);
                  const reg = item.registro ?? "nao_registrada";
                  const isNorm = item.status === "normalizada" && !item.arquivada;
                  const isSelected = selecionados.has(item.id);

                  return (
                    <tr key={item.id} className={`border-b border-gray-100 dark:border-gray-800 transition-colors group
                      ${isSelected ? "bg-indigo-500/[0.04] dark:bg-indigo-500/[0.06]" : isNorm ? "opacity-60 hover:opacity-80 bg-emerald-500/[0.02]" : "hover:bg-gray-50/40 dark:hover:bg-gray-800/30"}
                      ${item.arquivada ? "opacity-40 hover:opacity-60" : ""}
                    `}>
                      <td className="px-4 py-4 text-center align-middle">
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(item.id)}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <p className="text-sm font-black text-gray-800 dark:text-white whitespace-nowrap">{item.subestacao}</p>
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">{item.concessao || "—"}</p>
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">{item.ativo || "—"}</p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap break-words min-w-[200px] max-w-[350px] leading-relaxed">{item.descricao}</p>
                      </td>
                      <td className="px-4 py-4 text-center align-middle whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5 text-sm text-gray-400">
                          <CalendarDaysIcon className="w-4 h-4" />{formatDate(item.data)}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center align-middle">
                        {item.arquivada ? (
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border font-black text-[10px] ${st.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />{st.label}
                          </span>
                        ) : (
                          <button
                            onClick={(e) => {
                              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                              setStatusDropdown(statusDropdown?.id === item.id ? null : { id: item.id, top: rect.bottom + 6, left: rect.left + rect.width / 2 });
                            }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border font-black text-[10px] transition-all hover:opacity-80 ${st.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${st.dot} flex-shrink-0`} />
                            {st.label}
                            <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center align-middle">
                        {item.arquivada ? (
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border font-black text-[10px] ${reg === "registrada" ? "bg-indigo-500/15 text-indigo-400 border-indigo-500/30" : "bg-gray-500/10 text-gray-500 border-gray-500/20"}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${reg === "registrada" ? "bg-indigo-400" : "bg-gray-500"}`} />
                            {reg === "registrada" ? "Registrada" : "Não registrada"}
                          </span>
                        ) : (
                          <button onClick={() => alterarRegistro(item.id, reg === "registrada" ? "nao_registrada" : "registrada")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border font-black text-[10px] transition-all hover:opacity-80 ${
                              reg === "registrada"
                                ? "bg-indigo-500/15 text-indigo-400 border-indigo-500/30"
                                : "bg-gray-500/10 text-gray-400 border-gray-500/20 hover:border-indigo-500/30 hover:text-indigo-400"
                            }`}>
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${reg === "registrada" ? "bg-indigo-400" : "bg-gray-500"}`} />
                            {reg === "registrada" ? "Registrada" : "Não registrada"}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right align-middle">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!item.arquivada && (
                            <>
                              <button onClick={() => abrirEdicao(item)}
                                className="p-1.5 text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-lg transition-colors">
                                <PencilSquareIcon className="w-4 h-4" />
                              </button>
                              <button onClick={() => arquivar(item.id)} title="Arquivar"
                                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                                <ArchiveBoxIcon className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          <button onClick={() => excluir(item.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors">
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

      {/* Dropdown status */}
      {statusDropdown && (() => {
        const item = itens.find(x => x.id === statusDropdown.id);
        if (!item) return null;
        return (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setStatusDropdown(null)} />
            <div className="fixed z-50 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-1.5 min-w-[160px] -translate-x-1/2"
              style={{ top: statusDropdown.top, left: statusDropdown.left }}>
              {STATUS_LIST.map(s => (
                <button key={s.id}
                  onClick={() => { alterarStatus(item.id, s.id); setStatusDropdown(null); }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-[11px] font-bold transition-all hover:bg-gray-800 ${item.status === s.id ? s.badge : "text-gray-400 hover:text-gray-200"}`}>
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
                  {s.label}
                  {item.status === s.id && <CheckIcon className="w-3 h-3 ml-auto" />}
                </button>
              ))}
            </div>
          </>
        );
      })()}

      {/* Modal CRUD */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-[2rem] shadow-2xl w-full max-w-lg border border-gray-100 dark:border-gray-800 overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-7 pt-7 pb-5 sticky top-0 bg-white dark:bg-gray-900 z-10 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-xl font-black text-gray-900 dark:text-white">
                {editId ? "Editar Anormalidade" : "Nova Anormalidade"}
              </h2>
              <button onClick={fecharForm} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={salvar} className="px-7 pb-7 pt-5 space-y-4">
              {/* Subestação */}
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Subestação <span className="text-red-400">*</span></label>
                <input type="text" required value={form.subestacao} onChange={e => setForm(p => ({ ...p, subestacao: e.target.value }))}
                  placeholder="Nome da subestação..." className={inputCls} />
              </div>

              {/* Concessão + Ativo */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Concessão</label>
                  <input type="text" value={form.concessao} onChange={e => setForm(p => ({ ...p, concessao: e.target.value }))}
                    placeholder="Ex: CELG, CEMIG..." className={inputCls} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Ativo</label>
                  <input type="text" value={form.ativo} onChange={e => setForm(p => ({ ...p, ativo: e.target.value }))}
                    placeholder="Ex: Transformador T1..." className={inputCls} />
                </div>
              </div>

              {/* Descrição */}
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Descrição <span className="text-red-400">*</span></label>
                <textarea required rows={4} value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
                  placeholder="Descreva a anormalidade..." className={inputCls + " resize-none"} />
              </div>

              {/* Data */}
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Data</label>
                <input type="date" value={form.data} onChange={e => setForm(p => ({ ...p, data: e.target.value }))} className={inputCls} />
              </div>

              {/* Status */}
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Status</label>
                <div className="grid grid-cols-3 gap-2">
                  {STATUS_LIST.map(s => {
                    const SIcon = s.icon;
                    return (
                      <button key={s.id} type="button" onClick={() => setForm(p => ({ ...p, status: s.id }))}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                          form.status === s.id
                            ? s.badge + " ring-2 ring-offset-1 dark:ring-offset-gray-900 ring-amber-500"
                            : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300"
                        }`}>
                        <SIcon className="w-4 h-4 flex-shrink-0" />
                        {s.label}
                        {form.status === s.id && <CheckIcon className="w-3 h-3 ml-auto flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Registro */}
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Registro</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { id: "registrada",     label: "Registrada",     cls: "border-indigo-500 bg-indigo-500/10 text-indigo-400", dot: "bg-indigo-400" },
                    { id: "nao_registrada", label: "Não Registrada", cls: "border-gray-400 bg-gray-500/10 text-gray-400",       dot: "bg-gray-400" },
                  ] as { id: Registro; label: string; cls: string; dot: string }[]).map(r => (
                    <button key={r.id} type="button" onClick={() => setForm(p => ({ ...p, registro: r.id }))}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                        form.registro === r.id
                          ? r.cls + " ring-2 ring-offset-1 dark:ring-offset-gray-900 ring-amber-500"
                          : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300"
                      }`}>
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${form.registro === r.id ? r.dot : "bg-gray-400"}`} />
                      {r.label}
                      {form.registro === r.id && <CheckIcon className="w-3.5 h-3.5 ml-auto flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>

              <button type="submit" disabled={saving}
                className="w-full py-3.5 bg-amber-500 disabled:opacity-50 text-white rounded-xl font-black text-sm hover:bg-amber-600 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2">
                {saving ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <CheckIcon className="w-4 h-4" />}
                {editId ? "Salvar Alterações" : "Registrar Anormalidade"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Email */}
      {modalEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-[2rem] shadow-2xl w-full max-w-2xl border border-gray-100 dark:border-gray-800 overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-7 pt-7 pb-5 sticky top-0 bg-white dark:bg-gray-900 z-10 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h2 className="text-xl font-black text-gray-900 dark:text-white">Enviar Relatório</h2>
                <p className="text-sm text-gray-400 mt-0.5">{selecionados.size} anormalidade{selecionados.size > 1 ? "s" : ""} selecionada{selecionados.size > 1 ? "s" : ""}</p>
              </div>
              <button onClick={() => setModalEmail(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="px-7 pb-7 pt-5 space-y-5">
              {/* Campos de e-mail */}
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Para <span className="text-red-400">*</span></label>
                  <input type="email" value={emailDest} onChange={e => setEmailDest(e.target.value)}
                    placeholder="destinatario@email.com" className={inputCls} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">CC (opcional)</label>
                  <input type="email" value={emailCc} onChange={e => setEmailCc(e.target.value)}
                    placeholder="copia@email.com" className={inputCls} />
                </div>
              </div>

              {/* Preview */}
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Pré-visualização dos itens selecionados</label>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        {["Subestação", "Concessão", "Ativo", "Data", "Status"].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left text-[9px] font-black text-gray-400 uppercase tracking-widest">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {itensSelecionados.map(i => {
                        const st = getStatus(i.status);
                        return (
                          <tr key={i.id} className="border-b border-gray-100 dark:border-gray-700 last:border-0">
                            <td className="px-3 py-2.5 font-bold text-gray-800 dark:text-white">{i.subestacao}</td>
                            <td className="px-3 py-2.5 text-gray-500">{i.concessao || "—"}</td>
                            <td className="px-3 py-2.5 text-gray-500">{i.ativo || "—"}</td>
                            <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{formatDate(i.data)}</td>
                            <td className="px-3 py-2.5">
                              <span className={`px-2 py-0.5 rounded-full border text-[9px] font-black ${st.badge}`}>{st.label}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-gray-400 mt-2">* A descrição completa é incluída no corpo do e-mail.</p>
              </div>

              {/* Botões */}
              <div className="flex gap-3">
                <button onClick={copiarRelatorio}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-xl font-bold text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-all">
                  <ClipboardDocumentIcon className="w-4 h-4" />
                  Copiar relatório
                </button>
                <button onClick={enviarEmail}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg">
                  <EnvelopeIcon className="w-4 h-4" />
                  Abrir no e-mail
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
