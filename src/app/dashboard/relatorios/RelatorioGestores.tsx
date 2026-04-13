"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { 
  UserGroupIcon, 
  ChevronDownIcon, 
  ChevronUpIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
  TruckIcon,
  MapPinIcon,
  CurrencyDollarIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { dataCache } from '@/lib/cache';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

const RelatorioGestores = () => {
    const [selectedMonth, setSelectedMonth] = useState('');
    const [expandedGestor, setExpandedGestor] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    
    const abastecimentos = dataCache.abastecimentos || [];
    // @ts-ignore
    const placaToGerente = dataCache.placaToGerente || new Map();
    // @ts-ignore
    const placaToAdmin = dataCache.placaToAdmin || new Map();

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
    useEffect(() => {
      if (!selectedMonth && availableMonths.length > 0) {
        setSelectedMonth(availableMonths[0]);
      }
    }, [availableMonths, selectedMonth]);

    // Dados consolidados por cidade/combustível (Melhores preços)
    const cheapestByCity = useMemo(() => {
      const prices: any = {};
      const filtered = abastecimentos.filter((a: any) => {
        if (!a.data_transacao || !selectedMonth) return false;
        return String(a.data_transacao).slice(0, 7) === selectedMonth;
      });

      filtered.forEach((a: any) => {
        const city = String(a.cidade || a.municipio || "NÃO INFORMADA").toUpperCase().trim();
        const fuel = String(a.tipo_combustivel || "OUTROS").toUpperCase().trim();
        const price = Number(a.valor_litro) || 0;
        const post = String(a.estabelecimento || "POSTO").toUpperCase().trim();

        if (price <= 0) return;

        if (!prices[city]) prices[city] = {};
        if (!prices[city][fuel]) {
          prices[city][fuel] = { price: price, post: post };
        } else if (price < prices[city][fuel].price) {
          prices[city][fuel] = { price: price, post: post };
        }
      });
      return prices;
    }, [abastecimentos, selectedMonth]);

    // Agrupamento por Gestor
    const managersData = useMemo(() => {
      const data: any = {};
      const filtered = abastecimentos.filter((a: any) => {
        if (!a.data_transacao || !selectedMonth) return false;
        return String(a.data_transacao).slice(0, 7) === selectedMonth;
      });

      filtered.forEach((a: any) => {
        const normalize = (p: string) => p?.toString().replace(/[^a-zA-Z0-9]/g, '').toUpperCase().trim() || "";
        const normPlaca = normalize(a.placa);
        const gestorEmail = placaToGerente.get(normPlaca) || placaToAdmin.get(normPlaca) || "NÃO ATRIBUÍDO";
        
        if (!data[gestorEmail]) {
          data[gestorEmail] = { vehicles: {}, totalSpent: 0, alerts: 0 };
        }

        const city = String(a.cidade || a.municipio || "NÃO INFORMADA").toUpperCase().trim();
        const fuel = String(a.tipo_combustivel || "OUTROS").toUpperCase().trim();
        const price = Number(a.valor_litro) || 0;
        
        if (!data[gestorEmail].vehicles[normPlaca]) {
          data[gestorEmail].vehicles[normPlaca] = { placa: a.placa, fuelings: [], totalLiters: 0 };
        }

        // Verifica se existe um posto mais barato nesta cidade para este combustível
        const best = cheapestByCity[city]?.[fuel];
        const isExpensive = best && best.price < (price - 0.05); // Margem de 5 centavos

        const entry = {
            ...a,
            city,
            fuel,
            price,
            bestPrice: best?.price,
            bestPost: best?.post,
            isExpensive
        };

        data[gestorEmail].vehicles[normPlaca].fuelings.push(entry);
        data[gestorEmail].totalSpent += (Number(a.valor_emissao) || 0);
        if (isExpensive) data[gestorEmail].alerts += 1;
      });

      return data;
    }, [abastecimentos, selectedMonth, cheapestByCity, placaToGerente, placaToAdmin]);

    const handleSendAlert = (email: string, managerData: any) => {
        if (email === "NÃO ATRIBUÍDO") {
            toast.error("Este grupo não possui um e-mail de gestor atribuído.");
            return;
        }
        
        // Simulação de envio ou integração com backend
        toast.promise(
            new Promise(resolve => setTimeout(resolve, 1500)),
            {
                loading: `Gerando relatório de economia para ${email}...`,
                success: 'Alerta de economia enviado com sucesso!',
                error: 'Erro ao enviar e-mail.',
            }
        );
    };

    return (
      <div className="space-y-6 pb-20">
        <div className="bg-[#1a1c23] p-8 rounded-[3rem] shadow-2xl flex flex-col md:flex-row justify-between items-center gap-6 border border-white/5">
          <div>
            <h2 className="text-2xl font-black text-white italic tracking-tighter">Gestão por Gerentes</h2>
            <p className="text-orange-500 font-bold text-[10px] uppercase tracking-widest mt-1">Análise de economia e performance por centro de custo</p>
          </div>

          <div className="flex items-center px-6 py-4 bg-white/5 rounded-2xl border border-white/10">
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

        <div className="space-y-4">
          {Object.entries(managersData).sort((a: any, b: any) => b[1].alerts - a[1].alerts).map(([email, data]: [string, any]) => (
            <div key={email} className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
              <div className="w-full px-8 py-6 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center flex-1">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mr-5 shadow-lg ${data.alerts > 0 ? 'bg-orange-100 text-orange-600' : 'bg-emerald-100 text-emerald-600'}`}>
                    <UserGroupIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-gray-900 truncate max-w-md">{email}</h3>
                    <div className="flex gap-4 mt-1">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{Object.keys(data.vehicles).length} Veículos</span>
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{data.totalSpent.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {data.alerts > 0 && (
                    <div className="px-4 py-2 bg-orange-50 border border-orange-100 rounded-xl flex items-center gap-2">
                       <ExclamationTriangleIcon className="w-4 h-4 text-orange-600" />
                       <span className="text-[10px] font-black text-orange-700 uppercase">{data.alerts} Oportunidades de Economia</span>
                    </div>
                  )}
                  
                  <button 
                    onClick={() => handleSendAlert(email, data)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-[#0b7336] hover:bg-[#09602c] text-white text-[10px] font-black rounded-xl transition-all shadow-lg shadow-green-500/20"
                  >
                    <EnvelopeIcon className="w-4 h-4" />
                    NOTIFICAR
                  </button>

                  <button 
                    onClick={() => setExpandedGestor(expandedGestor === email ? null : email)}
                    className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                  >
                    {expandedGestor === email ? <ChevronUpIcon className="w-5 h-5 text-gray-400" /> : <ChevronDownIcon className="w-5 h-5 text-gray-400" />}
                  </button>
                </div>
              </div>

              {expandedGestor === email && (
                <div className="px-8 pb-8 space-y-4 bg-gray-50/30">
                  <div className="h-px bg-gray-100 w-full mb-4" />
                  {Object.values(data.vehicles).map((v: any) => (
                    <div key={v.placa} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                       <div className="px-6 py-4 bg-gray-50/50 flex justify-between items-center border-b border-gray-100">
                         <div className="flex items-center gap-3">
                            <TruckIcon className="w-4 h-4 text-gray-400" />
                            <span className="font-black text-gray-800 tracking-tighter">{v.placa}</span>
                         </div>
                       </div>
                       <div className="p-4 space-y-2">
                         {v.fuelings.map((f: any, idx: number) => (
                           <div key={idx} className={`p-4 rounded-xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${f.isExpensive ? 'bg-red-50/50 border-red-100' : 'bg-white border-gray-50'}`}>
                             <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                   <MapPinIcon className="w-3.5 h-3.5 text-gray-400" />
                                   <span className="text-[10px] font-black text-gray-500 uppercase">{f.city} • {f.estabelecimento}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                   <span className="text-xs font-bold text-gray-700">{f.fuel}</span>
                                   <span className="text-sm font-black text-gray-900">{f.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} / L</span>
                                </div>
                             </div>
                             
                             {f.isExpensive ? (
                               <div className="flex items-center gap-4 bg-white p-3 rounded-xl border border-red-200 shadow-sm animate-pulse">
                                  <div className="text-right">
                                     <p className="text-[8px] font-black text-red-500 uppercase tracking-widest">Posto Mais Barato na Cidade</p>
                                     <p className="text-[10px] font-black text-gray-900 truncate max-w-[150px]">{f.bestPost}</p>
                                     <p className="text-xs font-black text-emerald-600">{f.bestPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} / L</p>
                                  </div>
                                  <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                                     <ArrowRightOnRectangleIcon className="w-4 h-4 text-red-600 rotate-180" />
                                  </div>
                               </div>
                             ) : (
                               <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                                  <CheckCircleIcon className="w-4 h-4" />
                                  <span className="text-[10px] font-black uppercase">Economia OK</span>
                               </div>
                             )}
                           </div>
                         ))}
                       </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
};

export default RelatorioGestores;
