"use client";

import { useEffect, useState } from "react";
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { toast } from "react-hot-toast";
import { supabase } from "@/lib/supabase";
import { Produto, CATEGORIAS, UNIDADES } from "./types";

const EMPTY: Omit<Produto, "id" | "created_at"> = {
  nome: "",
  categoria: "",
  unidade: "UND",
  descricao: "",
  ativo: true,
};

export default function TabProdutos() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<Produto | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  async function fetchProdutos() {
    setLoading(true);
    const { data, error } = await supabase
      .from("compras_produtos")
      .select("*")
      .order("nome");
    if (error) toast.error("Erro ao carregar produtos");
    else setProdutos(data || []);
    setLoading(false);
  }

  useEffect(() => { fetchProdutos(); }, []);

  const produtosFiltrados = produtos.filter((p) => {
    const matchBusca = p.nome.toLowerCase().includes(busca.toLowerCase()) ||
      p.categoria.toLowerCase().includes(busca.toLowerCase());
    const matchCategoria = !filtroCategoria || p.categoria === filtroCategoria;
    return matchBusca && matchCategoria;
  });

  function abrirNovo() {
    setEditando(null);
    setForm({ ...EMPTY });
    setShowForm(true);
  }

  function abrirEdicao(p: Produto) {
    setEditando(p);
    setForm({ nome: p.nome, categoria: p.categoria, unidade: p.unidade, descricao: p.descricao || "", ativo: p.ativo });
    setShowForm(true);
  }

  async function salvar() {
    if (!form.nome.trim() || !form.categoria || !form.unidade) {
      toast.error("Preencha Nome, Categoria e Unidade");
      return;
    }
    setSaving(true);
    if (editando) {
      const { error } = await supabase.from("compras_produtos").update(form).eq("id", editando.id);
      if (error) toast.error("Erro ao atualizar");
      else { toast.success("Produto atualizado!"); fetchProdutos(); setShowForm(false); }
    } else {
      const { error } = await supabase.from("compras_produtos").insert(form);
      if (error) toast.error("Erro ao cadastrar");
      else { toast.success("Produto cadastrado!"); fetchProdutos(); setShowForm(false); }
    }
    setSaving(false);
  }

  async function excluir(id: string) {
    if (!confirm("Excluir este produto?")) return;
    const { error } = await supabase.from("compras_produtos").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir");
    else { toast.success("Produto excluído"); fetchProdutos(); }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-1 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar produto..."
              className="pl-9 pr-4 py-2 w-full border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0b7336]/40"
            />
          </div>
          <select
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
            className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0b7336]/40"
          >
            <option value="">Todas categorias</option>
            {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <button
          onClick={abrirNovo}
          className="flex items-center gap-2 px-4 py-2 bg-[#0b7336] text-white rounded-xl text-sm font-semibold hover:bg-[#095c2b] transition-colors shadow-sm"
        >
          <PlusIcon className="w-4 h-4" />
          Novo Produto
        </button>
      </div>

      {/* Formulário */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
          <h3 className="font-bold text-gray-800 dark:text-white mb-4">
            {editando ? "Editar Produto" : "Novo Produto"}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="lg:col-span-2">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Nome *</label>
              <input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value.toUpperCase() })}
                className="mt-1 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0b7336]/40"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Categoria *</label>
              <select
                value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                className="mt-1 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0b7336]/40"
              >
                <option value="">Selecione...</option>
                {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Unidade *</label>
              <select
                value={form.unidade}
                onChange={(e) => setForm({ ...form, unidade: e.target.value })}
                className="mt-1 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0b7336]/40"
              >
                {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="lg:col-span-2">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Descrição</label>
              <input
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                className="mt-1 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0b7336]/40"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4 justify-end">
            <button
              onClick={() => setShowForm(false)}
              className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <XMarkIcon className="w-4 h-4" /> Cancelar
            </button>
            <button
              onClick={salvar}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#0b7336] text-white rounded-xl text-sm font-semibold hover:bg-[#095c2b] disabled:opacity-50"
            >
              <CheckIcon className="w-4 h-4" /> {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      )}

      {/* Tabela */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gradient-to-r from-[#0b7336]/10 to-transparent border-b border-gray-200 dark:border-gray-700">
                <th className="text-left px-4 py-3 font-bold text-gray-700 dark:text-gray-300 uppercase text-xs tracking-wide">Produto</th>
                <th className="text-left px-4 py-3 font-bold text-gray-700 dark:text-gray-300 uppercase text-xs tracking-wide">Categoria</th>
                <th className="text-center px-4 py-3 font-bold text-gray-700 dark:text-gray-300 uppercase text-xs tracking-wide">Unidade</th>
                <th className="text-center px-4 py-3 font-bold text-gray-700 dark:text-gray-300 uppercase text-xs tracking-wide">Status</th>
                <th className="text-center px-4 py-3 font-bold text-gray-700 dark:text-gray-300 uppercase text-xs tracking-wide">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-12 text-gray-400">Carregando...</td></tr>
              ) : produtosFiltrados.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-gray-400">Nenhum produto encontrado</td></tr>
              ) : produtosFiltrados.map((p, i) => (
                <tr key={p.id} className={`border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${i % 2 === 0 ? "" : "bg-gray-50/40 dark:bg-gray-900/20"}`}>
                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{p.nome}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    <span className="px-2 py-0.5 bg-[#0b7336]/10 text-[#0b7336] dark:text-green-400 rounded-lg text-xs font-semibold">{p.categoria}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-xs font-bold">{p.unidade}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold ${p.ativo ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"}`}>
                      {p.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => abrirEdicao(p)} className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        <PencilSquareIcon className="w-4 h-4" />
                      </button>
                      <button onClick={() => excluir(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500 dark:text-red-400">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700/50 text-xs text-gray-400">
          {produtosFiltrados.length} produto(s) encontrado(s)
        </div>
      </div>
    </div>
  );
}
