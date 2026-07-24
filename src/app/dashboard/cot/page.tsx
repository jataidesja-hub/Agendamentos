"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  PlusIcon, XMarkIcon, PencilSquareIcon, TrashIcon,
  FunnelIcon, ArrowPathIcon, CalendarDaysIcon, DocumentTextIcon,
  ClockIcon, CheckCircleIcon, ExclamationTriangleIcon, PlayIcon,
  UserIcon, ArchiveBoxIcon, ArrowLeftIcon, SignalIcon, EnvelopeIcon,
  BoltIcon, ClipboardDocumentIcon
} from "@heroicons/react/24/outline";
import { CheckIcon } from "@heroicons/react/24/solid";
import { toast } from "react-hot-toast";
import { supabase } from "@/lib/supabase";

type Subtipo = "pes" | "doc_ext";
type TipoAtividade = "diaria" | "continua";
type StatusDiaria = "programada" | "iniciada" | "em_execucao" | "interrompida" | "concluida";
type StatusContinua = "programada" | "iniciada" | "em_execucao" | "concluida";
type StatusTarefa = StatusDiaria | StatusContinua;
type Registro = "registrada" | "nao_registrada";

const DOC_EXT_OPTS = ["MO", "AI", "ATEE", "ATEIE"] as const;
type DocExterno = "nao_possui" | typeof DOC_EXT_OPTS[number];

const DOC_EXT_COLORS: Record<string, string> = {
  MO:    "bg-violet-500/15 text-violet-400 border-violet-500/30",
  AI:    "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  ATEE:  "bg-orange-500/15 text-orange-400 border-orange-500/30",
  ATEIE: "bg-pink-500/15 text-pink-400 border-pink-500/30",
};

interface CotTarefa {
  id: string;
  subtipo: Subtipo;
  nome_projeto: string;
  atividade: string;
  numero_documento: string | null;   // Nº do PES (PES) ou Nº Documento (DOC EXT.)
  numero_doc_ext: string | null;      // Nº Documento quando PES tem doc externo vinculado
  observacao: string | null;
  data_fim: string | null;
  tipo_atividade: TipoAtividade;
  tipo_numero: number | null;
  nome_agente: string | null;
  doc_externo: string | null;
  status: StatusTarefa;
  registro: Registro;
  concluida_em: string | null;
  interrompida_em: string | null;
  hora_fim: string | null;
  data_programacao: string | null;
  arquivada: boolean;
  numero_sgi: string | null;
  last_modified_by: string | null;
  created_at: string;
  updated_at: string;
}

type TipoEvento = "indisponibilidade" | "anormalidade" | "conv_op";
type StatusEvento = "ativa" | "sem_previsao" | "previsao_vencida" | "normalizada";

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

