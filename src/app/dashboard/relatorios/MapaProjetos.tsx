"use client";

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '@/lib/supabase';
import { MapPinIcon, PlusIcon, MapIcon, MagnifyingGlassIcon, CursorArrowRaysIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface Projeto {
  id: string;
  nome: string;
  endereco: string;
  latitude: number;
  longitude: number;
  detalhes_json: any;
}

// Limites do Brasil (Lat/Lng)
const BRAZIL_BOUNDS: [[number, number], [number, number]] = [
  [-33.75, -73.99], // Sudoeste
  [5.27, -28.84]    // Nordeste
];

// Nominatim Geocoding
async function geocodeAddress(address: string) {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`);
    const data = await response.json();
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon)
      };
    }
    return null;
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
}

// Componente para capturar cliques no mapa
function MapEvents({ onMapClick }: { onMapClick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function MapaProjetos() {
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // New project state
  const [novoNome, setNovoNome] = useState('');
  const [novoEndereco, setNovoEndereco] = useState('');
  const [novoDetalhes, setNovoDetalhes] = useState('');
  const [coordsManuais, setCoordsManuais] = useState<{lat: number, lon: number} | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    // Leaflet side effects must be inside useEffect
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
    
    fetchProjetos();
  }, []);

  async function fetchProjetos() {
    try {
      const { data, error } = await supabase
        .from('projetos')
        .select('*');

      if (error) throw error;
      setProjetos(data || []);
    } catch (error) {
      console.error('Erro ao buscar projetos:', error);
      toast.error('Erro ao carregar mapa');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddProject(e: React.FormEvent) {
    e.preventDefault();
    setIsAdding(true);
    
    try {
      let lat, lon;

      if (coordsManuais) {
        lat = coordsManuais.lat;
        lon = coordsManuais.lon;
      } else {
        const coords = await geocodeAddress(novoEndereco);
        if (!coords) {
          toast.error('Endereço não encontrado. Clique no mapa para marcar manualmente.');
          setIsAdding(false);
          return;
        }
        lat = coords.lat;
        lon = coords.lon;
      }

      let detalhesObj = {};
      try {
        detalhesObj = novoDetalhes ? JSON.parse(novoDetalhes) : {};
      } catch {
        detalhesObj = { observacao: novoDetalhes };
      }

      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase.from('projetos').insert({
        user_id: user?.id,
        nome: novoNome,
        endereco: novoEndereco || `Coordenadas: ${lat.toFixed(4)}, ${lon.toFixed(4)}`,
        latitude: lat,
        longitude: lon,
        detalhes_json: detalhesObj
      });

      if (error) throw error;

      toast.success('Projeto adicionado com sucesso!');
      setNovoNome('');
      setNovoEndereco('');
      setNovoDetalhes('');
      setCoordsManuais(null);
      setShowAddForm(false);
      fetchProjetos();
    } catch (error) {
      console.error('Erro ao adicionar projeto:', error);
      toast.error('Erro ao salvar no banco');
    } finally {
      setIsAdding(false);
    }
  }

  if (loading) {
    return (
      <div className="h-[500px] w-full flex items-center justify-center bg-gray-100 rounded-3xl animate-pulse">
        <div className="text-[#0b7336] flex flex-col items-center gap-2">
          <MapIcon className="w-10 h-10 animate-bounce" />
          <span className="font-bold">Carregando Mapa...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapIcon className="w-6 h-6 text-[#0b7336]" />
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">Relatório de Localização (Brasil)</h3>
        </div>
        <button 
          onClick={() => {
            setShowAddForm(!showAddForm);
            setCoordsManuais(null);
          }}
          className="flex items-center gap-2 bg-[#0b7336] hover:bg-[#298d4a] text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-lg hover:scale-105 active:scale-95"
        >
          {showAddForm ? 'Cancelar' : (
            <><PlusIcon className="w-4 h-4" /> Novo Projeto/Torre</>
          )}
        </button>
      </div>

      {/* Form */}
      {showAddForm && (
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl p-6 border border-green-500/20 shadow-xl animate-in slide-in-from-top-4 duration-300 z-10">
          <div className="flex items-center gap-2 mb-4 text-[#0b7336]">
            <CursorArrowRaysIcon className="w-5 h-5 animate-pulse" />
            <p className="text-sm font-bold">
              {coordsManuais 
                ? "Localização marcada no mapa! Preencha o nome e salve." 
                : "Digite o endereço ou clique em qualquer lugar no mapa para marcar."}
            </p>
          </div>
          <form onSubmit={handleAddProject} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-400 uppercase ml-1">Nome da Torre/Projeto</label>
              <input 
                required
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                placeholder="Ex: Torre Juazeiro-BA" 
                className="bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#0b7336] outline-none text-gray-900 dark:text-white"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-400 uppercase ml-1">Endereço (ou use o mapa)</label>
              <div className="relative">
                <input 
                  value={novoEndereco}
                  onChange={(e) => {
                    setNovoEndereco(e.target.value);
                    if (coordsManuais) setCoordsManuais(null); 
                  }}
                  placeholder={coordsManuais ? "Coordenadas capturadas!" : "Busca por texto..."} 
                  className={`w-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white border ${coordsManuais ? 'border-green-500 ring-2 ring-green-500/20' : 'border-gray-200 dark:border-gray-700'} rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-[#0b7336] outline-none transition-all text-gray-900 dark:text-white`}
                />
                <MagnifyingGlassIcon className={`w-4 h-4 absolute left-3 top-3 ${coordsManuais ? 'text-green-500' : 'text-gray-400'}`} />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-400 uppercase ml-1">Informações Extras (JSON)</label>
              <div className="flex gap-2">
                <input 
                  value={novoDetalhes}
                  onChange={(e) => setNovoDetalhes(e.target.value)}
                  placeholder='{"tensão": "220V"}' 
                  className="flex-1 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#0b7336] outline-none text-gray-900 dark:text-white"
                />
                <button 
                  disabled={isAdding}
                  type="submit"
                  className="bg-green-600 text-white px-6 rounded-xl font-bold hover:bg-green-700 disabled:opacity-50 transition-all shadow-lg active:scale-95"
                >
                  {isAdding ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Map Container */}
      <div className="relative flex-1 min-h-[600px] w-full rounded-3xl overflow-hidden shadow-2xl border border-white/20">
        <MapContainer 
          center={[-15.78, -47.93]} 
          zoom={4} 
          minZoom={4}
          maxBounds={BRAZIL_BOUNDS}
          maxBoundsViscosity={1.0}
          style={{ 
            height: '100%', 
            width: '100%'
          }}
          className="z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          <MapEvents onMapClick={(lat, lon) => {
            if (showAddForm) {
              setCoordsManuais({ lat, lon });
              toast.success("Local selecionado!");
            }
          }} />

          {/* Projetos Existentes */}
          {projetos.map((p) => (
            <Marker key={p.id} position={[p.latitude, p.longitude]}>
              <Popup>
                <div className="p-2 min-w-[220px]">
                  <h4 className="text-[#0b7336] font-black text-lg border-b border-green-100 pb-1 mb-2">{p.nome}</h4>
                  <p className="text-xs text-gray-600 flex items-center gap-1 mb-3">
                    <MapPinIcon className="w-3 h-3 text-[#0b7336]" /> {p.endereco}
                  </p>
                  
                  <div className="bg-green-50/50 p-3 rounded-xl border border-green-100">
                    <span className="text-[10px] font-black text-[#0b7336]/60 uppercase tracking-widest block mb-2">Detalhes Operacionais</span>
                    <div className="flex justify-between text-xs py-1.5 border-b border-green-100/50">
                      <span className="font-bold text-gray-500">Status:</span>
                      <span className="text-gray-900 font-medium">{p.detalhes_json?.status || 'Ativo'}</span>
                    </div>
                    <div className="mt-2 text-[10px] text-gray-400 font-bold uppercase mb-1">Veículos:</div>
                    <div className="flex flex-wrap gap-1">
                      {(p.detalhes_json?.veiculos || []).map((v: string) => (
                        <span key={v} className="bg-white px-1.5 py-0.5 rounded border border-green-200 text-[9px] font-bold text-gray-700">{v}</span>
                      ))}
                      {(!p.detalhes_json?.veiculos || p.detalhes_json.veiculos.length === 0) && <span className="text-[9px] text-gray-400">Nenhum</span>}
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Marcador Temporário Manual */}
          {showAddForm && coordsManuais && (
            <Marker 
              position={[coordsManuais.lat, coordsManuais.lon]}
            >
              <Popup>
                <span className="font-bold text-[#0b7336]">Nova Localização Selecionada</span>
              </Popup>
            </Marker>
          )}
        </MapContainer>
        
        {/* Map Overlays */}
        <div className="absolute top-4 right-4 z-[500] bg-white/80 backdrop-blur rounded-xl p-3 border border-green-500/20 shadow-xl max-w-[200px]">
          <p className="text-[10px] font-black text-[#0b7336] uppercase tracking-tighter mb-1">Dica de Operação</p>
          <p className="text-[10px] text-gray-600 leading-tight">Para endereços difíceis, clique diretamente no mapa para marcar a torre.</p>
        </div>
        
        <div className="absolute bottom-4 right-4 z-[500] bg-black/40 backdrop-blur rounded-lg px-3 py-1.5 text-[10px] font-bold text-white border border-white/10 shadow-2xl">
          CYMI - MONITORAMENTO BRASIL
        </div>
      </div>
    </div>
  );
}
