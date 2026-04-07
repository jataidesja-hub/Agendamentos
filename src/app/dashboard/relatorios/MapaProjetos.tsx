"use client";

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  FunnelIcon, 
  ChartBarIcon, 
  ArrowTrendingUpIcon, 
  ArrowTrendingDownIcon, 
  UserIcon,
  TagIcon,
  TruckIcon,
  CalendarIcon,
  ChevronDownIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface Abastecimento {
  id: string;
  projeto: string;
  placa: string;
  data_transacao: string;
  nome_motorista: string;
  tipo_combustivel: string;
  litros: number;
  valor_litro: number;
  valor_emissao: number;
  estabelecimento: string;
  modelo_veiculo: string;
}

export default function RelatorioProjetos() {
  const [abastecimentos, setAbastecimentos] = useState<Abastecimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [expandedVehicles, setExpandedVehicles] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchDados();
  }, [selectedMonth]);

  async function fetchDados() {
    setLoading(true);
    try {
      // Busca todos os dados do mês selecionado
      const { data, error } = await supabase
        .from('abastecimentos')
        .select('*')
        .gte('data_transacao', `${selectedMonth}-01`)
        .lte('data_transacao', `${selectedMonth}-31`)
        .order('data_transacao', { ascending: false });

      if (error) throw error;
      setAbastecimentos(data || []);
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao carregar relatório');
    } finally {
      setLoading(false);
    }
  }

  // Gera lista de meses baseada no calendário (ou dados)
  const availableMonths = useMemo(() => {
    const months = [];
    const date = new Date();
    for (let i = 0; i < 12; i++) {
      months.push(date.toISOString().slice(0, 7));
      date.setMonth(date.getMonth() - 1);
    }
    return months;
  }, []);

  // Agrupamento Hierárquico: Projeto > Veículo
  const projectsData = useMemo(() => {
    const grouped: any = {};

    abastecimentos.forEach(a => {
      const projName = a.projeto || "SEM PROJETO";
      const placa = a.placa || "SEM PLACA";

      if (!grouped[projName]) {
        grouped[projName] = {
          nome: projName,
          totalGasto: 0,
          totalLitros: 0,
          veiculos: {}
        };
      }

      grouped[projName].totalGasto += a.valor_emissao || 0;
      grouped[projName].totalLitros += a.litros || 0;

      if (!grouped[projName].veiculos[placa]) {
        grouped[projName].veiculos[placa] = {
          placa: placa,
          modelo: a.modelo_veiculo,
          totalGasto: 0,
          totalLitros: 0,
          abastecimentos: []
        };
      }

      grouped[projName].veiculos[placa].totalGasto += a.valor_emissao || 0;
      grouped[projName].veiculos[placa].totalLitros += a.litros || 0;
      grouped[projName].veiculos[placa].abastecimentos.push(a);
    });

    return Object.values(grouped).sort((a: any, b: any) => b.totalGasto - a.totalGasto);
  }, [abastecimentos]);

  const toggleProject = (name: string) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(name)) newExpanded.delete(name);
    else newExpanded.add(name);
    setExpandedProjects(newExpanded);
  };

  const toggleVehicle = (id: string) => {
    const newExpanded = new Set(expandedVehicles);
    if (newExpanded.has(id)) newExpanded.delete(id);
    else newExpanded.add(id);
    setExpandedVehicles(newExpanded);
  };

  return (
    <div className="flex flex-col gap-6 w-full h-full p-4">
      {/* Header com Filtros */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white dark:bg-gray-800 p-6 rounded-[2.5rem] shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#0b7336] rounded-2xl">
            <ChartBarIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-black text-gray-900 tracking-tight">Relatório por Projeto</h3>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Baseado nos dados da planilha</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-2xl border border-gray-100">
          <FunnelIcon className="w-4 h-4 text-gray-400" />
          <select 
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-transparent border-0 text-sm font-bold text-gray-700 focus:ring-0 cursor-pointer"
          >
            {availableMonths.map(m => (
              <option key={m} value={m}>
                {new Date(m + "-01T12:00:00").toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 grayscale opacity-50">
          <div className="w-12 h-12 border-4 border-[#0b7336] border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-xs font-black uppercase tracking-widest text-[#0b7336]">Cruzando Dados Operacionais...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {projectsData.length === 0 && (
             <div className="text-center py-20 bg-white rounded-[3rem] border-2 border-dashed border-gray-100 italic text-gray-400">
                Nenhum dado encontrado para o mês selecionado.
             </div>
          )}

          {projectsData.map((project: any) => (
            <div key={project.nome} className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden transition-all duration-300">
              {/* Header do Projeto */}
              <div 
                onClick={() => toggleProject(project.nome)}
                className="p-6 flex items-center justify-between cursor-pointer hover:bg-gray-50 group"
              >
                <div className="flex items-center gap-5">
                  <div className="flex items-center justify-center w-12 h-12 bg-green-50 rounded-2xl group-hover:scale-110 transition-transform">
                    {expandedProjects.has(project.nome) ? <ChevronDownIcon className="w-5 h-5 text-[#0b7336]" /> : <ChevronRightIcon className="w-5 h-5 text-gray-300" />}
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-gray-900 leading-none">{project.nome}</h4>
                    <p className="text-[10px] font-black text-gray-400 uppercase mt-1 tracking-widest">
                      {Object.keys(project.veiculos).length} Veículos Ativos
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-10">
                  <div className="text-right">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Litros</p>
                    <p className="text-sm font-black text-gray-900">{project.totalLitros.toFixed(2)} L</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Custo Total</p>
                    <p className="text-sm font-black text-[#0b7336]">
                      {project.totalGasto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Lista de Veículos (Expansível) */}
              {expandedProjects.has(project.nome) && (
                <div className="px-6 pb-6 space-y-4 animate-in slide-in-from-top-2 duration-300">
                  <div className="h-px bg-gray-50 mb-4" />
                  {Object.values(project.veiculos).map((veic: any) => {
                    const vehicleKey = `${project.nome}-${veic.placa}`;
                    return (
                      <div key={vehicleKey} className="bg-gray-50/50 rounded-[2rem] border border-gray-100/50 overflow-hidden">
                        <div 
                          onClick={() => toggleVehicle(vehicleKey)}
                          className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-100/80 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <span className="bg-gray-900 text-white px-3 py-1 rounded-lg font-black text-xs tracking-tight">
                              {veic.placa}
                            </span>
                            <span className="text-xs font-bold text-gray-500 uppercase">{veic.modelo || 'MODELO NÃO IDENTIFICADO'}</span>
                          </div>
                          <div className="flex items-center gap-8">
                             <div className="text-[10px] font-black text-gray-400 uppercase">
                                {veic.abastecimentos.length} Abast.
                             </div>
                             <div className="font-black text-sm text-gray-700">
                                {veic.totalGasto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                             </div>
                             {expandedVehicles.has(vehicleKey) ? <ChevronDownIcon className="w-4 h-4 text-gray-400" /> : <ChevronRightIcon className="w-4 h-4 text-gray-400" />}
                          </div>
                        </div>

                        {/* Detalhes do Veículo */}
                        {expandedVehicles.has(vehicleKey) && (
                          <div className="bg-white border-t border-gray-100 p-4">
                            <table className="w-full text-left text-[10px]">
                               <thead>
                                 <tr className="uppercase font-black text-gray-400 tracking-widest border-b border-gray-50">
                                    <th className="py-2">Data</th>
                                    <th className="py-2">Motorista</th>
                                    <th className="py-2">Tipo</th>
                                    <th className="py-2 text-right">Litros</th>
                                    <th className="py-2 text-right">Vl/L</th>
                                    <th className="py-2 text-right">Total</th>
                                    <th className="py-2 px-4">Posto</th>
                                 </tr>
                               </thead>
                               <tbody>
                                 {veic.abastecimentos.map((ab: any, idx: number) => (
                                   <tr key={idx} className="hover:bg-gray-50 border-b border-gray-50 last:border-0 font-medium">
                                      <td className="py-3">{new Date(ab.data_transacao + "T12:00:00").toLocaleDateString('pt-BR')}</td>
                                      <td className="py-3 uppercase font-bold text-gray-600">{ab.nome_motorista || '---'}</td>
                                      <td className="py-3 uppercase text-[#0b7336]">{ab.tipo_combustivel}</td>
                                      <td className="py-3 text-right tabular-nums">{ab.litros.toFixed(2)} L</td>
                                      <td className="py-3 text-right tabular-nums">{ab.valor_litro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                      <td className="py-3 text-right tabular-nums font-black">{ab.valor_emissao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                      <td className="py-3 px-4 uppercase text-gray-400 truncate max-w-[150px]">{ab.estabelecimento}</td>
                                   </tr>
                                 ))}
                               </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
