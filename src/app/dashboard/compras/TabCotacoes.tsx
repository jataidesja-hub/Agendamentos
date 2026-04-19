"use client";

import { useEffect, useState } from "react";
import {
  MagnifyingGlassIcon,
  CheckCircleIcon,
  ScaleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "@heroicons/react/24/outline";
import { CheckBadgeIcon } from "@heroicons/react/24/solid";
import { toast } from "react-hot-toast";
import { supabase } from "@/lib/supabase";
import { Processo, Cotacao, PRAZOS, CONDICOES_PAGAMENTO, STATUS_CONFIG } from "./types";

function formatBRL(v?: number | null) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function CotacaoCard({
  numero,
  cotacao,
  isVencedora,
  onSave,
  onSelecionar,
  fornecedores,
}: {
  numero: 1 | 2 | 3;
  cotacao?: Cotacao;
  isVencedora: boolean;
  onSave: (n: 1 | 2 | 3, data: Partial<Cotacao>) => void;
  onSelecionar: (n: 1 | 2 | 3) => void;
  fornecedores: { id: string; razao_social: string }[];
}) {
  const [editing, setEditing] = useState(!cotacao?.fornecedor_nome);
  const [form, setForm] = useState<Partial<Cotacao>>(cotacao || { numero_cotacao: numero });

  useEffect(() => {
    setForm(cotacao || { numero_cotacao: numero });
    setEditing(!cotacao?.fornecedor_nome);
  }, [cotacao, numero]);

  const colorMap = { 1: "blue", 2: "purple", 3: "orange" };
  const color = colorMap[numero];

  const colorStyles: Record<string, { header: string; border: string; badge: string; btn: string }> = {
    blue: {
      header: "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30",
      border: "border-blue-200 dark:border-blue-500/20",
      badge: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
      btn: "bg-blue-600 hover:bg-blue-700",
    },
    purple: {
      header: "bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/30",
      border: "border-purple-200 dark:border-purple-500/20",
      badge: "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300",
      btn: "bg-purple-600 hover:bg-purple-700",
    },
    orange: {
      header: "bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/30",
      border: "border-orange-200 dark:border-orange-500/20",
      badge: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300",
      btn: "bg-orange-600 hover:bg-orange-700",
    },
  };
  const s = colorStyles[color];

  return (
    <div className={`border rounded-2xl overflow-hidden ${isVencedora ? "ring-2 ring-emerald-500 dark:ring-emerald-400" : s.border}`}>
      <div className={`px-4 py-3 border-b flex items-center justify-between ${s.header}`}>
        <div className="flex items-center gap-2">
          {isVencedora && <CheckBadgeIcon className="w-5 h-5 text-emerald-500" />}
          <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold ${s.badge}`}>COTAÇÃO {numero}</span>
        </div>
        {cotacao?.fornecedor_nome && !editing && (
          <button onClick={() => onSelecionar(numero)} className={`px-3 py-1 text-white text-xs font-semibold rounded-lg ${isVencedora ? "bg-emerald-600 hover:bg-emerald-700" : "bg-gray-400 hover:bg-gray-500"} transition-colors`}>
            {isVencedora ? "Vencedora ✓" : "Selecionar"}
          </button>
        )}
      </div>

      <div className="p-4 space-y-3 bg-white dark:bg-gray-800">
        {editing ? (
          <>
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Fornecedor</label>
              <input
                value={form.fornecedor_nome || ""}
                onChange={(e) => setForm({ ...form, fornecedor_nome: e.target.value.toUpperCase() })}
                placeholder="Nome do fornecedor"
                list={`fornecedores-list-${numero}`}
                className="mt-1 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0b7336]/40"
              />
              <datalist id={`fornecedores-list-${numero}`}>
                {fornecedores.map((f) => <option key={f.id} value={f.razao_social} />)}
              </datalist>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Preço (R$)</label>
                <input
                  type="number"
                  value={form.preco || ""}
                  onChange={(e) => setForm({ ...form, preco: e.target.value ? Number(e.target.value) : null })}
                  placeholder="0,00"
                  className="mt-1 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0b7336]/40"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Prazo</label>
                <select
                  value={form.prazo || ""}
                  onChange={(e) => setForm({ ...form, prazo: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0b7336]/40"
                >
                  <option value="">Selecione...</option>
                  {PRAZOS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Cond. Pagamento</label>
                <select
                  value={form.condicao_pagamento || ""}
                  onChange={(e) => setForm({ ...form, condicao_pagamento: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0b7336]/40"
                >
                  <option value="">Selecione...</option>
                  {CONDICOES_PAGAMENTO.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Validade</label>
                <input
                  type="date"
                  value={form.validade_cotacao || ""}
                  onChange={(e) => setForm({ ...form, validade_cotacao: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0b7336]/40"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Observações</label>
              <textarea
                value={form.observacoes || ""}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                rows={2}
                className="mt-1 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0b7336]/40 resize-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>
            <div className="flex justify-end gap-2">
              {cotacao?.fornecedor_nome && (
                <button onClick={() => setEditing(false)} className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-xl text-xs hover:bg-gray-50 dark:hover:bg-gray-700">
                  Cancelar
                </button>
              )}
              <button
                onClick={() => { onSave(numero, form); setEditing(false); }}
                disabled={!form.fornecedor_nome}
                className={`px-4 py-1.5 text-white rounded-xl text-xs font-semibold disabled:opacity-50 transition-colors ${s.btn}`}
              >
                Salvar Cotação
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="font-bold text-gray-800 dark:text-white text-sm">{cotacao?.fornecedor_nome}</div>
            <div className="text-2xl font-black text-gray-900 dark:text-white">{formatBRL(cotacao?.preco)}</div>
            <div className="grid grid-cols-2 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
              <span>Prazo:</span><span className="font-semibold text-gray-700 dark:text-gray-300">{cotacao?.prazo || "—"}</span>
              <span>Pagamento:</span><span className="font-semibold text-gray-700 dark:text-gray-300">{cotacao?.condicao_pagamento || "—"}</span>
              {cotacao?.validade_cotacao && (
                <><span>Validade:</span><span className="font-semibold text-gray-700 dark:text-gray-300">{new Date(cotacao.validade_cotacao + "T00:00:00").toLocaleDateString("pt-BR")}</span></>
              )}
            </div>
            {cotacao?.observacoes && (
              <p className="text-xs text-gray-400 italic border-t border-gray-100 dark:border-gray-700 pt-2">{cotacao.observacoes}</p>
            )}
            <button onClick={() => setEditing(true)} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline">
              Editar cotação
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function TabCotacoes() {
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [expandido, setExpandido] = useState<string | null>(null);
  const [fornecedores, setFornecedores] = useState<{ id: string; razao_social: string }[]>([]);

  async function fetchData() {
    setLoading(true);
    const [{ data: procs }, { data: forn }] = await Promise.all([
      supabase.from("compras_processos").select("*").order("created_at", { ascending: false }),
      supabase.from("compras_fornecedores").select("id, razao_social").order("razao_social"),
    ]);
    if (procs) {
      const ids = procs.map((p: Processo) => p.id);
      if (ids.length > 0) {
        const { data: cots } = await supabase.from("compras_cotacoes").select("*").in("processo_id", ids);
        const procsComCot = procs.map((p: Processo) => ({
          ...p,
          cotacoes: (cots || []).filter((c: Cotacao) => c.processo_id === p.id),
        }));
        setProcessos(procsComCot);
      } else {
        setProcessos([]);
      }
    }
    setFornecedores(forn || []);
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, []);

  const filtrados = processos.filter((p) =>
    p.produto_nome.toLowerCase().includes(busca.toLowerCase()) ||
    (p.numero_processo || "").toLowerCase().includes(busca.toLowerCase()) ||
    p.responsavel_compra.toLowerCase().includes(busca.toLowerCase())
  );

  async function salvarCotacao(processoId: string, numero: 1 | 2 | 3, data: Partial<Cotacao>) {
    const payload = {
      processo_id: processoId,
      numero_cotacao: numero,
      fornecedor_nome: data.fornecedor_nome || "",
      preco: data.preco ?? null,
      prazo: data.prazo || null,
      condicao_pagamento: data.condicao_pagamento || null,
      validade_cotacao: data.validade_cotacao || null,
      observacoes: data.observacoes || null,
      selecionada: false,
    };

    const processo = processos.find((p) => p.id === processoId);
    const cotExistente = processo?.cotacoes?.find((c) => c.numero_cotacao === numero);

    if (cotExistente?.id) {
      const { error } = await supabase.from("compras_cotacoes").update(payload).eq("id", cotExistente.id);
      if (error) { toast.error("Erro ao salvar cotação"); return; }
    } else {
      const { error } = await supabase.from("compras_cotacoes").insert(payload);
      if (error) { toast.error("Erro ao salvar cotação"); return; }
    }
    toast.success(`Cotação ${numero} salva!`);
    fetchData();
  }

  async function selecionarCotacao(processoId: string, numero: 1 | 2 | 3) {
    const processo = processos.find((p) => p.id === processoId);
    if (!processo) return;
    const cotacaoSel = processo.cotacoes?.find((c) => c.numero_cotacao === numero);
    if (!cotacaoSel) return;

    // Desmarca todas, marca a selecionada
    await supabase.from("compras_cotacoes").update({ selecionada: false }).eq("processo_id", processoId);
    await supabase.from("compras_cotacoes").update({ selecionada: true }).eq("id", cotacaoSel.id!);

    // Atualiza o processo com fornecedor e preço escolhido
    await supabase.from("compras_processos").update({
      fornecedor_escolhido_nome: cotacaoSel.fornecedor_nome,
      preco_escolhido: cotacaoSel.preco,
      status: "EM APROVAÇÃO",
    }).eq("id", processoId);

    toast.success(`Cotação ${numero} selecionada! Processo movido para EM APROVAÇÃO.`);
    fetchData();
  }

  // Análise comparativa
  function getMenorPreco(cots?: Cotacao[]) {
    if (!cots?.length) return null;
    const precos = cots.filter((c) => c.preco != null).map((c) => c.preco!);
    return precos.length ? Math.min(...precos) : null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-xl text-sm text-blue-700 dark:text-blue-300">
        <ScaleIcon className="w-5 h-5 flex-shrink-0" />
        <span>Gerencie até <strong>3 cotações</strong> por processo. Selecione a vencedora para mover o processo para <strong>EM APROVAÇÃO</strong> automaticamente.</span>
      </div>

      <div className="relative max-w-md">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar processo ou produto..."
          className="pl-9 pr-4 py-2 w-full border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0b7336]/40"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Carregando...</div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <ScaleIcon className="w-10 h-10 mx-auto text-gray-300 mb-2" />
          <p>Nenhum processo encontrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtrados.map((p) => {
            const isOpen = expandido === p.id;
            const menorPreco = getMenorPreco(p.cotacoes);
            const cotVenc = p.cotacoes?.find((c) => c.selecionada);
            const sc = STATUS_CONFIG[p.status];
            const totalCots = p.cotacoes?.filter((c) => c.fornecedor_nome).length || 0;

            return (
              <div key={p.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden shadow-sm">
                {/* Cabeçalho do processo */}
                <button
                  onClick={() => setExpandido(isOpen ? null : p.id)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                >
                  <div className="flex items-center gap-3 text-left">
                    <div>
                      <div className="font-bold text-gray-800 dark:text-white text-sm">{p.produto_nome}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {p.numero_processo || "Sem nº"} · {p.quantidade} {p.unidade} · {p.responsavel_compra}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold border ${sc.bg} ${sc.color} ${sc.border}`}>
                      {sc.label}
                    </span>
                    <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-xs">
                      {totalCots}/3 cotações
                    </span>
                    {cotVenc && (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 rounded-lg text-xs font-semibold">
                        {formatBRL(cotVenc.preco)}
                      </span>
                    )}
                    {isOpen ? <ChevronUpIcon className="w-4 h-4 text-gray-400" /> : <ChevronDownIcon className="w-4 h-4 text-gray-400" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-gray-100 dark:border-gray-700/50 p-4">
                    {menorPreco && (
                      <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-xl text-sm">
                        <span className="text-emerald-700 dark:text-emerald-300 font-semibold">
                          Menor preço: {formatBRL(menorPreco)}
                        </span>
                        {cotVenc && (
                          <span className="ml-2 text-emerald-600 dark:text-emerald-400">
                            — Fornecedor selecionado: <strong>{cotVenc.fornecedor_nome}</strong>
                          </span>
                        )}
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {([1, 2, 3] as const).map((num) => {
                        const cot = p.cotacoes?.find((c) => c.numero_cotacao === num);
                        const isVenc = cotVenc?.numero_cotacao === num;
                        return (
                          <CotacaoCard
                            key={num}
                            numero={num}
                            cotacao={cot}
                            isVencedora={isVenc}
                            onSave={(n, data) => salvarCotacao(p.id, n, data)}
                            onSelecionar={(n) => selecionarCotacao(p.id, n)}
                            fornecedores={fornecedores}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
