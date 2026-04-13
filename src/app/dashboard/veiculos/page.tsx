"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { TruckIcon, PlusIcon, TrashIcon, DocumentArrowUpIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

export default function VeiculosPage() {
  const [veiculos, setVeiculos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [busca, setBusca] = useState('');

  // Form states
  const [placa, setPlaca] = useState('');
  const [modelo, setModelo] = useState('');
  const [status, setStatus] = useState('Ativo');
  const [projeto, setProjeto] = useState('');
  const [base, setBase] = useState('');

  useEffect(() => {
    fetchVeiculos();
  }, []);

  async function fetchVeiculos() {
    try {
      const { data, error } = await supabase.from('frota_veiculos').select('*').order('created_at', { ascending: false });
      if (error) {
        console.warn('Tabela frota_veiculos error', error);
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
      const { error } = await supabase.from('frota_veiculos').insert({ 
        placa, 
        modelo,
        status,
        projeto,
        subprojeto: base
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
    // Atualização otimista para feedback imediato
    const originalVeiculos = [...veiculos];
    setVeiculos(prev => prev.map(v => v.id === id ? { ...v, status: newStatus } : v));

    try {
      const { error } = await supabase
        .from('frota_veiculos')
        .update({ status: newStatus })
        .eq('id', id);
      
      if (error) {
        setVeiculos(originalVeiculos);
        toast.error('Erro ao salvar no banco: ' + error.message);
      } else {
        toast.success('Status atualizado com sucesso!');
      }
    } catch (error) {
      setVeiculos(originalVeiculos);
      toast.error('Falha na conexão ao atualizar status');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este veículo da frota?')) return;
    try {
      const { error } = await supabase.from('frota_veiculos').delete().eq('id', id);
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
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl shadow-lg">
            <TruckIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Frota / Veículos</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Cadastro de placas, projetos e bases da operação</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <input 
              type="text" 
              placeholder="Pesquisar placa, projeto ou base..." 
              value={busca}
              onChange={(e) => setBusca(e.target.value.toUpperCase())}
              className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <label className="flex items-center gap-2 bg-gray-800 hover:bg-black text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg cursor-pointer whitespace-nowrap">
            <DocumentArrowUpIcon className="w-5 h-5" /> Importar Planilha
            <input type="file" accept=".xlsx, .xls" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setLoading(true);
              const reader = new FileReader();
              reader.onload = async (evt: any) => {
                try {
                  const wb = XLSX.read(evt.target.result, { type: 'binary' });
                  const rawData: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
                  const getV = (row: any, names: string[]) => {
                    for (const name of names) {
                      const found = Object.keys(row).find(k => k.toUpperCase().trim() === name.toUpperCase().trim());
                      if (found) return row[found];
                    }
                    return "";
                  };
                  const rawFormatted = rawData.map(row => {
                    const placa = String(getV(row, ["PLACA", "VEICULO"]) || "").trim().toUpperCase();
                    return {
                      placa: placa,
                      identificacao: placa,
                      projeto: String(getV(row, ["PROJETO"]) || "").trim(),
                      subprojeto: String(getV(row, ["BASE", "SUBPROJETO"]) || "").trim(),
                      email_gerente: String(getV(row, ["GERENTE", "EMAIL GERENTE", "EMAIL_GERENTE"]) || "").trim(),
                      email_administrativo: String(getV(row, ["ADMINISTRATIVO", "EMAIL ADMINISTRATIVO", "EMAIL_ADMINISTRATIVO"]) || "").trim(),
                      status: 'Ativo'
                    };
                  }).filter(x => x.placa !== "");

                  // Deduplicação: garantir que cada placa apareça apenas uma vez no lote de envio
                  const uniqueMap = new Map();
                  rawFormatted.forEach(item => uniqueMap.set(item.placa, item));
                  const formatted = Array.from(uniqueMap.values());

                  if (confirm(`Importar ${formatted.length} veículos?`)) {
                    const { error } = await supabase.from('frota_veiculos').upsert(formatted, { onConflict: 'placa' });
                    if (error) {
                      console.error("Erro detalhes:", error);
                      throw error;
                    }
                    toast.success('Frota atualizada!');
                    fetchVeiculos();
                  }
                } catch (err: any) { 
                  console.error("Erro detalhes:", err);
                  toast.error('Erro ao importar: ' + (err.message || String(err))); 
                }
                finally { setLoading(false); }
              };
              reader.readAsBinaryString(file);
            }} />
          </label>
          <button 
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg hover:scale-105 active:scale-95 whitespace-nowrap"
          >
            {showForm ? 'Cancelar' : <><PlusIcon className="w-5 h-5" /> Novo Veiculo</>}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border border-gray-100 dark:border-gray-700/50 rounded-3xl p-6 md:p-8 shadow-xl animate-in slide-in-from-top-4 duration-300">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-gray-400 uppercase ml-1">Placa</label>
              <input 
                required placeholder="EX: ABC-1234"
                value={placa} onChange={e => setPlaca(e.target.value.toUpperCase())}
                className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none uppercase text-gray-900 dark:text-white"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-gray-400 uppercase ml-1">Modelo</label>
              <input 
                placeholder="EX: Toyota Hilux"
                value={modelo} onChange={e => setModelo(e.target.value)}
                className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-gray-400 uppercase ml-1">Projeto</label>
              <input 
                placeholder="EX: ALIANÇA"
                value={projeto} onChange={e => setProjeto(e.target.value.toUpperCase())}
                className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none uppercase text-gray-900 dark:text-white"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-gray-400 uppercase ml-1">Base / Subprojeto</label>
              <input 
                placeholder="EX: SE ABDON"
                value={base} onChange={e => setBase(e.target.value.toUpperCase())}
                className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none uppercase text-gray-900 dark:text-white"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-gray-400 uppercase ml-1">Status</label>
              <select 
                value={status} onChange={e => setStatus(e.target.value)}
                className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white font-bold"
              >
                <option value="Ativo">✅ Ativo</option>
                <option value="Em Manutenção">🛠 Manutenção</option>
                <option value="Fora de Serviço">🚫 Inativo</option>
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
        {veiculos
          .filter(v => v.placa.includes(busca) || v.projeto?.includes(busca) || v.subprojeto?.includes(busca) || v.modelo?.toLowerCase().includes(busca.toLowerCase()))
          .map(v => (
          <div key={v.id} className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl border border-white/50 dark:border-gray-700/50 rounded-[2rem] p-7 shadow-[0_10px_40px_rgb(0,0,0,0.06)] flex flex-col justify-between group transition-all duration-300 hover:shadow-blue-500/10">
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">{v.projeto || 'SEM PROJETO'}</p>
                <h3 className="text-3xl font-black text-gray-900 dark:text-white tracking-widest leading-none mb-2">{v.placa}</h3>
                <p className="text-[11px] font-bold text-gray-400 uppercase">{v.subprojeto || 'SEM BASE'}</p>
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
