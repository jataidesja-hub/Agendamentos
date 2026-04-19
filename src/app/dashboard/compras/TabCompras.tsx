"use client";

import { useEffect, useState, useMemo } from "react";
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  ClipboardDocumentListIcon,
} from "@heroicons/react/24/outline";
import { toast } from "react-hot-toast";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import {
  Processo,
  Produto,
  Fornecedor,
  STATUS_COMPRA,
  STATUS_CONFIG,
  StatusCompra,
  CENTROS_CUSTO,
  UNIDADES,
} from "./types";

const RESPONSAVEIS = ["JOSE LUCENA", "TIAGO SILVA", "RODRIGO FARIA", "OUTRO"];

const EMPTY_PROC: Omit<Processo, "id" | "created_at"> = {
  numero_processo: "",
  numero_requisicao: "",
  numero_pedido: "",
  status: "EM COTAÇÃO",
  centro_custo: "CENTRO OPERACIONAL",
  projeto: "",
  produto_nome: "",
  categoria: "",
  quantidade: 1,
  unidade: "UND",
  responsavel_compra: "",
  solicitante: "",
  data_pedido: new Date().toISOString().slice(0, 10),
  fornecedor_escolhido_nome: "",
  preco_escolhido: undefined,
  observacoes: "",
};

function formatBRL(v?: number | null) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function StatusBadge({ status }: { status: StatusCompra }) {
  const s = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold border whitespace-nowrap ${s.bg} ${s.color} ${s.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
      {s.label}
    </span>
  );
}

