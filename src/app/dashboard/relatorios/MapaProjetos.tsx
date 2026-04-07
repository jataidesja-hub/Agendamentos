"use client";

import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '@/lib/supabase';
import { MapPinIcon, MapIcon, CurrencyDollarIcon, FunnelIcon, ChartBarIcon, TableCellsIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

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

    const projectVehicles = projetoSelecionado.detalhes_json?.veiculos || [];
    const relevantVehicles = veiculosFrota.filter(v => projectVehicles.includes(v.placa));
    const projectAbast = abastecimentos.filter(a => 
      projectVehicles.includes(a.placa) && 
      a.data_transacao.startsWith(selectedMonth)
    );

    const totalGasto = projectAbast.reduce((acc, curr) => acc + curr.valor_total, 0);
    const sortedByPrice = [...projectAbast].sort((a, b) => b.valor_litro - a.valor_litro);
    
    // Agrupa por Posto e Combustível
    const postoConsumo = projectAbast.reduce((acc: any, curr) => {
      const key = `${curr.nome_estabelecimento}_${curr.tipo_combustivel}`;
      if (!acc[key]) {
        acc[key] = {
          nome: curr.nome_estabelecimento,
          combustivel: curr.tipo_combustivel,
          valor_litro: curr.valor_litro,
          total: 0,
          litros: 0
        };
      }
      acc[key].total += curr.valor_total;
      acc[key].litros += curr.litros;
      return acc;
    }, {});

    // Agrupa por Veículo (NOVA FUNCIONALIDADE)
    const veiculoConsumo = relevantVehicles.map((v: any) => {
      const vAbast = projectAbast.filter(a => a.placa === v.placa);
      const vTotal = vAbast.reduce((acc, curr) => acc + curr.valor_total, 0);
      const vLitros = vAbast.reduce((acc, curr) => acc + curr.litros, 0);
      const sortedPrices = [...vAbast].sort((a, b) => a.valor_litro - b.valor_litro);
      
      // Pega o tipo de combustível mais frequente
      const fuelTypes = vAbast.reduce((acc: any, curr) => {
        acc[curr.tipo_combustivel] = (acc[curr.tipo_combustivel] || 0) + 1;
        return acc;
      }, {});
      const mainFuel = Object.entries(fuelTypes).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || '---';

      return {
        ...v,
        totalAbast: vAbast.length,
        totalGasto: vTotal,
        totalLitros: vLitros,
        maisBarato: sortedPrices[0]?.valor_litro || 0,
        maisCaro: sortedPrices[sortedPrices.length - 1]?.valor_litro || 0,
        combustivel: mainFuel
      };
    });

    return {
      vehicles: veiculoConsumo,
      abast: projectAbast,
      totalGasto,
      maisCaro: sortedByPrice[0],
      maisBarato: sortedByPrice[sortedByPrice.length - 1],
      porPosto: Object.values(postoConsumo)
    };
  }, [projetoSelecionado, veiculosFrota, abastecimentos, selectedMonth]);

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
      <div id="map-section" className="relative h-[500px] w-full rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/20 bg-gray-100 dark:bg-gray-900">
        <MapContainer 
          center={[-15.78, -47.93]} 
          zoom={4} 
          minZoom={4}
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
                click: () => setProjetoSelecionado(p)
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

      {/* Detailed Analytics Section (Below Map) */}
      {projetoSelecionado ? (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 bg-[#0b7336] rounded-xl">
              <ChartBarIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h4 className="text-2xl font-black text-gray-900 dark:text-white leading-none">Relatório Detalhado: {projetoSelecionado.nome}</h4>
              <p className="text-sm font-medium text-gray-500 mt-1">Análise de custos e frota para o período de {new Date(selectedMonth + "-01").toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</p>
            </div>
          </div>

            {/* Coluna 1, 2 e 3: Agora um Grid mais amplo ou Tabela Unificada */}
            <div className="lg:col-span-3 space-y-6">
              {/* Cards de Resumo Rápido (Reduzidos) */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-[#0b7336] p-5 rounded-[2rem] shadow-lg shadow-green-500/20 text-white">
                  <span className="text-[9px] font-black uppercase tracking-widest opacity-80 block mb-1">Total Gasto (Projeto)</span>
                  <p className="text-2xl font-black">{analytics?.totalGasto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>

                <div className="bg-white dark:bg-gray-800/60 p-5 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm">
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Total de Abastecimentos</span>
                  <p className="text-2xl font-black text-gray-900 dark:text-white">{analytics?.abast.length}x</p>
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

              {/* Tabela de Veículos (Um por linha) */}
              <div className="bg-white dark:bg-gray-800/60 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-50 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 flex items-center justify-between">
                  <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Consumo Detalhado por Veículo</h5>
                  <span className="text-[10px] font-bold text-[#0b7336] bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded-lg">
                    {analytics?.vehicles.length} Veículos Encontrados
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[9px] font-black text-gray-400 uppercase tracking-widest bg-gray-50/30 dark:bg-gray-900/20">
                        <th className="px-6 py-4">Veículo / Placa</th>
                        <th className="px-6 py-4">Combustível</th>
                        <th className="px-6 py-4 text-right">Abastecimentos</th>
                        <th className="px-6 py-4 text-right">Mín/Máx L</th>
                        <th className="px-6 py-4 text-right">Total Litros</th>
                        <th className="px-6 py-4 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                      {analytics?.vehicles.map((v: any, idx: number) => (
                        <tr key={idx} className="text-xs hover:bg-gray-50/50 dark:hover:bg-gray-900/30 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="bg-gray-100 dark:bg-gray-900 p-2 rounded-xl font-black text-gray-900 dark:text-white tabular-nums">
                                {v.placa}
                              </div>
                              <div>
                                <div className="font-bold text-gray-900 dark:text-white uppercase truncate max-w-[150px]">{v.identificacao || 'N/A'}</div>
                                <div className={`text-[8px] font-black uppercase ${
                                  v.status === 'Ativo' || v.status === 'Disponível' ? 'text-green-500' : 'text-amber-500'
                                }`}>
                                  {v.status || 'Ativo'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-black text-blue-600 dark:text-blue-400 uppercase">{v.combustivel}</span>
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-gray-900 dark:text-white">{v.totalAbast}x</td>
                          <td className="px-6 py-4 text-right">
                            <div className="text-[9px] font-bold text-green-600">{v.maisBarato > 0 ? v.maisBarato.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '---'}</div>
                            <div className="text-[9px] font-bold text-red-600">{v.maisCaro > 0 ? v.maisCaro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '---'}</div>
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-gray-500">{v.totalLitros.toFixed(2)} L</td>
                          <td className="px-6 py-4 text-right font-black text-[#0b7336]">{v.totalGasto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                        </tr>
                      ))}
                      {analytics?.vehicles.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-8 text-center text-sm font-medium text-gray-400 italic">Nenhum veículo vinculado.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tabela de Postos (Original, mas em destaque) */}
              <div className="bg-white dark:bg-gray-800/60 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-50 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30">
                  <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Consumo por Posto / Estabelecimento</h5>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[9px] font-black text-gray-400 uppercase tracking-widest bg-gray-50/30 dark:bg-gray-900/20">
                        <th className="px-6 py-4">Estabelecimento</th>
                        <th className="px-6 py-4">Combustível</th>
                        <th className="px-6 py-4 text-right">Valor/Litro</th>
                        <th className="px-6 py-4 text-right">Litros</th>
                        <th className="px-6 py-4 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                      {analytics?.porPosto.map((item: any, idx: number) => (
                        <tr key={idx} className="text-xs hover:bg-gray-50/50 dark:hover:bg-gray-900/30 transition-colors">
                          <td className="px-6 py-4 font-bold text-gray-900 dark:text-white capitalize">{item.nome.toLowerCase()}</td>
                          <td className="px-6 py-4 font-medium text-gray-500 uppercase">{item.combustivel}</td>
                          <td className="px-6 py-4 text-right font-black text-gray-900 dark:text-white">{item.valor_litro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                          <td className="px-6 py-4 text-right font-bold text-gray-500">{item.litros.toFixed(2)} L</td>
                          <td className="px-6 py-4 text-right font-black text-[#0b7336]">{item.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
