"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  FunnelIcon,
  EnvelopeIcon,
  TruckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { dataCache } from '@/lib/cache';
import toast from 'react-hot-toast';

export default function RelatorioEficiencia() {
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
          const filteredData = data.filter((a: any) => !String(a.tipo_combustivel || '').toUpperCase().includes("ARLA"));
          allAbastecimentos = [...allAbastecimentos, ...filteredData];
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

  const vehicleHistoricalKmL = useMemo(() => {
    const totals: Record<string, { km: number, liters: number }> = {};
    const normalize = (p: string) => p?.toString().replace(/[^a-zA-Z0-9]/g, '').toUpperCase().trim() || "";
    const currentMonth = new Date().toISOString().slice(0, 7);

    abastecimentos.forEach((a: any) => {
      if (!a.data_transacao) return;
      if (String(a.tipo_combustivel || '').toUpperCase().includes("ARLA")) return;
      
      const month = String(a.data_transacao).slice(0, 7);
      if (month >= currentMonth) return;
      const normPlaca = normalize(a.placa);
      if (!normPlaca) return;
      
      if (!totals[normPlaca]) totals[normPlaca] = { km: 0, liters: 0 };
      totals[normPlaca].km += Number(a.km_rodados_horas || a.km_rodados) || 0;
      totals[normPlaca].liters += Number(a.litros) || 0;
    });

    const averages: Record<string, number> = {};
    for (const placa in totals) {
      averages[placa] = totals[placa].liters > 0 ? totals[placa].km / totals[placa].liters : 0;
    }
    return averages;
  }, [abastecimentos]);

  const efficiencyData = useMemo(() => {
    const normalize = (p: string) => p?.toString().replace(/[^a-zA-Z0-9]/g, '').toUpperCase().trim() || "";
    // @ts-ignore
    const placaToProject = dataCache.placaToProject || new Map();
    // @ts-ignore
    const placaToGerente = dataCache.placaToGerente || new Map();
    // @ts-ignore
    const placaToModel = dataCache.placaToModel || new Map();

    const currentMonthData = abastecimentos.filter(a => String(a.data_transacao).slice(0, 7) === selectedMonth);
    const vehicleStats: Record<string, { km: number, liters: number, count: number, proj: string, gestor: string, modelo: string }> = {};

    currentMonthData.forEach(a => {
      if (String(a.tipo_combustivel || '').toUpperCase().includes("ARLA")) return;
      
      const placaNorm = normalize(a.placa);
      if (!vehicleStats[placaNorm]) {
        vehicleStats[placaNorm] = {
          km: 0,
          liters: 0,
          count: 0,
          proj: String(a.projeto || placaToProject.get(placaNorm) || "SEM PROJETO").toUpperCase(),
          gestor: String(placaToGerente.get(placaNorm) || "Sem Gestor Mapeado").toLowerCase(),
          modelo: String(a.modelo_veiculo || placaToModel.get(placaNorm) || "OUTROS").toUpperCase()
        };
      }
      vehicleStats[placaNorm].km += Number(a.km_rodados_horas || a.km_rodados) || 0;
      vehicleStats[placaNorm].liters += Number(a.litros) || 0;
      vehicleStats[placaNorm].count++;
    });

    // Calcula kml e agrupa
    // Estrutura: proj -> gestor -> modelo -> vehicles[]
    const grouped: any = {};
    const targetModels = ['POLO', 'RANGER', 'S10', 'MONTANA', 'FIORINO', 'STRADA', 'SAVEIRO'];

    for (const placa in vehicleStats) {
      const stats = vehicleStats[placa];
      const isTarget = targetModels.some(m => stats.modelo.includes(m));
      if (!isTarget) continue;

      let kml = stats.liters > 0 ? stats.km / stats.liters : 0;
      let isHistorical = false;
      
      if (stats.count === 1 && vehicleHistoricalKmL[placa] > 0) {
        kml = vehicleHistoricalKmL[placa];
        isHistorical = true;
      }

      if (!grouped[stats.proj]) grouped[stats.proj] = { gestores: {} };
      if (!grouped[stats.proj].gestores[stats.gestor]) grouped[stats.proj].gestores[stats.gestor] = { modelos: {} };
      if (!grouped[stats.proj].gestores[stats.gestor].modelos[stats.modelo]) {
        grouped[stats.proj].gestores[stats.gestor].modelos[stats.modelo] = { vehicles: [], avgModel: 0, totalKml: 0 };
      }

      grouped[stats.proj].gestores[stats.gestor].modelos[stats.modelo].vehicles.push({
        placa,
        kml,
        isHistorical,
        liters: stats.liters
      });
      grouped[stats.proj].gestores[stats.gestor].modelos[stats.modelo].totalKml += kml;
    }

    // Calcula média do modelo para definir anomalias
    for (const proj in grouped) {
      for (const gestor in grouped[proj].gestores) {
        for (const modelo in grouped[proj].gestores[gestor].modelos) {
          const mod = grouped[proj].gestores[gestor].modelos[modelo];
          mod.avgModel = mod.vehicles.length > 0 ? mod.totalKml / mod.vehicles.length : 0;
          mod.vehicles.sort((a: any, b: any) => b.kml - a.kml); // Do melhor para o pior
        }
      }
    }

    return grouped;
  }, [abastecimentos, selectedMonth, vehicleHistoricalKmL]);

  const handleSendEmail = (gestorEmail: string, projName: string, gestorData: any) => {
    if (!gestorEmail || gestorEmail === "sem gestor mapeado") {
      toast.error("Este grupo não possui um e-mail de gestor cadastrado na frota.");
      return;
    }

    let reportBody = `Olá,\n\nSegue o relatório de eficiência e desempenho da frota para o projeto ${projName} (${selectedMonth}).\n\n`;

    let hasAnomalies = false;
    let anomaliesText = `ATENÇÃO - VEÍCULOS FORA DO PADRÃO (Abaixo da média do modelo):\n`;

    for (const modelo in gestorData.modelos) {
      const mod = gestorData.modelos[modelo];
      reportBody += `Modelo: ${modelo} (Média da Categoria: ${mod.avgModel.toFixed(2)} km/l)\n`;
      mod.vehicles.forEach((v: any) => {
        reportBody += ` - ${v.placa}: ${v.kml.toFixed(2)} km/l (${v.liters.toFixed(2)} L consumidos)\n`;
        // Anomalia: abaixo de 70% da média
        if (v.kml > 0 && mod.avgModel > 0 && v.kml < mod.avgModel * 0.7) {
          hasAnomalies = true;
          anomaliesText += ` - ${v.placa} (${modelo}): ${v.kml.toFixed(2)} km/l (Média esperada: ${mod.avgModel.toFixed(2)})\n`;
        }
      });
      reportBody += `\n`;
    }

    if (hasAnomalies) {
      reportBody = anomaliesText + `\n----------------------\n\n` + reportBody;
    }

    const subject = encodeURIComponent(`Relatório de Eficiência de Frota - ${projName}`);
    window.location.href = `mailto:${gestorEmail}?subject=${subject}&body=${encodeURIComponent(reportBody)}`;
    toast.success("Gerando e-mail...");
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 animate-pulse bg-white/50 backdrop-blur-xl rounded-[3rem]">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-gray-400 font-black text-xs uppercase tracking-widest text-center">Calculando Eficiência...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="bg-[#1a1c23] p-8 rounded-[3rem] shadow-2xl flex flex-col md:flex-row justify-between items-center gap-6 border border-white/5">
        <div className="text-center md:text-left">
          <h2 className="text-2xl font-black text-white italic tracking-tighter">Eficiência & Desempenho</h2>
          <p className="text-indigo-500 font-bold text-[10px] uppercase tracking-widest mt-1">Comparativo de Média (KM/L) por Modelo</p>
        </div>

        <div className="flex items-center px-6 py-4 bg-white/5 rounded-2xl border border-white/10">
          <FunnelIcon className="w-4 h-4 text-indigo-500 mr-3" />
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-transparent text-white font-black text-sm uppercase tracking-widest outline-none cursor-pointer"
          >
            {availableMonths.map(m => (
              <option key={m} value={m} className="bg-gray-900">{m}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {Object.keys(efficiencyData).map(proj => (
          <div key={proj} className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-[2.5rem] border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
            <div 
              className="p-6 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors flex justify-between items-center"
              onClick={() => setExpandedProj(expandedProj === proj ? null : proj)}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center">
                  <span className="text-indigo-600 dark:text-indigo-400 font-black text-xs">{proj.substring(0,2)}</span>
                </div>
                <div>
                  <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">{proj}</h3>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    {Object.keys(efficiencyData[proj].gestores).length} Gestores Mapeados
                  </p>
                </div>
              </div>
              {expandedProj === proj ? <ChevronUpIcon className="w-5 h-5 text-gray-400" /> : <ChevronDownIcon className="w-5 h-5 text-gray-400" />}
            </div>

            {expandedProj === proj && (
              <div className="px-6 pb-6 pt-2 space-y-6">
                {Object.keys(efficiencyData[proj].gestores).map(gestor => {
                  const gestorData = efficiencyData[proj].gestores[gestor];
                  return (
                    <div key={gestor} className="bg-gray-50 dark:bg-gray-900/50 rounded-[2rem] p-6 border border-gray-100 dark:border-gray-800">
                      <div className="flex justify-between items-center mb-6">
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Gestor Responsável</p>
                          <h4 className="text-base font-bold text-gray-900 dark:text-white">{gestor}</h4>
                        </div>
                        <button
                          onClick={() => handleSendEmail(gestor, proj, gestorData)}
                          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/20"
                        >
                          <EnvelopeIcon className="w-4 h-4" /> Enviar Relatório
                        </button>
                      </div>

                      <div className="space-y-6">
                        {Object.keys(gestorData.modelos).map(modelo => {
                          const mod = gestorData.modelos[modelo];
                          return (
                            <div key={modelo} className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm">
                              <div className="flex justify-between items-center mb-4">
                                <h5 className="font-black text-gray-800 dark:text-gray-200">{modelo}</h5>
                                <div className="text-right">
                                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Média da Categoria</p>
                                  <p className="text-sm font-black text-indigo-600">{mod.avgModel.toFixed(2)} km/l</p>
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                {mod.vehicles.map((v: any) => {
                                  // Anomalia: menos de 70% da média do modelo
                                  const isAnomaly = v.kml > 0 && mod.avgModel > 0 && v.kml < (mod.avgModel * 0.7);
                                  const isBest = v.kml >= mod.avgModel && v.kml > 0;

                                  return (
                                    <div key={v.placa} className={`p-3 rounded-xl border flex justify-between items-center ${isAnomaly ? 'border-red-200 bg-red-50 dark:bg-red-900/10' : 'border-gray-100 dark:border-gray-700'}`}>
                                      <div className="flex items-center gap-3">
                                        <TruckIcon className={`w-4 h-4 ${isAnomaly ? 'text-red-500' : 'text-gray-400'}`} />
                                        <div>
                                          <p className={`text-xs font-black ${isAnomaly ? 'text-red-700 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>{v.placa}</p>
                                          {v.isHistorical && <p className="text-[8px] font-black text-gray-400 uppercase">Média Histórica *</p>}
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <p className={`text-sm font-black ${isAnomaly ? 'text-red-600' : isBest ? 'text-emerald-600' : 'text-gray-900 dark:text-white'}`}>
                                          {v.kml.toFixed(2)}
                                        </p>
                                        <p className="text-[9px] font-bold text-gray-400">{v.liters.toFixed(0)}L consumidos</p>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
