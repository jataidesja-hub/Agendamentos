"use client";

import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '@/lib/supabase';
import { MapPinIcon, MapIcon, CurrencyDollarIcon, FunnelIcon, ChartPieIcon } from '@heroicons/react/24/outline';
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
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM

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

  // Gera lista de meses disponíveis para o filtro
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    abastecimentos.forEach(a => {
      if (a.data_transacao) months.add(a.data_transacao.slice(0, 7));
    });
    // Adiciona mês atual se vazio
    if (months.size === 0) months.add(new Date().toISOString().slice(0, 7));
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [abastecimentos]);

  if (loading) {
    return (
      <div className="h-[500px] w-full flex items-center justify-center bg-gray-100 rounded-3xl animate-pulse">
        <div className="text-[#0b7336] flex flex-col items-center gap-2">
          <MapIcon className="w-10 h-10 animate-bounce" />
          <span className="font-bold">Carregando Mapa Operacional...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full h-full">
      {/* Header com Filtro */}
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
          <div className="bg-green-50 dark:bg-green-900/20 px-3 py-1 rounded-full border border-green-100 dark:border-green-800">
            <span className="text-[10px] font-black text-[#0b7336] uppercase tracking-widest leading-none">Painel Realtime</span>
          </div>
        </div>
      </div>

      <div className="relative flex-1 min-h-[600px] w-full rounded-3xl overflow-hidden shadow-2xl border border-white/20">
        <MapContainer 
          center={[-15.78, -47.93]} 
          zoom={4} 
          minZoom={4}
          maxBounds={BRAZIL_BOUNDS}
          maxBoundsViscosity={1.0}
          style={{ height: '100%', width: '100%' }}
          className="z-0"
        >
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {projetos.map((p) => {
            const projectVehicles = p.detalhes_json?.veiculos || [];
            const relevantVehicles = veiculosFrota.filter(v => projectVehicles.includes(v.placa));
            
            // Stats Frota
            const ativos = relevantVehicles.filter(v => v.status === 'Ativo' || !v.status).length;
            const manutencao = relevantVehicles.filter(v => v.status === 'Em Manutenção').length;

            // Stats Abastecimento (Filtrado por veículo e mês)
            const projectAbast = abastecimentos.filter(a => 
              projectVehicles.includes(a.placa) && 
              a.data_transacao.startsWith(selectedMonth)
            );

            const totalGasto = projectAbast.reduce((acc, curr) => acc + curr.valor_total, 0);
            
            // Encontra posto mais caro/barato
            const sortedByPrice = [...projectAbast].sort((a, b) => b.valor_litro - a.valor_litro);
            const maisCaro = sortedByPrice[0];
            const maisBarato = sortedByPrice[sortedByPrice.length - 1];

            // Agrupa por combustível
            const porCombustivel = projectAbast.reduce((acc: any, curr) => {
              const tipo = curr.tipo_combustivel || 'Outros';
              if (!acc[tipo]) acc[tipo] = 0;
              acc[tipo] += curr.valor_total;
              return acc;
            }, {});

            return (
              <Marker key={p.id} position={[p.latitude, p.longitude]}>
                <Popup className="custom-popup">
                  <div className="p-2 min-w-[300px] max-h-[450px] overflow-auto scroll-thin">
                    <h4 className="text-[#0b7336] font-black text-xl border-b border-green-100 pb-2 mb-3 leading-tight">{p.nome}</h4>
                    
                    <p className="text-[10px] text-gray-500 flex items-start gap-1 mb-4 italic">
                      <MapPinIcon className="w-3.5 h-3.5 text-[#0b7336] shrink-0" /> {p.endereco}
                    </p>
                    
                    <div className="space-y-4">
                      {/* Resumo Frota */}
                      <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-2xl border border-gray-100 dark:border-gray-800">
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Status da Frota</span>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-white dark:bg-gray-800 p-2 rounded-xl text-center shadow-sm">
                            <span className="block text-lg font-black text-gray-900 dark:text-white">{projectVehicles.length}</span>
                            <span className="text-[8px] font-bold text-gray-400 uppercase">Total</span>
                          </div>
                          <div className="bg-white dark:bg-gray-800 p-2 rounded-xl text-center shadow-sm">
                            <span className="block text-lg font-black text-green-600">{ativos}</span>
                            <span className="text-[8px] font-bold text-gray-400 uppercase">Ativos</span>
                          </div>
                          <div className="bg-white dark:bg-gray-800 p-2 rounded-xl text-center shadow-sm">
                            <span className="block text-lg font-black text-amber-500">{manutencao}</span>
                            <span className="text-[8px] font-bold text-gray-400 uppercase">Manut.</span>
                          </div>
                        </div>
                      </div>

                      {/* Custos (Abastecimento) */}
                      <div className="bg-green-50/50 dark:bg-green-900/10 p-3 rounded-2xl border border-green-100 dark:border-green-800/50">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[9px] font-black text-[#0b7336] uppercase tracking-widest">Abastecimentos ({selectedMonth})</span>
                          <span className="text-sm font-black text-[#0b7336]">{totalGasto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        </div>

                        {projectAbast.length > 0 ? (
                          <div className="space-y-3">
                            {/* Mais Caro/Mais Barato */}
                            <div className="grid grid-cols-2 gap-2">
                              <div className="bg-white/80 dark:bg-gray-800/80 p-2 rounded-xl border border-red-100 dark:border-red-900/30">
                                <span className="text-[8px] font-black text-red-500 uppercase block mb-1">Posto + Caro</span>
                                <span className="text-[10px] font-black block truncate text-gray-900 dark:text-white">{maisCaro?.nome_estabelecimento}</span>
                                <span className="text-[9px] font-bold text-red-600">{maisCaro?.valor_litro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/L</span>
                              </div>
                              <div className="bg-white/80 dark:bg-gray-800/80 p-2 rounded-xl border border-green-100 dark:border-green-900/30">
                                <span className="text-[8px] font-black text-green-500 uppercase block mb-1">Posto + Barato</span>
                                <span className="text-[10px] font-black block truncate text-gray-900 dark:text-white">{maisBarato?.nome_estabelecimento}</span>
                                <span className="text-[9px] font-bold text-green-600">{maisBarato?.valor_litro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/L</span>
                              </div>
                            </div>

                            {/* Detalhe por Posto */}
                            <div>
                               <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block mb-1">Gasto por Combustível</span>
                               <div className="space-y-1">
                                  {Object.entries(porCombustivel).map(([tipo, valor]: any) => (
                                    <div key={tipo} className="flex justify-between items-center text-[10px]">
                                      <span className="font-bold text-gray-600 dark:text-gray-400 truncate mr-2">{tipo}</span>
                                      <span className="font-black text-gray-900 dark:text-white">{valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                    </div>
                                  ))}
                               </div>
                            </div>
                          </div>
                        ) : (
                          <p className="text-[10px] text-gray-400 font-bold italic text-center py-2">Sem registros neste mês</p>
                        )}
                      </div>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
        
        <div className="absolute bottom-4 right-4 z-[500] bg-black/40 backdrop-blur rounded-lg px-3 py-1.5 text-[10px] font-bold text-white border border-white/10 shadow-2xl tracking-tighter uppercase">
          CYMI - Painel Centralizado v2.0
        </div>
      </div>
    </div>
  );
}
