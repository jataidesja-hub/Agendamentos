"use client";

import React, { useState, useMemo } from 'react';
import { 
  BuildingStorefrontIcon, 
  MapPinIcon, 
  FunnelIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  BeakerIcon
} from '@heroicons/react/24/outline';
import { dataCache } from '@/lib/cache';

const RelatorioPostos = () => {
    const [selectedMonth, setSelectedMonth] = useState('');
    const [expandedState, setExpandedState] = useState<string | null>(null);
    const [expandedCity, setExpandedCity] = useState<string | null>(null);

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

    // Define o mês inicial
    if (!selectedMonth && availableMonths.length > 0) {
      setSelectedMonth(availableMonths[0]);
    }

    const groupedData = useMemo(() => {
      const data: any = {};
      
      const filtered = abastecimentos.filter((a: any) => {
        if (!a.data_transacao || !selectedMonth) return false;
        return String(a.data_transacao).slice(0, 7) === selectedMonth;
      });

      // Passo 1: Agrupar e somar valores
      filtered.forEach((a: any) => {
        const uf = String(a.uf || a.estado || "UF").toUpperCase().trim();
        const city = String(a.cidade || a.municipio || "NÃO INFORMADA").toUpperCase().trim();
        const post = String(a.estabelecimento || "POSTO DESCONHECIDO").toUpperCase().trim();
        const fuel = String(a.tipo_combustivel || "OUTROS").toUpperCase().trim();

        if (!data[uf]) data[uf] = { cities: {}, totalInvested: 0 };
        if (!data[uf].cities[city]) data[uf].cities[city] = { posts: {}, totalInvested: 0, fuelPrices: {} };
        if (!data[uf].cities[city].posts[post]) data[uf].cities[city].posts[post] = { fuels: {}, totalValue: 0 };
        
        if (!data[uf].cities[city].posts[post].fuels[fuel]) {
          data[uf].cities[city].posts[post].fuels[fuel] = { sumPrice: 0, count: 0, value: 0 };
        }

        const fuelData = data[uf].cities[city].posts[post].fuels[fuel];
        fuelData.sumPrice += (Number(a.valor_litro) || 0);
        fuelData.count += 1;
        fuelData.value += (Number(a.valor_emissao) || 0);

        data[uf].cities[city].posts[post].totalValue += (Number(a.valor_emissao) || 0);
        data[uf].cities[city].totalInvested += (Number(a.valor_emissao) || 0);
        data[uf].totalInvested += (Number(a.valor_emissao) || 0);
      });

      // Passo 2: Calcular min/max baseando-se nas MÉDIAS consolidadas por posto
      Object.values(data).forEach((ufData: any) => {
        Object.values(ufData.cities).forEach((cityData: any) => {
          Object.values(cityData.posts).forEach((postData: any) => {
            Object.entries(postData.fuels).forEach(([fuel, fuelData]: [string, any]) => {
              const avg = fuelData.sumPrice / fuelData.count;
              if (!cityData.fuelPrices[fuel]) {
                cityData.fuelPrices[fuel] = { min: avg, max: avg };
              } else {
                if (avg > 0 && avg < cityData.fuelPrices[fuel].min) cityData.fuelPrices[fuel].min = avg;
                if (avg > cityData.fuelPrices[fuel].max) cityData.fuelPrices[fuel].max = avg;
              }
            });
          });
        });
      });

      return data;
    }, [abastecimentos, selectedMonth]);

    return (
      <div className="space-y-6 pb-20">
        {/* Filtro de Mês */}
        <div className="bg-gray-900 p-8 rounded-[3rem] shadow-2xl flex flex-col md:flex-row justify-between items-center gap-6 border border-white/5">
          <div>
            <h2 className="text-2xl font-black text-white italic tracking-tighter">Comparador de Preços</h2>
            <p className="text-emerald-500 font-bold text-[10px] uppercase tracking-widest mt-1">Análise competitiva por Estado e Cidade</p>
          </div>

          <div className="flex items-center px-6 py-4 bg-white/5 rounded-2xl border border-white/10 hover:border-emerald-500 transition-all cursor-pointer">
            <FunnelIcon className="w-4 h-4 text-emerald-500 mr-3" />
            <select 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-white font-black text-sm outline-none uppercase tracking-widest"
            >
              {availableMonths.map(m => (
                <option key={m} value={m} className="bg-gray-900">
                  {new Date(m + "-02").toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Listagem por Estados */}
        <div className="space-y-4">
          {Object.keys(groupedData).length === 0 ? (
            <div className="bg-white p-20 rounded-[3rem] text-center border-2 border-dashed border-gray-100 flex flex-col items-center">
               <MapPinIcon className="w-12 h-12 text-gray-200 mb-4" />
               <p className="text-gray-400 font-medium text-sm italic">Nenhum dado para este período.</p>
            </div>
          ) : (
            Object.keys(groupedData).sort().map(uf => (
              <div key={uf} className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
                <button 
                  onClick={() => setExpandedState(expandedState === uf ? null : uf)}
                  className="w-full px-8 py-5 flex justify-between items-center hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center text-white font-black text-xs uppercase border border-white/10 shadow-lg">
                      {uf}
                    </div>
                    <div className="text-left">
                       <h3 className="text-lg font-black text-gray-900 italic">ESTADO: {uf}</h3>
                       <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Investido: {groupedData[uf].totalInvested.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                  </div>
                  {expandedState === uf ? <ChevronUpIcon className="w-5 h-5 text-gray-400" /> : <ChevronDownIcon className="w-5 h-5 text-gray-400" />}
                </button>

                {expandedState === uf && (
                  <div className="px-6 pb-6 space-y-3 bg-gray-50/20">
                    <div className="h-px bg-gray-100 w-full mb-4" />
                    {Object.keys(groupedData[uf].cities).sort().map(city => (
                      <div key={city} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                         <button 
                            onClick={() => setExpandedCity(expandedCity === city ? null : city)}
                            className="w-full px-6 py-4 flex justify-between items-center hover:bg-gray-50 transition-colors"
                         >
                            <div className="flex items-center gap-3">
                               <MapPinIcon className="w-4 h-4 text-emerald-600" />
                               <span className="font-black text-gray-700 text-sm tracking-tight">{city}</span>
                            </div>
                            <div className="flex items-center gap-6">
                               <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                                 {groupedData[uf].cities[city].totalInvested.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                               </span>
                               {expandedCity === city ? <ChevronUpIcon className="w-4 h-4 text-gray-400" /> : <ChevronDownIcon className="w-4 h-4 text-gray-400" />}
                            </div>
                         </button>

                         {expandedCity === city && (
                           <div className="px-6 pb-6 pt-2 grid grid-cols-1 lg:grid-cols-2 gap-4">
                              {Object.keys(groupedData[uf].cities[city].posts).sort((a,b) => groupedData[uf].cities[city].posts[a].totalValue - groupedData[uf].cities[city].posts[b].totalValue).map(post => (
                                <div key={post} className="bg-gray-50/50 p-5 rounded-3xl border border-gray-100">
                                   <div className="flex items-center gap-3 mb-4">
                                      <BuildingStorefrontIcon className="w-4 h-4 text-gray-400" />
                                      <h4 className="font-black text-gray-900 uppercase text-[11px] truncate tracking-tighter">{post}</h4>
                                   </div>
                                   <div className="space-y-2">
                                      {Object.keys(groupedData[uf].cities[city].posts[post].fuels).map(fuel => {
                                        const fuelData = groupedData[uf].cities[city].posts[post].fuels[fuel];
                                        const avgPrice = fuelData.sumPrice / fuelData.count;
                                        const cityMin = groupedData[uf].cities[city].fuelPrices[fuel].min;
                                        const cityMax = groupedData[uf].cities[city].fuelPrices[fuel].max;
                                        
                                        // Comparação com margem pequena para capturar os selos corretamente
                                        const isMin = Math.abs(avgPrice - cityMin) < 0.01 && cityMin !== cityMax;
                                        const isMax = Math.abs(avgPrice - cityMax) < 0.01 && cityMin !== cityMax;

                                        return (
                                          <div key={fuel} className={`flex justify-between items-center p-3 rounded-2xl border ${
                                            isMin ? 'bg-emerald-100/50 border-emerald-200' : 
                                            isMax ? 'bg-red-100/50 border-red-200' : 'bg-white border-gray-100 shadow-sm'
                                          }`}>
                                             <div className="flex items-center gap-2">
                                                <BeakerIcon className={`w-3.5 h-3.5 ${isMin ? 'text-emerald-600' : isMax ? 'text-red-600' : 'text-blue-500'}`} />
                                                <div>
                                                   <div className="flex items-center gap-1.5 flex-wrap">
                                                     <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{fuel}</p>
                                                     {isMin && <span className="bg-emerald-600 text-[5px] text-white px-1.5 py-0.5 rounded-full font-black uppercase">MELHOR PREÇO</span>}
                                                     {isMax && <span className="bg-red-600 text-[5px] text-white px-1.5 py-0.5 rounded-full font-black uppercase">MAIOR PREÇO</span>}
                                                   </div>
                                                   <p className={`text-[10px] font-black ${isMin ? 'text-emerald-900' : isMax ? 'text-red-900' : 'text-gray-700'}`}>
                                                      {avgPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} / L
                                                   </p>
                                                </div>
                                             </div>
                                             <div className="text-right">
                                                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Investido</p>
                                                <p className={`text-[10px] font-black ${isMin ? 'text-emerald-600' : isMax ? 'text-red-600' : 'text-blue-600'}`}>
                                                  {fuelData.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                </p>
                                             </div>
                                          </div>
                                        );
                                      })}
                                   </div>
                                </div>
                              ))}
                           </div>
                         )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    );
};

export default RelatorioPostos;
