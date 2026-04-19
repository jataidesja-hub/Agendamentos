"use client";

import { useEffect, useState } from "react";
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
  BuildingOfficeIcon,
} from "@heroicons/react/24/outline";
import { toast } from "react-hot-toast";
import { supabase } from "@/lib/supabase";
import { Fornecedor, CATEGORIAS } from "./types";

const EMPTY: Omit<Fornecedor, "id" | "created_at"> = {
  razao_social: "",
  nome_fantasia: "",
  cnpj_cpf: "",
  contato: "",
  email: "",
  telefone: "",
  categorias: [],
  ativo: true,
};

export default function TabFornecedores() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<Fornecedor | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  async function fetchFornecedores() {
    setLoading(true);
    const { data, error } = await supabase
      .from("compras_fornecedores")
      .select("*")
      .order("razao_social");
    if (error) toast.error("Erro ao carregar fornecedores");
    else setFornecedores(data || []);
    setLoading(false);
  }

  useEffect(() => { fetchFornecedores(); }, []);

  const fornecedoresFiltrados = fornecedores.filter((f) =>
    f.razao_social.toLowerCase().includes(busca.toLowerCase()) ||
    (f.nome_fantasia || "").toLowerCase().includes(busca.toLowerCase()) ||
    (f.cnpj_cpf || "").includes(busca)
  );

  function abrirNovo() {
    setEditando(null);
    setForm({ ...EMPTY });
    setShowForm(true);
  }

  function abrirEdicao(f: Fornecedor) {
    setEditando(f);
    setForm({
      razao_social: f.razao_social,
      nome_fantasia: f.nome_fantasia || "",
      cnpj_cpf: f.cnpj_cpf || "",
      contato: f.contato || "",
      email: f.email || "",
      telefone: f.telefone || "",
      categorias: f.categorias || [],
      ativo: f.ativo,
    });
    setShowForm(true);
  }

  function toggleCategoria(cat: string) {
    const cats = form.categorias || [];
    setForm({
      ...form,
      categorias: cats.includes(cat) ? cats.filter((c) => c !== cat) : [...cats, cat],
    });
  }

  async function salvar() {
    if (!form.razao_social.trim()) {
      toast.error("Preencha a Razão Social");
      return;
    }
    setSaving(true);
    if (editando) {
      const { error } = await supabase.from("compras_fornecedores").update(form).eq("id", editando.id);
      if (error) toast.error("Erro ao atualizar");
      else { toast.success("Fornecedor atualizado!"); fetchFornecedores(); setShowForm(false); }
    } else {
      const { error } = await supabase.from("compras_fornecedores").insert(form);
      if (error) toast.error("Erro ao cadastrar");
      else { toast.success("Fornecedor cadastrado!"); fetchFornecedores(); setShowForm(false); }
    }
    setSaving(false);
  }

  async function excluir(id: string) {
    if (!confirm("Excluir este fornecedor?")) return;
    const { error } = await supabase.from("compras_fornecedores").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir");
    else { toast.success("Fornecedor excluído"); fetchFornecedores(); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 min-w-48 max-w-md">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar fornecedor ou CNPJ..."
            className="pl-9 pr-4 py-2 w-full border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0b7336]/40"
          />
        </div>
        <button
          onClick={abrirNovo}
          className="flex items-center gap-2 px-4 py-2 bg-[#0b7336] text-white rounded-xl text-sm font-semibold hover:bg-[#095c2b] transition-colors shadow-sm"
        >
          <PlusIcon className="w-4 h-4" />
          Novo Fornecedor
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
          <h3 className="font-bold text-gray-800 dark:text-white mb-4">
            {editando ? "Editar Fornecedor" : "Novo Fornecedor"}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Razão Social *</label>
              <input
                value={form.razao_social}
                onChange={(e) => setForm({ ...form, razao_social: e.target.value.toUpperCase() })}
                className="mt-1 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0b7336]/40"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">CNPJ / CPF</label>
              <input
                value={form.cnpj_cpf}
                onChange={(e) => setForm({ ...form, cnpj_cpf: e.target.value })}
                placeholder="00.000.000/0001-00"
                className="mt-1 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0b7336]/40"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Contato</label>
              <input
                value={form.contato}
                onChange={(e) => setForm({ ...form, contato: e.target.value })}
                className="mt-1 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0b7336]/40"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">E-mail</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="mt-1 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0b7336]/40"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Telefone</label>
              <input
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                className="mt-1 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0b7336]/40"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Categorias que atende</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {CATEGORIAS.map((cat) => {
                const sel = (form.categorias || []).includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategoria(cat)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${sel
                      ? "bg-[#0b7336] text-white border-[#0b7336]"
                      : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-[#0b7336]/50"
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
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

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gradient-to-r from-[#0b7336]/10 to-transparent border-b border-gray-200 dark:border-gray-700">
                <th className="text-left px-4 py-3 font-bold text-gray-700 dark:text-gray-300 uppercase text-xs tracking-wide">Razão Social</th>
                <th className="text-left px-4 py-3 font-bold text-gray-700 dark:text-gray-300 uppercase text-xs tracking-wide">CNPJ/CPF</th>
                <th className="text-left px-4 py-3 font-bold text-gray-700 dark:text-gray-300 uppercase text-xs tracking-wide">Contato</th>
                <th className="text-left px-4 py-3 font-bold text-gray-700 dark:text-gray-300 uppercase text-xs tracking-wide">Categorias</th>
                <th className="text-center px-4 py-3 font-bold text-gray-700 dark:text-gray-300 uppercase text-xs tracking-wide">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-12 text-gray-400">Carregando...</td></tr>
              ) : fornecedoresFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12">
                    <BuildingOfficeIcon className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                    <p className="text-gray-400 text-sm">Nenhum fornecedor cadastrado</p>
                  </td>
                </tr>
              ) : fornecedoresFiltrados.map((f, i) => (
                <tr key={f.id} className={`border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${i % 2 === 0 ? "" : "bg-gray-50/40 dark:bg-gray-900/20"}`}>
                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">
                    <div>{f.razao_social}</div>
                    {f.nome_fantasia && <div className="text-xs text-gray-400">{f.nome_fantasia}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-mono text-xs">{f.cnpj_cpf || "—"}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    <div>{f.contato || "—"}</div>
                    {f.email && <div className="text-xs text-gray-400">{f.email}</div>}
                    {f.telefone && <div className="text-xs text-gray-400">{f.telefone}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(f.categorias || []).slice(0, 3).map((cat) => (
                        <span key={cat} className="px-1.5 py-0.5 bg-[#0b7336]/10 text-[#0b7336] dark:text-green-400 rounded text-xs font-medium">{cat}</span>
                      ))}
                      {(f.categorias || []).length > 3 && (
                        <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 rounded text-xs">+{(f.categorias || []).length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => abrirEdicao(f)} className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        <PencilSquareIcon className="w-4 h-4" />
                      </button>
                      <button onClick={() => excluir(f.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500 dark:text-red-400">
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
          {fornecedoresFiltrados.length} fornecedor(es) encontrado(s)
        </div>
      </div>
    </div>
  );
}
