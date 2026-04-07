"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  ChevronDownIcon, 
  ChevronUpIcon,
  FunnelIcon,
  TruckIcon
} from '@heroicons/react/24/outline';

const RelatorioProjetos = () => {
    const [abastecimentos, setAbastecimentos] = useState<any[]>([]);
    const [veiculosAtivos, setVeiculosAtivos] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState('');
    const [expandedProject, setExpandedProject] = useState<string | null>(null);
    const [expandedVehicle, setExpandedVehicle] = useState<string | null>(null);

    useEffect(() => {
      fetchDadosCompletos();
    }, []);

    const fetchDadosCompletos = async () => {
      setLoading(true);
      try {
        // 1. Busca todos os veículos ativos primeiro
        const { data: frota, error: errFrota } = await supabase
          .from('veiculos')
          .select('placa')
          .eq('status', 'Ativo');
        
        if (!errFrota && frota) {
          setVeiculosAtivos(new Set(frota.map(v => v.placa.trim().toUpperCase())));
        }

        // 2. Busca exaustiva de todos os abastecimentos (Pagination Bypass)
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
            if (data.length < 1000) {
              hasMore = false;
            } else {
              from += 1000;
              to += 1000;
            }
          }
          // Limite de segurança para 50k registros
          if (allAbastecimentos.length > 50000) break;
        }

        setAbastecimentos(allAbastecimentos);

        // Define o mês mais recente disponível como padrão
        if (allAbastecimentos.length > 0) {
          const latestMonth = String(allAbastecimentos[0].data_transacao).slice(0, 7);
          setSelectedMonth(latestMonth);
        }
      } catch (err) {
        console.error("Erro nos relatórios complexos:", err);
      } finally {
        setLoading(false);
      }
    };

    const availableMonths = useMemo(() => {
      const monthsSet = new Set<string>();
      abastecimentos.forEach((a: any) => {
        if (a.data_transacao) {
          const dateStr = String(a.data_transacao);
          if (dateStr.includes('-')) {
             monthsSet.add(dateStr.slice(0, 7));
          }
        }
      });
      return Array.from(monthsSet).sort().reverse();
    }, [abastecimentos]);

    // Aplica o filtro de Mês E o filtro de Veículos Ativos
    const filteredData = useMemo(() => {
      return abastecimentos.filter((a: any) => {
        if (!a.data_transacao || !selectedMonth) return false;
        
        // Filtro de Mês
        const itemMonth = String(a.data_transacao).slice(0, 7);
        if (itemMonth !== selectedMonth) return false;

        // NOVO: Filtro de Veículos Ativos
        const placa = String(a.placa || "").trim().toUpperCase();
        return veiculosAtivos.has(placa);
      });
    }, [abastecimentos, selectedMonth, veiculosAtivos]);

    const groupedData = useMemo(() => {
      const groups: any = {};
      filteredData.forEach((a: any) => {
        const projName = String(a.projeto || "SEM PROJETO").toUpperCase();
        if (!groups[projName]) {
          groups[projName] = { vehicles: {}, totalLiters: 0, totalValue: 0 };
        }
        
        const placa = a.placa || "N/A";
        if (!groups[projName].vehicles[placa]) {
          groups[projName].vehicles[placa] = { items: [], liters: 0, value: 0 };
        }

        groups[projName].vehicles[placa].items.push(a);
        groups[projName].vehicles[placa].liters += (Number(a.litros) || 0);
        groups[projName].vehicles[placa].value += (Number(a.valor_emissao) || 0);
        
        groups[projName].totalLiters += (Number(a.litros) || 0);
        groups[projName].totalValue += (Number(a.valor_emissao) || 0);
      });
      return groups;
    }, [filteredData]);

    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center p-20 animate-pulse bg-white/50 backdrop-blur-xl rounded-[3rem]">
          <div className="w-10 h-10 border-4 border-[#0b7336] border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-400 font-black text-xs uppercase tracking-widest text-center">
            Sincronizando Base Histórica Completa...<br/>
            <span className="text-[10px] opacity-60">Filtrando apenas veículos ativos</span>
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Cabeçalho de Filtro */}
        <div className="bg-[#1a1c23] p-8 rounded-[3rem] shadow-2xl flex flex-col md:flex-row justify-between items-center gap-6 border border-white/5">
          <div className="text-center md:text-left">
            <h2 className="text-2xl font-black text-white italic tracking-tighter">Relatório Consolidado</h2>
            <p className="text-emerald-500 font-bold text-[10px] uppercase tracking-widest mt-1">Exibindo apenas frota ativa • {veiculosAtivos.size} veículos</p>
          </div>

          <div className="flex items-center px-6 py-4 bg-white/5 rounded-2xl border border-white/10 hover:border-[#0b7336] transition-all cursor-pointer">
            <FunnelIcon className="w-4 h-4 text-emerald-500 mr-3" />
            <select 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-white font-black text-sm outline-none uppercase tracking-widest"
            >
              {availableMonths.map(m => (
                <option key={m} value={m} className="bg-[#1a1c23]">
                  {new Date(m + "-02").toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Lista de Projetos */}
        <div className="space-y-4">
          {Object.keys(groupedData).length === 0 ? (
            <div className="bg-white p-20 rounded-[3rem] text-center border-2 border-dashed border-gray-100 flex flex-col items-center">
               <FunnelIcon className="w-12 h-12 text-gray-200 mb-4" />
               <p className="text-gray-400 font-medium text-sm italic">Nenhum abastecimento de veículo ATIVO encontrado para {new Date(selectedMonth + "-02").toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}.</p>
            </div>
          ) : (
            Object.keys(groupedData).sort().map(projName => (
              <div key={projName} className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden transition-all">
                <button 
                  onClick={() => setExpandedProject(expandedProject === projName ? null : projName)}
                  className="w-full px-8 py-6 flex flex-col md:flex-row justify-between items-start md:items-center hover:bg-gray-50/50 transition-colors gap-4"
                >
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-gray-900 rounded-2xl flex items-center justify-center mr-5 shadow-lg">
                      <span className="text-white font-black text-xs">{projName.substring(0, 2)}</span>
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-black text-[#0b7336] uppercase tracking-widest mb-0.5">Projeto</p>
                      <h3 className="text-xl font-black text-gray-900 tracking-tight">{projName}</h3>
                    </div>
                  </div>

                  <div className="flex gap-8 items-center">
                    <div className="text-right">
                       <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Ativos</p>
                       <p className="font-black text-gray-900">{Object.keys(groupedData[projName].vehicles).length}</p>
                    </div>
                    <div className="text-right">
                       <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Investimento</p>
                       <p className="font-black text-emerald-600">{groupedData[projName].totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                    {expandedProject === projName ? <ChevronUpIcon className="w-5 h-5 text-gray-400" /> : <ChevronDownIcon className="w-5 h-5 text-gray-400" />}
                  </div>
                </button>

                {expandedProject === projName && (
                  <div className="px-8 pb-8 space-y-3 bg-gray-50/30">
                    <div className="h-px bg-gray-100 w-full mb-6" />
                    {Object.keys(groupedData[projName].vehicles).map(placa => (
                      <div key={placa} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <button 
                          onClick={() => setExpandedVehicle(expandedVehicle === placa ? null : placa)}
                          className="w-full px-6 py-4 flex justify-between items-center hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center">
                            <TruckIcon className="w-4 h-4 text-gray-400 mr-3" />
                            <span className="bg-gray-100 px-3 py-1 rounded-lg font-black text-gray-700 text-sm">{placa}</span>
                            <span className="ml-4 text-xs font-bold text-gray-500 uppercase">{groupedData[projName].vehicles[placa].items.length} abastecimentos</span>
                          </div>
                          <div className="flex items-center gap-6">
                             <p className="text-sm font-black text-gray-800">{groupedData[projName].vehicles[placa].liters.toFixed(2)} L</p>
                             {expandedVehicle === placa ? <ChevronUpIcon className="w-4 h-4 text-gray-400" /> : <ChevronDownIcon className="w-4 h-4 text-gray-400" />}
                          </div>
                        </button>

                        {expandedVehicle === placa && (
                          <div className="px-6 pb-4 overflow-x-auto">
                            <table className="w-full text-left text-[10px]">
                              <thead>
                                <tr className="text-gray-400 uppercase font-black tracking-widest border-b border-gray-100">
                                  <th className="py-3">Data</th>
                                  <th className="py-3">Motorista</th>
                                  <th className="py-3">Tipo</th>
                                  <th className="py-3 text-right">Lts</th>
                                  <th className="py-3 text-right">Custo</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-50">
                                {groupedData[projName].vehicles[placa].items.map((item: any, i: number) => (
                                  <tr key={i}>
                                    <td className="py-2.5 font-bold text-gray-500">{new Date(item.data_transacao + "T12:00:00").toLocaleDateString('pt-BR')}</td>
                                    <td className="py-2.5 font-black text-gray-800 uppercase">{item.nome_motorista || '---'}</td>
                                    <td className="py-2.5 text-gray-400 uppercase font-bold">{item.tipo_combustivel}</td>
                                    <td className="py-2.5 text-right font-black">{Number(item.litros).toFixed(2)}</td>
                                    <td className="py-2.5 text-right font-black text-emerald-600">{Number(item.valor_emissao).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
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

export default RelatorioProjetos;
