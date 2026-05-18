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
  BoltIcon,
} from "@heroicons/react/24/outline";
import { CheckIcon } from "@heroicons/react/24/solid";
import { toast } from "react-hot-toast";
import { supabase } from "@/lib/supabase";

type TipoEvento = "indisponibilidade" | "anormalidade";
type StatusEvento = "pendente" | "em_analise" | "normalizada";
type Registro = "registrada" | "nao_registrada";

interface Evento {
  id: string;
  tipo: TipoEvento;
  subestacao: string;
  concessao: string | null;
  ativo: string | null;
  descricao: string;
  data: string | null;
  status: StatusEvento;
  registro: Registro;
  arquivada: boolean;
  last_modified_by: string | null;
  created_at: string;
  updated_at: string;
}

const TIPO_CONFIG: Record<TipoEvento, { label: string; color: string; activeColor: string; accent: string; statBg: string }> = {
  indisponibilidade: {
    label:       "INDISPONIBILIDADE",
    color:       "text-amber-400",
    activeColor: "border-amber-500 bg-amber-500/10",
    accent:      "bg-amber-500",
    statBg:      "bg-amber-500/8 border-amber-500/20",
  },
  anormalidade: {
    label:       "ANORMALIDADE",
    color:       "text-rose-400",
    activeColor: "border-rose-500 bg-rose-500/10",
    accent:      "bg-rose-500",
    statBg:      "bg-rose-500/8 border-rose-500/20",
  },
};

