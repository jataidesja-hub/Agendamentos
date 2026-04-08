"use client";

import React, { useMemo, useState } from 'react';
import { 
  GlobeAmericasIcon, 
  CloudIcon, 
  ScaleIcon,
  TruckIcon,
  CloudArrowDownIcon,
  PresentationChartLineIcon,
  FunnelIcon,
  BuildingOffice2Icon,
  ArrowTrendingUpIcon,
  TrophyIcon
} from '@heroicons/react/24/outline';
import { dataCache } from '@/lib/cache';

const RelatorioMeioAmbiente = () => {
  const [selectedMonth, setSelectedMonth] = useState('');
  const abastecimentos = dataCache.abastecimentos || [];

  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    abastecimentos.forEach((a: any) => {
      if (a.data_transacao) {
        const dateStr = String(a.data_transacao);
        if (dateStr.includes('-')) monthsSet.add(dateStr.slice(0, 7));
      }
    });
    return Array.from(monthsSet).sort().reverse();
  }, [abastecimentos]);

  if (!selectedMonth && availableMonths.length > 0) {
    setSelectedMonth(availableMonths[0]);
  }

  const processedData = useMemo(() => {
    const filtered = abastecimentos.filter((a: any) => {
      if (!a.data_transacao || !selectedMonth) return false;
      return String(a.data_transacao).slice(0, 7) === selectedMonth;
    });

    let totalCO2 = 0;
    let totalLiters = 0;
    let totalKm = 0;
    const projectStats: any = {};
    const typeStats: any = {
      'Combustão': 0,
      'Transporte': 0
    };

    filtered.forEach((a: any) => {
      const litros = Number(a.litros) || 0;
      const km = Number(a.km_rodados_horas) || 0;
      const fuel = String(a.tipo_combustivel || "").toUpperCase();
      const project = String(a.projeto || "SEM PROJETO").toUpperCase();
      const vehicleType = String(a.tipo_frota || a.modelo_veiculo || "").toUpperCase();

      let co2FromFuel = 0;
      let co2FromKm = 0;

      // Cálculo por Combustão (Fatores fornecidos na imagem + estimativas padrão)
      if (fuel.includes("GASOLINA")) {
        co2FromFuel = litros * 2.27; // Litros * 0.82 * 0.75 * 3.7
      } else if (fuel.includes("DIESEL")) {
        co2FromFuel = litros * 2.68;
      } else if (fuel.includes("ETANOL")) {
        co2FromFuel = litros * 0.45;
      }

      // Cálculo por KM
      let kmFactor = 0.314; // Carro Pequeno
      if (vehicleType.includes("CAMINHONETE") || vehicleType.includes("PICKUP") || vehicleType.includes("HILUX") || vehicleType.includes("S10") || vehicleType.includes("L200")) {
        kmFactor = 0.461;
      } else if (vehicleType.includes("MOTO")) {
        kmFactor = 0.212;
      }

      co2FromKm = km * kmFactor;
      
      const recordCO2 = co2FromFuel > 0 ? co2FromFuel : co2FromKm;

      totalCO2 += recordCO2;
      totalLiters += litros;
      totalKm += km;

      typeStats['Combustão'] += co2FromFuel;
      typeStats['Transporte'] += co2FromKm;

      if (!projectStats[project]) {
        projectStats[project] = { name: project, co2: 0, liters: 0, km: 0 };
      }
      projectStats[project].co2 += recordCO2;
      projectStats[project].liters += litros;
      projectStats[project].km += km;
    });

    const chartData = Object.values(projectStats)
      .sort((a: any, b: any) => b.co2 - a.co2)
      .slice(0, 8);

    const maxExp = Math.max(...chartData.map((d: any) => d.co2), 1);

    return {
      totalCO2,
      totalLiters,
      totalKm,
      chartData: chartData.map((d: any) => ({ ...d, percentage: (d.co2 / maxExp) * 100 })),
      typeStats,
      totalRecords: filtered.length
    };
  }, [abastecimentos, selectedMonth]);

  const treeOffset = Math.ceil(processedData.totalCO2 / 15);

  return (
    <div className="space-y-8 pb-20 max-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Search & Filter Header */}
      <div className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-2xl p-8 rounded-[3.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] flex flex-col md:flex-row justify-between items-center gap-6 border border-white dark:border-white/5">
        <div className="flex items-center gap-6">
           <div className="w-16 h-16 bg-gradient-to-tr from-emerald-500 to-green-400 rounded-3xl flex items-center justify-center shadow-lg shadow-emerald-500/20 rotate-3">
              <GlobeAmericasIcon className="w-9 h-9 text-white" />
           </div>
           <div>
              <h2 className="text-3xl font-black text-gray-900 dark:text-white italic tracking-tighter uppercase">Painel de Sustentabilidade</h2>
              <p className="text-emerald-500 font-bold text-[10px] uppercase tracking-[0.2em] mt-1">Gestão de emissões CYMI • Protocolo de gases estufa</p>
           </div>
        </div>

        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-blue-500 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
          <div className="relative flex items-center px-8 py-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-white/10 group-hover:border-emerald-500 transition-all cursor-pointer">
            <FunnelIcon className="w-4 h-4 text-emerald-500 mr-4 group-hover:rotate-180 transition-transform duration-700" />
            <select 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-gray-900 dark:text-white font-black text-sm outline-none uppercase tracking-widest cursor-pointer"
            >
              {availableMonths.map(m => (
                <option key={m} value={m} className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
                  {new Date(m + "-02").toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gray-900 p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden group">
           <div className="absolute -right-6 -top-6 w-32 h-32 bg-emerald-500/20 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000" />
           <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em] mb-4">Total de Emissões</p>
           <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black tracking-tighter">{(processedData.totalCO2 / 1000).toFixed(2)}</span>
              <span className="text-lg font-bold text-gray-400">ton CO₂e</span>
           </div>
           <div className="mt-8 flex items-center gap-2 bg-white/5 py-2 px-4 rounded-xl border border-white/5 w-fit">
              <CloudIcon className="w-4 h-4 text-emerald-500" />
              <span className="text-[10px] font-bold text-gray-400">Baseado em {processedData.totalRecords} registros</span>
           </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1">
           <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center mb-6">
              <ArrowTrendingUpIcon className="w-6 h-6 text-emerald-600" />
           </div>
           <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Neutralização</p>
           <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter">{treeOffset}</span>
              <span className="text-sm font-bold text-emerald-600 uppercase">Árvores</span>
           </div>
           <p className="text-[10px] text-gray-400 font-medium mt-4 leading-relaxed">Quantidade estimada de árvores para compensar este período.</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1">
           <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center mb-6">
              <TruckIcon className="w-6 h-6 text-blue-600" />
           </div>
           <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Eficiência da Frota</p>
           <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter">
                {(processedData.totalCO2 / (processedData.totalKm || 1)).toFixed(3)}
              </span>
              <span className="text-sm font-bold text-blue-600 uppercase">kg/km</span>
           </div>
           <p className="text-[10px] text-gray-400 font-medium mt-4 leading-relaxed">Impacto médio por quilômetro rodado pela frota no período.</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1">
           <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/20 rounded-2xl flex items-center justify-center mb-6">
              <CloudArrowDownIcon className="w-6 h-6 text-amber-600" />
           </div>
           <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Consumo Total</p>
           <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter">{processedData.totalLiters.toLocaleString('pt-BR')}</span>
              <span className="text-sm font-bold text-amber-600 uppercase">Litros</span>
           </div>
           <p className="text-[10px] text-gray-400 font-medium mt-4 leading-relaxed">Volume total de combustível processado nas faturas de {selectedMonth}.</p>
        </div>
      </div>

      {/* Visual Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Project Ranking Table/Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-10 rounded-[3.5rem] border border-gray-100 dark:border-gray-700 shadow-xl">
           <div className="flex justify-between items-center mb-10">
              <div className="flex items-center gap-4">
                 <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center">
                    <TrophyIcon className="w-5 h-5 text-yellow-500" />
                 </div>
                 <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase italic tracking-tighter">Impacto Ambiental por Projeto</h3>
              </div>
              <span className="text-[9px] font-black bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 px-4 py-1.5 rounded-full border border-gray-200 dark:border-white/10 uppercase tracking-widest">Top emissões</span>
           </div>

           <div className="space-y-6">
              {processedData.chartData.length === 0 ? (
                <div className="text-center py-20 text-gray-400 italic">Sem dados suficientes para gerar ranking.</div>
              ) : (
                processedData.chartData.map((item: any, idx: number) => (
                  <div key={item.name} className="relative">
                    <div className="flex justify-between items-center mb-2 px-1">
                       <span className="text-[11px] font-black text-gray-700 dark:text-gray-300 uppercase tracking-tight truncate max-w-[70%]">{idx + 1}. {item.name}</span>
                       <span className="text-xs font-black text-gray-900 dark:text-white">{item.co2.toFixed(1)} <span className="text-[9px] text-gray-400">kg CO₂</span></span>
                    </div>
                    <div className="h-4 bg-gray-50 dark:bg-gray-900/50 rounded-full overflow-hidden border border-gray-100 dark:border-white/5">
                        <div 
                          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-1000 ease-out flex items-center justify-end px-3"
                          style={{ width: `${item.percentage}%` }}
                        >
                           {item.percentage > 10 && <div className="w-1 h-1 bg-white/40 rounded-full animate-pulse" />}
                        </div>
                    </div>
                  </div>
                ))
              )}
           </div>
        </div>

        {/* Source Distribution */}
        <div className="bg-gradient-to-br from-emerald-600 to-green-700 p-10 rounded-[3.5rem] text-white shadow-2xl relative overflow-hidden flex flex-col justify-between">
           <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
           
           <div>
              <div className="flex items-center gap-3 mb-8">
                 <ScaleIcon className="w-6 h-6 text-emerald-200" />
                 <h3 className="text-lg font-black uppercase italic tracking-tighter">Origem do Carbono</h3>
              </div>
              
              <div className="space-y-8 mt-10">
                 <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/20">
                    <p className="text-[10px] font-black text-emerald-200 uppercase tracking-widest mb-3">Combustão Direta</p>
                    <div className="flex justify-between items-end">
                       <p className="text-3xl font-black">
                         {((processedData.typeStats['Combustão'] / (processedData.totalCO2 || 1)) * 100).toFixed(1)}%
                       </p>
                       <p className="text-[10px] font-bold text-emerald-200/60 ">{(processedData.typeStats['Combustão']/1000).toFixed(2)} t</p>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full mt-4 overflow-hidden">
                       <div className="h-full bg-white rounded-full" style={{ width: `${(processedData.typeStats['Combustão'] / (processedData.totalCO2 || 1)) * 100}%` }} />
                    </div>
                 </div>

                 <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/20">
                    <p className="text-[10px] font-black text-emerald-200 uppercase tracking-widest mb-3">Transporte Médio (Km)</p>
                    <div className="flex justify-between items-end">
                       <p className="text-3xl font-black">
                         {((processedData.typeStats['Transporte'] / (processedData.totalCO2 || 1)) * 100).toFixed(1)}%
                       </p>
                       <p className="text-[10px] font-bold text-emerald-200/60 ">{(processedData.typeStats['Transporte']/1000).toFixed(2)} t</p>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full mt-4 overflow-hidden">
                       <div className="h-full bg-emerald-300 rounded-full" style={{ width: `${(processedData.typeStats['Transporte'] / (processedData.totalCO2 || 1)) * 100}%` }} />
                    </div>
                 </div>
              </div>
           </div>

           <div className="mt-10 pt-6 border-t border-white/10 text-[10px] font-bold text-emerald-100 flex items-center gap-2 italic">
              <PresentationChartLineIcon className="w-4 h-4" />
              Baseado no GHG Protocol • Scopo 1
           </div>
        </div>
      </div>

      {/* Methodology Section */}
      <div className="bg-white dark:bg-gray-800 p-10 rounded-[4rem] border border-gray-100 dark:border-gray-700 shadow-xl flex flex-col md:flex-row items-center gap-10">
          <div className="w-24 h-24 bg-emerald-500/10 dark:bg-emerald-400/5 text-emerald-600 rounded-[2.5rem] flex items-center justify-center shrink-0 border border-emerald-500/10">
            <PresentationChartLineIcon className="w-12 h-12" />
          </div>
          <div className="flex-1">
             <h4 className="text-xl font-black text-gray-900 dark:text-white tracking-tighter uppercase italic mb-4">Critérios de Cálculo Aplicados</h4>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div>
                   <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2 px-3 py-1 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg w-fit">Gasolina Brasil</p>
                   <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed font-medium">Fórmula: <code className="bg-gray-100 dark:bg-gray-900 px-1.5 py-0.5 rounded font-black italic">Litros × 2,27</code>. Baseia-se em 82% de pureza e densidade de 0,75kg/L conforme relatório técnico.</p>
                </div>
                <div>
                   <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2 px-3 py-1 bg-blue-50 dark:bg-blue-900/30 rounded-lg w-fit">Diesel / Outros</p>
                   <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed font-medium">Estimativa de <code className="bg-gray-100 dark:bg-gray-900 px-1.5 py-0.5 rounded font-black italic">2,68 kg/L</code> para Diesel e <code className="bg-gray-100 dark:bg-gray-900 px-1.5 py-0.5 rounded font-black italic">0,45 kg/L</code> para Etanol em ciclo de vida.</p>
                </div>
                <div>
                   <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-2 px-3 py-1 bg-amber-50 dark:bg-amber-900/30 rounded-lg w-fit">Transporte por KM</p>
                   <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed font-medium">Carros: <code className="bg-gray-100 dark:bg-gray-900 px-1.5 py-0.5 rounded font-black italic">0,314 kg/km</code>. Caminhonetes: <code className="bg-gray-100 dark:bg-gray-900 px-1.5 py-0.5 rounded font-black italic">0,461 kg/km</code>. Motos: <code className="bg-gray-100 dark:bg-gray-900 px-1.5 py-0.5 rounded font-black italic">0,212 kg/km</code>.</p>
                </div>
             </div>
          </div>
      </div>

    </div>
  );
};

export default RelatorioMeioAmbiente;
