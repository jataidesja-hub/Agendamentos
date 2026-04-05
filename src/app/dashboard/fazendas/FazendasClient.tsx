"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { MapIcon, PlusIcon, CursorArrowRaysIcon, PencilIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
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

export default function ProjetosClient() {
  const [projetos, setProjetos] = useState<any[]>([]);
  const [veiculosLista, setVeiculosLista] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Form states
  const [nome, setNome] = useState('');
  const [status, setStatus] = useState('Ativo');
  const [veiculosSelecionados, setVeiculosSelecionados] = useState<string[]>([]);
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
      setVeiculosLista(veicRes.data || []);
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
        tipo: 'projeto',
        status: status,
        veiculos: veiculosSelecionados
      };

      const { data: { user } } = await supabase.auth.getUser();

      const payload = {
        user_id: user?.id,
        nome: nome,
        endereco: `Coord: ${coordsManuais.lat.toFixed(4)}, ${coordsManuais.lon.toFixed(4)}`,
        latitude: coordsManuais.lat,
        longitude: coordsManuais.lon,
        detalhes_json: detalhes
      };

      if (editId) {
        const { error } = await supabase.from('projetos').update(payload).eq('id', editId);
        if (error) throw error;
        toast.success('Projeto atualizado com sucesso!');
      } else {
        const { error } = await supabase.from('projetos').insert(payload);
        if (error) throw error;
        toast.success('Projeto salvo com sucesso!');
      }

      setShowForm(false);
      resetForm();
      fetchDados();
    } catch (error) {
      toast.error('Erro ao salvar');
    }
  };

  const addVeiculo = (placa: string) => {
    if (!placa) return;
    if (veiculosSelecionados.includes(placa)) {
      toast.error('Veículo já adicionado');
      return;
    }
    setVeiculosSelecionados([...veiculosSelecionados, placa]);
  };

  const removeVeiculo = (placa: string) => {
    setVeiculosSelecionados(veiculosSelecionados.filter(v => v !== placa));
  };

  const handleEdit = (p: any) => {
    setEditId(p.id);
    setNome(p.nome);
    setStatus(p.detalhes_json?.status || 'Ativo');
    setVeiculosSelecionados(p.detalhes_json?.veiculos || []);
    setCoordsManuais({ lat: p.latitude, lon: p.longitude });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este projeto?')) return;
    try {
      const { error } = await supabase.from('projetos').delete().eq('id', id);
      if (error) throw error;
      toast.success('Projeto removido');
      fetchDados();
    } catch {
      toast.error('Erro ao excluir');
    }
  };

  const resetForm = () => {
    setEditId(null);
    setNome('');
    setStatus('Ativo');
    setVeiculosSelecionados([]);
    setCoordsManuais(null);
  };

  if (loading) return <div className="p-8 text-center text-gray-500 animate-pulse font-bold">Carregando dados...</div>;

  return (
    <div className="p-4 md:p-8 w-full max-w-6xl mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-[#0b7336] to-[#298d4a] rounded-xl shadow-lg">
            <MapIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Cadastro de Projetos</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Gerencie torres e bases no mapa operacional</p>
          </div>
        </div>
        
        <button 
          onClick={() => {
            if (showForm) resetForm();
            setShowForm(!showForm);
          }}
          className="flex items-center gap-2 bg-[#0b7336] hover:bg-[#298d4a] text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg hover:scale-105 active:scale-95"
        >
          {showForm ? 'Cancelar' : <><PlusIcon className="w-5 h-5" /> Novo Projeto</>}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border border-gray-100 dark:border-gray-700/50 rounded-3xl p-6 md:p-8 shadow-xl animate-in slide-in-from-top-4 duration-300 grid grid-cols-1 md:grid-cols-2 gap-8">
          
          <div className="flex flex-col gap-5">
            <h2 className="text-lg font-bold text-gray-800 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-3">
              {editId ? 'Editar Projeto' : 'Novo Projeto'}
            </h2>
            
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-gray-400 uppercase">Nome do Projeto</label>
              <input 
                required placeholder="Ex: Projeto Torres Nordeste"
                value={nome} onChange={e => setNome(e.target.value)}
                className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#0b7336] outline-none text-gray-900 dark:text-white"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-gray-400 uppercase">Status</label>
              <select 
                value={status} onChange={e => setStatus(e.target.value)}
                className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#0b7336] outline-none appearance-none text-gray-900 dark:text-white"
              >
                <option value="Ativo">Ativo</option>
                <option value="Inativo">Inativo</option>
                <option value="Em Manutenção">Em Manutenção</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-gray-400 uppercase">Adicionar Veículos</label>
              <div className="flex gap-2">
                <select 
                  onChange={e => addVeiculo(e.target.value)}
                  className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#0b7336] outline-none appearance-none text-gray-900 dark:text-white"
                >
                  <option value="">-- Selecione para adicionar --</option>
                  {veiculosLista.map(v => (
                    <option key={v.placa} value={v.placa}>{v.placa} - {v.modelo}</option>
                  ))}
                </select>
              </div>
              
              {/* Chips de Veículos Selecionados */}
              <div className="flex flex-wrap gap-2 mt-2">
                {veiculosSelecionados.map(v => (
                  <div key={v} className="bg-green-50 dark:bg-green-900/30 text-[#0b7336] dark:text-green-400 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 border border-green-200 dark:border-green-800">
                    {v}
                    <button type="button" onClick={() => removeVeiculo(v)} className="hover:text-red-500 transition-colors">
                      <XMarkIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {veiculosSelecionados.length === 0 && (
                  <span className="text-[10px] text-gray-400 font-bold uppercase italic">Nenhum veículo vinculado</span>
                )}
              </div>
            </div>

            <button type="submit" className="mt-4 bg-[#0b7336] text-white px-8 py-3 rounded-xl font-bold hover:bg-[#298d4a] transition-all shadow-lg active:scale-95 text-center">
              {editId ? 'Salvar Alterações' : 'Criar e Salvar no Relatório'}
            </button>
          </div>

          <div className="flex flex-col gap-2 h-[400px]">
            <div className="flex items-center gap-2 mb-2 text-[#0b7336] px-2">
              <CursorArrowRaysIcon className="w-5 h-5 animate-pulse" />
              <p className="text-sm font-bold tracking-tight">
                {coordsManuais 
                  ? "Local definido! Clique em outra área para mudar." 
                  : "Clique no mapa para marcar o local do projeto."}
              </p>
            </div>
            
            <div className="flex-1 rounded-2xl overflow-hidden border-2 border-dashed border-[#0b7336]/30">
              <MapContainer 
                center={coordsManuais ? [coordsManuais.lat, coordsManuais.lon] : [-15.78, -47.93]} 
                zoom={coordsManuais ? 8 : 4} 
                className="w-full h-full z-0"
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <MapEvents onMapClick={(lat, lon) => setCoordsManuais({ lat, lon })} />
                {coordsManuais && <Marker position={[coordsManuais.lat, coordsManuais.lon]} />}
              </MapContainer>
            </div>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
        {projetos.map(item => (
          <div key={item.id} className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-md border border-gray-100 dark:border-gray-700/50 rounded-2xl p-6 shadow-xl relative group">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-black text-gray-900 dark:text-white truncate pr-2">{item.nome}</h3>
              <span className={`text-[10px] uppercase font-black tracking-widest px-2 py-1 rounded-full shrink-0 ${
                item.detalhes_json?.status === 'Ativo' ? 'bg-green-100 text-green-700' : 
                item.detalhes_json?.status === 'Inativo' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
              }`}>
                {item.detalhes_json?.status || 'Ativo'}
              </span>
            </div>
            <p className="text-xs font-medium text-gray-500 bg-gray-50 dark:bg-gray-900 rounded-lg p-2 mb-4 leading-relaxed line-clamp-2">
              {item.endereco}
            </p>
            <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
              <div className="mb-3">
                <p className="text-[10px] text-gray-400 font-bold uppercase mb-2">Veículos Vinculados:</p>
                <div className="flex flex-wrap gap-1.5">
                  {(item.detalhes_json?.veiculos || []).map((v: string) => (
                    <span key={v} className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-md text-[9px] font-black tracking-tighter border border-gray-200 dark:border-gray-600">
                      {v}
                    </span>
                  ))}
                  {(!item.detalhes_json?.veiculos || item.detalhes_json.veiculos.length === 0) && (
                    <span className="text-[10px] text-gray-400 italic">Nenhum</span>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => handleEdit(item)} className="p-2 bg-gray-100 dark:bg-gray-700 hover:bg-white dark:hover:bg-gray-600 rounded-lg transition-all text-gray-600 dark:text-gray-300 shadow-sm">
                  <PencilIcon className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(item.id)} className="p-2 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition-all text-red-600 dark:text-red-400 shadow-sm">
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {projetos.length === 0 && !showForm && (
          <div className="col-span-full py-12 text-center text-gray-400 font-bold italic">
            Nenhum projeto cadastrado no momento.
          </div>
        )}
      </div>
    </div>
  );
}
