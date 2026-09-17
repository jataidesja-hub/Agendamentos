"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { XMarkIcon, PresentationChartBarIcon } from "@heroicons/react/24/outline";
import { supabase } from "@/lib/supabase";

interface Props {
  abastecimentos: any[];
  availableMonths: string[];
}

const normalize = (p: string) => p?.toString().replace(/[^a-zA-Z0-9]/g, "").toUpperCase().trim() || "";
const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtMonth = (m: string) => new Date(m + "-02").toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

const mapUFtoRegiao = (uf: string) => {
  if (["PR", "SC", "RS"].includes(uf)) return "Sul";
  if (["SP", "RJ", "MG", "ES"].includes(uf)) return "Sudeste";
  if (["MS", "MT", "GO", "DF"].includes(uf)) return "Centro-Oeste";
  if (["BA", "SE", "AL", "PE", "PB", "RN", "CE", "PI", "MA"].includes(uf)) return "Nordeste";
  if (["AM", "RR", "AP", "PA", "TO", "RO", "AC"].includes(uf)) return "Norte";
  return "Outros";
};

export default function DashboardAnalitico({ abastecimentos, availableMonths }: Props) {
  const [open, setOpen] = useState(false);
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<"select" | "dash">("select");
  const placaToProject = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    supabase.from("frota_veiculos").select("placa, projeto").eq("status", "Ativo").then(({ data }) => {
      const map = new Map<string, string>();
      (data || []).forEach((v: any) => {
        if (v.projeto) map.set(normalize(v.placa), String(v.projeto).toUpperCase().trim());
      });
      placaToProject.current = map;
    });
  }, []);

  const sortedSelected = useMemo(() => Array.from(selectedMonths).sort(), [selectedMonths]);

  const dados = useMemo(() => {
    if (!sortedSelected.length) return null;
    const ptp = placaToProject.current;
    const items = abastecimentos.filter(a =>
      sortedSelected.includes(String(a.data_transacao).slice(0, 7))
    );

    const monthData = sortedSelected.map(month => {
      const mi = items.filter(a => String(a.data_transacao).slice(0, 7) === month);
      const totalLitros = mi.reduce((s, a) => s + (Number(a.litros) || 0), 0);
      const totalValor = mi.reduce((s, a) => s + (Number(a.valor_emissao) || 0), 0);
      const precoMedio = totalLitros > 0 ? totalValor / totalLitros : 0;
      const economizado = mi.reduce((s, a) => {
        const saving = (precoMedio - (Number(a.valor_litro) || 0)) * (Number(a.litros) || 0);
        return s + (saving > 0 ? saving : 0);
      }, 0);
      return { month, totalLitros, totalValor, precoMedio, economizado };
    });

    const precoPorRegiao: Record<string, { valor: number; litros: number; tipos: Record<string, { valor: number; litros: number }> }> = {};
    const consumoPorProjeto: Record<string, number> = {};
    const ultimos5 = sortedSelected.slice(-5);
    const consumoPorProjetoMes: Record<string, Record<string, { valor: number; litros: number }>> = {};

    items.forEach(a => {
      const valorEmissao = Number(a.valor_emissao) || 0;
      const litros = Number(a.litros) || 0;
      let uf = String(a.uf || a.estado || "").toUpperCase().trim();
      if (!uf && a.cidade && typeof a.cidade === "string" && a.cidade.includes("/"))
        uf = a.cidade.split("/").pop()?.toUpperCase().trim() || "";
      const regiao = mapUFtoRegiao(uf);
      if (!precoPorRegiao[regiao]) precoPorRegiao[regiao] = { valor: 0, litros: 0, tipos: {} };
      precoPorRegiao[regiao].valor += valorEmissao;
      precoPorRegiao[regiao].litros += litros;
      const comb = String(a.tipo_combustivel || "NAO INFORMADO").toUpperCase().trim();
      if (!precoPorRegiao[regiao].tipos[comb]) precoPorRegiao[regiao].tipos[comb] = { valor: 0, litros: 0 };
      precoPorRegiao[regiao].tipos[comb].valor += valorEmissao;
      precoPorRegiao[regiao].tipos[comb].litros += litros;

      const proj = String(a.projeto || ptp.get(normalize(String(a.placa || ""))) || "SEM PROJETO").toUpperCase();
      if (proj !== "SEM PROJETO") {
        consumoPorProjeto[proj] = (consumoPorProjeto[proj] || 0) + valorEmissao;
        const mes = String(a.data_transacao).slice(0, 7);
        if (ultimos5.includes(mes)) {
          if (!consumoPorProjetoMes[proj]) consumoPorProjetoMes[proj] = {};
          if (!consumoPorProjetoMes[proj][mes]) consumoPorProjetoMes[proj][mes] = { valor: 0, litros: 0 };
          consumoPorProjetoMes[proj][mes].valor += valorEmissao;
          consumoPorProjetoMes[proj][mes].litros += litros;
        }
      }
    });

    const mediasRegiao = Object.entries(precoPorRegiao)
      .map(([regiao, v]) => ({
        regiao, media: v.litros > 0 ? v.valor / v.litros : 0,
        tipos: Object.entries(v.tipos)
          .map(([tipo, tv]) => ({ tipo, media: tv.litros > 0 ? tv.valor / tv.litros : 0 }))
          .sort((a, b) => b.media - a.media),
      }))
      .filter(r => r.regiao !== "Outros")
      .sort((a, b) => b.media - a.media);

    const top5 = Object.entries(consumoPorProjeto).sort(([, a], [, b]) => b - a).slice(0, 5);
    const projsSorted = Object.keys(consumoPorProjetoMes).sort(
      (a, b) => (consumoPorProjeto[b] || 0) - (consumoPorProjeto[a] || 0)
    );

    return { monthData, mediasRegiao, top5, projsSorted, consumoPorProjetoMes, ultimos5 };
  }, [sortedSelected, abastecimentos]);

  return (
    <>
      <button
        onClick={() => { setStep("select"); setOpen(true); }}
        className="flex items-center gap-2 px-5 py-3.5 rounded-2xl text-sm font-black bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 transition-all"
      >
        <PresentationChartBarIcon className="w-4 h-4" /> DASHBOARD
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          {step === "select" ? (
            <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 w-full max-w-lg shadow-2xl border border-gray-100 dark:border-gray-800">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xl font-black text-gray-900 dark:text-white">Dashboard Analítico</h3>
                  <p className="text-xs text-gray-500 mt-1">Selecione os meses para visualizar</p>
                </div>
                <button onClick={() => setOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl">
                  <XMarkIcon className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto mb-6">
                {availableMonths.map(m => (
                  <button key={m}
                    onClick={() => setSelectedMonths(prev => { const n = new Set(prev); n.has(m) ? n.delete(m) : n.add(m); return n; })}
                    className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition-all border ${selectedMonths.has(m) ? "bg-emerald-600 border-emerald-600 text-white" : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 hover:border-emerald-400"}`}
                  >
                    {new Date(m + "-02").toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })}
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setSelectedMonths(new Set(availableMonths))} className="flex-1 py-2.5 rounded-xl text-xs font-black text-gray-500 border border-gray-200 hover:bg-gray-50 transition-all">
                  Selecionar Todos
                </button>
                <button
                  onClick={() => { if (selectedMonths.size > 0) setStep("dash"); }}
                  disabled={selectedMonths.size === 0}
                  className="flex-1 py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Ver Dashboard ({selectedMonths.size})
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 dark:bg-gray-950 rounded-[2rem] w-full max-w-7xl max-h-[95vh] overflow-y-auto shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col">
              <div className="sticky top-0 z-10 bg-[#0b7336] px-8 py-5 flex justify-between items-center rounded-t-[2rem]">
                <div>
                  <h2 className="text-xl font-black text-white tracking-tight">DASHBOARD ANALÍTICO</h2>
                  <p className="text-emerald-200 text-xs font-bold mt-0.5">{sortedSelected.map(fmtMonth).join(" • ")}</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setStep("select")} className="px-4 py-2 rounded-xl text-xs font-black text-white/70 hover:text-white border border-white/20 hover:border-white/50 transition-all">← Meses</button>
                  <button onClick={() => setOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all"><XMarkIcon className="w-5 h-5 text-white" /></button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Consolidado por Mês */}
                <section>
                  <h3 className="text-xs font-black uppercase tracking-widest text-[#0b7336] mb-3">Consolidado por Mês</h3>
                  <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800 shadow-sm">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-900 text-white uppercase font-black tracking-wider">
                          <th className="px-5 py-3 text-left">Mês</th>
                          <th className="px-5 py-3 text-right">Litros</th>
                          <th className="px-5 py-3 text-right">Valor Total</th>
                          <th className="px-5 py-3 text-right">Preço Médio/L</th>
                          <th className="px-5 py-3 text-right">Economizado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                        {dados?.monthData.map((m, i) => (
                          <tr key={m.month} className={i % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50 dark:bg-gray-800/50"}>
                            <td className="px-5 py-3 font-bold text-[#0b7336] capitalize">{fmtMonth(m.month)}</td>
                            <td className="px-5 py-3 text-right tabular-nums">{m.totalLitros.toLocaleString("pt-BR", { minimumFractionDigits: 0 })} L</td>
                            <td className="px-5 py-3 text-right font-bold tabular-nums">{fmt(m.totalValor)}</td>
                            <td className="px-5 py-3 text-right tabular-nums">{fmt(m.precoMedio)}/L</td>
                            <td className="px-5 py-3 text-right font-black text-emerald-600 tabular-nums">{fmt(m.economizado)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Top 5 + Preço Médio Região */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <section>
                    <h3 className="text-xs font-black uppercase tracking-widest text-[#0b7336] mb-3">Top 5 Maiores Consumos</h3>
                    <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800 shadow-sm divide-y divide-gray-50 dark:divide-gray-800">
                      {dados?.top5.length === 0 && <p className="px-5 py-4 text-xs text-gray-400">Nenhum projeto identificado.</p>}
                      {dados?.top5.map(([proj, val], i) => (
                        <div key={proj} className="flex items-center justify-between px-5 py-3">
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 text-[10px] font-black flex items-center justify-center">{i + 1}</span>
                            <span className="font-bold text-xs text-gray-800 dark:text-gray-100">{proj}</span>
                          </div>
                          <span className="font-black text-xs text-red-600">{fmt(val)}</span>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section>
                    <h3 className="text-xs font-black uppercase tracking-widest text-[#0b7336] mb-3">Preço Médio / Região</h3>
                    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
                      {dados?.mediasRegiao.map(mr => (
                        <div key={mr.regiao} className="border-b last:border-0 border-gray-50 dark:border-gray-800">
                          <div className="flex justify-between items-center px-5 py-2.5 bg-gray-50 dark:bg-gray-800/60">
                            <span className="font-black text-xs text-gray-900 dark:text-white">{mr.regiao}</span>
                            <span className="font-black text-xs text-[#0b7336]">{fmt(mr.media)}</span>
                          </div>
                          {mr.tipos.map(t => (
                            <div key={t.tipo} className="flex justify-between items-center px-5 py-1.5 pl-8">
                              <span className="text-[10px] text-gray-500">{t.tipo}</span>
                              <span className="text-[10px] font-bold text-[#0b7336]">{fmt(t.media)}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </section>
                </div>

                {/* Consumo por Projeto / Mês */}
                <section>
                  <h3 className="text-xs font-black uppercase tracking-widest text-[#0b7336] mb-3">
                    Consumo por Projeto / Mês
                    <span className="ml-2 text-gray-400 normal-case font-normal text-[10px]">últimos {dados?.ultimos5.length} meses selecionados</span>
                  </h3>
                  <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-x-auto border border-gray-100 dark:border-gray-800 shadow-sm">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-900 text-white uppercase font-black tracking-wider">
                          <th className="px-5 py-3 text-left">Projeto</th>
                          {dados?.ultimos5.map(m => (
                            <th key={m} className="px-4 py-3 text-right whitespace-nowrap">
                              {new Date(m + "-02").toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).toUpperCase()}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                        {dados?.projsSorted.map((proj, i) => (
                          <tr key={proj} className={i % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50 dark:bg-gray-800/50"}>
                            <td className="px-5 py-2.5 font-bold text-gray-800 dark:text-gray-100 whitespace-nowrap max-w-[200px] truncate">{proj}</td>
                            {dados?.ultimos5.map(m => {
                              const v = dados?.consumoPorProjetoMes[proj]?.[m]?.valor || 0;
                              return (
                                <td key={m} className="px-4 py-2.5 text-right tabular-nums">
                                  {v > 0
                                    ? <span className="font-bold text-gray-800 dark:text-gray-100">{fmt(v)}</span>
                                    : <span className="text-gray-300 dark:text-gray-600">—</span>}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
