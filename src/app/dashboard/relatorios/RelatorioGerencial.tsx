"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  FunnelIcon,
  TruckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CurrencyDollarIcon,
  FireIcon,
  DocumentArrowDownIcon
} from '@heroicons/react/24/outline';
import { dataCache } from '@/lib/cache';
import { gerarRelatorioGerencialPdf } from '@/lib/gerencialPdf';

export default function RelatorioGerencial() {
  const [abastecimentos, setAbastecimentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [expandedProj, setExpandedProj] = useState<string | null>(null);

  useEffect(() => {
    fetchDados();
  }, []);

  const fetchDados = async () => {
    if (dataCache.abastecimentos) {
      setAbastecimentos(dataCache.abastecimentos);
      if (dataCache.abastecimentos.length > 0 && !selectedMonth) {
        setSelectedMonth(String(dataCache.abastecimentos[0].data_transacao).slice(0, 7));
      }
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      let allAbastecimentos: any[] = [];
      let hasMore = true;
      let from = 0;
      let to = 999;

      while (hasMore) {
        const { data, error } = await supabase
          .from('abastecimentos')
          .select('*')
          .order('data_transacao', { ascending: false })
          .range(from, to);

        if (error) throw error;
        
        if (!data || data.length === 0) {
          hasMore = false;
        } else {
          allAbastecimentos = [...allAbastecimentos, ...data];
          if (data.length < 1000) hasMore = false;
          else { from += 1000; to += 1000; }
        }
        if (allAbastecimentos.length > 100000) break;
      }

      setAbastecimentos(allAbastecimentos);
      dataCache.abastecimentos = allAbastecimentos;

      if (allAbastecimentos.length > 0) {
        setSelectedMonth(String(allAbastecimentos[0].data_transacao).slice(0, 7));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    abastecimentos.forEach((a: any) => {
      if (a.data_transacao) {
        monthsSet.add(String(a.data_transacao).slice(0, 7));
      }
    });
    return Array.from(monthsSet).sort().reverse();
  }, [abastecimentos]);

  const { grouped, topKm, topValor } = useMemo(() => {
    const normalize = (p: string) => p?.toString().replace(/[^a-zA-Z0-9]/g, '').toUpperCase().trim() || "";
    // @ts-ignore
    const placaToProject = dataCache.placaToProject || new Map();

    const currentMonthData = abastecimentos.filter(a => String(a.data_transacao).slice(0, 7) === selectedMonth);
    const vehicleStats: Record<string, { km: number, liters: number, valor: number, proj: string }> = {};

    currentMonthData.forEach(a => {
      const placaNorm = normalize(a.placa);
      if (!vehicleStats[placaNorm]) {
        vehicleStats[placaNorm] = {
          km: 0,
          liters: 0,
          valor: 0,
          proj: String(a.projeto || placaToProject.get(placaNorm) || "SEM PROJETO").toUpperCase(),
        };
      }
      vehicleStats[placaNorm].km += Number(a.km_rodados_horas || a.km_rodados) || 0;
      vehicleStats[placaNorm].liters += Number(a.litros) || 0;
      vehicleStats[placaNorm].valor += Number(a.valor_emissao) || 0;
    });

    const entries = Object.entries(vehicleStats);
    
    // Top 5 KM
    const topKm = [...entries].sort((a, b) => b[1].km - a[1].km).slice(0, 5);
    // Top 5 Valor
    const topValor = [...entries].sort((a, b) => b[1].valor - a[1].valor).slice(0, 5);

    // Agrupar por projeto
    const projGroups: Record<string, { totalKm: number, totalLiters: number, totalValor: number, vehicles: any[] }> = {};
    for (const [placa, stats] of entries) {
      if (!projGroups[stats.proj]) {
        projGroups[stats.proj] = { totalKm: 0, totalLiters: 0, totalValor: 0, vehicles: [] };
      }
      projGroups[stats.proj].totalKm += stats.km;
      projGroups[stats.proj].totalLiters += stats.liters;
      projGroups[stats.proj].totalValor += stats.valor;
      projGroups[stats.proj].vehicles.push({ placa, ...stats });
    }

    // Sort vehicles within projects by KM
    for (const proj in projGroups) {
      projGroups[proj].vehicles.sort((a, b) => b.km - a.km);
    }

    // Sort projects alphabetically
    const sortedGrouped = Object.fromEntries(
      Object.entries(projGroups).sort(([a], [b]) => a.localeCompare(b))
    );

    return { grouped: sortedGrouped, topKm, topValor };
  }, [abastecimentos, selectedMonth]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 animate-pulse bg-white/50 backdrop-blur-xl rounded-[3rem]">
        <div className="w-10 h-10 border-4 border-[#0b7336] border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-gray-400 font-black text-xs uppercase tracking-widest text-center">
          Carregando Relatório Gerencial...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filtro de Mês e PDF */}
      <div className="flex justify-end gap-3">
        <button
          onClick={() => gerarRelatorioGerencialPdf({ month: selectedMonth, grouped, topKm, topValor })}
          className="flex items-center gap-2 px-6 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm rounded-2xl shadow-lg transition-all active:scale-95 uppercase tracking-widest"
        >
          <DocumentArrowDownIcon className="w-5 h-5" />
          Baixar PDF
        </button>

        <div className="flex items-center px-6 py-4 bg-[#1a1c23] rounded-2xl border border-white/10 shadow-xl cursor-pointer">
          <FunnelIcon className="w-4 h-4 text-emerald-500 mr-3" />
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-transparent text-white font-black text-sm outline-none uppercase tracking-widest cursor-pointer"
          >
            {availableMonths.map(m => (
              <option key={m} value={m} className="bg-[#1a1c23]">
                {new Date(m + "-02").toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tops */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <TruckIcon className="w-5 h-5" />
            </div>
            <h3 className="font-black text-sm uppercase tracking-widest text-gray-800">Top 5 Veículos que Mais Rodam</h3>
          </div>
          <div className="flex-1 space-y-3">
            {topKm.map(([placa, stats], idx) => (
              <div key={placa} className="flex justify-between items-center p-3 rounded-xl hover:bg-gray-50 transition-colors border border-gray-50">
                <div className="flex items-center gap-3">
                  <span className="text-gray-400 font-black text-xs">{idx + 1}º</span>
                  <div>
                    <p className="font-black text-gray-900">{placa}</p>
                    <p className="text-[10px] text-gray-400 uppercase font-bold">{stats.proj}</p>
                  </div>
                </div>
                <span className="font-black text-blue-600">{stats.km.toLocaleString('pt-BR')} km</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <CurrencyDollarIcon className="w-5 h-5" />
            </div>
            <h3 className="font-black text-sm uppercase tracking-widest text-gray-800">Top 5 Veículos que Mais Abastecem</h3>
          </div>
          <div className="flex-1 space-y-3">
            {topValor.map(([placa, stats], idx) => (
              <div key={placa} className="flex justify-between items-center p-3 rounded-xl hover:bg-gray-50 transition-colors border border-gray-50">
                <div className="flex items-center gap-3">
                  <span className="text-gray-400 font-black text-xs">{idx + 1}º</span>
                  <div>
                    <p className="font-black text-gray-900">{placa}</p>
                    <p className="text-[10px] text-gray-400 uppercase font-bold">{stats.proj}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black text-emerald-600">{stats.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                  <p className="text-[10px] font-bold text-gray-400">{stats.liters.toLocaleString('pt-BR')} L</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Lista por Projeto */}
      <div className="space-y-4">
        <h3 className="font-black text-lg text-gray-800 uppercase tracking-widest ml-2 mt-4">Detalhamento por Projeto</h3>
        
        {Object.entries(grouped).map(([proj, data]) => {
          const isExpanded = expandedProj === proj;
          return (
            <div key={proj} className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
              <div 
                className="p-6 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpandedProj(isExpanded ? null : proj)}
              >
                <div className="flex-1">
                  <h4 className="font-black text-lg text-gray-900">{proj}</h4>
                  <p className="text-xs font-bold text-gray-400 uppercase mt-1">{data.vehicles.length} Veículos Ativos no Mês</p>
                </div>
                
                <div className="flex items-center gap-8 text-right mr-6 hidden md:flex">
                  <div>
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Total KM</p>
                    <p className="font-black text-gray-800">{data.totalKm.toLocaleString('pt-BR')} km</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Total Litros</p>
                    <p className="font-black text-gray-800">{data.totalLiters.toLocaleString('pt-BR')} L</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Custo Total</p>
                    <p className="font-black text-emerald-600">{data.totalValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                  </div>
                </div>

                <div className="p-2 text-gray-400">
                  {isExpanded ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
                </div>
              </div>

              {isExpanded && (
                <div className="bg-gray-50 p-6 border-t border-gray-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {data.vehicles.map(v => (
                      <div key={v.placa} className="bg-white p-4 rounded-xl border border-gray-100 flex items-center justify-between">
                        <div>
                          <p className="font-black text-gray-900">{v.placa}</p>
                          <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase">{v.km.toLocaleString('pt-BR')} km rodados</p>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-emerald-600">{v.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                          <p className="text-[10px] font-bold text-gray-400 uppercase">{v.liters.toLocaleString('pt-BR')} L</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
