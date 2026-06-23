"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "react-hot-toast";
import {
  LockClosedIcon,
  BoltIcon,
  PhoneIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  CheckIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon,
  BuildingOfficeIcon,
} from "@heroicons/react/24/outline";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Senha {
  id: string;
  aplicativo_sistema: string;
  id_usuario: string;
  senha: string;
  created_at: string;
}

interface Transformador {
  id: string;
  concessao: string;
  se: string;
  tap_max: string;
  tap_central: string;
  transformacao: string;
  created_at: string;
}

interface AgendaYealink {
  id: string;
  display_name: string;
  office_number: string;
  mobile_number: string;
  other_number: string;
  line: string;
  ring: string;
  priority: string;
  group_id_name: string;
  default_photo: string;
  photo_data: string;
  created_at: string;
}

interface ContratoDistribuidora {
  id: string;
  substacao: string;
  concessionaria: string;
  telefone: string;
  titular: string;
  conta_contrato: string;
  instalacao: string;
  endereco: string;
  created_at: string;
}

type TabKey = "senhas" | "transformadores" | "agenda" | "contratos";

const inputCls =
  "w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white";

// ─── Component ────────────────────────────────────────────────────────────────
export default function InformacoesPage() {
  const [tab, setTab] = useState<TabKey>("senhas");

  // ── Senhas ──
  const [senhas, setSenhas] = useState<Senha[]>([]);
  const [loadingSenhas, setLoadingSenhas] = useState(true);
  const [modalSenha, setModalSenha] = useState(false);
  const [editSenha, setEditSenha] = useState<Senha | null>(null);
  const [fSistema, setFSistema] = useState("");
  const [fUsuario, setFUsuario] = useState("");
  const [fSenha, setFSenha] = useState("");
  const [buscaSenha, setBuscaSenha] = useState("");
  const [showSenha, setShowSenha] = useState<Record<string, boolean>>({});

  // ── Transformadores ──
  const [transformadores, setTransformadores] = useState<Transformador[]>([]);
  const [loadingTrans, setLoadingTrans] = useState(true);
  const [modalTrans, setModalTrans] = useState(false);
  const [editTrans, setEditTrans] = useState<Transformador | null>(null);
  const [tConcessao, setTConcessao] = useState("");
  const [tSe, setTSe] = useState("");
  const [tTapMax, setTTapMax] = useState("");
  const [tTapCentral, setTTapCentral] = useState("");
  const [tTransformacao, setTTransformacao] = useState("");
  const [buscaTrans, setBuscaTrans] = useState("");

  // ── Agenda Yealink ──
  const [agenda, setAgenda] = useState<AgendaYealink[]>([]);
  const [loadingAgenda, setLoadingAgenda] = useState(true);
  const [modalAgenda, setModalAgenda] = useState(false);
  const [editAgenda, setEditAgenda] = useState<AgendaYealink | null>(null);
  const [aForm, setAForm] = useState({
    display_name: "", office_number: "", mobile_number: "", other_number: "",
    line: "", ring: "", priority: "", group_id_name: "", default_photo: "", photo_data: ""
  });
  const [buscaAgenda, setBuscaAgenda] = useState("");

  // ── Contratos Distribuidoras ──
  const [contratos, setContratos] = useState<ContratoDistribuidora[]>([]);
  const [loadingContratos, setLoadingContratos] = useState(true);
  const [modalContrato, setModalContrato] = useState(false);
  const [editContrato, setEditContrato] = useState<ContratoDistribuidora | null>(null);
  const [cForm, setCForm] = useState({ substacao: "", concessionaria: "", telefone: "", titular: "", conta_contrato: "", instalacao: "", endereco: "" });
  const [buscaContratos, setBuscaContratos] = useState("");

  const [saving, setSaving] = useState(false);

  // ── Fetch ──
  useEffect(() => { fetchSenhas(); fetchTransformadores(); fetchAgenda(); fetchContratos(); }, []);

  async function fetchSenhas() {
    setLoadingSenhas(true);
    const { data } = await supabase.from("info_senhas").select("*").order("aplicativo_sistema");
    setSenhas(data || []);
    setLoadingSenhas(false);
  }

  async function fetchTransformadores() {
    setLoadingTrans(true);
    const { data } = await supabase.from("info_transformadores").select("*").order("se");
    setTransformadores(data || []);
    setLoadingTrans(false);
  }

  async function fetchAgenda() {
    setLoadingAgenda(true);
    const { data } = await supabase.from("info_agenda_yealink").select("*").order("display_name");
    setAgenda(data || []);
    setLoadingAgenda(false);
  }

  // ── Filter ──
  const senhasFilt = useMemo(() =>
    senhas.filter(s =>
      s.aplicativo_sistema.toLowerCase().includes(buscaSenha.toLowerCase()) ||
      s.id_usuario.toLowerCase().includes(buscaSenha.toLowerCase())
    ), [senhas, buscaSenha]);

  const transFilt = useMemo(() =>
    transformadores.filter(t =>
      t.se.toLowerCase().includes(buscaTrans.toLowerCase()) ||
      t.concessao.toLowerCase().includes(buscaTrans.toLowerCase())
    ), [transformadores, buscaTrans]);

  const agendaFilt = useMemo(() =>
    agenda.filter(a =>
      a.display_name.toLowerCase().includes(buscaAgenda.toLowerCase()) ||
      a.office_number.toLowerCase().includes(buscaAgenda.toLowerCase()) ||
      a.group_id_name.toLowerCase().includes(buscaAgenda.toLowerCase())
    ), [agenda, buscaAgenda]);

  const contratosFilt = useMemo(() =>
    contratos.filter(c =>
      c.substacao.toLowerCase().includes(buscaContratos.toLowerCase()) ||
      c.concessionaria.toLowerCase().includes(buscaContratos.toLowerCase()) ||
      c.conta_contrato.toLowerCase().includes(buscaContratos.toLowerCase())
    ), [contratos, buscaContratos]);

  async function fetchContratos() {
    setLoadingContratos(true);
    const { data } = await supabase.from("contratos_distribuidoras").select("*").order("substacao");
    setContratos(data || []);
    setLoadingContratos(false);
  }

  // ── Senha CRUD ──
  function openNewSenha() { setEditSenha(null); setFSistema(""); setFUsuario(""); setFSenha(""); setModalSenha(true); }
  function openEditSenha(s: Senha) { setEditSenha(s); setFSistema(s.aplicativo_sistema); setFUsuario(s.id_usuario); setFSenha(s.senha); setModalSenha(true); }

  async function saveSenha(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      const payload = { aplicativo_sistema: fSistema.trim(), id_usuario: fUsuario.trim(), senha: fSenha };
      if (editSenha) {
        const { error } = await supabase.from("info_senhas").update(payload).eq("id", editSenha.id);
        if (error) throw error;
        toast.success("Atualizada!");
      } else {
        const { error } = await supabase.from("info_senhas").insert(payload);
        if (error) throw error;
        toast.success("Salva!");
      }
      setModalSenha(false); fetchSenhas();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  async function deleteSenha(id: string) {
    if (!confirm("Excluir?")) return;
    await supabase.from("info_senhas").delete().eq("id", id);
    fetchSenhas();
  }

  // ── Transformador CRUD ──
  function openNewTrans() { setEditTrans(null); setTConcessao(""); setTSe(""); setTTapMax(""); setTTapCentral(""); setTTransformacao(""); setModalTrans(true); }
  function openEditTrans(t: Transformador) { setEditTrans(t); setTConcessao(t.concessao); setTSe(t.se); setTTapMax(t.tap_max); setTTapCentral(t.tap_central); setTTransformacao(t.transformacao); setModalTrans(true); }

  async function saveTrans(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      const payload = { concessao: tConcessao.trim(), se: tSe.trim(), tap_max: tTapMax.trim(), tap_central: tTapCentral.trim(), transformacao: tTransformacao.trim() };
      if (editTrans) {
        const { error } = await supabase.from("info_transformadores").update(payload).eq("id", editTrans.id);
        if (error) throw error;
        toast.success("Atualizado!");
      } else {
        const { error } = await supabase.from("info_transformadores").insert(payload);
        if (error) throw error;
        toast.success("Salvo!");
      }
      setModalTrans(false); fetchTransformadores();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  async function deleteTrans(id: string) {
    if (!confirm("Excluir?")) return;
    await supabase.from("info_transformadores").delete().eq("id", id);
    fetchTransformadores();
  }

  // ── Agenda CRUD ──
  function openNewAgenda() { setEditAgenda(null); setAForm({ display_name: "", office_number: "", mobile_number: "", other_number: "", line: "", ring: "", priority: "", group_id_name: "", default_photo: "", photo_data: "" }); setModalAgenda(true); }
  function openEditAgenda(a: AgendaYealink) {
    setEditAgenda(a);
    setAForm({ display_name: a.display_name, office_number: a.office_number, mobile_number: a.mobile_number, other_number: a.other_number, line: a.line, ring: a.ring, priority: a.priority, group_id_name: a.group_id_name, default_photo: a.default_photo, photo_data: a.photo_data });
    setModalAgenda(true);
  }

  async function saveAgenda(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      if (editAgenda) {
        const { error } = await supabase.from("info_agenda_yealink").update(aForm).eq("id", editAgenda.id);
        if (error) throw error;
        toast.success("Atualizado!");
      } else {
        const { error } = await supabase.from("info_agenda_yealink").insert(aForm);
        if (error) throw error;
        toast.success("Salvo!");
      }
      setModalAgenda(false); fetchAgenda();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  async function deleteAgenda(id: string) {
    if (!confirm("Excluir?")) return;
    await supabase.from("info_agenda_yealink").delete().eq("id", id);
    fetchAgenda();
  }

  // ── Export Yealink XML ──
  function exportYealinkXml() {
    const entries = agenda.map(a => `  <DirectoryEntry>
    <FirstName>${a.display_name}</FirstName>
    <LastName></LastName>
    <Telephone>${a.office_number}</Telephone>
    <Telephone2>${a.mobile_number}</Telephone2>
    <Telephone3>${a.other_number}</Telephone3>
    <AccountIndex>${a.line || "0"}</AccountIndex>
    <Ring>${a.ring || "Auto"}</Ring>
    <Group>${a.group_id_name}</Group>
  </DirectoryEntry>`).join("\n");
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<YealinkIPPhoneDirectory>\n${entries}\n</YealinkIPPhoneDirectory>`;
    const blob = new Blob([xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "agenda_yealink.xml"; a.click();
    URL.revokeObjectURL(url);
    toast.success("XML exportado!");
  }

  // ── Contratos CRUD ──
  function openNewContrato() { setEditContrato(null); setCForm({ substacao: "", concessionaria: "", telefone: "", titular: "", conta_contrato: "", instalacao: "", endereco: "" }); setModalContrato(true); }
  function openEditContrato(c: ContratoDistribuidora) { setEditContrato(c); setCForm({ substacao: c.substacao, concessionaria: c.concessionaria, telefone: c.telefone || "", titular: c.titular || "", conta_contrato: c.conta_contrato || "", instalacao: c.instalacao || "", endereco: c.endereco || "" }); setModalContrato(true); }

  async function saveContrato(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      if (editContrato) {
        const { error } = await supabase.from("contratos_distribuidoras").update(cForm).eq("id", editContrato.id);
        if (error) throw error;
        toast.success("Atualizado!");
      } else {
        const { error } = await supabase.from("contratos_distribuidoras").insert(cForm);
        if (error) throw error;
        toast.success("Salvo!");
      }
      setModalContrato(false); fetchContratos();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  async function deleteContrato(id: string) {
    if (!confirm("Excluir?")) return;
    await supabase.from("contratos_distribuidoras").delete().eq("id", id);
    fetchContratos();
  }

  // ─── Tabs config ───────────────────────────────────────────────────────────
  const tabs = [
    { key: "senhas" as TabKey, label: "Senhas", icon: LockClosedIcon, color: "indigo" },
    { key: "transformadores" as TabKey, label: "Info. Transformadores", icon: BoltIcon, color: "amber" },
    { key: "agenda" as TabKey, label: "Agenda YEALINK", icon: PhoneIcon, color: "emerald" },
    { key: "contratos" as TabKey, label: "Contratos Distribuidoras (SEs)", icon: BuildingOfficeIcon, color: "blue" },
  ];

  const tabColor: Record<string, string> = {
    indigo: "bg-indigo-600 text-white",
    amber: "bg-amber-500 text-white",
    emerald: "bg-emerald-600 text-white",
    blue: "bg-blue-600 text-white",
  };

  const activeColor = tabs.find(t => t.key === tab)?.color || "indigo";

  return (
    <div className="h-full flex flex-col p-4 md:p-8 gap-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Controle de Informações</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Senhas, transformadores e agenda telefônica centralizada</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${tab === t.key ? tabColor[t.color] : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-gray-300"}`}>
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ═══ SENHAS ═══ */}
      {tab === "senhas" && (
        <div className="flex-1 flex flex-col gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <input value={buscaSenha} onChange={e => setBuscaSenha(e.target.value)}
              placeholder="Pesquisar sistema ou usuário..."
              className="flex-1 min-w-[200px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white" />
            <button onClick={openNewSenha}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-all">
              <PlusIcon className="w-4 h-4" /> Nova Senha
            </button>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-[1.5rem] border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
            {loadingSenhas ? <div className="flex justify-center py-16"><ArrowPathIcon className="w-6 h-6 text-indigo-500 animate-spin" /></div> : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800">
                      <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-left">Aplicativo / Sistema</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-left">ID (Usuário)</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-left">Senha</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {senhasFilt.length === 0 ? (
                      <tr><td colSpan={4} className="text-center py-16 text-gray-400 text-sm font-bold">Nenhum registro</td></tr>
                    ) : senhasFilt.map(s => (
                      <tr key={s.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                        <td className="px-6 py-4 font-bold text-sm text-gray-900 dark:text-white">{s.aplicativo_sistema}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 font-mono">{s.id_usuario}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-gray-700 dark:text-gray-200">
                              {showSenha[s.id] ? s.senha : "••••••••"}
                            </span>
                            <button onClick={() => setShowSenha(p => ({ ...p, [s.id]: !p[s.id] }))}
                              className="text-[10px] font-black text-indigo-500 hover:text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200 hover:border-indigo-400 transition-colors">
                              {showSenha[s.id] ? "Ocultar" : "Ver"}
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => openEditSenha(s)} className="p-1.5 text-gray-400 hover:text-indigo-600 bg-gray-100 hover:bg-indigo-50 rounded-lg transition-colors"><PencilIcon className="w-4 h-4" /></button>
                            <button onClick={() => deleteSenha(s.id)} className="p-1.5 text-gray-400 hover:text-red-600 bg-gray-100 hover:bg-red-50 rounded-lg transition-colors"><TrashIcon className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ TRANSFORMADORES ═══ */}
      {tab === "transformadores" && (
        <div className="flex-1 flex flex-col gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <input value={buscaTrans} onChange={e => setBuscaTrans(e.target.value)}
              placeholder="Pesquisar SE ou concessão..."
              className="flex-1 min-w-[200px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-500 dark:text-white" />
            <button onClick={openNewTrans}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-all">
              <PlusIcon className="w-4 h-4" /> Novo Transformador
            </button>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-[1.5rem] border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
            {loadingTrans ? <div className="flex justify-center py-16"><ArrowPathIcon className="w-6 h-6 text-amber-500 animate-spin" /></div> : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800">
                      {["Concessão", "SE", "TAP MÁX", "TAP CENTRAL", "Transformação", ""].map(h => (
                        <th key={h} className={`px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest ${h === "" ? "text-right" : "text-left"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {transFilt.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-16 text-gray-400 text-sm font-bold">Nenhum registro</td></tr>
                    ) : transFilt.map(t => (
                      <tr key={t.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                        <td className="px-6 py-4 text-sm font-bold text-gray-900 dark:text-white">{t.concessao}</td>
                        <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-200 font-mono">{t.se}</td>
                        <td className="px-6 py-4 text-sm text-amber-600 dark:text-amber-400 font-black">{t.tap_max}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">{t.tap_central}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">{t.transformacao}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => openEditTrans(t)} className="p-1.5 text-gray-400 hover:text-amber-600 bg-gray-100 hover:bg-amber-50 rounded-lg transition-colors"><PencilIcon className="w-4 h-4" /></button>
                            <button onClick={() => deleteTrans(t.id)} className="p-1.5 text-gray-400 hover:text-red-600 bg-gray-100 hover:bg-red-50 rounded-lg transition-colors"><TrashIcon className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ AGENDA YEALINK ═══ */}
      {tab === "agenda" && (
        <div className="flex-1 flex flex-col gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <input value={buscaAgenda} onChange={e => setBuscaAgenda(e.target.value)}
              placeholder="Pesquisar nome, número ou grupo..."
              className="flex-1 min-w-[200px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white" />
            <button onClick={exportYealinkXml}
              className="flex items-center gap-2 bg-gray-700 hover:bg-gray-800 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-all">
              <ArrowDownTrayIcon className="w-4 h-4" /> Exportar XML
            </button>
            <button onClick={openNewAgenda}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-all">
              <PlusIcon className="w-4 h-4" /> Novo Contato
            </button>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-[1.5rem] border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
            {loadingAgenda ? <div className="flex justify-center py-16"><ArrowPathIcon className="w-6 h-6 text-emerald-500 animate-spin" /></div> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800">
                      {["Nome", "Ramal/Fixo", "Celular", "Outro", "Linha", "Ring", "Prioridade", "Grupo", ""].map(h => (
                        <th key={h} className={`px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest ${h === "" ? "text-right" : "text-left"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {agendaFilt.length === 0 ? (
                      <tr><td colSpan={9} className="text-center py-16 text-gray-400 font-bold">Nenhum contato</td></tr>
                    ) : agendaFilt.map(a => (
                      <tr key={a.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 font-bold text-gray-900 dark:text-white whitespace-nowrap">{a.display_name}</td>
                        <td className="px-4 py-3 font-mono text-gray-600 dark:text-gray-300">{a.office_number || "—"}</td>
                        <td className="px-4 py-3 font-mono text-gray-600 dark:text-gray-300">{a.mobile_number || "—"}</td>
                        <td className="px-4 py-3 font-mono text-gray-500">{a.other_number || "—"}</td>
                        <td className="px-4 py-3 text-center text-gray-500">{a.line || "—"}</td>
                        <td className="px-4 py-3 text-gray-500">{a.ring || "—"}</td>
                        <td className="px-4 py-3 text-center text-gray-500">{a.priority || "—"}</td>
                        <td className="px-4 py-3">
                          {a.group_id_name ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 whitespace-nowrap">
                              {a.group_id_name}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => openEditAgenda(a)} className="p-1.5 text-gray-400 hover:text-emerald-600 bg-gray-100 hover:bg-emerald-50 rounded-lg transition-colors"><PencilIcon className="w-4 h-4" /></button>
                            <button onClick={() => deleteAgenda(a.id)} className="p-1.5 text-gray-400 hover:text-red-600 bg-gray-100 hover:bg-red-50 rounded-lg transition-colors"><TrashIcon className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ CONTRATOS DISTRIBUIDORAS ═══ */}
      {tab === "contratos" && (
        <div className="flex-1 flex flex-col gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <input value={buscaContratos} onChange={e => setBuscaContratos(e.target.value)}
              placeholder="Pesquisar SE, concessionária ou conta..."
              className="flex-1 min-w-[200px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
            <button onClick={openNewContrato}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-all">
              <PlusIcon className="w-4 h-4" /> Novo Contrato
            </button>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-[1.5rem] border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
            {loadingContratos ? <div className="flex justify-center py-16"><ArrowPathIcon className="w-6 h-6 text-blue-500 animate-spin" /></div> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800">
                      {["Subestação", "Concessionária", "Telefone", "Titular", "Conta Contrato", "Instalação", "Endereço", ""].map(h => (
                        <th key={h} className={`px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest ${h === "" ? "text-right" : "text-left"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {contratosFilt.length === 0 ? (
                      <tr><td colSpan={8} className="text-center py-16 text-gray-400 font-bold">Nenhum contrato</td></tr>
                    ) : contratosFilt.map(c => (
                      <tr key={c.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">{c.substacao}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{c.concessionaria}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{c.telefone || "—"}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{c.titular || "—"}</td>
                        <td className="px-4 py-3 font-mono text-gray-600 dark:text-gray-300">{c.conta_contrato || "—"}</td>
                        <td className="px-4 py-3 font-mono text-gray-600 dark:text-gray-300">{c.instalacao || "—"}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{c.endereco || "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => openEditContrato(c)} className="p-1.5 text-gray-400 hover:text-blue-600 bg-gray-100 hover:bg-blue-50 rounded-lg transition-colors"><PencilIcon className="w-4 h-4" /></button>
                            <button onClick={() => deleteContrato(c.id)} className="p-1.5 text-gray-400 hover:text-red-600 bg-gray-100 hover:bg-red-50 rounded-lg transition-colors"><TrashIcon className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ MODAL SENHA ═══ */}
      {modalSenha && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-[2rem] shadow-2xl w-full max-w-md border border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between px-7 py-5 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-xl font-black text-gray-900 dark:text-white">{editSenha ? "Editar Senha" : "Nova Senha"}</h2>
              <button onClick={() => setModalSenha(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl"><XMarkIcon className="w-5 h-5" /></button>
            </div>
            <form onSubmit={saveSenha} className="p-7 space-y-4">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Aplicativo / Sistema *</label>
                <input required value={fSistema} onChange={e => setFSistema(e.target.value)} className={inputCls} placeholder="Ex: SCADA, VPN, Supabase..." />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">ID (Usuário) *</label>
                <input required value={fUsuario} onChange={e => setFUsuario(e.target.value)} className={inputCls} placeholder="Ex: admin@cymi.com.br" />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Senha *</label>
                <input required value={fSenha} onChange={e => setFSenha(e.target.value)} className={inputCls} placeholder="Senha" />
              </div>
              <button type="submit" disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 rounded-xl flex justify-center items-center gap-2 transition-all">
                {saving ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <CheckIcon className="w-4 h-4" />}
                {editSenha ? "Salvar Alterações" : "Registrar"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ═══ MODAL TRANSFORMADOR ═══ */}
      {modalTrans && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-[2rem] shadow-2xl w-full max-w-md border border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between px-7 py-5 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-xl font-black text-gray-900 dark:text-white">{editTrans ? "Editar Transformador" : "Novo Transformador"}</h2>
              <button onClick={() => setModalTrans(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl"><XMarkIcon className="w-5 h-5" /></button>
            </div>
            <form onSubmit={saveTrans} className="p-7 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Concessão *</label>
                  <input required value={tConcessao} onChange={e => setTConcessao(e.target.value)} className={inputCls} placeholder="Ex: CHESF" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">SE *</label>
                  <input required value={tSe} onChange={e => setTSe(e.target.value)} className={inputCls} placeholder="Ex: SE MESSEJANA" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">TAP MÁX</label>
                  <input value={tTapMax} onChange={e => setTTapMax(e.target.value)} className={inputCls} placeholder="Ex: 17" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">TAP CENTRAL</label>
                  <input value={tTapCentral} onChange={e => setTTapCentral(e.target.value)} className={inputCls} placeholder="Ex: 9" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Transformação</label>
                <input value={tTransformacao} onChange={e => setTTransformacao(e.target.value)} className={inputCls} placeholder="Ex: 230/69 kV" />
              </div>
              <button type="submit" disabled={saving} className="w-full bg-amber-500 hover:bg-amber-600 text-white font-black py-3 rounded-xl flex justify-center items-center gap-2 transition-all">
                {saving ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <CheckIcon className="w-4 h-4" />}
                {editTrans ? "Salvar Alterações" : "Registrar"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ═══ MODAL AGENDA ═══ */}
      {modalAgenda && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between px-7 py-5 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-xl font-black text-gray-900 dark:text-white">{editAgenda ? "Editar Contato" : "Novo Contato"}</h2>
              <button onClick={() => setModalAgenda(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl"><XMarkIcon className="w-5 h-5" /></button>
            </div>
            <div className="p-7 overflow-y-auto">
              <form id="agendaForm" onSubmit={saveAgenda} className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Nome Display *</label>
                  <input required value={aForm.display_name} onChange={e => setAForm({ ...aForm, display_name: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Ramal/Fixo</label>
                  <input value={aForm.office_number} onChange={e => setAForm({ ...aForm, office_number: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Celular</label>
                  <input value={aForm.mobile_number} onChange={e => setAForm({ ...aForm, mobile_number: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Outro Número</label>
                  <input value={aForm.other_number} onChange={e => setAForm({ ...aForm, other_number: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Grupo</label>
                  <input value={aForm.group_id_name} onChange={e => setAForm({ ...aForm, group_id_name: e.target.value })} className={inputCls} placeholder="Ex: Engenharia" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Linha (AccountIndex)</label>
                  <input value={aForm.line} onChange={e => setAForm({ ...aForm, line: e.target.value })} className={inputCls} placeholder="Padrão: 0" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Toque (Ring)</label>
                  <input value={aForm.ring} onChange={e => setAForm({ ...aForm, ring: e.target.value })} className={inputCls} placeholder="Padrão: Auto" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Priority</label>
                  <input value={aForm.priority} onChange={e => setAForm({ ...aForm, priority: e.target.value })} className={inputCls} placeholder="Ex: 1" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Default Photo</label>
                  <input value={aForm.default_photo} onChange={e => setAForm({ ...aForm, default_photo: e.target.value })} className={inputCls} placeholder="0 ou 1" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Photo Data</label>
                  <input value={aForm.photo_data} onChange={e => setAForm({ ...aForm, photo_data: e.target.value })} className={inputCls} placeholder="Base64 ou URL" />
                </div>
              </form>
            </div>
            <div className="p-7 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 rounded-b-[2rem]">
              <button form="agendaForm" type="submit" disabled={saving} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-xl flex justify-center items-center gap-2 transition-all">
                {saving ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <CheckIcon className="w-4 h-4" />}
                {editAgenda ? "Salvar Alterações" : "Registrar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL CONTRATOS ═══ */}
      {modalContrato && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between px-7 py-5 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-xl font-black text-gray-900 dark:text-white">{editContrato ? "Editar Contrato" : "Novo Contrato"}</h2>
              <button onClick={() => setModalContrato(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl"><XMarkIcon className="w-5 h-5" /></button>
            </div>
            <div className="p-7 overflow-y-auto">
              <form id="contratoForm" onSubmit={saveContrato} className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Subestação *</label>
                  <input required value={cForm.substacao} onChange={e => setCForm({ ...cForm, substacao: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Concessionária *</label>
                  <input required value={cForm.concessionaria} onChange={e => setCForm({ ...cForm, concessionaria: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Telefone</label>
                  <input value={cForm.telefone} onChange={e => setCForm({ ...cForm, telefone: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Titular</label>
                  <input value={cForm.titular} onChange={e => setCForm({ ...cForm, titular: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Conta Contrato</label>
                  <input value={cForm.conta_contrato} onChange={e => setCForm({ ...cForm, conta_contrato: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Instalação</label>
                  <input value={cForm.instalacao} onChange={e => setCForm({ ...cForm, instalacao: e.target.value })} className={inputCls} />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Endereço</label>
                  <input value={cForm.endereco} onChange={e => setCForm({ ...cForm, endereco: e.target.value })} className={inputCls} />
                </div>
              </form>
            </div>
            <div className="p-7 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 rounded-b-[2rem]">
              <button form="contratoForm" type="submit" disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-3 rounded-xl flex justify-center items-center gap-2 transition-all">
                {saving ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <CheckIcon className="w-4 h-4" />}
                {editContrato ? "Salvar Alterações" : "Registrar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
