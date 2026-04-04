"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { MapIcon, PlusIcon, CursorArrowRaysIcon } from '@heroicons/react/24/outline';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import toast from 'react-hot-toast';

function MapEvents({ onMapClick }: { onMapClick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function FazendasPage() {
  const [projetos, setProjetos] = useState<any[]>([]);
  const [veiculosLista, setVeiculosLista] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'fazenda' | 'projeto'>('fazenda');

  // Form states
  const [nome, setNome] = useState('');
  const [status, setStatus] = useState('Ativo');
  const [veiculoVinculado, setVeiculoVinculado] = useState('');
  const [coordsManuais, setCoordsManuais] = useState<{lat: number, lon: number} | null>(null);

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
      const [projRes, veicRes] = await Promise.all([
        supabase.from('projetos').select('*').order('created_at', { ascending: false }),
        supabase.from('veiculos_frota').select('*')
      ]);

      setProjetos(projRes.data || []);
      setVeiculosLista(veicRes.data || [{ placa: 'VEIC-TESTE', modelo: 'Teste' }]);
    } catch {
      toast.error('Erro ao carregar os dados');
    } finally {
      setLoading(false);
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coordsManuais) {
      toast.error('Selecione o local no mapa!');
      return;
    }

    try {
      const detalhes = {
        tipo: activeTab,
        status: status,
        veiculo: veiculoVinculado
      };

      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase.from('projetos').insert({
        user_id: user?.id,
        nome: nome,
        endereco: `Coord: ${coordsManuais.lat.toFixed(4)}, ${coordsManuais.lon.toFixed(4)} \n${activeTab.toUpperCase()}`,
        latitude: coordsManuais.lat,
        longitude: coordsManuais.lon,
        detalhes_json: detalhes
      });

      if (error) throw error;

      toast.success(`${activeTab === 'fazenda' ? 'Fazenda' : 'Projeto'} salvo com sucesso! O ponto já foi enviado ao mapa de relatórios.`);
      setShowForm(false);
      setNome('');
      setVeiculoVinculado('');
      setCoordsManuais(null);
      fetchDados();
    } catch (error) {
      toast.error('Erro ao salvar');
    }
  };

  const filteredItems = projetos.filter(p => p.detalhes_json?.tipo === activeTab);

  if (loading) return <div className="p-8 text-center text-gray-500 animate-pulse font-bold">Carregando dados...</div>;

  return (
    <div className="p-4 md:p-8 w-full max-w-6xl mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-lg">
            <MapIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Cadastro Geo</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Cadastre Fazendas e Projetos no Mapa (serão mostrados no Relatório Geral)</p>
          </div>
        </div>
        
        <button 
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-amber-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg hover:scale-105 active:scale-95"
        >
          {showForm ? 'Cancelar' : <><PlusIcon className="w-5 h-5" /> Nova Marcação</>}
        </button>
      </div>

      <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl w-fit drop-shadow-sm">
        <button 
          onClick={() => setActiveTab('fazenda')}
          className={`px-8 py-2 text-sm font-bold rounded-xl transition-all ${
            activeTab === 'fazenda' 
            ? 'bg-white dark:bg-gray-700 text-amber-600 shadow-sm' 
            : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Fazendas
        </button>
        <button 
          onClick={() => setActiveTab('projeto')}
          className={`px-8 py-2 text-sm font-bold rounded-xl transition-all ${
            activeTab === 'projeto' 
            ? 'bg-white dark:bg-gray-700 text-amber-600 shadow-sm' 
            : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Projetos
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border border-gray-100 dark:border-gray-700/50 rounded-3xl p-6 md:p-8 shadow-xl animate-in slide-in-from-top-4 duration-300 grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Coluna do Formulário */}
          <div className="flex flex-col gap-5">
            <h2 className="text-lg font-bold text-gray-800 dark:text-white capitalize border-b border-gray-100 dark:border-gray-700 pb-3">Novo(a) {activeTab}</h2>
            
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-gray-400 uppercase">Nome</label>
              <input 
                required placeholder={`Ex: ${activeTab === 'fazenda' ? 'Fazenda Boa Vista' : 'Projeto Torres X'}`}
                value={nome} onChange={e => setNome(e.target.value)}
                className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-gray-400 uppercase">Status</label>
              <select 
                value={status} onChange={e => setStatus(e.target.value)}
                className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-amber-500 outline-none appearance-none"
              >
                <option value="Ativo">Ativo</option>
                <option value="Inativo">Inativo</option>
                <option value="Em Manutenção">Em Manutenção</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-gray-400 uppercase">Veículo Vinculado</label>
              <select 
                value={veiculoVinculado} onChange={e => setVeiculoVinculado(e.target.value)}
                className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-amber-500 outline-none appearance-none"
              >
                <option value="">-- Nenhum veículo selecionado --</option>
                {veiculosLista.map(v => (
                  <option key={v.placa} value={v.placa}>{v.placa} - {v.modelo}</option>
                ))}
              </select>
            </div>

            <button type="submit" className="mt-4 bg-amber-500 text-white px-8 py-3 rounded-xl font-bold hover:bg-orange-600 transition-all shadow-lg active:scale-95 text-center">
              Criar e Salvar no Relatório Geral
            </button>
          </div>

          {/* Coluna do Mapa */}
          <div className="flex flex-col gap-2 h-[400px]">
            <div className="flex items-center gap-2 mb-2 text-amber-600 px-2">
              <CursorArrowRaysIcon className="w-5 h-5 animate-pulse" />
              <p className="text-sm font-bold tracking-tight">
                {coordsManuais 
                  ? "Local capturado! Pode salvar." 
                  : "Arraste / Clique no mapa para definir o endereço."}
              </p>
            </div>
            
            <div className="flex-1 rounded-2xl overflow-hidden border-2 border-dashed border-amber-500/30">
              <MapContainer center={[-15.78, -47.93]} zoom={4} className="w-full h-full z-0">
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <MapEvents onMapClick={(lat, lon) => {
                  setCoordsManuais({ lat, lon });
                }} />
                {coordsManuais && <Marker position={[coordsManuais.lat, coordsManuais.lon]} />}
              </MapContainer>
            </div>
          </div>

        </form>
      )}

      {/* Listagem */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
        {filteredItems.map(item => (
          <div key={item.id} className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-md border border-gray-100 dark:border-gray-700/50 rounded-2xl p-6 shadow-xl relative group">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-black text-gray-900 dark:text-white capitalize">{item.nome}</h3>
              <span className={`text-[10px] uppercase font-black tracking-widest px-2 py-1 rounded-full ${
                item.detalhes_json?.status === 'Ativo' ? 'bg-green-100 text-green-700' : 
                item.detalhes_json?.status === 'Inativo' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
              }`}>
                {item.detalhes_json?.status || 'Desconhecido'}
              </span>
            </div>
            <p className="text-xs font-medium text-gray-500 bg-gray-50 dark:bg-gray-900 rounded-lg p-2 mb-4 leading-relaxed line-clamp-2">
              {item.endereco}
            </p>
            <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
              <p className="text-xs text-gray-400 font-bold uppercase">Veículo Operacional: <span className="text-gray-700 dark:text-gray-200 ml-1">{item.detalhes_json?.veiculo || 'Nenhum'}</span></p>
            </div>
          </div>
        ))}
        {filteredItems.length === 0 && !showForm && (
          <div className="col-span-full py-12 text-center text-gray-400">
            Nenhum registro encontrado para {activeTab}.
          </div>
        )}
      </div>
    </div>
  );
}