const STATUS_DIARIA: { id: StatusDiaria; label: string; badge: string; dot: string; icon: any }[] = [
  { id: "programada",   label: "Programada",   badge: "bg-sky-500/15 text-sky-400 border-sky-500/30",               dot: "bg-sky-400",     icon: CalendarDaysIcon },
  { id: "iniciada",     label: "Iniciada",     badge: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",      dot: "bg-indigo-400",  icon: PlayIcon },
  { id: "em_execucao",  label: "Em execução",  badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",         dot: "bg-amber-400",   icon: ClockIcon },
  { id: "interrompida", label: "Interrompida", badge: "bg-rose-500/15 text-rose-400 border-rose-500/30",            dot: "bg-rose-400",    icon: ExclamationTriangleIcon },
  { id: "concluida",    label: "Concluída",    badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",   dot: "bg-emerald-400", icon: CheckCircleIcon },
];

const STATUS_CONTINUA: { id: StatusContinua; label: string; badge: string; dot: string; icon: any }[] = [
  { id: "programada",  label: "Programada",  badge: "bg-sky-500/15 text-sky-400 border-sky-500/30",               dot: "bg-sky-400",     icon: CalendarDaysIcon },
  { id: "iniciada",    label: "Iniciada",    badge: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",      dot: "bg-indigo-400",  icon: PlayIcon },
  { id: "em_execucao", label: "Em execução", badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",         dot: "bg-amber-400",   icon: ClockIcon },
  { id: "concluida",   label: "Concluída",   badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",   dot: "bg-emerald-400", icon: CheckCircleIcon },
];

function getStatusList(tipo: TipoAtividade) {
  return tipo === "diaria" ? STATUS_DIARIA : STATUS_CONTINUA;
}
function getStatusInfo(tipo: TipoAtividade, status: StatusTarefa) {
  return getStatusList(tipo).find(s => s.id === status) ?? getStatusList(tipo)[0];
}

const TIPO_COLORS: Record<TipoAtividade, string> = {
  diaria:   "bg-orange-500/15 text-orange-400 border-orange-500/30",
  continua: "bg-teal-500/15 text-teal-400 border-teal-500/30",
};
const TIPO_LABELS: Record<TipoAtividade, string> = { diaria: "Diária", continua: "Contínua" };

const SUBTIPO_CONFIG: Record<Subtipo, { label: string; color: string; activeColor: string }> = {
  pes:     { label: "PES",      color: "text-violet-400", activeColor: "border-violet-500 bg-violet-500/10" },
  doc_ext: { label: "DOC EXT.", color: "text-cyan-400",   activeColor: "border-cyan-500 bg-cyan-500/10" },
};

const TIPO_EVENTO_CONFIG: Record<TipoEvento, { label: string; color: string; activeColor: string; accent: string; statBg: string }> = {
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
  conv_op: {
    label:       "CONV. OP.",
    color:       "text-purple-400",
    activeColor: "border-purple-500 bg-purple-500/10",
    accent:      "bg-purple-500",
    statBg:      "bg-purple-500/8 border-purple-500/20",
  },
};

const STATUS_EVENTO_LIST: { id: StatusEvento; label: string; badge: string; dot: string; icon: any }[] = [
  { id: "ativa",            label: "Ativa",            badge: "bg-sky-500/15 text-sky-400 border-sky-500/30",               dot: "bg-sky-400",     icon: ExclamationTriangleIcon },
  { id: "sem_previsao",     label: "Sem Previsão",     badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",         dot: "bg-amber-400",   icon: ClockIcon },
  { id: "previsao_vencida", label: "Prev. Vencida",    badge: "bg-rose-500/15 text-rose-400 border-rose-500/30",            dot: "bg-rose-400",    icon: ExclamationTriangleIcon },
  { id: "normalizada",      label: "Normalizada",      badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",   dot: "bg-emerald-400", icon: CheckCircleIcon },
];

function getStatusEvento(s: StatusEvento) {
  return STATUS_EVENTO_LIST.find(x => x.id === s) ?? STATUS_EVENTO_LIST[0];
}

const ARCHIVE_MS = 24 * 60 * 60 * 1000;

const EMPTY_FORM = {
  subtipo: "pes" as Subtipo,
  nome_projeto: "",
  atividade: "",
  numero_documento: "",
  numero_doc_ext: "",
  observacao: "",
  data_fim: "",
  tipo_numero: "" as string,
  nome_agente: "",
  doc_externo: "nao_possui" as string,
  numero_sgi: "",
  status: "programada" as StatusTarefa,
  registro: "nao_registrada" as Registro,
  hora_fim: "",
  data_programacao: "",
};

const EMPTY_EVENTO_FORM = {
  tipo:        "indisponibilidade" as TipoEvento,
  subestacao:  "",
  concessao:   "",
  ativo:       "",
  descricao:   "",
  data:        "",
  status:      "ativa" as StatusEvento,
  registro:    "nao_registrada" as Registro,
};

function StatsCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">{label}</span>
      <span className={`text-2xl font-black ${color}`}>{value}</span>
    </div>
  );
}

function calcCountdown(concluida_em: string | null, nowMs: number): { text: string; color: string } | null {
  if (!concluida_em) return null;
  const remaining = Math.max(0, ARCHIVE_MS - (nowMs - new Date(concluida_em).getTime()));
  if (remaining === 0) return { text: "Arquivando…", color: "text-red-400" };
  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  const text = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  if (h < 4)  return { text, color: "text-red-400" };
  if (h < 12) return { text, color: "text-amber-400" };
  return { text, color: "text-emerald-400" };
}

export default function CotPage() {
  const [tarefas, setTarefas] = useState<CotTarefa[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [subtipoAtivo, setSubtipoAtivo] = useState<Subtipo>("pes");
  const [viewMode, setViewMode] = useState<"geral" | "pes" | "doc_ext" | "indisponibilidade" | "anormalidade" | "conv_op">("geral");
  const [mostrarArquivados, setMostrarArquivados] = useState(false);
  const [realtimePulse, setRealtimePulse] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const [modalStep, setModalStep] = useState<0 | 1 | 2>(0);
  const [tipoSelecionado, setTipoSelecionado] = useState<TipoAtividade>("diaria");
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  
  // Eventos states
  const [showFormEvento, setShowFormEvento] = useState(false);
  const [formEvento, setFormEvento] = useState(EMPTY_EVENTO_FORM);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [modalEmail, setModalEmail] = useState(false);
  const [emailDest, setEmailDest] = useState("");
  const [emailCc, setEmailCc] = useState("");
  const [statusEventoDropdown, setStatusEventoDropdown] = useState<{ id: string; top: number; left: number } | null>(null);
  const [filtroStatusEvento, setFiltroStatusEvento] = useState<StatusEvento | "todos">("todos");

  const [saving, setSaving] = useState(false);
  const [statusDropdown, setStatusDropdown] = useState<{ id: string; top: number; left: number } | null>(null);
  const [userEmail, setUserEmail] = useState("");

  const [filtroTipo, setFiltroTipo] = useState<TipoAtividade | "todos">("todos");
  const [filtroStatus, setFiltroStatus] = useState<StatusTarefa | "todos">("todos");
  const [filtroDocExt, setFiltroDocExt] = useState<string>("todos");

  // Ordenação tarefas
  const [sortCol, setSortCol] = useState<string>("data_fim");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  // Ordenação eventos
  const [sortColEvt, setSortColEvt] = useState<string>("data");
  const [sortDirEvt, setSortDirEvt] = useState<"asc" | "desc">("desc");
  const toggleSortEvt = (col: string) => {
    if (sortColEvt === col) setSortDirEvt(d => d === "asc" ? "desc" : "asc");
    else { setSortColEvt(col); setSortDirEvt("asc"); }
  };

  const loadTarefas = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [resCot, resEventos] = await Promise.all([
        supabase.from("cot_tarefas").select("*").order("updated_at", { ascending: false }),
        supabase.from("anormalidades").select("*").order("updated_at", { ascending: false })
      ]);
      if (resCot.error) throw resCot.error;
      if (resEventos.error) throw resEventos.error;
      
      setTarefas(resCot.data || []);
      
      // Mapear status antigos (pendente/em_analise) para "ativa" na visualizacao
      const eventosMapped = (resEventos.data || []).map((d: any) => {
        let st = d.status;
        if (st === "pendente" || st === "em_analise") st = "ativa";
        return { ...d, tipo: d.tipo ?? "anormalidade", status: st };
      });
      setEventos(eventosMapped);
    } catch { toast.error("Erro ao carregar dados."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session?.user?.email) setUserEmail(data.session.user.email);
    });
    loadTarefas();
    const channel = supabase
      .channel("realtime_cot_v2")
      .on("postgres_changes", { event: "*", schema: "public", table: "cot_tarefas" }, () => {
        setRealtimePulse(true);
        setTimeout(() => setRealtimePulse(false), 2000);
        loadTarefas(true);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "anormalidades" }, () => {
        setRealtimePulse(true);
        setTimeout(() => setRealtimePulse(false), 2000);
        loadTarefas(true);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadTarefas]);

  // Auto-archive and Auto-program tasks
  useEffect(() => {
    const now = Date.now();
    const toArchive = tarefas.filter(t =>
      t.status === "concluida" && !t.arquivada && t.concluida_em &&
      now - new Date(t.concluida_em).getTime() >= ARCHIVE_MS
    );
    
    const INTERROMPIDA_MS = 12 * 60 * 60 * 1000;
    const toProgram = tarefas.filter(t => 
      t.status === "interrompida" && t.interrompida_em &&
      now - new Date(t.interrompida_em).getTime() >= INTERROMPIDA_MS
    );

    if (toArchive.length === 0 && toProgram.length === 0) return;
    
    Promise.all([
      ...toArchive.map(t =>
        supabase.from("cot_tarefas")
          .update({ arquivada: true, updated_at: new Date().toISOString() })
          .eq("id", t.id)
      ),
      ...toProgram.map(t =>
        supabase.from("cot_tarefas")
          .update({ status: "programada", updated_at: new Date().toISOString() })
          .eq("id", t.id)
      )
    ]).then(() => loadTarefas(true));
  }, [tarefas, loadTarefas]);

  const stats = useMemo(() => {
    const hoje = new Date().toISOString().split("T")[0];
    const calc = (sub: Subtipo) => {
      const t = tarefas.filter(x => x.subtipo === sub && !x.arquivada);
      return {
        total:     t.length,
        diarias:   t.filter(x => x.tipo_atividade === "diaria").length,
        continuas: t.filter(x => x.tipo_atividade === "continua" && (x.data_fim || "").startsWith(hoje)).length,
        concluidas:t.filter(x => x.status === "concluida").length,
        arquivadas:tarefas.filter(x => x.subtipo === sub && x.arquivada).length,
      };
    };
    return { pes: calc("pes"), doc_ext: calc("doc_ext") };
  }, [tarefas]);

  const { tarefasAtivas, tarefasConcluidas, tarefasArquivadas } = useMemo(() => {
    const base = tarefas.filter(t => {
      if (filtroTipo !== "todos" && t.tipo_atividade !== filtroTipo) return false;
      if (filtroStatus !== "todos" && t.status !== filtroStatus) return false;
      if (filtroDocExt !== "todos") {
        if (filtroDocExt === "nao_possui") {
          if (t.doc_externo && t.doc_externo !== "nao_possui") return false;
        } else {
          if (t.doc_externo !== filtroDocExt) return false;
        }
      }
      return true;
    });
    const arquivadas = base.filter(t => t.arquivada)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    const ativas = base.filter(t => !t.arquivada && t.status !== "concluida")
      .sort((a, b) => {
        const hoje = new Date().toISOString().split("T")[0];
        const isContinuaHoje = (t: CotTarefa) => t.tipo_atividade === "continua" && !!t.data_fim && t.data_fim.startsWith(hoje);
        
        if (isContinuaHoje(a) && !isContinuaHoje(b)) return -1;
        if (!isContinuaHoje(a) && isContinuaHoje(b)) return 1;

        const getVenc = (t: CotTarefa) => {
          if (!t.data_fim) return Infinity;
          const dt = t.data_fim.split("T")[0] + "T" + (t.hora_fim ? t.hora_fim : "23:59") + ":00";
          return new Date(dt).getTime();
        };
        const peso = (t: CotTarefa) => (t.status === "em_execucao" || t.status === "programada") ? 0 : 1;
        if (peso(a) !== peso(b)) return peso(a) - peso(b);
        return getVenc(a) - getVenc(b);
      });
    const concluidas = base.filter(t => !t.arquivada && t.status === "concluida")
      .sort((a, b) => {
        const ta = a.concluida_em ? new Date(a.concluida_em).getTime() : 0;
        const tb = b.concluida_em ? new Date(b.concluida_em).getTime() : 0;
        return tb - ta;
      });
    return { tarefasAtivas: ativas, tarefasConcluidas: concluidas, tarefasArquivadas: arquivadas };
  }, [tarefas, subtipoAtivo, filtroTipo, filtroStatus, filtroDocExt]);

  const statsEventos = useMemo(() => {
    const calc = (tipo: TipoEvento) => {
      const t = eventos.filter(e => e.tipo === tipo && !e.arquivada);
      return {
        total:       t.length,
        ativas:      t.filter(e => e.status === "ativa").length,
        sem_previsao:t.filter(e => e.status === "sem_previsao").length,
        prev_vencida:t.filter(e => e.status === "previsao_vencida").length,
        normalizadas:t.filter(e => e.status === "normalizada").length,
        arquivadas:  eventos.filter(e => e.tipo === tipo && e.arquivada).length,
      };
    };
    return { indisponibilidade: calc("indisponibilidade"), anormalidade: calc("anormalidade"), conv_op: calc("conv_op") };
  }, [eventos]);

  const { eventosAtivos, eventosArquivados } = useMemo(() => {
    const base = eventos.filter(e => {
      if (viewMode !== "indisponibilidade" && viewMode !== "anormalidade" && viewMode !== "conv_op") return false;
      if (e.tipo !== viewMode) return false;
      if (filtroStatusEvento !== "todos" && e.status !== filtroStatusEvento) return false;
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
    return { eventosAtivos: ativosList, eventosArquivados: arquivadosList };
  }, [eventos, viewMode, filtroStatusEvento]);

  const abrirNova = () => {
    setEditId(null);
    setForm({
      ...EMPTY_FORM,
      subtipo: subtipoAtivo,
      doc_externo: subtipoAtivo === "doc_ext" ? "MO" : "nao_possui",
    });
    setModalStep(1);
  };

  const abrirNovoEvento = () => {
    setEditId(null);
    setFormEvento({ ...EMPTY_EVENTO_FORM, tipo: viewMode as TipoEvento });
    setShowFormEvento(true);
  };

  const abrirEdicao = (t: CotTarefa) => {
    setEditId(t.id);
    setTipoSelecionado(t.tipo_atividade);
    setForm({
      subtipo: t.subtipo,
      nome_projeto: t.nome_projeto,
      atividade: t.atividade,
      numero_documento: t.numero_documento ?? "",
      numero_doc_ext: t.numero_doc_ext ?? "",
      observacao: t.observacao ?? "",
      data_fim: t.data_fim ?? "",
      tipo_numero: t.tipo_numero != null ? String(t.tipo_numero) : "",
      numero_sgi: t.numero_sgi ?? "",
      nome_agente: t.nome_agente ?? "",
      doc_externo: t.doc_externo ?? (t.subtipo === "doc_ext" ? "MO" : "nao_possui"),
      status: t.status,
      registro: (t.registro ?? "nao_registrada") as Registro,
      hora_fim: t.hora_fim ?? "",
      data_programacao: t.data_programacao ?? "",
    });
    setModalStep(2);
  };

  const abrirEdicaoEvento = (e: Evento) => {
    setEditId(e.id);
    setFormEvento({
      tipo:       e.tipo,
      subestacao: e.subestacao,
      concessao:  e.concessao ?? "",
      ativo:      e.ativo ?? "",
      descricao:  e.descricao,
      data:       e.data ?? "",
      status:     e.status,
      registro:   e.registro ?? "nao_registrada",
    });
    setShowFormEvento(true);
  };

  const confirmarTipo = (tipo: TipoAtividade) => {
    setTipoSelecionado(tipo);
    setForm(prev => ({ ...prev, status: "programada" }));
    setModalStep(2);
  };

  const fecharModal = () => { setModalStep(0); setEditId(null); setForm(EMPTY_FORM); };
  const fecharFormEvento = () => { setShowFormEvento(false); setEditId(null); setFormEvento(EMPTY_EVENTO_FORM); };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome_projeto.trim() || !form.atividade.trim()) {
      toast.error("Projeto e Atividade são obrigatórios."); return;
    }
    setSaving(true);
    try {
      const isConcluida = form.status === "concluida";
      const payload: any = {
        subtipo: form.subtipo,
        nome_projeto: form.nome_projeto.trim(),
        atividade: form.atividade.trim(),
        numero_documento: (form.numero_documento || "").trim() || null,
        numero_doc_ext: (form.subtipo === "pes" && form.doc_externo !== "nao_possui") ? ((form.numero_doc_ext || "").trim() || null) : null,
        observacao: (form.observacao || "").trim() || null,
        numero_sgi: ["1", "2", "3"].includes(form.tipo_numero) ? ((form.numero_sgi || "").trim() || null) : null,
        data_fim: form.data_fim || null,
        hora_fim: form.hora_fim || null,
        data_programacao: form.status === "programada" ? (form.data_programacao || null) : null,
        tipo_atividade: tipoSelecionado,
        tipo_numero: form.tipo_numero ? parseInt(form.tipo_numero) : null,
        nome_agente: form.subtipo === "doc_ext" ? ((form.nome_agente || "").trim() || null) : null,
        doc_externo: form.doc_externo || null,
        status: form.status,
        registro: form.registro,
        last_modified_by: userEmail,
        updated_at: new Date().toISOString(),
      };
      if (form.status === "interrompida") payload.interrompida_em = new Date().toISOString();
      if (editId) {
        const current = tarefas.find(t => t.id === editId);
        if (isConcluida && !current?.concluida_em) payload.concluida_em = new Date().toISOString();
        else if (!isConcluida) { payload.concluida_em = null; payload.arquivada = false; }
        const { error } = await supabase.from("cot_tarefas").update(payload).eq("id", editId);
        if (error) throw error;
        toast.success("Tarefa atualizada!");
      } else {
        if (isConcluida) payload.concluida_em = new Date().toISOString();
        const { error } = await supabase.from("cot_tarefas").insert(payload);
        if (error) throw error;
        toast.success("Tarefa criada!");
      }
      fecharModal(); loadTarefas();
    } catch (e: any) { toast.error("Erro ao salvar tarefa: " + (e.message || "Erro desconhecido")); }
    finally { setSaving(false); }
  };

  const salvarEvento = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (formEvento.tipo !== "conv_op" && !formEvento.subestacao.trim()) {
      toast.error("Subestação é obrigatória."); return;
    }
    if (!formEvento.descricao.trim()) {
      toast.error("Descrição é obrigatória."); return;
    }
    setSaving(true);
    try {
      const payload = {
        tipo:       formEvento.tipo,
        subestacao: formEvento.tipo === "conv_op" ? "CONV. OP." : formEvento.subestacao.trim(),
        concessao:  formEvento.tipo === "conv_op" ? null : (formEvento.concessao.trim() || null),
        ativo:      formEvento.tipo === "conv_op" ? null : (formEvento.ativo.trim() || null),
        descricao:  formEvento.descricao.trim(),
        data:       formEvento.tipo === "conv_op" ? null : (formEvento.data || null),
        status:     formEvento.tipo === "conv_op" ? "ativa" : formEvento.status,
        registro:   formEvento.registro,
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
      fecharFormEvento(); loadTarefas();
    } catch (err: any) { toast.error("Erro ao salvar: " + (err?.message || err)); }
    finally { setSaving(false); }
  };

  const excluir = async (id: string) => {
    if (!window.confirm("Deseja excluir esta tarefa?")) return;
    try {
      const { error } = await supabase.from("cot_tarefas").delete().eq("id", id);
      if (error) throw error;
      toast.success("Tarefa excluída!"); loadTarefas();
    } catch { toast.error("Erro ao excluir."); }
  };

  const excluirEvento = async (id: string) => {
    if (!window.confirm("Deseja excluir este evento?")) return;
    try {
      const { error } = await supabase.from("anormalidades").delete().eq("id", id);
      if (error) throw error;
      toast.success("Excluído!"); loadTarefas();
    } catch { toast.error("Erro ao excluir."); }
  };

  const alterarStatus = async (id: string, tipo: TipoAtividade, novoStatus: StatusTarefa) => {
    try {
      const isConcluida = novoStatus === "concluida";
      const current = tarefas.find(t => t.id === id);
      const update: any = { status: novoStatus, updated_at: new Date().toISOString(), last_modified_by: userEmail };
      if (isConcluida && !current?.concluida_em) update.concluida_em = new Date().toISOString();
      else if (!isConcluida) { update.concluida_em = null; update.arquivada = false; }
      
      if (novoStatus === "interrompida") update.interrompida_em = new Date().toISOString();
      
      const { error } = await supabase.from("cot_tarefas").update(update).eq("id", id);
      if (error) throw error;
      setTarefas(prev => prev.map(t => t.id === id ? { ...t, ...update } : t));
    } catch { toast.error("Erro ao atualizar status."); }
  };

  const alterarRegistro = async (id: string, novoRegistro: Registro) => {
    try {
      const { error } = await supabase.from("cot_tarefas")
        .update({ registro: novoRegistro, updated_at: new Date().toISOString(), last_modified_by: userEmail }).eq("id", id);
      if (error) throw error;
      setTarefas(prev => prev.map(t => t.id === id ? { ...t, registro: novoRegistro } : t));
    } catch { toast.error("Erro ao atualizar registro."); }
  };

  const alterarStatusEvento = async (id: string, novoStatus: StatusEvento) => {
    try {
      const { error } = await supabase.from("anormalidades")
        .update({ status: novoStatus, last_modified_by: userEmail, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      setEventos(prev => prev.map(e => e.id === id ? { ...e, status: novoStatus, last_modified_by: userEmail } : e));
    } catch { toast.error("Erro ao atualizar status."); }
  };

  const alterarRegistroEvento = async (id: string, novo: Registro) => {
    try {
      const { error } = await supabase.from("anormalidades")
        .update({ registro: novo, last_modified_by: userEmail, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      setEventos(prev => prev.map(e => e.id === id ? { ...e, registro: novo, last_modified_by: userEmail } : e));
    } catch { toast.error("Erro ao atualizar registro."); }
  };

  const arquivarEvento = async (id: string) => {
    try {
      const { error } = await supabase.from("anormalidades")
        .update({ arquivada: true, last_modified_by: userEmail, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      toast.success("Arquivado!"); loadTarefas();
    } catch { toast.error("Erro ao arquivar."); }
  };

  const toggleSelectEvento = (id: string) => {
    setSelecionados(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAllEventos = (lista: Evento[]) => {
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
      const s = getStatusEvento(e.status);
      const tipo = TIPO_EVENTO_CONFIG[e.tipo].label;
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

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  };

  const statusOptions = tipoSelecionado === "diaria" ? STATUS_DIARIA : STATUS_CONTINUA;
  const inputCls = "w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-[#0b7336] focus:border-transparent transition-all";

  const colCount = 13;

  const renderRow = (t: CotTarefa, isArquivada = false, isDocExt = false) => {
    const statusInfo = getStatusInfo(t.tipo_atividade, t.status);
    const isConcluida = t.status === "concluida" && !isArquivada;
    const countdown = isConcluida ? calcCountdown(t.concluida_em, nowMs) : null;
    const reg = t.registro ?? "nao_registrada";

    const isVencendo = (() => {
      if (!t.data_fim || isConcluida || isArquivada) return false;
      const dtStr = t.data_fim.split("T")[0] + "T" + (t.hora_fim || "23:59") + ":00";
      const dtMs = new Date(dtStr).getTime();
      return (dtMs - nowMs) > 0 && (dtMs - nowMs) <= 60 * 60 * 1000;
    })();

    return (
      <tr key={t.id} className={`border-b border-gray-100 dark:border-gray-800 transition-colors group
        ${isConcluida ? "opacity-60 hover:opacity-80 bg-emerald-500/[0.02] dark:bg-emerald-500/[0.04]" : "hover:bg-gray-50/40 dark:hover:bg-gray-800/30"}
        ${isArquivada ? "opacity-40 hover:opacity-60" : ""}
        ${isVencendo ? "animate-pulse ring-inset ring-2 ring-red-500/50 bg-red-500/5 dark:bg-red-500/10 z-10 relative" : ""}
      `}>
        {/* Tipo */}
        <td className="px-1.5 py-2 text-center align-middle whitespace-nowrap">
          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full border ${TIPO_COLORS[t.tipo_atividade]}`}>
            {TIPO_LABELS[t.tipo_atividade]}
          </span>
        </td>
        {/* Nº Tipo */}
        <td className="px-1.5 py-2 text-center align-middle">
          {t.tipo_numero != null
            ? <span className="w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-black text-[10px] inline-flex items-center justify-center">{t.tipo_numero}</span>
            : <span className="text-gray-500 text-xs">—</span>}
        </td>
        {/* Projeto */}
        <td className="px-1.5 py-2 text-center align-middle">
          <p className="text-[11px] font-bold text-gray-800 dark:text-white leading-tight min-w-[70px] mx-auto">{t.nome_projeto}</p>
        </td>
        {/* Atividade */}
        <td className="px-1.5 py-2 text-center align-top relative">
          {t.last_modified_by && (
            <p className="text-[8px] font-bold text-rose-500/90 dark:text-rose-400/90 mb-1 uppercase tracking-wide leading-tight text-center">
              Modificado por {t.last_modified_by.split("@")[0]}
            </p>
          )}
          <p className="text-[11px] text-gray-600 dark:text-gray-300 whitespace-pre-wrap break-words min-w-[250px] max-w-[500px] w-full leading-snug mx-auto text-center">{t.atividade}</p>
        </td>
        {/* Agente */}
        {isDocExt && (
          <td className="px-1.5 py-2 text-center align-middle">
            {t.nome_agente
              ? <div className="inline-flex items-center justify-center gap-1 text-[11px] text-cyan-400 whitespace-nowrap"><UserIcon className="w-3 h-3 flex-shrink-0" />{t.nome_agente}</div>
              : <span className="text-gray-500 text-xs">—</span>}
          </td>
        )}
        {/* Nº PES / Documento */}
        <td className="px-1.5 py-2 text-center align-middle">
          <div className="flex flex-col items-center gap-0.5">
            <p className="text-[11px] text-gray-400 font-mono whitespace-nowrap">{t.numero_documento || "—"}</p>
            {t.subtipo === "pes" && t.numero_doc_ext && (
              <p className="text-[9px] text-gray-500 font-mono whitespace-nowrap">{t.numero_doc_ext}</p>
            )}
          </div>
        </td>
        {/* Data Fim */}
        <td className="px-1.5 py-2 text-center align-middle whitespace-nowrap">
          <div className="flex flex-col items-center justify-center gap-0.5 text-[11px] text-gray-400">
            <div className="flex items-center gap-1">
              <CalendarDaysIcon className="w-3 h-3 flex-shrink-0" />
              {formatDate(t.data_fim)}
            </div>
            {t.hora_fim && (
              <div className="flex items-center gap-1 text-[9px] font-bold text-gray-500">
                <ClockIcon className="w-2.5 h-2.5" />
                {t.hora_fim}
              </div>
            )}
          </div>
        </td>
        {/* Status */}
        <td className="px-1.5 py-2 text-center align-middle">
          {isArquivada ? (
            <span className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded-full border font-black text-[9px] bg-gray-500/10 text-gray-400 border-gray-500/20 whitespace-nowrap">
              <ArchiveBoxIcon className="w-3 h-3 flex-shrink-0" /> Arquivada
            </span>
          ) : (
            <button
              onClick={(e) => {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setStatusDropdown(statusDropdown?.id === t.id ? null : { id: t.id, top: rect.bottom + 6, left: rect.left + rect.width / 2 });
              }}
              className={`inline-flex items-center justify-center gap-1 px-2 py-1 rounded-full border font-black text-[9px] transition-all hover:opacity-80 whitespace-nowrap ${statusInfo.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot} flex-shrink-0`} />
              {statusInfo.label}
              <svg className="w-2.5 h-2.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
        </td>
        {/* Doc. Externo */}
        <td className="px-1.5 py-2 text-center align-middle">
          {(() => {
            const de = t.doc_externo;
            if (!de || de === "nao_possui") return <span className="text-gray-500 text-xs">—</span>;
            return (
              <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full border whitespace-nowrap ${DOC_EXT_COLORS[de] ?? "bg-gray-500/10 text-gray-400 border-gray-500/20"}`}>
                {de}
              </span>
            );
          })()}
        </td>
        <td className="px-1.5 py-2 text-center align-middle">
          {isArquivada ? (
            <span className={`inline-flex items-center justify-center gap-1 px-1.5 py-0.5 rounded-full border font-black text-[9px] whitespace-nowrap ${
              reg === "registrada" ? "bg-indigo-500/15 text-indigo-400 border-indigo-500/30" : "bg-gray-500/10 text-gray-500 border-gray-500/20"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${reg === "registrada" ? "bg-indigo-400" : "bg-gray-500"}`} />
              {reg === "registrada" ? "Reg." : "N/R"}
            </span>
          ) : (
            <button
              onClick={() => alterarRegistro(t.id, reg === "registrada" ? "nao_registrada" : "registrada")}
              className={`inline-flex items-center justify-center gap-1 px-1.5 py-0.5 rounded-full border font-black text-[9px] transition-all hover:opacity-80 whitespace-nowrap ${
                reg === "registrada"
                  ? "bg-indigo-500/15 text-indigo-400 border-indigo-500/30"
                  : "bg-gray-500/10 text-gray-400 border-gray-500/20 hover:border-indigo-500/30 hover:text-indigo-400"
              }`}>
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${reg === "registrada" ? "bg-indigo-400" : "bg-gray-500"}`} />
              {reg === "registrada" ? "Reg." : "N/R"}
            </button>
          )}
        </td>
        {/* Obs. */}
        <td className="px-1.5 py-2 text-center align-middle w-[100px] xl:w-[120px]">
          {t.observacao
            ? <p className="text-[9px] text-gray-400 whitespace-pre-wrap break-words hover:text-gray-200 transition-colors cursor-default leading-tight mx-auto text-center">{t.observacao}</p>
            : <span className="text-gray-600 text-[10px]">—</span>}
        </td>
        {/* Countdown / Ações */}
        <td className="px-1.5 py-2 text-right align-middle min-w-[70px]">
          {isConcluida && countdown ? (
            <div className="flex flex-col items-end gap-0.5">
              <span className={`font-mono font-black text-xs ${countdown.color}`}>{countdown.text}</span>
              <span className="text-[7px] text-gray-500 uppercase tracking-widest">arquivo em</span>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-1">
              {/* Passar Turno: só aparece quando status = iniciada */}
              {!isArquivada && t.status === "iniciada" && (
                <button
                  onClick={() => alterarStatus(t.id, t.tipo_atividade, "em_execucao")}
                  title="Passar Turno → Em execução"
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25 text-[9px] font-black transition-all whitespace-nowrap">
                  <PlayIcon className="w-3 h-3" />
                  Passar Turno
                </button>
              )}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {!isArquivada && (
                  <button onClick={() => abrirEdicao(t)}
                    className="p-1.5 text-gray-400 hover:text-[#0b7336] hover:bg-green-50 dark:hover:bg-green-500/10 rounded-lg transition-colors">
                    <PencilSquareIcon className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => excluir(t.id)}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors">
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </td>
      </tr>
    );
  };

  const renderRowEvento = (e: Evento) => {
    const st = getStatusEvento(e.status);
    const reg = e.registro ?? "nao_registrada";
    const isNorm = e.status === "normalizada" && !e.arquivada;
    const isSelected = selecionados.has(e.id);

    return (
      <tr key={e.id} className={`border-b border-gray-100 dark:border-gray-800 transition-colors group
        ${isSelected ? "bg-indigo-500/[0.04] dark:bg-indigo-500/[0.06]" : isNorm ? "opacity-60 hover:opacity-80 bg-emerald-500/[0.02]" : "hover:bg-gray-50/40 dark:hover:bg-gray-800/30"}
        ${e.arquivada ? "opacity-40 hover:opacity-60" : ""}
      `}>
        <td className="px-3 py-3 text-center align-middle">
          <input type="checkbox" checked={isSelected} onChange={() => toggleSelectEvento(e.id)}
            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
        </td>
        <td className="px-3 py-3 align-middle">
          <p className="text-xs font-black text-gray-800 dark:text-white whitespace-nowrap">{e.subestacao}</p>
        </td>
        <td className="px-3 py-3 align-middle">
          <p className="text-xs text-gray-500 whitespace-nowrap">{e.concessao || "—"}</p>
        </td>
        <td className="px-3 py-3 align-middle">
          <p className="text-xs text-gray-500 whitespace-nowrap">{e.ativo || "—"}</p>
        </td>
        <td className="px-3 py-3 align-top">
          {e.last_modified_by && (
            <p className="text-[9px] font-bold text-rose-500/90 dark:text-rose-400/90 mb-1 uppercase tracking-wide">
              Modificado por {e.last_modified_by.split("@")[0]}
            </p>
          )}
          <p className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap break-words min-w-[250px] max-w-[500px] w-full leading-relaxed">{e.descricao}</p>
        </td>
        <td className="px-3 py-3 text-center align-middle whitespace-nowrap">
          <div className="flex items-center justify-center gap-1 text-xs text-gray-400">
            <CalendarDaysIcon className="w-3.5 h-3.5" />{formatDate(e.data)}
          </div>
        </td>
        <td className="px-3 py-3 text-center align-middle">
          {e.arquivada ? (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border font-black text-[9px] ${st.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />{st.label}
            </span>
          ) : (
            <button
              onClick={(ev) => {
                const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
                setStatusEventoDropdown(statusEventoDropdown?.id === e.id ? null : { id: e.id, top: rect.bottom + 6, left: rect.left + rect.width / 2 });
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
          {e.arquivada ? (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border font-black text-[9px] whitespace-nowrap ${reg === "registrada" ? "bg-indigo-500/15 text-indigo-400 border-indigo-500/30" : "bg-gray-500/10 text-gray-500 border-gray-500/20"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${reg === "registrada" ? "bg-indigo-400" : "bg-gray-500"}`} />
              {reg === "registrada" ? "Registrada" : "Não reg."}
            </span>
          ) : (
            <button onClick={() => alterarRegistroEvento(e.id, reg === "registrada" ? "nao_registrada" : "registrada")}
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
            {!e.arquivada && (
              <>
                <button onClick={() => abrirEdicaoEvento(e)}
                  className={`p-1.5 text-gray-400 rounded-lg transition-colors ${e.tipo === "indisponibilidade" ? "hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10" : "hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"}`}>
                  <PencilSquareIcon className="w-4 h-4" />
                </button>
                <button onClick={() => arquivarEvento(e.id)} title="Arquivar"
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                  <ArchiveBoxIcon className="w-4 h-4" />
                </button>
              </>
            )}
            <button onClick={() => excluirEvento(e.id)}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors">
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  const tableHeaders = [
    { label: "Tipo",         align: "text-center" },
    { label: "Subtipo",      align: "text-center" },
    { label: "Nº Tipo",      align: "text-center" },
    { label: "Projeto",      align: "text-center" },
    { label: "Atividade",    align: "text-center" },
    { label: "Agente",       align: "text-center" },
    { label: "Nº PES / Doc.",align: "text-center" },
    { label: "Data Fim",     align: "text-center" },
    { label: "Status",       align: "text-center" },
    { label: "Doc. Ext.",    align: "text-center" },
    { label: "Registro",     align: "text-center" },
    { label: "Obs.",         align: "text-center" },
    { label: "",             align: "text-center" },
  ];

  return (
    <div className="h-full flex flex-col px-2 md:px-4 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 mt-8 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter">PORTAL COT - Tempo real</h1>
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest transition-all duration-500 ${
              realtimePulse
                ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-400 scale-105"
                : "border-gray-200 dark:border-gray-700 text-gray-400"
            }`}>
              <SignalIcon className={`w-3 h-3 ${realtimePulse ? "text-emerald-400" : "text-gray-400"}`} />
              {realtimePulse ? "Atualizado" : "Ao vivo"}
            </div>
          </div>
        </div>
        <div className="flex gap-3 items-center">
          <button onClick={() => loadTarefas()}
            className="p-3 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-2xl border border-gray-100 dark:border-gray-700 hover:bg-gray-50 transition-all shadow-sm">
            <ArrowPathIcon className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
          </button>
          
          {selecionados.size > 0 && (viewMode === "indisponibilidade" || viewMode === "anormalidade" || viewMode === "conv_op") && (
            <button onClick={() => setModalEmail(true)}
              className="flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-sm transition-all shadow-xl">
              <EnvelopeIcon className="w-5 h-5" />
              Enviar Relatório
              <span className="bg-white/20 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{selecionados.size}</span>
            </button>
          )}

          {viewMode === "indisponibilidade" || viewMode === "anormalidade" || viewMode === "conv_op" ? (
            <button onClick={abrirNovoEvento}
              className={`flex items-center gap-2 px-6 py-3 text-white rounded-2xl font-bold text-sm transition-all shadow-xl ${
                viewMode === "indisponibilidade" ? "bg-amber-500 hover:bg-amber-600" : viewMode === "anormalidade" ? "bg-rose-500 hover:bg-rose-600" : "bg-purple-500 hover:bg-purple-600"
              }`}>
              <PlusIcon className="w-5 h-5" />
              Novo Evento
            </button>
          ) : (
            <button onClick={abrirNova}
              className="flex items-center gap-2 px-6 py-3 bg-[#0b7336] text-white rounded-2xl font-bold text-sm hover:bg-[#075a2a] transition-all shadow-xl">
              <PlusIcon className="w-5 h-5" />
              Nova Tarefa
            </button>
          )}
        </div>
      </div>

      {/* Tabs PES / DOC EXT. / EVENTOS */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-5">
        <button onClick={() => { setViewMode("geral"); setMostrarArquivados(false); setSelecionados(new Set()); }}
          className={`col-span-1 rounded-2xl p-5 border-2 text-left transition-all ${viewMode === "geral" ? "border-[#0b7336] bg-[#0b7336]/10" : "border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-200 dark:hover:border-gray-700"}`}>
          <div className="flex items-center justify-between mb-4">
            <span className={`text-lg font-black ${viewMode === "geral" ? "text-[#0b7336]" : "text-gray-400 dark:text-gray-500"}`}>GERAL</span>
            {viewMode === "geral" && <span className="text-[9px] font-black px-2 py-1 rounded-full border border-[#0b7336] text-[#0b7336]">ATIVO</span>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatsCard label="Total"          value={tarefas.filter(t => !t.arquivada).length} color={viewMode === "geral" ? "text-[#0b7336]" : "text-gray-500"} />
            <StatsCard label="Concluídas (24h)" value={tarefas.filter(t => t.status === "concluida" && !t.arquivada).length} color={viewMode === "geral" ? "text-[#0b7336]" : "text-gray-500"} />
          </div>
        </button>

        {(["pes", "doc_ext"] as Subtipo[]).map(sub => {
          const cfg = SUBTIPO_CONFIG[sub];
          const s = stats[sub];
          const isAtivo = viewMode === sub;
          return (
            <button key={sub} onClick={() => { setViewMode(sub); setSubtipoAtivo(sub); setMostrarArquivados(false); setSelecionados(new Set()); }}
              className={`col-span-1 md:col-span-1 rounded-2xl p-5 border-2 text-left transition-all ${isAtivo ? cfg.activeColor : "border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-200 dark:hover:border-gray-700"}`}>
              <div className="flex items-center justify-between mb-4">
                <span className={`text-lg font-black ${isAtivo ? cfg.color : "text-gray-400 dark:text-gray-500"}`}>{cfg.label}</span>
                <div className="flex items-center gap-2">
                  {s.arquivadas > 0 && (
                    <span className="text-[9px] font-black px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 flex items-center gap-1">
                      <ArchiveBoxIcon className="w-3 h-3" />{s.arquivadas}
                    </span>
                  )}
                  {isAtivo && <span className={`text-[9px] font-black px-2 py-1 rounded-full border ${cfg.activeColor} ${cfg.color}`}>ATIVO</span>}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <StatsCard label="Total"     value={s.total}      color={isAtivo ? cfg.color : "text-gray-500 dark:text-gray-400"} />
                <StatsCard label="Diárias"   value={s.diarias}    color={isAtivo ? "text-orange-400" : "text-gray-500 dark:text-gray-400"} />
                <StatsCard label="Contínuas" value={s.continuas}  color={isAtivo ? "text-teal-400"   : "text-gray-500 dark:text-gray-400"} />
              </div>
            </button>
          );
        })}

        {(["indisponibilidade", "anormalidade"] as TipoEvento[]).map(tipo => {
          const c = TIPO_EVENTO_CONFIG[tipo];
          const s = statsEventos[tipo];
          const isAtivo = viewMode === tipo;
          return (
            <button key={tipo} onClick={() => { setViewMode(tipo); setMostrarArquivados(false); setSelecionados(new Set()); }}
              className={`col-span-1 md:col-span-1 rounded-2xl p-5 border-2 text-left transition-all ${isAtivo ? c.activeColor : "border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-200 dark:hover:border-gray-700"}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-1">
                  {tipo === "indisponibilidade" ? <BoltIcon className={`w-4 h-4 ${isAtivo ? c.color : "text-gray-400"}`} /> : <ExclamationTriangleIcon className={`w-4 h-4 ${isAtivo ? c.color : "text-gray-400"}`} />}
                  <span className={`text-[12px] font-black ${isAtivo ? c.color : "text-gray-400 dark:text-gray-500"}`}>{c.label}</span>
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
              <div className="grid grid-cols-1 gap-3">
                <StatsCard label="Total"  value={s.total} color={isAtivo ? c.color : "text-gray-500 dark:text-gray-400"} />
              </div>
            </button>
          );
        })}

        {/* Card Conv. Op. */}
        {(() => {
          const s = statsEventos.conv_op;
          const isAtivo = viewMode === "conv_op";
          const c = TIPO_EVENTO_CONFIG.conv_op;
          return (
            <button onClick={() => { setViewMode("conv_op"); setMostrarArquivados(false); setSelecionados(new Set()); setFiltroStatusEvento("todos"); }}
              className={`col-span-1 rounded-2xl p-5 border-2 text-left transition-all ${isAtivo ? c.activeColor : "border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-200 dark:hover:border-gray-700"}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ExclamationTriangleIcon className={`w-4 h-4 ${isAtivo ? c.color : "text-gray-400"}`} />
                  <span className={`text-[12px] font-black ${isAtivo ? c.color : "text-gray-500"} transition-colors`}>{c.label}</span>
                </div>
                <div>
                  {isAtivo && <span className={`text-[9px] font-black px-2 py-1 rounded-full border ${c.activeColor} ${c.color}`}>ATIVO</span>}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <StatsCard label="Total" value={s.total} color={isAtivo ? c.color : "text-gray-500 dark:text-gray-400"} />
              </div>
            </button>
          );
        })()}
      </div>

      {/* Filtros + Arquivados */}
      <div className="flex flex-wrap gap-3 mb-4 items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center">
          <FunnelIcon className="w-4 h-4 text-gray-400" />
          {/* Filtro por tipo de doc */}
          <div className="flex gap-1 bg-white dark:bg-gray-800 rounded-xl p-1 border border-gray-100 dark:border-gray-700">
            {([
              { v: 'geral', label: 'Todos', color: 'bg-[#0b7336]' },
              { v: 'pes', label: 'PES', color: 'bg-[#0b7336]' },
              { v: 'doc_ext', label: 'DOC EXT.', color: 'bg-[#0b7336]' },
              { v: 'indisponibilidade', label: 'Indispon.', color: 'bg-amber-500' },
              { v: 'anormalidade', label: 'Anormal.', color: 'bg-rose-500' },
              { v: 'conv_op', label: 'Conv. Op.', color: 'bg-purple-500' },
            ] as const).map(({ v, label, color }) => (
              <button key={v} onClick={() => { setViewMode(v); setMostrarArquivados(false); setSelecionados(new Set()); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === v ? `${color} text-white shadow` : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                {label}
              </button>
            ))}
          </div>
          {viewMode === "indisponibilidade" || viewMode === "anormalidade" || viewMode === "conv_op" ? (
            <div className="flex gap-1 bg-white dark:bg-gray-800 rounded-xl p-1 border border-gray-100 dark:border-gray-700">
              {(["todos", "ativa", "sem_previsao", "previsao_vencida", "normalizada"] as const).map(v => (
                <button key={v} onClick={() => setFiltroStatusEvento(v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    filtroStatusEvento === v
                      ? viewMode === "indisponibilidade" ? "bg-amber-500 text-white shadow" : viewMode === "anormalidade" ? "bg-rose-500 text-white shadow" : "bg-purple-500 text-white shadow"
                      : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  }`}>
                  {v === "todos" ? "Todos" : v === "ativa" ? "Ativa" : v === "sem_previsao" ? "Sem Previsão" : v === "previsao_vencida" ? "Prev. Vencida" : "Normalizada"}
                </button>
              ))}
            </div>
          ) : (
            <>
              <div className="flex gap-1 bg-white dark:bg-gray-800 rounded-xl p-1 border border-gray-100 dark:border-gray-700">
                {(["todos", "diaria", "continua"] as const).map(v => (
                  <button key={v} onClick={() => setFiltroTipo(v)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filtroTipo === v ? "bg-[#0b7336] text-white shadow" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}>
                    {v === "todos" ? "Todos" : v === "diaria" ? "Diárias" : "Contínuas"}
                  </button>
                ))}
              </div>
              <div className="flex gap-1 bg-white dark:bg-gray-800 rounded-xl p-1 border border-gray-100 dark:border-gray-700">
                {(["todos", "programada", "em_execucao", "interrompida", "concluida"] as const).map(v => (
                  <button key={v} onClick={() => setFiltroStatus(v)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filtroStatus === v ? "bg-[#0b7336] text-white shadow" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}>
                    {v === "todos" ? "Todos" : v === "em_execucao" ? "Em execução" : v === "programada" ? "Programada" : v === "interrompida" ? "Interrompida" : "Concluída"}
                  </button>
                ))}
              </div>
              {(viewMode === "doc_ext" || viewMode === "pes") && (
                <div className="flex gap-1 bg-white dark:bg-gray-800 rounded-xl p-1 border border-gray-100 dark:border-gray-700">
                  {(["todos", "nao_possui", "MO", "AI", "ATEE", "ATEIE"] as const).map(v => (
                    <button key={v} onClick={() => setFiltroDocExt(v)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filtroDocExt === v ? "bg-violet-600 text-white shadow" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}>
                      {v === "todos" ? "Todos" : v === "nao_possui" ? "Não possui" : v}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <button
          onClick={() => { setMostrarArquivados(v => !v); setSelecionados(new Set()); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold transition-all ${
            mostrarArquivados
              ? "border-gray-400 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200"
              : "border-gray-200 dark:border-gray-700 text-gray-400 hover:border-gray-300 hover:text-gray-600 dark:hover:border-gray-600"
          }`}>
          {mostrarArquivados ? <ArrowLeftIcon className="w-3.5 h-3.5" /> : <ArchiveBoxIcon className="w-3.5 h-3.5" />}
          {mostrarArquivados ? "Voltar" : "Arquivados"}
          {!mostrarArquivados && (viewMode === "indisponibilidade" || viewMode === "anormalidade") && statsEventos[viewMode as TipoEvento]?.arquivadas > 0 && (
            <span className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded-full text-[9px] font-black">
              {statsEventos[viewMode as TipoEvento].arquivadas}
            </span>
          )}
          {!mostrarArquivados && (viewMode === "pes" || viewMode === "doc_ext") && stats[viewMode]?.arquivadas > 0 && (
            <span className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded-full text-[9px] font-black">
              {stats[viewMode].arquivadas}
            </span>
          )}
        </button>
      </div>

      {/* Tabelas Lado a Lado */}
      {loading ? (
        <div className="flex-1 bg-white dark:bg-gray-900 rounded-[1.5rem] border border-gray-100 dark:border-gray-800 flex items-center justify-center min-h-[400px]">
          <ArrowPathIcon className="w-8 h-8 text-[#0b7336] animate-spin" />
        </div>
      ) : (
        <div className={`flex-1 grid gap-4 min-h-0 ${viewMode === "geral" ? "grid-cols-1 xl:grid-cols-2" : "grid-cols-1"}`}>
          {(viewMode === "geral" ? ["pes", "doc_ext"] : [viewMode]).map(sub => {
            const isDocExt = sub === "doc_ext";
            const isEvento = sub === "indisponibilidade" || sub === "anormalidade" || sub === "conv_op";
            const cfg = isEvento ? TIPO_EVENTO_CONFIG[sub as TipoEvento] : SUBTIPO_CONFIG[sub as Subtipo];
            
            if (isEvento) {
              const EVT_SORT_COLS = ["subestacao", "ativo", "data", "status_evt"];
              const evtBase = eventosAtivos.filter(e => e.tipo === sub);
              const applyEvtSort = (arr: Evento[]) => {
                const dir = sortDirEvt === "asc" ? 1 : -1;
                return [...arr].sort((a, b) => {
                  switch (sortColEvt) {
                    case "subestacao": return dir * (a.subestacao || "").localeCompare(b.subestacao || "");
                    case "ativo":      return dir * (a.ativo || "").localeCompare(b.ativo || "");
                    case "status_evt": return dir * (a.status || "").localeCompare(b.status || "");
                    case "data": {
                      const da = a.data ? new Date(a.data).getTime() : 0;
                      const db = b.data ? new Date(b.data).getTime() : 0;
                      return dir * (da - db);
                    }
                    default: return 0;
                  }
                });
              };
              const evtAtivos = applyEvtSort(evtBase);
              const evtArquivados = applyEvtSort(eventosArquivados.filter(e => e.tipo === sub));

              const evColKeys: { label: string; key: string; align: string }[] = [
                { label: "Subestação", key: "subestacao", align: "text-left" },
                { label: "Concessão",  key: "concessao",  align: "text-left" },
                { label: "Ativo",      key: "ativo",      align: "text-left" },
                { label: "Descrição",  key: "descricao",  align: "text-left" },
                { label: "Data",       key: "data",       align: "text-center" },
                { label: "Status",     key: "status_evt", align: "text-center" },
                { label: "Registro",   key: "reg_evt",    align: "text-center" },
                { label: "",           key: "_",          align: "text-center" },
              ];

              const renderEvtHeader = (lista: Evento[]) => (
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="px-3 py-3 w-10">
                    <input type="checkbox"
                      checked={lista.length > 0 && lista.every(e => selecionados.has(e.id))}
                      onChange={() => toggleSelectAllEventos(lista)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                  </th>
                  {evColKeys.map(h => {
                    const sortable = EVT_SORT_COLS.includes(h.key);
                    const active = sortColEvt === h.key;
                    return (
                    <th key={h.key}
                      onClick={() => sortable && toggleSortEvt(h.key)}
                      className={`${h.align} px-3 py-2 text-[9px] font-black uppercase tracking-widest whitespace-nowrap select-none ${
                        sortable ? "cursor-pointer hover:text-white text-gray-400" : "text-gray-400"
                      } ${active ? "text-white" : ""}`}>
                      {h.label}
                      {sortable && (
                        <span className={`ml-0.5 ${active ? "text-[#4ade80]" : "text-gray-600"}`}>
                          {active ? (sortDirEvt === "asc" ? " ↑" : " ↓") : " ↕"}
                        </span>
                      )}
                    </th>
                  );})}
                </tr>
              );
              
              return (
                <div key={sub} className="bg-white dark:bg-gray-900 rounded-[1.5rem] border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col overflow-hidden">
                  <div className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between ${cfg.activeColor}`}>
                    <span className={`text-lg font-black tracking-widest ${cfg.color}`}>{cfg.label}</span>
                  </div>
                  <div className="flex-1 overflow-x-auto">
                    {mostrarArquivados ? (
                      evtArquivados.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
                          <ArchiveBoxIcon className="w-10 h-10" />
                          <p className="font-bold text-sm">Nenhum evento arquivado</p>
                        </div>
                      ) : (
                        <table className="w-full">
                          <thead>{renderEvtHeader(evtArquivados)}</thead>
                          <tbody>{evtArquivados.map(e => renderRowEvento(e))}</tbody>
                        </table>
                      )
                    ) : evtAtivos.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
                        <DocumentTextIcon className="w-10 h-10" />
                        <p className="font-bold text-sm">Nenhum evento em {cfg.label}</p>
                      </div>
                    ) : (
                      <table className="w-full">
                        <thead>{renderEvtHeader(evtAtivos)}</thead>
                        <tbody>{evtAtivos.map(e => renderRowEvento(e))}</tbody>
                      </table>
                    )}
                  </div>
                </div>
              );

            }
            
            // Re-filter tasks for this panel
            const base = tarefas.filter(t => {
              if (t.subtipo !== sub) return false;
              if (filtroTipo !== "todos" && t.tipo_atividade !== filtroTipo) return false;
              if (filtroStatus !== "todos" && t.status !== filtroStatus) return false;
              return true;
            });
            const tArquivadas = base.filter(t => t.arquivada).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
            const applySort = (arr: CotTarefa[]) => {
              const dir = sortDir === "asc" ? 1 : -1;
              return [...arr].sort((a, b) => {
                switch (sortCol) {
                  case "projeto":    return dir * a.nome_projeto.localeCompare(b.nome_projeto);
                  case "atividade":  return dir * a.atividade.localeCompare(b.atividade);
                  case "status_col": return dir * a.status.localeCompare(b.status);
                  case "numero_doc": return dir * (a.numero_documento || "").localeCompare(b.numero_documento || "");
                  case "tipo":       return dir * a.tipo_atividade.localeCompare(b.tipo_atividade);
                  case "data_fim": {
                    const da = a.data_fim ? new Date(a.data_fim).getTime() : Infinity;
                    const db = b.data_fim ? new Date(b.data_fim).getTime() : Infinity;
                    return dir * (da - db);
                  }
                  default: return 0;
                }
              });
            };
            const tAtivas    = applySort(base.filter(t => !t.arquivada && t.status !== "concluida"));
            const tConcluidas = applySort(base.filter(t => !t.arquivada && t.status === "concluida"));
            const tArquivadas2 = applySort(base.filter(t => t.arquivada));

            const SORT_COLS = ["tipo", "projeto", "atividade", "numero_doc", "data_fim", "status_col"];
            const colHeaders: { label: string; key: string; align: string }[] = [
              { label: "Tipo",      key: "tipo",        align: "text-center" },
              { label: "Nº Tipo",  key: "tipo_num",    align: "text-center" },
              { label: "Projeto",  key: "projeto",     align: "text-center" },
              { label: "Atividade",key: "atividade",   align: "text-center" },
              ...(isDocExt ? [{ label: "Agente", key: "agente", align: "text-center" }] : []),
              { label: !isDocExt ? "Nº PES / Doc." : "Nº Documento", key: "numero_doc", align: "text-center" },
              { label: "Data Fim", key: "data_fim",    align: "text-center" },
              { label: "Status",   key: "status_col",  align: "text-center" },
              { label: "Doc. Ext.",key: "doc_ext",     align: "text-center" },
              { label: "Registro", key: "registro_col",align: "text-center" },
              { label: "Obs.",     key: "obs",          align: "text-center" },
              { label: "",         key: "_acoes",       align: "text-center" },
            ];

            const renderTarefaHeader = () => (
              <tr className="border-b border-gray-100 dark:border-gray-800">
                {colHeaders.map((h) => {
                  const sortable = SORT_COLS.includes(h.key);
                  const active = sortCol === h.key;
                  return (
                    <th key={h.key}
                      onClick={() => sortable && toggleSort(h.key)}
                      className={`${h.align} px-1.5 py-2 text-[8px] font-black uppercase tracking-tighter whitespace-nowrap select-none ${
                        sortable ? "cursor-pointer hover:text-white text-gray-400" : "text-gray-400"
                      } ${active ? "text-white" : ""}`}>
                      {h.label}
                      {sortable && (
                        <span className={`ml-0.5 ${active ? "text-[#4ade80]" : "text-gray-600"}`}>
                          {active ? (sortDir === "asc" ? " ↑" : " ↓") : " ↕"}
                        </span>
                      )}
                    </th>
                  );
                })}
              </tr>
            );

            return (
              <div key={sub} className="bg-white dark:bg-gray-900 rounded-[1.5rem] border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col overflow-hidden">
                <div className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between ${cfg.activeColor}`}>
                  <span className={`text-lg font-black tracking-widest ${cfg.color}`}>{cfg.label}</span>
                </div>
                
                <div className="flex-1 overflow-x-auto">
                  {mostrarArquivados ? (
                    tArquivadas.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
                        <ArchiveBoxIcon className="w-10 h-10" />
                        <p className="font-bold text-sm">Nenhuma tarefa arquivada</p>
                      </div>
                    ) : (
                      <table className="w-full">
                        <thead>{renderTarefaHeader()}</thead>
                        <tbody>{tArquivadas2.map(t => renderRow(t, true, isDocExt))}</tbody>
                      </table>
                    )
                  ) : (tAtivas.length === 0 && tConcluidas.length === 0) ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
                      <DocumentTextIcon className="w-10 h-10" />
                      <p className="font-bold text-sm">Nenhuma tarefa ativa</p>
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead>{renderTarefaHeader()}</thead>
                      <tbody>
                        {tAtivas.map(t => renderRow(t, false, isDocExt))}
                        {tConcluidas.length > 0 && (
                          <tr>
                            <td colSpan={colHeaders.length} className="px-4 pt-4 pb-2">
                              <div className="flex items-center gap-3">
                                <div className="flex-1 border-t border-dashed border-emerald-500/20" />
                                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/8 border border-emerald-500/20">
                                  <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-400" />
                                  <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">Concluídas (24h)</span>
                                </div>
                                <div className="flex-1 border-t border-dashed border-emerald-500/20" />
                              </div>
                            </td>
                          </tr>
                        )}
                        {tConcluidas.map(t => renderRow(t, false, isDocExt))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dropdown status fixo */}
      {statusDropdown && (() => {
        const t = tarefas.find(x => x.id === statusDropdown.id);
        if (!t) return null;
        return (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setStatusDropdown(null)} />
            <div className="fixed z-50 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-1.5 min-w-[160px] -translate-x-1/2"
              style={{ top: statusDropdown.top, left: statusDropdown.left }}>
              {getStatusList(t.tipo_atividade).map(s => (
                <button key={s.id}
                  onClick={() => { alterarStatus(t.id, t.tipo_atividade, s.id); setStatusDropdown(null); }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-[11px] font-bold transition-all hover:bg-gray-800 ${t.status === s.id ? s.badge : "text-gray-400 hover:text-gray-200"}`}>
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
                  {s.label}
                  {t.status === s.id && <CheckIcon className="w-3 h-3 ml-auto" />}
                </button>
              ))}
            </div>
          </>
        );
      })()}

      {/* MODAL */}
      {modalStep > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-[2rem] shadow-2xl w-full max-w-lg border border-gray-100 dark:border-gray-800 overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-7 pt-7 pb-5 sticky top-0 bg-white dark:bg-gray-900 z-10 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h2 className="text-xl font-black text-gray-900 dark:text-white">
                  {modalStep === 1 ? "Tipo de Atividade" : editId ? "Editar Tarefa" : "Nova Tarefa"}
                </h2>
                {modalStep === 2 && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${TIPO_COLORS[tipoSelecionado]}`}>{TIPO_LABELS[tipoSelecionado]}</span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${form.subtipo === "pes" ? "border-violet-500/30 text-violet-400 bg-violet-500/10" : "border-cyan-500/30 text-cyan-400 bg-cyan-500/10"}`}>
                      {SUBTIPO_CONFIG[form.subtipo].label}
                    </span>
                    {!editId && <button onClick={() => setModalStep(1)} className="text-xs text-gray-400 hover:text-gray-600 underline">alterar</button>}
                  </div>
                )}
              </div>
              <button onClick={fecharModal} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {modalStep === 1 && (
              <div className="px-7 pb-7 pt-6 grid grid-cols-2 gap-4">
                <button onClick={() => confirmarTipo("diaria")}
                  className="flex flex-col items-center gap-4 p-6 rounded-2xl border-2 border-orange-200 dark:border-orange-500/30 bg-orange-50 dark:bg-orange-500/10 hover:border-orange-400 hover:scale-[1.02] active:scale-[0.98] transition-all">
                  <div className="w-14 h-14 rounded-2xl bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/30">
                    <CalendarDaysIcon className="w-7 h-7 text-white" />
                  </div>
                  <div className="text-center">
                    <p className="font-black text-orange-700 dark:text-orange-400 text-base">Diária</p>
                    <p className="text-xs text-orange-500/70 mt-1 leading-tight">Iniciada · Em execução<br />Interrompida · Concluída</p>
                  </div>
                </button>
                <button onClick={() => confirmarTipo("continua")}
                  className="flex flex-col items-center gap-4 p-6 rounded-2xl border-2 border-teal-200 dark:border-teal-500/30 bg-teal-50 dark:bg-teal-500/10 hover:border-teal-400 hover:scale-[1.02] active:scale-[0.98] transition-all">
                  <div className="w-14 h-14 rounded-2xl bg-teal-600 flex items-center justify-center shadow-lg shadow-teal-500/30">
                    <ArrowPathIcon className="w-7 h-7 text-white" />
                  </div>
                  <div className="text-center">
                    <p className="font-black text-teal-700 dark:text-teal-400 text-base">Contínua</p>
                    <p className="text-xs text-teal-500/70 mt-1 leading-tight">Iniciada · Em execução<br />Concluída</p>
                  </div>
                </button>
              </div>
            )}

            {modalStep === 2 && (
              <form onSubmit={salvar} className="px-7 pb-7 pt-5 space-y-4">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Subtipo</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["pes", "doc_ext"] as Subtipo[]).map(sub => (
                      <button key={sub} type="button" onClick={() => setForm(p => ({
                        ...p,
                        subtipo: sub,
                        // reset doc_externo when switching subtipo
                        doc_externo: sub === "pes" ? "nao_possui" : (DOC_EXT_OPTS.includes(p.doc_externo as any) ? p.doc_externo : "MO"),
                      }))}
                        className={`py-2.5 rounded-xl border text-xs font-black transition-all ${
                          form.subtipo === sub
                            ? sub === "pes" ? "border-violet-500 bg-violet-500/10 text-violet-400" : "border-cyan-500 bg-cyan-500/10 text-cyan-400"
                            : "border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300 dark:hover:border-gray-600"
                        }`}>
                        {SUBTIPO_CONFIG[sub].label}
                        {form.subtipo === sub && <CheckIcon className="w-3 h-3 inline ml-1.5" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Doc. Externo */}
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">
                    Doc. Externo{form.subtipo === "doc_ext" && <span className="text-red-400 ml-0.5">*</span>}
                  </label>
                  <div className={`grid gap-2 ${form.subtipo === "pes" ? "grid-cols-5" : "grid-cols-4"}`}>
                    {form.subtipo === "pes" && (
                      <button type="button"
                        onClick={() => setForm(p => ({ ...p, doc_externo: "nao_possui" }))}
                        className={`py-2 rounded-xl border text-xs font-black transition-all ${
                          form.doc_externo === "nao_possui"
                            ? "border-gray-400 bg-gray-500/15 text-gray-300 ring-2 ring-offset-1 dark:ring-offset-gray-900 ring-[#0b7336]"
                            : "border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300"
                        }`}>
                        Não possui
                        {form.doc_externo === "nao_possui" && <CheckIcon className="w-3 h-3 inline ml-1" />}
                      </button>
                    )}
                    {DOC_EXT_OPTS.map(opt => (
                      <button key={opt} type="button"
                        onClick={() => setForm(p => ({ ...p, doc_externo: opt }))}
                        className={`py-2 rounded-xl border text-xs font-black transition-all ${
                          form.doc_externo === opt
                            ? (DOC_EXT_COLORS[opt] ?? "") + " ring-2 ring-offset-1 dark:ring-offset-gray-900 ring-[#0b7336]"
                            : "border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300"
                        }`}>
                        {opt}
                        {form.doc_externo === opt && <CheckIcon className="w-3 h-3 inline ml-1" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">
                      {form.subtipo === "pes" ? "Nº do PES" : "Nº Documento"}
                    </label>
                    <input type="text" value={form.numero_documento} onChange={e => setForm(p => ({ ...p, numero_documento: e.target.value }))}
                      placeholder={form.subtipo === "pes" ? "Ex: PES-001" : "Ex: 24.532-26"} className={inputCls} />
                  </div>
                  
                  {form.subtipo === "pes" && form.doc_externo !== "nao_possui" ? (
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">
                        Nº Documento <span className={`ml-2 text-[9px] px-1.5 py-0.5 rounded-full border font-black ${DOC_EXT_COLORS[form.doc_externo] ?? ""}`}>{form.doc_externo}</span>
                      </label>
                      <input type="text" value={form.numero_doc_ext} onChange={e => setForm(p => ({ ...p, numero_doc_ext: e.target.value }))}
                        placeholder={`Nº do documento ${form.doc_externo}...`} className={inputCls} />
                    </div>
                  ) : form.subtipo === "doc_ext" ? (
                    <div>
                      <label className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-1.5 block">Nome do Agente</label>
                      <input type="text" value={form.nome_agente} onChange={e => setForm(p => ({ ...p, nome_agente: e.target.value }))}
                        placeholder="Nome do agente responsável..." className={inputCls} />
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Data Fim</label>
                        <input type="date" value={form.data_fim} onChange={e => setForm(p => ({ ...p, data_fim: e.target.value }))} className={inputCls} />
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Hora Fim</label>
                        <input type="time" value={form.hora_fim} onChange={e => setForm(p => ({ ...p, hora_fim: e.target.value }))} className={inputCls} />
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Subestação <span className="text-red-400">*</span></label>
                    <input type="text" value={form.nome_projeto} onChange={e => setForm(p => ({ ...p, nome_projeto: e.target.value }))}
                      placeholder="Nome da subestação..." required className={inputCls} />
                  </div>
                  <div className="flex flex-col gap-3">
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Nº Tipo</label>
                      <select value={form.tipo_numero} onChange={e => setForm(p => ({ ...p, tipo_numero: e.target.value }))} className={inputCls}>
                        <option value="">—</option>
                        {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                    {["1", "2", "3"].includes(form.tipo_numero) && (
                      <div>
                        <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1.5 block">Nº SGI <span className="text-red-400">*</span></label>
                        <input type="text" value={form.numero_sgi} onChange={e => setForm(p => ({ ...p, numero_sgi: e.target.value }))}
                          placeholder="SGI..." required className={inputCls + " ring-1 ring-emerald-500/50"} />
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Atividade <span className="text-red-400">*</span></label>
                  <textarea value={form.atividade} onChange={e => setForm(p => ({ ...p, atividade: e.target.value }))}
                    placeholder="Descrição da atividade..." required rows={3}
                    className={inputCls + " resize-none"} />
                </div>

                {(form.subtipo === "pes" && form.doc_externo !== "nao_possui") || form.subtipo === "doc_ext" ? (
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Data Fim</label>
                      <input type="date" value={form.data_fim} onChange={e => setForm(p => ({ ...p, data_fim: e.target.value }))} className={inputCls} />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Hora Fim</label>
                      <input type="time" value={form.hora_fim} onChange={e => setForm(p => ({ ...p, hora_fim: e.target.value }))} className={inputCls} />
                    </div>
                  </div>
                ) : null}

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Status</label>
                  <div className="grid grid-cols-2 gap-2">
                    {statusOptions.map(s => {
                      const SIcon = s.icon;
                      return (
                        <button key={s.id} type="button" onClick={() => setForm(p => ({ ...p, status: s.id }))}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                            form.status === s.id
                              ? s.badge + " ring-2 ring-offset-1 dark:ring-offset-gray-900 ring-[#0b7336]"
                              : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
                          }`}>
                          <SIcon className="w-4 h-4 flex-shrink-0" />
                          {s.label}
                          {form.status === s.id && <CheckIcon className="w-3.5 h-3.5 ml-auto flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {form.status === "programada" && (
                  <div>
                    <label className="text-[10px] font-black text-sky-400 uppercase tracking-widest mb-1.5 block">Data/Hora da Programação <span className="text-red-400">*</span></label>
                    <input type="datetime-local" required value={form.data_programacao} onChange={e => setForm(p => ({ ...p, data_programacao: e.target.value }))} className={inputCls + " ring-1 ring-sky-500/50"} />
                  </div>
                )}

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
                            ? r.cls + " ring-2 ring-offset-1 dark:ring-offset-gray-900 ring-[#0b7336]"
                            : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
                        }`}>
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${form.registro === r.id ? r.dot : "bg-gray-400"}`} />
                        {r.label}
                        {form.registro === r.id && <CheckIcon className="w-3.5 h-3.5 ml-auto flex-shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Observação</label>
                  <textarea value={form.observacao} onChange={e => setForm(p => ({ ...p, observacao: e.target.value }))}
                    placeholder="Observações adicionais..." rows={3}
                    className={inputCls + " resize-none"} />
                </div>

                <button type="submit" disabled={saving}
                  className="w-full py-3.5 bg-[#0b7336] disabled:opacity-50 text-white rounded-xl font-black text-sm hover:bg-[#075a2a] transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2">
                  {saving ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <CheckIcon className="w-4 h-4" />}
                  {editId ? "Salvar Alterações" : "Criar Tarefa"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL EVENTO */}
      {showFormEvento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-[2rem] shadow-2xl w-full max-w-xl border border-gray-100 dark:border-gray-800 overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-7 pt-7 pb-5 sticky top-0 bg-white dark:bg-gray-900 z-10 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-xl font-black text-gray-900 dark:text-white">
                {editId ? "Editar Evento" : "Novo Evento"}
              </h2>
              <button onClick={fecharFormEvento} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={salvarEvento} className="p-7 space-y-4">
              {formEvento.tipo !== "conv_op" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Subestação <span className="text-red-400">*</span></label>
                    <input type="text" value={formEvento.subestacao} onChange={e => setFormEvento(p => ({ ...p, subestacao: e.target.value.toUpperCase() }))}
                      placeholder="Ex: SE MESSEJANA" required={formEvento.tipo !== "conv_op"} className={inputCls} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Concessão</label>
                    <input type="text" value={formEvento.concessao} onChange={e => setFormEvento(p => ({ ...p, concessao: e.target.value.toUpperCase() }))}
                      placeholder="Ex: CHESF" className={inputCls} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Ativo</label>
                    <input type="text" value={formEvento.ativo} onChange={e => setFormEvento(p => ({ ...p, ativo: e.target.value.toUpperCase() }))}
                      placeholder="Ex: 04T4" className={inputCls} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Previsão de Normalização</label>
                    <input
                      type="date"
                      value={formEvento.data}
                      onChange={e => {
                        const val = e.target.value;
                        let newStatus: StatusEvento = formEvento.status;
                        if (!val) {
                          newStatus = "sem_previsao";
                        } else {
                          const today = new Date().toISOString().split("T")[0];
                          newStatus = val < today ? "previsao_vencida" : "ativa";
                        }
                        setFormEvento(p => ({ ...p, data: val, status: newStatus }));
                      }}
                      className={inputCls}
                    />
                    {!formEvento.data && <p className="text-[9px] text-amber-400 mt-1 font-bold">Sem previsão definida</p>}
                    {formEvento.data && formEvento.data < new Date().toISOString().split("T")[0] && <p className="text-[9px] text-rose-400 mt-1 font-bold">Previsão vencida</p>}
                  </div>
                </div>
              )}

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Descrição <span className="text-red-400">*</span></label>
                <textarea value={formEvento.descricao} onChange={e => setFormEvento(p => ({ ...p, descricao: e.target.value }))}
                  placeholder="Detalhes do evento..." required rows={3} className={inputCls + " resize-none"} />
              </div>

              {formEvento.tipo !== "conv_op" && (
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Status</label>
                  <div className="grid grid-cols-2 gap-2">
                    {STATUS_EVENTO_LIST.map(s => {
                      const SIcon = s.icon;
                      return (
                        <button key={s.id} type="button" onClick={() => setFormEvento(p => ({ ...p, status: s.id }))}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                            formEvento.status === s.id
                              ? s.badge + " ring-2 ring-offset-1 dark:ring-offset-gray-900 ring-indigo-500"
                              : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300"
                          }`}>
                          <SIcon className="w-4 h-4 flex-shrink-0" />{s.label}
                          {formEvento.status === s.id && <CheckIcon className="w-3.5 h-3.5 ml-auto flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Registro</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { id: "registrada",     label: "Registrada",     cls: "border-indigo-500 bg-indigo-500/10 text-indigo-400", dot: "bg-indigo-400" },
                    { id: "nao_registrada", label: "Não Registrada", cls: "border-gray-400 bg-gray-500/10 text-gray-400",       dot: "bg-gray-400" },
                  ] as { id: Registro; label: string; cls: string; dot: string }[]).map(r => (
                    <button key={r.id} type="button" onClick={() => setFormEvento(p => ({ ...p, registro: r.id }))}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                        formEvento.registro === r.id
                          ? r.cls + " ring-2 ring-offset-1 dark:ring-offset-gray-900 ring-indigo-500"
                          : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300"
                      }`}>
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${formEvento.registro === r.id ? r.dot : "bg-gray-400"}`} />
                      {r.label}
                      {formEvento.registro === r.id && <CheckIcon className="w-3.5 h-3.5 ml-auto flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>

              <button type="submit" disabled={saving}
                className="w-full py-3.5 bg-indigo-600 disabled:opacity-50 text-white rounded-xl font-black text-sm hover:bg-indigo-700 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2">
                {saving ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <CheckIcon className="w-4 h-4" />}
                {editId ? "Salvar Alterações" : "Salvar Evento"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Dropdown status evento */}
      {statusEventoDropdown && (() => {
        const e = eventos.find(x => x.id === statusEventoDropdown.id);
        if (!e) return null;
        return (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setStatusEventoDropdown(null)} />
            <div className="fixed z-50 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-1.5 min-w-[160px] -translate-x-1/2"
              style={{ top: statusEventoDropdown.top, left: statusEventoDropdown.left }}>
              {STATUS_EVENTO_LIST.map(s => (
                <button key={s.id}
                  onClick={() => { alterarStatusEvento(e.id, s.id); setStatusEventoDropdown(null); }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-[11px] font-bold transition-all hover:bg-gray-800 ${e.status === s.id ? s.badge : "text-gray-400 hover:text-gray-200"}`}>
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
                  {s.label}
                  {e.status === s.id && <CheckIcon className="w-3 h-3 ml-auto" />}
                </button>
              ))}
            </div>
          </>
        );
      })()}

      {/* MODAL EMAIL */}
      {modalEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-[2rem] shadow-2xl w-full max-w-lg border border-gray-100 dark:border-gray-800 p-7">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-gray-900 dark:text-white">Enviar Relatório</h2>
              <button onClick={() => setModalEmail(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">E-mail Destino <span className="text-red-400">*</span></label>
                <input type="email" value={emailDest} onChange={e => setEmailDest(e.target.value)} placeholder="email@exemplo.com" className={inputCls} />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">E-mail Cópia (CC)</label>
                <input type="email" value={emailCc} onChange={e => setEmailCc(e.target.value)} placeholder="copia@exemplo.com (opcional)" className={inputCls} />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={copiarRelatorio} className="flex-1 py-3.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-black text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-all flex items-center justify-center gap-2">
                <DocumentTextIcon className="w-4 h-4" />Copiar
              </button>
              <button onClick={enviarEmail} className="flex-1 py-3.5 bg-indigo-600 text-white rounded-xl font-black text-sm hover:bg-indigo-700 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2">
                <EnvelopeIcon className="w-4 h-4" />Enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
