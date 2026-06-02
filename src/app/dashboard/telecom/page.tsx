"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  PlusIcon, PencilSquareIcon, TrashIcon, EnvelopeIcon,
  XMarkIcon, CheckIcon, PhoneIcon
} from "@heroicons/react/24/outline";
import toast from "react-hot-toast";

interface TelecomRow {
  id: string;
  origem: string;
  destino: string;
  provedor: string;
  canal: string;
  contato: string;
  designacao: string;
  mensagem_padrao: string;
  observacoes_internas: string;
  contatos_internos: string;
  created_at: string;
}

const ADMINS = ["inacio", "eliton", "pablo", "steffany", "stéffany", "rafael", "ramos", "brendo", "oliveira", "logistica@cymi.com.br"];

function isAdmin(email: string) {
  const lc = email.toLowerCase();
  return ADMINS.some(a => lc.includes(a));
}

const inputCls = "w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all";

const EMPTY: Omit<TelecomRow, "id" | "created_at"> = {
  origem: "", destino: "", provedor: "", canal: "",
  contato: "", designacao: "", mensagem_padrao: "",
  observacoes_internas: "", contatos_internos: "",
};

export default function TelecomPage() {
  const [rows, setRows] = useState<TelecomRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [admin, setAdmin] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const email = data?.session?.user?.email || "";
      setUserEmail(email);
      setAdmin(isAdmin(email));
    });
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("telecom_linhas").select("*").order("created_at", { ascending: true });
    setRows(data || []);
    setLoading(false);
  }

  function openNew() {
    setEditId(null);
    setForm({ ...EMPTY });
    setShowForm(true);
  }

  function openEdit(r: TelecomRow) {
    setEditId(r.id);
    setForm({
      origem: r.origem, destino: r.destino, provedor: r.provedor,
      canal: r.canal, contato: r.contato, designacao: r.designacao,
      mensagem_padrao: r.mensagem_padrao, observacoes_internas: r.observacoes_internas,
      contatos_internos: r.contatos_internos,
    });
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editId) {
        const { error } = await supabase.from("telecom_linhas").update(form).eq("id", editId);
        if (error) throw error;
        toast.success("Linha atualizada!");
      } else {
        const { error } = await supabase.from("telecom_linhas").insert(form);
        if (error) throw error;
        toast.success("Linha criada!");
      }
      setShowForm(false);
      load();
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir esta linha?")) return;
    const { error } = await supabase.from("telecom_linhas").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Excluída!");
    load();
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function abrirChamado() {
    const selecionadas = rows.filter(r => selected.has(r.id));
    if (selecionadas.length === 0) { toast.error("Selecione ao menos uma linha."); return; }

    const corpo = selecionadas.map(r => {
      const msg = r.mensagem_padrao || "(sem mensagem padrão)";
      return `Origem: ${r.origem}\nDestino: ${r.destino}\nDesignação: ${r.designacao}\n\n${msg}`;
    }).join("\n\n---\n\n");

    const destinos = [...new Set(selecionadas.map(r => r.contatos_internos).filter(Boolean))].join(";");
    const assunto = encodeURIComponent(`Chamado Telecom – ${new Date().toLocaleDateString("pt-BR")}`);
    const corpoEnc = encodeURIComponent(corpo);
    window.open(`mailto:${destinos}?subject=${assunto}&body=${corpoEnc}`);
  }

  const cols = ["Origem","Destino","Provedor","Canal","Contato","Designação","Mensagem Padrão","Obs. Internas","Contatos Internos"];

  return (
    <div className="p-4 md:p-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
            <PhoneIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Controle Telecom</h1>
            <p className="text-xs text-gray-500 font-medium">{rows.length} linha{rows.length !== 1 ? "s" : ""} cadastrada{rows.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {selected.size > 0 && (
            <button onClick={abrirChamado}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-lg transition-all active:scale-95">
              <EnvelopeIcon className="w-4 h-4" />
              Abrir Chamado
              <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px] font-black">{selected.size}</span>
            </button>
          )}
          {admin && (
            <button onClick={openNew}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#0b7336] hover:bg-[#09602c] text-white font-bold rounded-xl text-sm shadow-lg transition-all active:scale-95">
              <PlusIcon className="w-4 h-4" />
              Nova Linha
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-400">
          <PhoneIcon className="w-12 h-12" />
          <p className="font-bold">Nenhuma linha cadastrada</p>
          {admin && <button onClick={openNew} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold">Criar primeira linha</button>}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="px-3 py-3 w-10" />
                {cols.map(c => (
                  <th key={c} className="px-3 py-3 text-left text-[9px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">{c}</th>
                ))}
                {admin && <th className="px-3 py-3 w-16" />}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className={`border-b border-gray-50 dark:border-gray-800 transition-colors group ${selected.has(r.id) ? "bg-indigo-50 dark:bg-indigo-900/10" : "hover:bg-gray-50/50 dark:hover:bg-gray-800/30"}`}>
                  <td className="px-3 py-3 text-center">
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                  </td>
                  <td className="px-3 py-3 font-bold text-gray-900 dark:text-white whitespace-nowrap">{r.origem || "—"}</td>
                  <td className="px-3 py-3 text-gray-500 whitespace-nowrap">{r.destino || "—"}</td>
                  <td className="px-3 py-3 text-gray-500 whitespace-nowrap">{r.provedor || "—"}</td>
                  <td className="px-3 py-3 text-gray-500 whitespace-nowrap">{r.canal || "—"}</td>
                  <td className="px-3 py-3 text-gray-500 whitespace-nowrap">{r.contato || "—"}</td>
                  <td className="px-3 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap font-mono text-xs">{r.designacao || "—"}</td>
                  <td className="px-3 py-3 max-w-[240px]">
                    <p className="text-xs text-gray-500 leading-relaxed line-clamp-3">{r.mensagem_padrao || "—"}</p>
                  </td>
                  <td className="px-3 py-3 max-w-[200px]">
                    <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">{r.observacoes_internas || "—"}</p>
                  </td>
                  <td className="px-3 py-3 text-xs text-indigo-600 dark:text-indigo-400 whitespace-nowrap">{r.contatos_internos || "—"}</td>
                  {admin && (
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(r)} className="p-1.5 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors">
                          <PencilSquareIcon className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(r.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors">
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL FORM */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-[2rem] shadow-2xl w-full max-w-2xl border border-gray-100 dark:border-gray-800 overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-7 pt-7 pb-5 sticky top-0 bg-white dark:bg-gray-900 z-10 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-xl font-black text-gray-900 dark:text-white">{editId ? "Editar Linha" : "Nova Linha Telecom"}</h2>
              <button onClick={() => setShowForm(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-7 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {([
                  ["origem", "Origem"],
                  ["destino", "Destino"],
                  ["provedor", "Provedor"],
                  ["canal", "Canal"],
                  ["contato", "Contato"],
                  ["designacao", "Designação"],
                  ["contatos_internos", "Contatos Internos (e-mail)"],
                ] as [keyof typeof EMPTY, string][]).map(([key, label]) => (
                  <div key={key} className={key === "contatos_internos" ? "col-span-2" : ""}>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">{label}</label>
                    <input type="text" value={(form as any)[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} className={inputCls} />
                  </div>
                ))}
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Mensagem Padrão (corpo do e-mail)</label>
                <textarea value={form.mensagem_padrao} onChange={e => setForm(p => ({ ...p, mensagem_padrao: e.target.value }))}
                  rows={5} className={inputCls + " resize-none"} placeholder="Corpo do e-mail que será aberto ao marcar esta linha..." />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Observações Internas</label>
                <textarea value={form.observacoes_internas} onChange={e => setForm(p => ({ ...p, observacoes_internas: e.target.value }))}
                  rows={3} className={inputCls + " resize-none"} />
              </div>
              <button type="submit" disabled={saving}
                className="w-full py-3.5 bg-indigo-600 disabled:opacity-50 text-white rounded-xl font-black text-sm hover:bg-indigo-700 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2">
                {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CheckIcon className="w-4 h-4" />}
                {editId ? "Salvar Alterações" : "Criar Linha"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
