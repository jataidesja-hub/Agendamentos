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

    const groupedByCity = useMemo(() => {
      const cityGroups: any = {};
      
      const filtered = abastecimentos.filter((a: any) => {
        if (!a.data_transacao || !selectedMonth) return false;
        return String(a.data_transacao).slice(0, 7) === selectedMonth;
      });

      filtered.forEach((a: any) => {
        const city = String(a.cidade || "NÃO INFORMADA").toUpperCase();
        const post = String(a.estabelecimento || "POSTO DESCONHECIDO").toUpperCase();
        const fuel = String(a.tipo_combustivel || "OUTROS").toUpperCase();

        if (!cityGroups[city]) {
          cityGroups[city] = { posts: {}, totalInvested: 0 };
        }

        if (!cityGroups[city].posts[post]) {
          cityGroups[city].posts[post] = { fuels: {}, totalLiters: 0, totalValue: 0 };
        }

        if (!cityGroups[city].posts[post].fuels[fuel]) {
          cityGroups[city].posts[post].fuels[fuel] = { 
            sumPrice: 0, 
            count: 0, 
            liters: 0, 
            value: 0 
          };
        }

        const fuelData = cityGroups[city].posts[post].fuels[fuel];
        fuelData.sumPrice += (Number(a.valor_litro) || 0);
        fuelData.count += 1;
        fuelData.liters += (Number(a.litros) || 0);
        fuelData.value += (Number(a.valor_emissao) || 0);

        cityGroups[city].posts[post].totalLiters += (Number(a.litros) || 0);
        cityGroups[city].posts[post].totalValue += (Number(a.valor_emissao) || 0);
        cityGroups[city].totalInvested += (Number(a.valor_emissao) || 0);
      });

      return cityGroups;
    }, [abastecimentos, selectedMonth]);

    return (
      <div className="space-y-6">
        {/* Filtro de Mês */}
        <div className="bg-gray-900 p-8 rounded-[3rem] shadow-2xl flex flex-col md:flex-row justify-between items-center gap-6 border border-white/5">
          <div>
            <h2 className="text-2xl font-black text-white italic tracking-tighter">Comparativo de Postos</h2>
            <p className="text-blue-500 font-bold text-[10px] uppercase tracking-widest mt-1">Visão geral por cidade e preço de combustível</p>
          </div>

          <div className="flex items-center px-6 py-4 bg-white/5 rounded-2xl border border-white/10 hover:border-blue-500 transition-all cursor-pointer">
            <FunnelIcon className="w-4 h-4 text-blue-500 mr-3" />
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

        {/* Cidades */}
        <div className="space-y-6">
          {Object.keys(groupedByCity).length === 0 ? (
            <div className="bg-white p-20 rounded-[3rem] text-center border-2 border-dashed border-gray-100 flex flex-col items-center">
               <MapPinIcon className="w-12 h-12 text-gray-200 mb-4" />
               <p className="text-gray-400 font-medium text-sm italic">Nenhum dado de posto para este período.</p>
            </div>
          ) : (
            Object.keys(groupedByCity).sort().map(city => (
              <div key={city} className="bg-white rounded-[3rem] shadow-sm border border-gray-100 overflow-hidden">
                <button 
                  onClick={() => setExpandedCity(expandedCity === city ? null : city)}
                  className="w-full px-8 py-6 flex justify-between items-center hover:bg-gray-50/50 transition-colors"
                >
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center mr-5 shadow-lg shadow-blue-500/20">
                      <MapPinIcon className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-left">
                       <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cidade</p>
                       <h3 className="text-2xl font-black text-gray-900">{city}</h3>
                    </div>
                  </div>
                  <div className="flex items-center gap-10">
                    <div className="text-right">
                       <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Postos</p>
                       <p className="font-black text-gray-900 text-xl">{Object.keys(groupedByCity[city].posts).length}</p>
                    </div>
                    <div className="text-right">
                       <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Custo Cidade</p>
                       <p className="font-black text-blue-600 text-xl">{groupedByCity[city].totalInvested.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                    {expandedCity === city ? <ChevronUpIcon className="w-5 h-5 text-gray-400" /> : <ChevronDownIcon className="w-5 h-5 text-gray-400" />}
                  </div>
                </button>

                {expandedCity === city && (
                  <div className="px-8 pb-8 space-y-6 bg-gray-50/30">
                    <div className="h-px bg-gray-100 w-full" />
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {Object.keys(groupedByCity[city].posts).sort().map(post => (
                        <div key={post} className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm">
                          <div className="flex items-center gap-4 mb-6">
                             <BuildingStorefrontIcon className="w-5 h-5 text-gray-400" />
                             <h4 className="font-black text-gray-900 uppercase tracking-tight text-sm truncate">{post}</h4>
                          </div>

                          <div className="space-y-3">
                            {Object.keys(groupedByCity[city].posts[post].fuels).map(fuel => {
                              const fuelData = groupedByCity[city].posts[post].fuels[fuel];
                              const avgPrice = fuelData.sumPrice / fuelData.count;
                              return (
                                <div key={fuel} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                   <div className="flex items-center">
                                      <BeakerIcon className="w-4 h-4 text-blue-500 mr-2" />
                                      <div>
                                         <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{fuel}</p>
                                         <p className="text-xs font-black text-gray-700">{avgPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} / L</p>
                                      </div>
                                   </div>
                                   <div className="text-right">
                                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Investido</p>
                                      <p className="text-xs font-black text-blue-600">{fuelData.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                   </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
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
