"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { TruckIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function VeiculosPage() {
  const [veiculos, setVeiculos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form states
  const [placa, setPlaca] = useState('');
  const [modelo, setModelo] = useState('');
  const [status, setStatus] = useState('Ativo');

  useEffect(() => {
    fetchVeiculos();
  }, []);

  async function fetchVeiculos() {
    try {
      const { data, error } = await supabase.from('veiculos_frota').select('*').order('created_at', { ascending: false });
      if (error) {
        console.warn('Tabela veiculos_frota talvez não exista', error);
        setVeiculos([]);
      } else {
        setVeiculos(data || []);
      }
    } catch {
      toast.error('Erro ao carregar veículos');
    } finally {
      setLoading(false);
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('veiculos_frota').insert({ 
        placa, 
        modelo,
        status 
      });
      if (!error) toast.success('Veículo registrado!');
      setShowForm(false);
      fetchVeiculos();
      setPlaca('');
      setModelo('');
      setStatus('Ativo');
    } catch (error) {
      toast.error('Erro ao salvar veículo');
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('veiculos_frota')
        .update({ status: newStatus })
        .eq('id', id);
      
      if (!error) {
        toast.success('Status atualizado!');
        fetchVeiculos();
      }
    } catch (error) {
      toast.error('Erro ao atualizar status');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este veículo da frota?')) return;
    try {
      const { error } = await supabase.from('veiculos_frota').delete().eq('id', id);
      if (!error) {
        toast.success('Veículo removido!');
        fetchVeiculos();
      }
    } catch {
      toast.error('Erro ao excluir veículo');
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500 animate-pulse font-bold">Carregando veículos...</div>;

  return (
    <div className="p-4 md:p-8 w-full max-w-6xl mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl shadow-lg">
            <TruckIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Frota / Veículos</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Cadastro de placas e veículos da operação</p>
          </div>
        </div>
        
        <button 
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg hover:scale-105 active:scale-95"
        >
          {showForm ? 'Cancelar' : <><PlusIcon className="w-5 h-5" /> Cadastrar Veículo</>}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border border-gray-100 dark:border-gray-700/50 rounded-3xl p-6 md:p-8 shadow-xl animate-in slide-in-from-top-4 duration-300">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-gray-400 uppercase ml-1">Placa do Veículo</label>
              <input 
                required placeholder="EX: ABC-1234"
                value={placa} onChange={e => setPlaca(e.target.value.toUpperCase())}
                className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none uppercase text-gray-900 dark:text-white"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-gray-400 uppercase ml-1">Modelo / Descrição</label>
              <input 
                required placeholder="EX: Toyota Hilux 4x4"
                value={modelo} onChange={e => setModelo(e.target.value)}
                className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-gray-400 uppercase ml-1">Status Operacional</label>
              <select 
                value={status} onChange={e => setStatus(e.target.value)}
                className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white"
              >
                <option value="Ativo">Ativo</option>
                <option value="Em Manutenção">Em Manutenção</option>
                <option value="Fora de Serviço">Fora de Serviço</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg active:scale-95">
              Salvar Veículo
            </button>
          </div>
        </form>
      )}

       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
        {veiculos.map(v => (
          <div key={v.id} className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl border border-white/50 dark:border-gray-700/50 rounded-[2rem] p-7 shadow-[0_10px_40px_rgb(0,0,0,0.06)] flex flex-col justify-between group transition-all duration-300 hover:shadow-blue-500/10">
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">{v.modelo}</p>
                <h3 className="text-3xl font-black text-gray-900 dark:text-white tracking-widest leading-none">{v.placa}</h3>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleDelete(v.id)}
                  className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                  title="Excluir Veículo"
                >
                  <TrashIcon className="w-5 h-5" />
                </button>
                <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                  <TruckIcon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-tighter ml-1">Status Operacional</label>
              <select 
                value={v.status || 'Ativo'} 
                onChange={(e) => handleUpdateStatus(v.id, e.target.value)}
                className={`w-full px-4 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest border-0 focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer ${
                  v.status === 'Ativo' ? 'bg-green-100 text-green-700' : 
                  v.status === 'Em Manutenção' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                }`}
              >
                <option value="Ativo" className="bg-white">✅ Ativo / Em Serviço</option>
                <option value="Em Manutenção" className="bg-white">🛠 Em Manutenção</option>
                <option value="Fora de Serviço" className="bg-white">🚫 Fora de Serviço</option>
              </select>
            </div>
          </div>
        ))}
        {veiculos.length === 0 && (
          <div className="col-span-full py-24 text-center border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-[3rem] bg-gray-50/50 dark:bg-gray-900/30">
            <TruckIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-bold italic">Nenhum veículo cadastrado na frota.</p>
          </div>
        )}
      </div>
    </div>
  );
}