const STATUS_LIST: { id: StatusEvento; label: string; badge: string; dot: string; icon: any }[] = [
  { id: "pendente",    label: "Pendente",    badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",         dot: "bg-amber-400",   icon: ExclamationTriangleIcon },
  { id: "em_analise",  label: "Em análise",  badge: "bg-sky-500/15 text-sky-400 border-sky-500/30",               dot: "bg-sky-400",     icon: ClockIcon },
  { id: "normalizada", label: "Normalizada", badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",   dot: "bg-emerald-400", icon: CheckCircleIcon },
];

function getStatus(s: StatusEvento) {
  return STATUS_LIST.find(x => x.id === s) ?? STATUS_LIST[0];
}

const EMPTY_FORM = {
  tipo:        "indisponibilidade" as TipoEvento,
  subestacao:  "",
  concessao:   "",
  ativo:       "",
  descricao:   "",
  data:        "",
  status:      "pendente" as StatusEvento,
  registro:    "nao_registrada" as Registro,
};

function formatDate(d: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function StatsCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">{label}</span>
      <span className={`text-2xl font-black ${color}`}>{value}</span>
    </div>
  );
}

export default function GestaoEventosPage() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [tipoAtivo, setTipoAtivo] = useState<TipoEvento>("indisponibilidade");
  const [realtimePulse, setRealtimePulse] = useState(false);
  const [mostrarArquivados, setMostrarArquivados] = useState(false);

  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [modalEmail, setModalEmail] = useState(false);
  const [emailDest, setEmailDest] = useState("");
  const [emailCc, setEmailCc] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [statusDropdown, setStatusDropdown] = useState<{ id: string; top: number; left: number } | null>(null);
  const [userEmail, setUserEmail] = useState("");

  const [filtroStatus, setFiltroStatus] = useState<StatusEvento | "todos">("todos");

  const loadEventos = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data, error } = await supabase
        .from("anormalidades").select("*").order("updated_at", { ascending: false });
      if (error) throw error;
      setEventos((data || []).map((d: any) => ({ ...d, tipo: d.tipo ?? "anormalidade" })));
    } catch { toast.error("Erro ao carregar eventos."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session?.user?.email) setUserEmail(data.session.user.email);
    });
    loadEventos();
    const channel = supabase
      .channel("realtime_gestao_eventos")
      .on("postgres_changes", { event: "*", schema: "public", table: "anormalidades" }, () => {
        setRealtimePulse(true);
        setTimeout(() => setRealtimePulse(false), 2000);
        loadEventos(true);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadEventos]);

  // Stats por tipo
  const stats = useMemo(() => {
    const calc = (tipo: TipoEvento) => {
      const t = eventos.filter(e => e.tipo === tipo && !e.arquivada);
      return {
        total:       t.length,
        pendentes:   t.filter(e => e.status === "pendente").length,
        analise:     t.filter(e => e.status === "em_analise").length,
        normalizadas:t.filter(e => e.status === "normalizada").length,
        arquivadas:  eventos.filter(e => e.tipo === tipo && e.arquivada).length,
      };
    };
    return {
      indisponibilidade: calc("indisponibilidade"),
      anormalidade:      calc("anormalidade"),
    };
  }, [eventos]);

  const { ativos, arquivados } = useMemo(() => {
    const base = eventos.filter(e => {
      if (e.tipo !== tipoAtivo) return false;
      if (filtroStatus !== "todos" && e.status !== filtroStatus) return false;
      return true;
    });
    const normalizados = (e: Evento) => e.status === "normalizada" && !e.arquivada;
    const ativosList = base.filter(e => !e.arquivada)
      .sort((a, b) => {
        if (normalizados(a) && !normalizados(b)) return 1;
        if (!normalizados(a) && normalizados(b)) return -1;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });
    const arquivadosList = base.filter(e => e.arquivada)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    return { ativos: ativosList, arquivados: arquivadosList };
  }, [eventos, tipoAtivo, filtroStatus]);

  const abrirNovo = () => {
    setEditId(null);
    setForm({ ...EMPTY_FORM, tipo: tipoAtivo });
    setShowForm(true);
  };

  const abrirEdicao = (e: Evento) => {
    setEditId(e.id);
    setForm({
      tipo:       e.tipo,
      subestacao: e.subestacao,
      concessao:  e.concessao ?? "",
      ativo:      e.ativo ?? "",
      descricao:  e.descricao,
      data:       e.data ?? "",
      status:     e.status,
      registro:   e.registro ?? "nao_registrada",
    });
    setShowForm(true);
  };

  const fecharForm = () => { setShowForm(false); setEditId(null); setForm(EMPTY_FORM); };

  const salvar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form.subestacao.trim() || !form.descricao.trim()) {
      toast.error("Subestação e Descrição são obrigatórios."); return;
    }
    setSaving(true);
    try {
      const payload = {
        tipo:       form.tipo,
        subestacao: form.subestacao.trim(),
        concessao:  form.concessao.trim() || null,
        ativo:      form.ativo.trim() || null,
        descricao:  form.descricao.trim(),
        data:       form.data || null,
        status:     form.status,
        registro:   form.registro,
        last_modified_by: userEmail,
        updated_at: new Date().toISOString(),
      };
      if (editId) {
        const { error } = await supabase.from("anormalidades").update(payload).eq("id", editId);
        if (error) throw error;
        toast.success("Evento atualizado!");
      } else {
        const { error } = await supabase.from("anormalidades").insert(payload);
        if (error) throw error;
        toast.success("Evento registrado!");
      }
      fecharForm(); loadEventos();
    } catch (err: any) { toast.error("Erro ao salvar: " + (err?.message || err)); }
    finally { setSaving(false); }
  };

  const excluir = async (id: string) => {
    if (!window.confirm("Deseja excluir este evento?")) return;
    try {
      const { error } = await supabase.from("anormalidades").delete().eq("id", id);
      if (error) throw error;
      toast.success("Excluído!"); loadEventos();
    } catch { toast.error("Erro ao excluir."); }
  };

  const alterarStatus = async (id: string, novoStatus: StatusEvento) => {
    try {
      const { error } = await supabase.from("anormalidades")
        .update({ status: novoStatus, last_modified_by: userEmail, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      setEventos(prev => prev.map(e => e.id === id ? { ...e, status: novoStatus, last_modified_by: userEmail } : e));
    } catch { toast.error("Erro ao atualizar status."); }
  };

  const alterarRegistro = async (id: string, novo: Registro) => {
    try {
      const { error } = await supabase.from("anormalidades")
        .update({ registro: novo, last_modified_by: userEmail, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      setEventos(prev => prev.map(e => e.id === id ? { ...e, registro: novo, last_modified_by: userEmail } : e));
    } catch { toast.error("Erro ao atualizar registro."); }
  };

  const arquivar = async (id: string) => {
    try {
      const { error } = await supabase.from("anormalidades")
        .update({ arquivada: true, last_modified_by: userEmail, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      toast.success("Arquivado!"); loadEventos();
    } catch { toast.error("Erro ao arquivar."); }
  };

  const toggleSelect = (id: string) => {
    setSelecionados(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (lista: Evento[]) => {
    const allIds = lista.map(e => e.id);
    const allSelected = allIds.every(id => selecionados.has(id));
    setSelecionados(prev => {
      const next = new Set(prev);
      allIds.forEach(id => allSelected ? next.delete(id) : next.add(id));
      return next;
    });
  };

  const itensSelecionados = useMemo(() => eventos.filter(e => selecionados.has(e.id)), [eventos, selecionados]);

  const gerarCorpoEmail = () => {
    const now = new Date().toLocaleString("pt-BR");
    const linhas = itensSelecionados.map((e, idx) => {
      const s = getStatus(e.status);
      const tipo = TIPO_CONFIG[e.tipo].label;
      return [
        `${idx + 1}. TIPO: ${tipo}`,
        `   SUBESTAÇÃO: ${e.subestacao}`,
        `   CONCESSÃO: ${e.concessao || "—"}`,
        `   ATIVO: ${e.ativo || "—"}`,
        `   DATA: ${formatDate(e.data)}`,
        `   STATUS: ${s.label}`,
        `   DESCRIÇÃO: ${e.descricao}`,
        `   REGISTRO: ${e.registro === "registrada" ? "Registrada" : "Não registrada"}`,
        "   ─────────────────────────────────────",
      ].join("\n");
    });
    return [
      `RELATÓRIO DE GESTÃO DE EVENTOS`,
      `Gerado em: ${now}`,
      `Total de registros: ${itensSelecionados.length}`,
      `═══════════════════════════════════════`,
      "",
      ...linhas,
    ].join("\n");
  };

  const enviarEmail = () => {
    if (!emailDest.trim()) { toast.error("Informe o e-mail de destino."); return; }
    const assunto = encodeURIComponent(`Relatório de Gestão de Eventos — ${new Date().toLocaleDateString("pt-BR")}`);
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

  const cfg = TIPO_CONFIG[tipoAtivo];
  const listaVisivel = mostrarArquivados ? arquivados : ativos;

  return (
    <div className="h-full flex flex-col px-2 md:px-4 pb-10">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 mt-8 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter">Gestão de Eventos</h1>
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest transition-all duration-500 ${
              realtimePulse
                ? "border-amber-500/50 bg-amber-500/15 text-amber-400 scale-105"
                : "border-gray-200 dark:border-gray-700 text-gray-400"
            }`}>
              <SignalIcon className={`w-3 h-3 ${realtimePulse ? "text-amber-400" : "text-gray-400"}`} />
              {realtimePulse ? "Atualizado" : "Ao vivo"}
            </div>
          </div>
          <p className="text-gray-500 text-sm mt-1 font-medium">Registro e controle de indisponibilidades e anormalidades</p>
        </div>
        <div className="flex gap-3 items-center">
          <button onClick={() => loadEventos()}
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
            className={`flex items-center gap-2 px-6 py-3 text-white rounded-2xl font-bold text-sm transition-all shadow-xl ${
              tipoAtivo === "indisponibilidade" ? "bg-amber-500 hover:bg-amber-600" : "bg-rose-500 hover:bg-rose-600"
            }`}>
            <PlusIcon className="w-5 h-5" />
            Novo Evento
          </button>
        </div>
      </div>

      {/* Tabs INDISPONIBILIDADE / ANORMALIDADE */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        {(["indisponibilidade", "anormalidade"] as TipoEvento[]).map(tipo => {
          const c = TIPO_CONFIG[tipo];
          const s = stats[tipo];
          const isAtivo = tipoAtivo === tipo;
          return (
            <button key={tipo} onClick={() => { setTipoAtivo(tipo); setMostrarArquivados(false); setSelecionados(new Set()); }}
              className={`rounded-2xl p-5 border-2 text-left transition-all ${isAtivo ? c.activeColor : "border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-200 dark:hover:border-gray-700"}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  {tipo === "indisponibilidade"
                    ? <BoltIcon className={`w-5 h-5 ${isAtivo ? c.color : "text-gray-400"}`} />
                    : <ExclamationTriangleIcon className={`w-5 h-5 ${isAtivo ? c.color : "text-gray-400"}`} />
                  }
                  <span className={`text-base font-black ${isAtivo ? c.color : "text-gray-400 dark:text-gray-500"}`}>{c.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  {s.arquivadas > 0 && (
                    <span className="text-[9px] font-black px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 flex items-center gap-1">
                      <ArchiveBoxIcon className="w-3 h-3" />{s.arquivadas}
                    </span>
                  )}
                  {isAtivo && <span className={`text-[9px] font-black px-2 py-1 rounded-full border ${c.activeColor} ${c.color}`}>ATIVO</span>}
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <StatsCard label="Total"        value={s.total}        color={isAtivo ? c.color             : "text-gray-500 dark:text-gray-400"} />
                <StatsCard label="Pendentes"    value={s.pendentes}    color={isAtivo ? "text-amber-400"    : "text-gray-500 dark:text-gray-400"} />
                <StatsCard label="Em análise"   value={s.analise}      color={isAtivo ? "text-sky-400"      : "text-gray-500 dark:text-gray-400"} />
                <StatsCard label="Normalizadas" value={s.normalizadas} color={isAtivo ? "text-emerald-400"  : "text-gray-500 dark:text-gray-400"} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-4 items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center">
          <FunnelIcon className="w-4 h-4 text-gray-400" />
          <div className="flex gap-1 bg-white dark:bg-gray-800 rounded-xl p-1 border border-gray-100 dark:border-gray-700">
            {(["todos", "pendente", "em_analise", "normalizada"] as const).map(v => (
              <button key={v} onClick={() => setFiltroStatus(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filtroStatus === v
                    ? tipoAtivo === "indisponibilidade" ? "bg-amber-500 text-white shadow" : "bg-rose-500 text-white shadow"
                    : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                }`}>
                {v === "todos" ? "Todos" : v === "em_analise" ? "Em análise" : v === "pendente" ? "Pendente" : "Normalizada"}
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
          {!mostrarArquivados && stats[tipoAtivo].arquivadas > 0 && (
            <span className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded-full text-[9px] font-black">
              {stats[tipoAtivo].arquivadas}
            </span>
          )}
        </button>
      </div>

      {/* Tabela */}
      <div className="flex-1 bg-white dark:bg-gray-900 rounded-[1.5rem] border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <ArrowPathIcon className={`w-8 h-8 animate-spin ${cfg.color}`} />
          </div>
        ) : listaVisivel.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-400">
            <DocumentTextIcon className="w-12 h-12" />
            <p className="font-bold">{mostrarArquivados ? "Nenhum evento arquivado" : `Nenhum evento em ${cfg.label}`}</p>
            {!mostrarArquivados && <p className="text-sm">Clique em "Novo Evento" para começar</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="px-3 py-3 w-10">
                    <input type="checkbox"
                      checked={listaVisivel.length > 0 && listaVisivel.every(e => selecionados.has(e.id))}
                      onChange={() => toggleSelectAll(listaVisivel)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                  </th>
                  {["Subestação", "Concessão", "Ativo", "Descrição", "Data", "Status", "Registro", ""].map((h, i) => (
                    <th key={i} className={`${i >= 4 ? "text-center" : "text-left"} px-3 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {listaVisivel.map(evento => {
                  const st = getStatus(evento.status);
                  const reg = evento.registro ?? "nao_registrada";
                  const isNorm = evento.status === "normalizada" && !evento.arquivada;
                  const isSelected = selecionados.has(evento.id);

                  return (
                    <tr key={evento.id} className={`border-b border-gray-100 dark:border-gray-800 transition-colors group
                      ${isSelected ? "bg-indigo-500/[0.04] dark:bg-indigo-500/[0.06]" : isNorm ? "opacity-60 hover:opacity-80 bg-emerald-500/[0.02]" : "hover:bg-gray-50/40 dark:hover:bg-gray-800/30"}
                      ${evento.arquivada ? "opacity-40 hover:opacity-60" : ""}
                    `}>
                      <td className="px-3 py-3 text-center align-middle">
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(evento.id)}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                      </td>
                      <td className="px-3 py-3 align-middle">
                        <p className="text-xs font-black text-gray-800 dark:text-white whitespace-nowrap">{evento.subestacao}</p>
                      </td>
                      <td className="px-3 py-3 align-middle">
                        <p className="text-xs text-gray-500 whitespace-nowrap">{evento.concessao || "—"}</p>
                      </td>
                      <td className="px-3 py-3 align-middle">
                        <p className="text-xs text-gray-500 whitespace-nowrap">{evento.ativo || "—"}</p>
                      </td>
                      <td className="px-3 py-3 align-top">
                        {evento.last_modified_by && (
                          <p className="text-[9px] font-bold text-rose-500/90 dark:text-rose-400/90 mb-1 uppercase tracking-wide">
                            Modificado por {evento.last_modified_by.split("@")[0]} em {new Date(evento.updated_at).toLocaleString('pt-BR')}
                          </p>
                        )}
                        <p className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap break-words w-[220px] leading-relaxed">{evento.descricao}</p>
                      </td>
                      <td className="px-3 py-3 text-center align-middle whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1 text-xs text-gray-400">
                          <CalendarDaysIcon className="w-3.5 h-3.5" />{formatDate(evento.data)}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center align-middle">
                        {evento.arquivada ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border font-black text-[9px] ${st.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />{st.label}
                          </span>
                        ) : (
                          <button
                            onClick={(e) => {
                              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                              setStatusDropdown(statusDropdown?.id === evento.id ? null : { id: evento.id, top: rect.bottom + 6, left: rect.left + rect.width / 2 });
                            }}
                            className={`flex items-center gap-1 px-2 py-1 rounded-full border font-black text-[9px] transition-all hover:opacity-80 whitespace-nowrap ${st.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${st.dot} flex-shrink-0`} />
                            {st.label}
                            <svg className="w-2.5 h-2.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center align-middle">
                        {evento.arquivada ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border font-black text-[9px] whitespace-nowrap ${reg === "registrada" ? "bg-indigo-500/15 text-indigo-400 border-indigo-500/30" : "bg-gray-500/10 text-gray-500 border-gray-500/20"}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${reg === "registrada" ? "bg-indigo-400" : "bg-gray-500"}`} />
                            {reg === "registrada" ? "Registrada" : "Não reg."}
                          </span>
                        ) : (
                          <button onClick={() => alterarRegistro(evento.id, reg === "registrada" ? "nao_registrada" : "registrada")}
                            className={`flex items-center gap-1 px-2 py-1 rounded-full border font-black text-[9px] transition-all hover:opacity-80 whitespace-nowrap ${
                              reg === "registrada"
                                ? "bg-indigo-500/15 text-indigo-400 border-indigo-500/30"
                                : "bg-gray-500/10 text-gray-400 border-gray-500/20 hover:border-indigo-500/30 hover:text-indigo-400"
                            }`}>
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${reg === "registrada" ? "bg-indigo-400" : "bg-gray-500"}`} />
                            {reg === "registrada" ? "Registrada" : "Não reg."}
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right align-middle">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!evento.arquivada && (
                            <>
                              <button onClick={() => abrirEdicao(evento)}
                                className={`p-1.5 text-gray-400 rounded-lg transition-colors ${tipoAtivo === "indisponibilidade" ? "hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10" : "hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"}`}>
                                <PencilSquareIcon className="w-4 h-4" />
                              </button>
                              <button onClick={() => arquivar(evento.id)} title="Arquivar"
                                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                                <ArchiveBoxIcon className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          <button onClick={() => excluir(evento.id)}
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
        const ev = eventos.find(x => x.id === statusDropdown.id);
        if (!ev) return null;
        return (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setStatusDropdown(null)} />
            <div className="fixed z-50 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-1.5 min-w-[160px] -translate-x-1/2"
              style={{ top: statusDropdown.top, left: statusDropdown.left }}>
              {STATUS_LIST.map(s => (
                <button key={s.id}
                  onClick={() => { alterarStatus(ev.id, s.id); setStatusDropdown(null); }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-[11px] font-bold transition-all hover:bg-gray-800 ${ev.status === s.id ? s.badge : "text-gray-400 hover:text-gray-200"}`}>
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
                  {s.label}
                  {ev.status === s.id && <CheckIcon className="w-3 h-3 ml-auto" />}
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
              <div>
                <h2 className="text-xl font-black text-gray-900 dark:text-white">
                  {editId ? "Editar Evento" : "Novo Evento"}
                </h2>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border mt-1 inline-block ${TIPO_CONFIG[form.tipo].activeColor} ${TIPO_CONFIG[form.tipo].color}`}>
                  {TIPO_CONFIG[form.tipo].label}
                </span>
              </div>
              <button onClick={fecharForm} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={salvar} className="px-7 pb-7 pt-5 space-y-4">
              {/* Tipo */}
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Tipo</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["indisponibilidade", "anormalidade"] as TipoEvento[]).map(t => {
                    const c = TIPO_CONFIG[t];
                    return (
                      <button key={t} type="button" onClick={() => setForm(p => ({ ...p, tipo: t }))}
                        className={`py-2.5 rounded-xl border text-xs font-black transition-all ${
                          form.tipo === t
                            ? c.activeColor + " " + c.color + " ring-2 ring-offset-1 dark:ring-offset-gray-900 ring-amber-500"
                            : "border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300"
                        }`}>
                        {c.label}
                        {form.tipo === t && <CheckIcon className="w-3 h-3 inline ml-1.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Subestação <span className="text-red-400">*</span></label>
                <input type="text" required value={form.subestacao} onChange={e => setForm(p => ({ ...p, subestacao: e.target.value }))}
                  placeholder="Nome da subestação..." className={inputCls} />
              </div>

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

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Descrição <span className="text-red-400">*</span></label>
                <textarea required rows={4} value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
                  placeholder="Descreva o evento..." className={inputCls + " resize-none"} />
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Data</label>
                <input type="date" value={form.data} onChange={e => setForm(p => ({ ...p, data: e.target.value }))} className={inputCls} />
              </div>

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
                className={`w-full py-3.5 disabled:opacity-50 text-white rounded-xl font-black text-sm transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 ${
                  form.tipo === "indisponibilidade" ? "bg-amber-500 hover:bg-amber-600" : "bg-rose-500 hover:bg-rose-600"
                }`}>
                {saving ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <CheckIcon className="w-4 h-4" />}
                {editId ? "Salvar Alterações" : "Registrar Evento"}
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
                <p className="text-sm text-gray-400 mt-0.5">{selecionados.size} evento{selecionados.size > 1 ? "s" : ""} selecionado{selecionados.size > 1 ? "s" : ""}</p>
              </div>
              <button onClick={() => setModalEmail(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="px-7 pb-7 pt-5 space-y-5">
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
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Pré-visualização</label>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        {["Tipo", "Subestação", "Concessão", "Ativo", "Data", "Status"].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left text-[9px] font-black text-gray-400 uppercase tracking-widest">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {itensSelecionados.map(e => {
                        const st = getStatus(e.status);
                        const c = TIPO_CONFIG[e.tipo];
                        return (
                          <tr key={e.id} className="border-b border-gray-100 dark:border-gray-700 last:border-0">
                            <td className="px-3 py-2.5">
                              <span className={`text-[9px] font-black ${c.color}`}>{c.label}</span>
                            </td>
                            <td className="px-3 py-2.5 font-bold text-gray-800 dark:text-white">{e.subestacao}</td>
                            <td className="px-3 py-2.5 text-gray-500">{e.concessao || "—"}</td>
                            <td className="px-3 py-2.5 text-gray-500">{e.ativo || "—"}</td>
                            <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{formatDate(e.data)}</td>
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
