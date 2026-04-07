"use client";

import { useEffect, useState, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '@/lib/supabase';
import { MapPinIcon, MapIcon, FunnelIcon, ChartBarIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
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
  const mapRef = useRef<any>(null);

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
        supabase.from('abastecimentos').select('*').order('data_transacao', { ascending: false })
      ]);

      setProjetos(projRes.data || []);
      setVeiculosFrota(veicRes.data || []);
      setAbastecimentos(abastRes.data || []);
      
      if (abastRes.data && abastRes.data.length > 0) {
        const lastDate = abastRes.data[0].data_transacao;
        if (lastDate && lastDate.includes('-')) {
           setSelectedMonth(lastDate.slice(0, 7));
        }
      }
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      toast.error('Erro ao carregar dados do mapa');
    } finally {
      setLoading(false);
    }
  }

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    abastecimentos.forEach((a: any) => {
      if (a.data_transacao) {
        let monthStr = a.data_transacao.slice(0, 7);
        if (!monthStr.startsWith('20')) {
             const parts = a.data_transacao.split('-');
             if (parts.length >= 2) {
                 const monthsMap: any = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12', set: '09', out: '10', dez: '12' };
                 const m = monthsMap[parts[1].toLowerCase()] || '01';
                 const y = parts[2]?.length === 2 ? "20" + parts[2] : (parts[2] || "2025");
                 monthStr = `${y}-${m}`;
             }
        }
        months.add(monthStr);
      }
    });
    if (months.size === 0) months.add(new Date().toISOString().slice(0, 7));
    return Array.from(months).sort((a: any, b: any) => b.localeCompare(a));
  }, [abastecimentos]);

  const analytics = useMemo(() => {
    if (!projetoSelecionado) return null;

    const projectVehicles = (projetoSelecionado.detalhes_json?.veiculos || [])
      .map((p: string) => p.trim().toUpperCase())
      .filter((p: string) => p !== "");
    
    const projectAbast = abastecimentos.filter((a: any) => {
      const aPlaca = a.placa?.trim().toUpperCase();
      if (!projectVehicles.includes(aPlaca)) return false;
      
      let d = a.data_transacao || "";
      if (!d.startsWith('20') && d.includes('-')) {
          const parts = d.split('-');
          const monthsMap: any = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12', set: '09', out: '10', dez: '12' };
          const m = monthsMap[parts[1]?.toLowerCase()] || '01';
          const y = parts[2]?.length === 2 ? "20" + parts[2] : (parts[2] || "2025");
          d = `${y}-${m}`;
      }
      return d.startsWith(selectedMonth);
    });

    const totalGasto = projectAbast.reduce((acc: number, curr: any) => acc + curr.valor_total, 0);
    const sortedByPrice = [...projectAbast].sort((a: any, b: any) => b.valor_litro - a.valor_litro);
    
    const relatorioVeiculos = projectVehicles.map((placa: string) => {
      const frotaData = veiculosFrota.find((vf: any) => vf.placa.trim().toUpperCase() === placa);
      const vAbast = projectAbast.filter((a: any) => a.placa?.trim().toUpperCase() === placa);
      
      const porPosto = vAbast.reduce((acc: any, curr: any) => {
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
        return acc;
      }, {});

      return {
        id: placa,
        placa: placa,
        identificacao: frotaData?.identificacao || 'NÃO ENCONTRADO NA FROTA',
        status: frotaData?.status || 'N/A',
        data: Object.values(porPosto),
        totalGasto: vAbast.reduce((acc: number, curr: any) => acc + curr.valor_total, 0),
        totalLitros: vAbast.reduce((acc: number, curr: any) => acc + curr.litros, 0),
        totalAbast: vAbast.length,
        combustivelPredominante: vAbast[0]?.tipo_combustivel || '---'
      };
    }).sort((a: any, b: any) => b.totalGasto - a.totalGasto);

    return {
      vehicles: relatorioVeiculos,
      abastCount: projectAbast.length,
      totalGasto,
      maisCaro: sortedByPrice[0],
      maisBarato: sortedByPrice[sortedByPrice.length - 1],
      totalBase: abastecimentos.length
    };
  }, [projetoSelecionado, veiculosFrota, abastecimentos, selectedMonth]);

  const RenderMap = useMemo(() => (
    <div className="w-full relative rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/20 bg-gray-100 dark:bg-gray-900" style={{ height: '500px' }}>
      <MapContainer 
        center={[-10.6, -42.7]} 
        zoom={5} 
        minZoom={3}
        maxBounds={BRAZIL_BOUNDS}
        maxBoundsViscosity={1.0}
        style={{ height: '500px', width: '100%' }}
        className="z-0"
        scrollWheelZoom={true}
        ref={(m) => { if(m) mapRef.current = m; }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {projetos.map((p) => (
          <Marker 
            key={p.id} 
            position={[p.latitude, p.longitude]}
            eventHandlers={{
              click: () => {
                setProjetoSelecionado(p);
                setTimeout(() => {
                  document.getElementById('project-report')?.scrollIntoView({ behavior: 'smooth' });
                  mapRef.current?.invalidateSize();
                }, 100);
              }
            }}
          >
            <Popup>
              <div className="font-bold text-[#0b7336] text-center">{p.nome}</div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  ), [projetos]);

  if (loading && projetos.length === 0) {
    return (
      <div className="h-[500px] w-full flex items-center justify-center bg-gray-100 dark:bg-gray-900 rounded-3xl animate-pulse text-[#0b7336]">
        <MapIcon className="w-10 h-10 animate-bounce mr-2" />
        <span className="font-bold uppercase tracking-widest text-xs">Carregando Mapa Operacional...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full h-full pb-20">
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

      {RenderMap}

      {projetoSelecionado ? (
        <div id="project-report" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-[#0b7336] rounded-[1.5rem] shadow-lg shadow-green-500/20">
              <ChartBarIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h4 className="text-2xl font-black text-gray-900 dark:text-white leading-none">{projetoSelecionado.nome}</h4>
              <p className="text-sm font-medium text-gray-500 mt-2 uppercase tracking-wide">
                Relatório de {new Date(selectedMonth + "-01").toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>

          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-[#0b7336] p-6 rounded-[2.5rem] shadow-xl shadow-green-500/10 text-white">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-70 block mb-1">Total Gasto no Mês</span>
                <p className="text-2xl font-black">{analytics?.totalGasto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
              </div>

              <div className="bg-white dark:bg-gray-800/60 p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm relative group overflow-hidden">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Abastecimentos</span>
                <p className="text-2xl font-black text-gray-900 dark:text-white">{analytics?.abastCount}x</p>
                <div className="absolute inset-x-0 bottom-0 h-1 bg-blue-500 scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></div>
              </div>

              <div className="bg-white dark:bg-gray-800/60 p-6 rounded-[2.5rem] border border-red-50/50 dark:border-red-900/20">
                <div className="flex items-center gap-2 mb-1">
                  <ArrowTrendingUpIcon className="w-4 h-4 text-red-500" />
                  <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Preço Máximo</span>
                </div>
                <p className="text-xl font-black text-red-600">{analytics?.maisCaro?.valor_litro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || '---'}</p>
                <p className="text-[9px] font-bold text-gray-400 mt-1 truncate uppercase">{analytics?.maisCaro?.nome_estabelecimento || '---'}</p>
              </div>

              <div className="bg-white dark:bg-gray-800/60 p-6 rounded-[2.5rem] border border-green-50/50 dark:border-green-900/20">
                <div className="flex items-center gap-2 mb-1">
                  <ArrowTrendingDownIcon className="w-4 h-4 text-green-500" />
                  <span className="text-[10px] font-black text-green-500 uppercase tracking-widest">Preço Mínimo</span>
                </div>
                <p className="text-xl font-black text-green-600">{analytics?.maisBarato?.valor_litro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || '---'}</p>
                <p className="text-[9px] font-bold text-gray-400 mt-1 truncate uppercase">{analytics?.maisBarato?.nome_estabelecimento || '---'}</p>
              </div>
            </div>

            <div className="space-y-6">
              {analytics?.vehicles.map((v: any) => (
                <div key={v.id} className="bg-white dark:bg-gray-800/60 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden group hover:border-[#0b7336]/30 transition-all duration-300">
                  <div className="px-8 py-6 border-b border-gray-50 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-900/30 flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-5">
                      <div className="bg-gray-900 text-white px-5 py-3 rounded-2xl font-black text-xl shadow-2xl tracking-tight">
                        {v.placa}
                      </div>
                      <div>
                        <div className="font-black text-gray-900 dark:text-white uppercase tracking-tight text-lg">{v.identificacao}</div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-black text-[#0b7336] uppercase bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-lg">PROJETO ATUAL</span>
                          <span className={`text-[10px] font-black uppercase ${
                            v.status === 'Ativo' || v.status === 'Disponível' ? 'text-blue-500' : 'text-amber-500'
                          }`}>
                            Status: {v.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-10">
                      <div className="text-right">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Consumo Total</p>
                        <p className="text-xl font-black text-gray-900 dark:text-white">{v.totalLitros.toFixed(2)} L</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Gasto Total</p>
                        <p className="text-xl font-black text-[#0b7336]">{v.totalGasto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50/10 dark:bg-gray-900/10">
                          <th className="px-8 py-4">Estabelecimento</th>
                          <th className="px-6 py-4">Tipo</th>
                          <th className="px-6 py-4 text-right">Preço/Litro</th>
                          <th className="px-6 py-4 text-right">Qtd.</th>
                          <th className="px-6 py-4 text-right">Volume</th>
                          <th className="px-8 py-4 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                        {v.data.map((item: any, idx: number) => (
                          <tr key={idx} className="text-sm hover:bg-gray-50/50 dark:hover:bg-gray-900/30 transition-colors">
                            <td className="px-8 py-5 font-bold text-gray-900 dark:text-white uppercase text-xs">{item.nome}</td>
                            <td className="px-6 py-5 font-black text-blue-500 text-[10px] uppercase">{item.combustivel}</td>
                            <td className="px-6 py-5 text-right font-black text-gray-900 dark:text-white">{item.valor_litro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                            <td className="px-6 py-5 text-right font-black text-gray-900 dark:text-white tabular-nums">{item.count}x</td>
                            <td className="px-6 py-5 text-right font-bold text-gray-500 tabular-nums">{item.litros.toFixed(2)} L</td>
                            <td className="px-8 py-5 text-right font-black text-[#0b7336] tabular-nums">{item.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-32 bg-white/40 dark:bg-gray-800/30 rounded-[3.5rem] border-2 border-dashed border-gray-100 dark:border-gray-700 shadow-inner">
          <div className="bg-gray-100 dark:bg-gray-900 p-8 rounded-full mb-8 shadow-lg">
            <MapPinIcon className="w-16 h-16 text-gray-300" />
          </div>
          <h4 className="text-2xl font-black text-gray-400 uppercase tracking-tighter">Selecione um projeto para detalhar</h4>
          <p className="text-sm font-bold text-gray-300 mt-3 uppercase tracking-widest">Dados operacionais e financeiros em tempo real</p>
        </div>
      )}
    </div>
  );
}
