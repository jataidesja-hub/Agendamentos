"use client";

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { supabase } from '@/lib/supabase';
import { MapPinIcon, PlusIcon, MapIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

// Fix for default marker icons in Leaflet with Next.js/Webpack
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

interface Projeto {
  id: string;
  nome: string;
  endereco: string;
  latitude: number;
  longitude: number;
  detalhes_json: any;
}

// Nominatim Geocoding Function
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

export default function MapaProjetos() {
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // States for new project
  const [novoNome, setNovoNome] = useState('');
  const [novoEndereco, setNovoEndereco] = useState('');
  const [novoDetalhes, setNovoDetalhes] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
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
      // 1. Geocoding
      const coords = await geocodeAddress(novoEndereco);
      if (!coords) {
        toast.error('Endereço não encontrado');
        setIsAdding(false);
        return;
      }

      // 2. Prepare JSON details (try to parse if it looks like JSON, otherwise save as object)
      let detalhesObj = {};
      try {
        detalhesObj = novoDetalhes ? JSON.parse(novoDetalhes) : {};
      } catch (e) {
        detalhesObj = { observacao: novoDetalhes };
      }

      // 3. Save to Supabase
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase.from('projetos').insert({
        user_id: user?.id,
        nome: novoNome,
        endereco: novoEndereco,
        latitude: coords.lat,
        longitude: coords.lon,
        detalhes_json: detalhesObj
      });

      if (error) throw error;

      toast.success('Projeto adicionado com sucesso!');
      setNovoNome('');
      setNovoEndereco('');
      setNovoDetalhes('');
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
    <div className="flex flex-col gap-4 w-full">
      {/* Header do Mapa */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapIcon className="w-6 h-6 text-[#0b7336]" />
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">Mapa de Projetos e Torres</h3>
        </div>
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 bg-[#0b7336] hover:bg-[#298d4a] text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-lg hover:scale-105 active:scale-95"
        >
          {showAddForm ? 'Cancelar' : (
            <><PlusIcon className="w-4 h-4" /> Novo Projeto/Torre</>
          )}
        </button>
      </div>

      {/* Form de Adicionar (Opcional - Condicional) */}
      {showAddForm && (
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl p-6 border border-green-500/20 shadow-xl animate-in slide-in-from-top-4 duration-300">
          <form onSubmit={handleAddProject} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-400 uppercase ml-1">Nome da Torre/Projeto</label>
              <input 
                required
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                placeholder="Ex: Torre Alfa" 
                className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#0b7336] outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-400 uppercase ml-1">Endereço Completo</label>
              <div className="relative">
                <input 
                  required
                  value={novoEndereco}
                  onChange={(e) => setNovoEndereco(e.target.value)}
                  placeholder="Rua, Número, Cidade, Estado" 
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-[#0b7336] outline-none"
                />
                <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-400 uppercase ml-1">Detalhes (JSON ou Texto)</label>
              <div className="flex gap-2">
                <input 
                  value={novoDetalhes}
                  onChange={(e) => setNovoDetalhes(e.target.value)}
                  placeholder='{"tensão": "220V"}' 
                  className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#0b7336] outline-none"
                />
                <button 
                  disabled={isAdding}
                  type="submit"
                  className="bg-green-600 text-white px-6 rounded-xl font-bold hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {isAdding ? 'Sincronizando...' : 'Adicionar'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Container do Mapa */}
      <div className="relative h-[600px] w-full rounded-3xl overflow-hidden shadow-2xl border border-white/20">
        <MapContainer 
          center={[-15.7801, -47.9292]} // Brasília (Centro do Brasil)
          zoom={4} 
          style={{ 
            height: '100%', 
            width: '100%',
            filter: 'hue-rotate(120deg) brightness(0.6) saturate(1.2) invert(1) hue-rotate(180deg)' // Dark Green Effect
          }}
          className="z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {projetos.map((p) => (
            <Marker key={p.id} position={[p.latitude, p.longitude]}>
              <Popup className="custom-popup">
                <div className="p-2 min-w-[200px]">
                  <h4 className="text-[#0b7336] font-black text-lg border-b pb-1 mb-2">{p.nome}</h4>
                  <p className="text-xs text-gray-600 flex items-center gap-1 mb-3">
                    <MapPinIcon className="w-3 h-3" /> {p.endereco}
                  </p>
                  
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Informações Técnicas</span>
                    {Object.entries(p.detalhes_json || {}).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-xs py-1 border-b border-gray-100 last:border-0">
                        <span className="font-semibold text-gray-500 capitalize">{key}:</span>
                        <span className="text-gray-900">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-3 flex justify-end">
                    <span className="text-[9px] text-gray-300 italic">ID: {p.id.slice(0,8)}</span>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
        
        {/* Overlay para facilitar interação se o filtro for muito forte */}
        <div className="absolute bottom-4 right-4 z-[1000] bg-white/90 backdrop-blur rounded-lg px-3 py-1 text-[10px] font-bold text-green-800 shadow-md">
          CYMI - MONITORAMENTO GEOGRÁFICO
        </div>
      </div>
      
      <style jsx global>{`
        .custom-popup .leaflet-popup-content-wrapper {
          border-radius: 16px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
          padding: 0;
        }
        .custom-popup .leaflet-popup-content {
          margin: 0;
        }
        .leaflet-container {
          background: #020617 !important;
        }
      `}</style>
    </div>
  );
}
