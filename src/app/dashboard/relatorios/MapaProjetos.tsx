"use client";

import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '@/lib/supabase';
import { MapPinIcon, MapIcon, CurrencyDollarIcon, FunnelIcon, ChartBarIcon, TableCellsIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';

interface Projeto {
  id: string;
  nome: string;
  endereco: string;
  latitude: number;
  longitude: number;
  detalhes_json: any;
}

interface Abastecimento {
  placa: string;
  data_transacao: string;
  tipo_combustivel: string;
  litros: number;
  valor_litro: number;
  valor_total: number;
  nome_estabelecimento: string;
}

const BRAZIL_BOUNDS: [[number, number], [number, number]] = [
  [-33.75, -73.99],
  [5.27, -28.84]
];

export default function MapaProjetos() {
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [veiculosFrota, setVeiculosFrota] = useState<any[]>([]);
  const [abastecimentos, setAbastecimentos] = useState<Abastecimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [projetoSelecionado, setProjetoSelecionado] = useState<Projeto | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('leaflet').then((L) => {
        const DefaultIcon = L.icon({
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
        });
        L.Marker.prototype.options.icon = DefaultIcon;
      });
    }
    fetchDados();
  }, []);

  async function fetchDados() {
    try {
      const [projRes, veicRes, abastRes] = await Promise.all([
        supabase.from('projetos').select('*'),
        supabase.from('frota_veiculos').select('*'),
        supabase.from('abastecimentos').select('*')
      ]);

      setProjetos(projRes.data || []);
      setVeiculosFrota(veicRes.data || []);
      setAbastecimentos(abastRes.data || []);
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      toast.error('Erro ao carregar dados do mapa');
    } finally {
      setLoading(false);
    }
  }

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    abastecimentos.forEach(a => {
      if (a.data_transacao) months.add(a.data_transacao.slice(0, 7));
    });
    if (months.size === 0) months.add(new Date().toISOString().slice(0, 7));
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [abastecimentos]);

  // Cálculos para o Painel Inferior
  const analytics = useMemo(() => {
    if (!projetoSelecionado) return null;

    const projectVehicles = (projetoSelecionado.detalhes_json?.veiculos || []).map((p: string) => p.trim().toUpperCase());
    
    // Filtra veículos da frota que pertencem ao projeto
    const relevantVehicles = veiculosFrota.filter(v => 
      projectVehicles.includes(v.placa.trim().toUpperCase())
    );

    // Filtra abastecimentos: apenas dos veículos do projeto E no mês selecionado
    const projectAbast = abastecimentos.filter(a => {
      const aPlaca = a.placa?.trim().toUpperCase();
      return projectVehicles.includes(aPlaca) && a.data_transacao?.startsWith(selectedMonth);
    });

    const totalGasto = projectAbast.reduce((acc, curr) => acc + curr.valor_total, 0);
    const sortedByPrice = [...projectAbast].sort((a, b) => b.valor_litro - a.valor_litro);
    
    // GERAÇÃO DO RELATÓRIO CARRO POR CARRO (Conforme solicitado pelo USER)
    const relatorioVeiculos = relevantVehicles.map((v: any) => {
      const vPlaca = v.placa.trim().toUpperCase();
      const vAbast = projectAbast.filter(a => a.placa?.trim().toUpperCase() === vPlaca);
      
      // Agrupa abastecimentos deste veículo por posto
      const porPosto = vAbast.reduce((acc: any, curr) => {
        const key = curr.nome_estabelecimento?.trim().toUpperCase() || 'DESCONHECIDO';
        if (!acc[key]) {
          acc[key] = {
            nome: curr.nome_estabelecimento,
            combustivel: curr.tipo_combustivel,
            valor_litro: curr.valor_litro,
            litros: 0,
            total: 0,
            count: 0
          };
        }
        acc[key].litros += curr.litros;
        acc[key].total += curr.valor_total;
        acc[key].count += 1;
        acc[key].valor_litro = curr.valor_litro; 
        return acc;
      }, {});

      return {
        ...v,
        data: Object.values(porPosto),
        totalGasto: vAbast.reduce((acc, curr) => acc + curr.valor_total, 0),
        totalLitros: vAbast.reduce((acc, curr) => acc + curr.litros, 0),
        totalAbast: vAbast.length,
        combustivelPredominante: vAbast[0]?.tipo_combustivel || '---'
      };
    });

    return {
      vehicles: relatorioVeiculos,
      abastCount: projectAbast.length,
      totalGasto,
      maisCaro: sortedByPrice[0],
      maisBarato: sortedByPrice[sortedByPrice.length - 1]
    };
  }, [projetoSelecionado, veiculosFrota, abastecimentos, selectedMonth]);

  // Componente de Mapa Memoizado para evitar que desapareça ao mudar o filtro de data
  const RenderMap = useMemo(() => (
    <div id="map-section" className="relative h-[500px] w-full rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/20 bg-gray-100 dark:bg-gray-900">
      <MapContainer 
        center={[-10, -45]} 
        zoom={4} 
        minZoom={3}
        maxBounds={BRAZIL_BOUNDS}
        maxBoundsViscosity={1.0}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
        scrollWheelZoom={true}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {projetos.map((p) => (
          <Marker 
            key={p.id} 
            position={[p.latitude, p.longitude]}
            eventHandlers={{
              click: () => {
                setProjetoSelecionado(p);
                // Scroll para o relatório
                setTimeout(() => {
                  document.getElementById('project-report')?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              }
            }}
          >
            <Popup>
              <div className="font-bold text-[#0b7336] text-center">{p.nome}</div>
              <div className="text-[9px] text-gray-400 text-center">Clique para ver detalhes abaixo</div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <div className="absolute bottom-4 right-4 z-[500] bg-black/40 backdrop-blur rounded-lg px-3 py-1.5 text-[9px] font-black text-white border border-white/10 tracking-widest uppercase">
        CYMI - Monitoramento Geográfico
      </div>
    </div>
  ), [projetos]);

  if (loading) {
    return (
      <div className="h-[500px] w-full flex items-center justify-center bg-gray-100 rounded-3xl animate-pulse text-[#0b7336]">
        <MapIcon className="w-10 h-10 animate-bounce mr-2" />
        <span className="font-bold">Carregando Painel Operacional...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full h-full pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <MapIcon className="w-6 h-6 text-[#0b7336]" />
          <h3 className="text-xl font-bold text-gray-800 dark:text-white tracking-tight">Status Operacional e Custos</h3>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-2 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <FunnelIcon className="w-4 h-4 text-gray-400" />
            <select 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent border-0 text-xs font-bold text-gray-700 dark:text-gray-200 focus:ring-0 cursor-pointer"
            >
              {availableMonths.map(m => (
                <option key={m} value={m}>{new Date(m + "-01").toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Map Section */}
      {RenderMap}

      {/* Detailed Analytics Section (Below Map) */}
      {projetoSelecionado ? (
        <div id="project-report" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 bg-[#0b7336] rounded-xl">
              <ChartBarIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h4 className="text-2xl font-black text-gray-900 dark:text-white leading-none">Relatório Detalhado: {projetoSelecionado.nome}</h4>
              <p className="text-sm font-medium text-gray-500 mt-1">Análise de custos e frota para o período de {new Date(selectedMonth + "-01").toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</p>
            </div>
          </div>

          <div className="space-y-8">
            {/* Cards de Resumo Rápido */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-[#0b7336] p-5 rounded-[2rem] shadow-lg shadow-green-500/20 text-white">
                <span className="text-[9px] font-black uppercase tracking-widest opacity-80 block mb-1">Total Gasto (Projeto)</span>
                <p className="text-2xl font-black">{analytics?.totalGasto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
              </div>

              <div className="bg-white dark:bg-gray-800/60 p-5 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Total de Abastecimentos</span>
                <p className="text-2xl font-black text-gray-900 dark:text-white">{analytics?.abastCount}x</p>
              </div>

              <div className="bg-white dark:bg-gray-800/60 p-5 rounded-[2rem] border border-red-100 dark:border-red-900/30">
                <div className="flex items-center gap-2 mb-1">
                  <ArrowTrendingUpIcon className="w-4 h-4 text-red-500" />
                  <span className="text-[9px] font-black text-red-500 uppercase tracking-widest">Mais Caro</span>
                </div>
                <p className="text-lg font-black text-red-600 leading-none">{analytics?.maisCaro?.valor_litro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/L</p>
                <p className="text-[9px] font-bold text-gray-400 mt-1 truncate">{analytics?.maisCaro?.nome_estabelecimento}</p>
              </div>

              <div className="bg-white dark:bg-gray-800/60 p-5 rounded-[2rem] border border-green-100 dark:border-green-900/30">
                <div className="flex items-center gap-2 mb-1">
                  <ArrowTrendingDownIcon className="w-4 h-4 text-green-500" />
                  <span className="text-[9px] font-black text-green-500 uppercase tracking-widest">Mais Barato</span>
                </div>
                <p className="text-lg font-black text-green-600 leading-none">{analytics?.maisBarato?.valor_litro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/L</p>
                <p className="text-[9px] font-bold text-gray-400 mt-1 truncate">{analytics?.maisBarato?.nome_estabelecimento}</p>
              </div>
            </div>

            {/* RELATÓRIO CARRO POR CARRO */}
            <div className="space-y-6">
              {analytics?.vehicles.map((v: any) => (
                <div key={v.id} className="bg-white dark:bg-gray-800/60 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                  <div className="px-8 py-5 border-b border-gray-50 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                      <div className="bg-gray-900 text-white px-4 py-2 rounded-2xl font-black text-lg shadow-lg">
                        {v.placa}
                      </div>
                      <div>
                        <div className="font-black text-gray-900 dark:text-white uppercase tracking-tight">{v.identificacao || 'N/A'}</div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-blue-500 uppercase">Combustível: {v.combustivelPredominante}</span>
                          <span className={`${
                            v.status === 'Ativo' || v.status === 'Disponível' ? 'text-green-500' : 'text-amber-500'
                          } text-[8px] font-black uppercase`}>
                            {v.status || 'Ativo'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-8">
                      <div className="text-center">
                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Total Litros</p>
                        <p className="text-sm font-black text-gray-900 dark:text-white">{v.totalLitros.toFixed(2)} L</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Total Gasto</p>
                        <p className="text-sm font-black text-[#0b7336]">{v.totalGasto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-[9px] font-black text-gray-400 uppercase tracking-widest bg-gray-50/20 dark:bg-gray-900/10">
                          <th className="px-8 py-3">Estabelecimento (Posto)</th>
                          <th className="px-6 py-3">Combustível</th>
                          <th className="px-6 py-3 text-right">Valor/Litro</th>
                          <th className="px-6 py-3 text-right">Abastecimentos</th>
                          <th className="px-6 py-3 text-right">Total Litros</th>
                          <th className="px-8 py-3 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                        {v.data.map((item: any, idx: number) => (
                          <tr key={idx} className="text-xs hover:bg-gray-50/50 dark:hover:bg-gray-900/30 transition-colors">
                            <td className="px-8 py-4 font-bold text-gray-900 dark:text-white capitalize">{item.nome.toLowerCase()}</td>
                            <td className="px-6 py-4 font-medium text-gray-500 uppercase">{item.combustivel}</td>
                            <td className="px-6 py-4 text-right font-black text-gray-700 dark:text-gray-300">{item.valor_litro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                            <td className="px-6 py-4 text-right font-bold text-gray-900 dark:text-white">{item.count}x</td>
                            <td className="px-6 py-4 text-right font-bold text-gray-500">{item.litros.toFixed(2)} L</td>
                            <td className="px-8 py-4 text-right font-black text-[#0b7336]">{item.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                          </tr>
                        ))}
                        {v.data.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-8 py-6 text-center text-xs font-medium text-gray-400 italic">Sem abastecimentos neste período.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
              {analytics?.vehicles.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 bg-gray-50/50 dark:bg-gray-900/20 rounded-[3rem] border border-dashed border-gray-200 dark:border-gray-700 opacity-50">
                   <p className="text-sm font-bold italic">Nenhum veículo vinculado a este projeto foi encontrado na frota.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 bg-gray-50/50 dark:bg-gray-900/20 rounded-[3rem] border border-dashed border-gray-200 dark:border-gray-700">
          <MapPinIcon className="w-12 h-12 text-gray-300 mb-4" />
          <h4 className="text-xl font-bold text-gray-400">Selecione um projeto no mapa</h4>
          <p className="text-sm text-gray-300">Para visualizar o relatório operacional completo</p>
        </div>
      )}
    </div>
  );
}
