"use client";

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '@/lib/supabase';
import { MapPinIcon, MapIcon } from '@heroicons/react/24/outline';
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

export default function MapaProjetos() {
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [veiculosFrota, setVeiculosFrota] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
    
    fetchDados();
  }, []);

  async function fetchDados() {
    try {
      const [projRes, veicRes] = await Promise.all([
        supabase.from('projetos').select('*'),
        supabase.from('veiculos_frota').select('*')
      ]);

      if (projRes.error) throw projRes.error;
      setProjetos(projRes.data || []);
      setVeiculosFrota(veicRes.data || []);
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      toast.error('Erro ao carregar mapa');
    } finally {
      setLoading(false);
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
          <h3 className="text-xl font-bold text-gray-800 dark:text-white tracking-tight">Status Operacional da Frota por Projeto</h3>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 px-3 py-1 rounded-full border border-green-100 dark:border-green-800">
          <span className="text-[10px] font-black text-[#0b7336] uppercase tracking-widest">Painel de Monitoramento</span>
        </div>
      </div>

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
          
          {/* Projetos Existentes */}
          {projetos.map((p) => {
            const projectVehicles = p.detalhes_json?.veiculos || [];
            const relevantVehicles = veiculosFrota.filter(v => projectVehicles.includes(v.placa));
            const ativos = relevantVehicles.filter(v => v.status === 'Ativo' || !v.status).length;
            const manutencao = relevantVehicles.filter(v => v.status === 'Em Manutenção').length;
            const fora = relevantVehicles.filter(v => v.status === 'Fora de Serviço').length;

            return (
              <Marker key={p.id} position={[p.latitude, p.longitude]}>
                <Popup>
                  <div className="p-2 min-w-[240px] font-sans">
                    <h4 className="text-[#0b7336] font-black text-xl border-b border-green-100 pb-2 mb-3 leading-tight">{p.nome}</h4>
                    <p className="text-[11px] text-gray-500 flex items-start gap-1 mb-4 italic">
                      <MapPinIcon className="w-3.5 h-3.5 text-[#0b7336] mt-0.5 shrink-0" /> {p.endereco}
                    </p>
                    
                    <div className="bg-green-50/50 dark:bg-gray-900/50 p-3 rounded-2xl border border-green-100/50">
                      <span className="text-[10px] font-black text-[#0b7336]/60 dark:text-green-500/50 uppercase tracking-widest block mb-3">Resumo da Frota Local</span>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-white dark:bg-gray-800 p-2.5 rounded-xl text-center border border-green-100/50 shadow-sm">
                          <span className="block text-2xl font-black text-gray-900 dark:text-white leading-none">{projectVehicles.length}</span>
                          <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase">Total</span>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-2.5 rounded-xl text-center border border-green-100/50 shadow-sm">
                          <span className="block text-2xl font-black text-green-600 leading-none">{ativos}</span>
                          <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase">Ativos</span>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-2.5 rounded-xl text-center border border-green-100/50 shadow-sm">
                          <span className="block text-2xl font-black text-yellow-600 leading-none">{manutencao}</span>
                          <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase">Em Manut.</span>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-2.5 rounded-xl text-center border border-green-100/50 shadow-sm">
                          <span className="block text-2xl font-black text-red-600 leading-none">{fora}</span>
                          <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase">Fora</span>
                        </div>
                      </div>

                      {projectVehicles.length === 0 && (
                        <p className="text-[10px] text-gray-400 font-bold italic text-center py-2">Nenhum veículo vinculado</p>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
        
        <div className="absolute bottom-4 right-4 z-[500] bg-black/40 backdrop-blur rounded-lg px-3 py-1.5 text-[10px] font-bold text-white border border-white/10 shadow-2xl tracking-tighter">
          CYMI - MONITORAMENTO OPERACIONAL
        </div>
      </div>
    </div>
  );
}