export default function TabCompras() {
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<StatusCompra | "">("");
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<Processo | null>(null);
  const [form, setForm] = useState({ ...EMPTY_PROC });
  const [saving, setSaving] = useState(false);
  const [showFiltros, setShowFiltros] = useState(false);
  const [filtroResponsavel, setFiltroResponsavel] = useState("");
  const [filtroCentro, setFiltroCentro] = useState("");

  async function fetchData() {
    setLoading(true);
    const [{ data: procs }, { data: prods }, { data: forn }] = await Promise.all([
      supabase.from("compras_processos").select("*").order("created_at", { ascending: false }),
      supabase.from("compras_produtos").select("*").eq("ativo", true).order("nome"),
      supabase.from("compras_fornecedores").select("*").eq("ativo", true).order("razao_social"),
    ]);
    setProcessos(procs || []);
    setProdutos(prods || []);
    setFornecedores(forn || []);
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, []);

  // Gera próximo número de processo automaticamente
  function gerarNumeroProcesso() {
    const base = "RC";
    const ultimo = processos
      .map((p) => parseInt((p.numero_processo || "").replace("RC", "") || "0"))
      .filter((n) => !isNaN(n));
    const proximo = ultimo.length ? Math.max(...ultimo) + 1 : 1001;
    return `RC${String(proximo).padStart(6, "0")}`;
  }

  function abrirNovo() {
    setEditando(null);
    setForm({ ...EMPTY_PROC, numero_processo: gerarNumeroProcesso() });
    setShowForm(true);
  }

  function abrirEdicao(p: Processo) {
    setEditando(p);
    setForm({
      numero_processo: p.numero_processo || "",
      numero_requisicao: p.numero_requisicao || "",
      numero_pedido: p.numero_pedido || "",
      status: p.status,
      centro_custo: p.centro_custo,
      projeto: p.projeto || "",
      produto_nome: p.produto_nome,
      categoria: p.categoria,
      quantidade: p.quantidade,
      unidade: p.unidade,
      responsavel_compra: p.responsavel_compra,
      solicitante: p.solicitante || "",
      data_pedido: p.data_pedido,
      fornecedor_escolhido_nome: p.fornecedor_escolhido_nome || "",
      preco_escolhido: p.preco_escolhido,
      observacoes: p.observacoes || "",
    });
    setShowForm(true);
  }

  function selecionarProduto(nome: string) {
    const prod = produtos.find((p) => p.nome === nome);
    if (prod) setForm((f) => ({ ...f, produto_nome: prod.nome, categoria: prod.categoria, unidade: prod.unidade }));
    else setForm((f) => ({ ...f, produto_nome: nome }));
  }

  async function salvar() {
    if (!form.produto_nome.trim() || !form.responsavel_compra) {
      toast.error("Preencha Produto e Responsável");
      return;
    }
    setSaving(true);
    const payload = { ...form };
    if (editando) {
      const { error } = await supabase.from("compras_processos").update(payload).eq("id", editando.id);
      if (error) toast.error("Erro ao atualizar");
      else { toast.success("Processo atualizado!"); fetchData(); setShowForm(false); }
    } else {
      const { error } = await supabase.from("compras_processos").insert(payload);
      if (error) toast.error("Erro ao criar processo");
      else { toast.success("Processo criado!"); fetchData(); setShowForm(false); }
    }
    setSaving(false);
  }

  async function avancarStatus(p: Processo) {
    const fluxo: StatusCompra[] = ["EM COTAÇÃO", "EM APROVAÇÃO", "LIBERADO", "PEDIDO EMITIDO", "RECEBIDO"];
    const idx = fluxo.indexOf(p.status);
    if (idx === -1 || idx >= fluxo.length - 1) return;
    const novoStatus = fluxo[idx + 1];
    const { error } = await supabase.from("compras_processos").update({ status: novoStatus }).eq("id", p.id);
    if (error) toast.error("Erro ao atualizar status");
    else { toast.success(`Status: ${STATUS_CONFIG[novoStatus].label}`); fetchData(); }
  }

  async function excluir(id: string) {
    if (!confirm("Excluir este processo?")) return;
    const { error } = await supabase.from("compras_processos").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir");
    else { toast.success("Processo excluído"); fetchData(); }
  }

  const filtrados = useMemo(() => processos.filter((p) => {
    const matchBusca =
      p.produto_nome.toLowerCase().includes(busca.toLowerCase()) ||
      (p.numero_processo || "").toLowerCase().includes(busca.toLowerCase()) ||
      (p.numero_pedido || "").toLowerCase().includes(busca.toLowerCase()) ||
      (p.fornecedor_escolhido_nome || "").toLowerCase().includes(busca.toLowerCase());
    const matchStatus = !filtroStatus || p.status === filtroStatus;
    const matchResp = !filtroResponsavel || p.responsavel_compra === filtroResponsavel;
    const matchCentro = !filtroCentro || p.centro_custo === filtroCentro;
    return matchBusca && matchStatus && matchResp && matchCentro;
  }), [processos, busca, filtroStatus, filtroResponsavel, filtroCentro]);

  // Métricas do topo
  const metricas = useMemo(() => {
    const total = processos.length;
    const emCotacao = processos.filter((p) => p.status === "EM COTAÇÃO").length;
    const emAprovacao = processos.filter((p) => p.status === "EM APROVAÇÃO").length;
    const liberados = processos.filter((p) => p.status === "LIBERADO").length;
    const valorTotal = processos
      .filter((p) => p.preco_escolhido)
      .reduce((acc, p) => acc + (p.preco_escolhido || 0), 0);
    return { total, emCotacao, emAprovacao, liberados, valorTotal };
  }, [processos]);

  function exportarXLSX() {
    const rows = filtrados.map((p) => ({
      "Processo": p.numero_processo || "",
      "Requisição": p.numero_requisicao || "",
      "Pedido": p.numero_pedido || "",
      "Status": p.status,
      "Centro de Custo": p.centro_custo,
      "Projeto": p.projeto || "",
      "Produto": p.produto_nome,
      "Categoria": p.categoria,
      "Qtd": p.quantidade,
      "Unidade": p.unidade,
      "Fornecedor": p.fornecedor_escolhido_nome || "",
      "Valor": p.preco_escolhido || "",
      "Resp. Compra": p.responsavel_compra,
      "Solicitante": p.solicitante || "",
      "Data Pedido": p.data_pedido,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Compras");
    XLSX.writeFile(wb, `compras_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Exportado!");
  }

  const proximoStatus: Record<StatusCompra, string | null> = {
    "EM COTAÇÃO": "Mover p/ Aprovação",
    "EM APROVAÇÃO": "Liberar",
    "LIBERADO": "Emitir Pedido",
    "PEDIDO EMITIDO": "Marcar Recebido",
    "RECEBIDO": null,
    "PROCESSO COM RJ": null,
    "CANCELADO": null,
  };

  return (
    <div className="space-y-4">
      {/* Métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total", value: metricas.total, color: "text-gray-700 dark:text-gray-200", bg: "bg-gray-50 dark:bg-gray-800" },
          { label: "Em Cotação", value: metricas.emCotacao, color: "text-blue-700 dark:text-blue-300", bg: "bg-blue-50 dark:bg-blue-500/10" },
          { label: "Em Aprovação", value: metricas.emAprovacao, color: "text-amber-700 dark:text-amber-300", bg: "bg-amber-50 dark:bg-amber-500/10" },
          { label: "Liberados", value: metricas.liberados, color: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
        ].map((m) => (
          <div key={m.label} className={`${m.bg} border border-gray-200 dark:border-gray-700/50 rounded-2xl p-4`}>
            <div className={`text-2xl font-black ${m.color}`}>{m.value}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{m.label}</div>
          </div>
        ))}
      </div>

      {/* Barra de ações */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-1 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar produto, processo, fornecedor..."
              className="pl-9 pr-4 py-2 w-full border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0b7336]/40"
            />
          </div>
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value as StatusCompra | "")}
            className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0b7336]/40"
          >
            <option value="">Todos status</option>
            {STATUS_COMPRA.map((s) => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
          </select>
          <button
            onClick={() => setShowFiltros(!showFiltros)}
            className={`flex items-center gap-1.5 px-3 py-2 border rounded-xl text-sm transition-colors ${showFiltros ? "bg-[#0b7336] text-white border-[#0b7336]" : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
          >
            <FunnelIcon className="w-4 h-4" />
            Filtros
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={exportarXLSX} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700">
            <ArrowDownTrayIcon className="w-4 h-4" /> Excel
          </button>
          <button onClick={abrirNovo} className="flex items-center gap-2 px-4 py-2 bg-[#0b7336] text-white rounded-xl text-sm font-semibold hover:bg-[#095c2b] transition-colors shadow-sm">
            <PlusIcon className="w-4 h-4" /> Nova Compra
          </button>
        </div>
      </div>

      {/* Filtros extras */}
      {showFiltros && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 flex flex-wrap gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide block mb-1">Responsável</label>
            <select
              value={filtroResponsavel}
              onChange={(e) => setFiltroResponsavel(e.target.value)}
              className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0b7336]/40"
            >
              <option value="">Todos</option>
              {[...new Set(processos.map((p) => p.responsavel_compra))].map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide block mb-1">Centro de Custo</label>
            <select
              value={filtroCentro}
              onChange={(e) => setFiltroCentro(e.target.value)}
              className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0b7336]/40"
            >
              <option value="">Todos</option>
              {CENTROS_CUSTO.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={() => { setFiltroResponsavel(""); setFiltroCentro(""); setFiltroStatus(""); }} className="px-3 py-2 text-sm text-red-500 hover:text-red-600 underline">
              Limpar filtros
            </button>
          </div>
        </div>
      )}

      {/* Formulário */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
          <h3 className="font-bold text-gray-800 dark:text-white mb-4">
            {editando ? "Editar Processo" : "Nova Solicitação de Compra"}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Nº Processo</label>
              <input
                value={form.numero_processo}
                onChange={(e) => setForm({ ...form, numero_processo: e.target.value.toUpperCase() })}
                className="mt-1 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0b7336]/40"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Requisição</label>
              <input
                value={form.numero_requisicao}
                onChange={(e) => setForm({ ...form, numero_requisicao: e.target.value.toUpperCase() })}
                placeholder="ex: PCB5-47081"
                className="mt-1 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0b7336]/40"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Pedido (PO)</label>
              <input
                value={form.numero_pedido}
                onChange={(e) => setForm({ ...form, numero_pedido: e.target.value.toUpperCase() })}
                placeholder="ex: PCB5-47081"
                className="mt-1 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0b7336]/40"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as StatusCompra })}
                className="mt-1 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0b7336]/40"
              >
                {STATUS_COMPRA.map((s) => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Centro de Custo *</label>
              <select
                value={form.centro_custo}
                onChange={(e) => setForm({ ...form, centro_custo: e.target.value })}
                className="mt-1 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0b7336]/40"
              >
                {CENTROS_CUSTO.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Projeto</label>
              <input
                value={form.projeto}
                onChange={(e) => setForm({ ...form, projeto: e.target.value.toUpperCase() })}
                className="mt-1 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0b7336]/40"
              />
            </div>
            <div className="lg:col-span-2">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Produto *</label>
              <input
                value={form.produto_nome}
                onChange={(e) => selecionarProduto(e.target.value.toUpperCase())}
                list="produtos-list"
                className="mt-1 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0b7336]/40"
              />
              <datalist id="produtos-list">
                {produtos.map((p) => <option key={p.id} value={p.nome} />)}
              </datalist>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Quantidade</label>
              <input
                type="number"
                min={1}
                value={form.quantidade}
                onChange={(e) => setForm({ ...form, quantidade: Number(e.target.value) })}
                className="mt-1 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0b7336]/40"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Unidade</label>
              <select
                value={form.unidade}
                onChange={(e) => setForm({ ...form, unidade: e.target.value })}
                className="mt-1 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0b7336]/40"
              >
                {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Responsável Compra *</label>
              <input
                value={form.responsavel_compra}
                onChange={(e) => setForm({ ...form, responsavel_compra: e.target.value.toUpperCase() })}
                list="responsaveis-list"
                className="mt-1 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0b7336]/40"
              />
              <datalist id="responsaveis-list">
                {RESPONSAVEIS.map((r) => <option key={r} value={r} />)}
              </datalist>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Solicitante</label>
              <input
                value={form.solicitante}
                onChange={(e) => setForm({ ...form, solicitante: e.target.value.toUpperCase() })}
                className="mt-1 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0b7336]/40"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Data do Pedido</label>
              <input
                type="date"
                value={form.data_pedido}
                onChange={(e) => setForm({ ...form, data_pedido: e.target.value })}
                className="mt-1 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0b7336]/40"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Fornecedor Escolhido</label>
              <input
                value={form.fornecedor_escolhido_nome}
                onChange={(e) => setForm({ ...form, fornecedor_escolhido_nome: e.target.value.toUpperCase() })}
                list="fornecedores-escolhidos-list"
                className="mt-1 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0b7336]/40"
              />
              <datalist id="fornecedores-escolhidos-list">
                {fornecedores.map((f) => <option key={f.id} value={f.razao_social} />)}
              </datalist>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Valor (R$)</label>
              <input
                type="number"
                value={form.preco_escolhido || ""}
                onChange={(e) => setForm({ ...form, preco_escolhido: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="0,00"
                className="mt-1 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0b7336]/40"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Observações</label>
              <textarea
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                rows={2}
                className="mt-1 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0b7336]/40 resize-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4 justify-end">
            <button onClick={() => setShowForm(false)} className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
              <XMarkIcon className="w-4 h-4" /> Cancelar
            </button>
            <button onClick={salvar} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-[#0b7336] text-white rounded-xl text-sm font-semibold hover:bg-[#095c2b] disabled:opacity-50">
              <CheckIcon className="w-4 h-4" /> {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      )}

      {/* Tabela */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="bg-gradient-to-r from-[#0b7336]/10 to-transparent border-b border-gray-200 dark:border-gray-700">
                <th className="text-left px-4 py-3 font-bold text-gray-700 dark:text-gray-300 uppercase text-xs tracking-wide">Processo</th>
                <th className="text-left px-4 py-3 font-bold text-gray-700 dark:text-gray-300 uppercase text-xs tracking-wide">Produto</th>
                <th className="text-left px-4 py-3 font-bold text-gray-700 dark:text-gray-300 uppercase text-xs tracking-wide">Centro Custo</th>
                <th className="text-center px-4 py-3 font-bold text-gray-700 dark:text-gray-300 uppercase text-xs tracking-wide">Qtd</th>
                <th className="text-left px-4 py-3 font-bold text-gray-700 dark:text-gray-300 uppercase text-xs tracking-wide">Fornecedor</th>
                <th className="text-right px-4 py-3 font-bold text-gray-700 dark:text-gray-300 uppercase text-xs tracking-wide">Valor</th>
                <th className="text-left px-4 py-3 font-bold text-gray-700 dark:text-gray-300 uppercase text-xs tracking-wide">Responsável</th>
                <th className="text-center px-4 py-3 font-bold text-gray-700 dark:text-gray-300 uppercase text-xs tracking-wide">Status</th>
                <th className="text-center px-4 py-3 font-bold text-gray-700 dark:text-gray-300 uppercase text-xs tracking-wide">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-12 text-gray-400">Carregando...</td></tr>
              ) : filtrados.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12">
                    <ClipboardDocumentListIcon className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                    <p className="text-gray-400">Nenhum processo encontrado</p>
                  </td>
                </tr>
              ) : filtrados.map((p, i) => {
                const prox = proximoStatus[p.status];
                return (
                  <tr key={p.id} className={`border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${i % 2 === 0 ? "" : "bg-gray-50/40 dark:bg-gray-900/20"}`}>
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs font-bold text-gray-700 dark:text-gray-300">{p.numero_processo || "—"}</div>
                      {p.numero_pedido && <div className="text-xs text-gray-400">{p.numero_pedido}</div>}
                      <div className="text-xs text-gray-400">{new Date(p.data_pedido + "T00:00:00").toLocaleDateString("pt-BR")}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800 dark:text-gray-200 max-w-48 truncate">{p.produto_nome}</div>
                      <span className="px-1.5 py-0.5 bg-[#0b7336]/10 text-[#0b7336] dark:text-green-400 rounded text-xs">{p.categoria}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 max-w-32 truncate">
                      <div>{p.centro_custo}</div>
                      {p.projeto && <div className="text-gray-400">{p.projeto}</div>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-semibold text-gray-700 dark:text-gray-300">{p.quantidade}</span>
                      <span className="text-xs text-gray-400 ml-1">{p.unidade}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400 max-w-40 truncate">
                      {p.fornecedor_escolhido_nome || <span className="text-gray-300 dark:text-gray-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300 text-xs">
                      {formatBRL(p.preco_escolhido)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">
                      <div>{p.responsavel_compra}</div>
                      {p.solicitante && <div className="text-gray-400">{p.solicitante}</div>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {prox && (
                          <button
                            onClick={() => avancarStatus(p)}
                            title={prox}
                            className="px-2 py-1 bg-[#0b7336]/10 text-[#0b7336] dark:text-green-400 rounded-lg text-xs font-semibold hover:bg-[#0b7336]/20 transition-colors whitespace-nowrap"
                          >
                            {prox}
                          </button>
                        )}
                        <button onClick={() => abrirEdicao(p)} className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-500/10 text-blue-600 dark:text-blue-400">
                          <PencilSquareIcon className="w-4 h-4" />
                        </button>
                        <button onClick={() => excluir(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500 dark:text-red-400">
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {filtrados.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
                  <td colSpan={5} className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400">
                    {filtrados.length} processo(s)
                  </td>
                  <td className="px-4 py-3 text-right font-black text-gray-800 dark:text-white text-sm">
                    {formatBRL(filtrados.reduce((acc, p) => acc + (p.preco_escolhido || 0), 0))}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
