"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { ArchiveBoxIcon, PlusIcon, MinusIcon, ExclamationTriangleIcon, TrashIcon, PencilIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

interface Material {
  id: string;
  nome: string;
  unidade: string;
  estoque_minimo: number;
  quantidade_atual: number;
}

export default function MateriaisApp({ isAdmin }: { isAdmin: boolean }) {
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);

  // Modals state
  const [showMovimentacao, setShowMovimentacao] = useState<{ id: string, tipo: 'entrada' | 'saida', material: Material } | null>(null);
  const [showCadastro, setShowCadastro] = useState(false);
  const [editMaterial, setEditMaterial] = useState<Material | null>(null);

  // Form states
  const [qtde, setQtde] = useState('');
  const [placa, setPlaca] = useState('');
  const [obs, setObs] = useState('');

  // Form Cadastro states
  const [nome, setNome] = useState('');
  const [unidade, setUnidade] = useState('un');
  const [estoqueMin, setEstoqueMin] = useState('');

  useEffect(() => {
    fetchMateriais();

    // Inscrever para atualizações em tempo real
    const channel = supabase.channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'materiais' }, (payload) => {
        fetchMateriais();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchMateriais() {
    try {
      const { data, error } = await supabase.from('materiais').select('*').order('nome');
      if (error) throw error;
      setMateriais(data || []);
    } catch (error: any) {
      toast.error('Erro ao buscar materiais');
    } finally {
      setLoading(false);
    }
  }

  async function handleMovimentacao(e: React.FormEvent) {
    e.preventDefault();
    if (!showMovimentacao) return;

    const quantidadeNum = parseFloat(qtde);
    if (isNaN(quantidadeNum) || quantidadeNum <= 0) {
      toast.error('Quantidade inválida');
      return;
    }

    if (showMovimentacao.tipo === 'saida' && showMovimentacao.material.quantidade_atual < quantidadeNum) {
      toast.error('Estoque insuficiente para esta saída.');
      return;
    }

    const loadToast = toast.loading('Registrando...');
    try {
      const { error } = await supabase.from('movimentacoes_materiais').insert([{
        material_id: showMovimentacao.id,
        tipo: showMovimentacao.tipo,
        quantidade: quantidadeNum,
        placa_veiculo: placa.trim().toUpperCase() || null,
        observacao: obs.trim() || null
      }]);
      if (error) throw error;
      toast.success('Registrado com sucesso!', { id: loadToast });
      setShowMovimentacao(null);
      setQtde('');
      setPlaca('');
      setObs('');
      fetchMateriais(); // fallback in case realtime fails
    } catch (error: any) {
      toast.error('Erro ao registrar', { id: loadToast });
    }
  }

  async function handleCadastro(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;

    const estoqueMinNum = parseFloat(estoqueMin) || 0;
    const loadToast = toast.loading('Salvando...');

    try {
      if (editMaterial) {
        const { error } = await supabase.from('materiais').update({
          nome: nome.trim(),
          unidade,
          estoque_minimo: estoqueMinNum
        }).eq('id', editMaterial.id);
        if (error) throw error;
        toast.success('Atualizado!', { id: loadToast });
      } else {
        const { error } = await supabase.from('materiais').insert([{
          nome: nome.trim(),
          unidade,
          estoque_minimo: estoqueMinNum,
          quantidade_atual: 0
        }]);
        if (error) throw error;
        toast.success('Cadastrado!', { id: loadToast });
      }
      setShowCadastro(false);
      setEditMaterial(null);
      setNome('');
      setEstoqueMin('');
      fetchMateriais();
    } catch (error: any) {
      toast.error('Erro ao salvar', { id: loadToast });
    }
  }

  async function apagarMaterial(id: string) {
    if (!confirm('Deseja realmente apagar este material e todo seu histórico?')) return;
    try {
      await supabase.from('materiais').delete().eq('id', id);
      fetchMateriais();
    } catch {
      toast.error('Erro ao apagar');
    }
  }

  function openEdit(m: Material) {
    setEditMaterial(m);
    setNome(m.nome);
    setUnidade(m.unidade);
    setEstoqueMin(m.estoque_minimo.toString());
    setShowCadastro(true);
  }

  const filtered = materiais.filter(m => m.nome.toLowerCase().includes(busca.toLowerCase()));

  return (
    <div className={`min-h-screen bg-gray-50 ${isAdmin ? '' : 'p-4 sm:p-6'}`}>
      <div className={`max-w-4xl mx-auto ${isAdmin ? 'pb-24' : ''}`}>
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
              <ArchiveBoxIcon className="w-8 h-8 text-[#0b7336]" />
              {isAdmin ? 'Gerenciamento de Materiais' : 'Controle de Materiais'}
            </h1>
            {!isAdmin && <p className="text-sm text-gray-500 mt-1">Registre entradas e saídas de estoque</p>}
          </div>
          
          {isAdmin && (
            <button
              onClick={() => { setEditMaterial(null); setNome(''); setEstoqueMin(''); setShowCadastro(true); }}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-[#0b7336] text-white font-bold rounded-xl shadow-lg hover:bg-[#09602c] active:scale-95 transition-all"
            >
              <PlusIcon className="w-5 h-5" />
              Novo Material
            </button>
          )}
        </div>

        {/* Busca */}
        <div className="relative mb-6">
          <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar material..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="w-full pl-12 pr-4 py-4 rounded-2xl border border-gray-200 bg-white shadow-sm focus:border-[#0b7336] focus:ring-1 focus:ring-[#0b7336] outline-none text-gray-700"
          />
        </div>

        {/* Lista */}
        {loading ? (
          <div className="flex justify-center p-12"><div className="animate-spin w-8 h-8 border-4 border-[#0b7336] border-t-transparent rounded-full" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center p-12 bg-white rounded-3xl border border-dashed border-gray-200">
            <ArchiveBoxIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Nenhum material encontrado.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filtered.map(m => {
              const baixoEstoque = m.quantidade_atual <= m.estoque_minimo;
              return (
                <div key={m.id} className={`bg-white rounded-3xl p-5 border-2 shadow-sm transition-all ${baixoEstoque ? 'border-red-400 bg-red-50/30' : 'border-gray-100'}`}>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-black text-gray-900 leading-tight">{m.nome}</h3>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">Mínimo: {m.estoque_minimo} {m.unidade}</p>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(m)} className="p-2 text-gray-400 hover:text-blue-500 bg-gray-50 hover:bg-blue-50 rounded-full transition-colors"><PencilIcon className="w-4 h-4" /></button>
                        <button onClick={() => apagarMaterial(m.id)} className="p-2 text-gray-400 hover:text-red-500 bg-gray-50 hover:bg-red-50 rounded-full transition-colors"><TrashIcon className="w-4 h-4" /></button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-end justify-between mb-6">
                    <div>
                      <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Em Estoque</p>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-4xl font-black ${baixoEstoque ? 'text-red-600 animate-pulse' : 'text-[#0b7336]'}`}>
                          {m.quantidade_atual}
                        </span>
                        <span className="text-sm font-bold text-gray-500">{m.unidade}</span>
                      </div>
                      {baixoEstoque && (
                        <p className="text-xs font-bold text-red-500 flex items-center gap-1 mt-1">
                          <ExclamationTriangleIcon className="w-4 h-4" /> Estoque Baixo
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setShowMovimentacao({ id: m.id, tipo: 'entrada', material: m })}
                      className="flex items-center justify-center gap-2 py-3 bg-emerald-50 text-emerald-700 font-black rounded-xl hover:bg-emerald-100 active:scale-95 transition-all"
                    >
                      <PlusIcon className="w-5 h-5" /> ENTRADA
                    </button>
                    <button
                      onClick={() => setShowMovimentacao({ id: m.id, tipo: 'saida', material: m })}
                      className="flex items-center justify-center gap-2 py-3 bg-rose-50 text-rose-700 font-black rounded-xl hover:bg-rose-100 active:scale-95 transition-all disabled:opacity-50"
                      disabled={m.quantidade_atual <= 0}
                    >
                      <MinusIcon className="w-5 h-5" /> SAÍDA
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* Modal Movimentação */}
      {showMovimentacao && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <form onSubmit={handleMovimentacao} className="w-full max-w-md bg-white rounded-[2rem] p-6 sm:p-8 animate-slide-up">
            <div className={`w-16 h-16 rounded-3xl mx-auto flex items-center justify-center mb-6 shadow-xl ${showMovimentacao.tipo === 'entrada' ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-500/30' : 'bg-gradient-to-br from-rose-400 to-rose-600 shadow-rose-500/30'}`}>
              {showMovimentacao.tipo === 'entrada' ? <PlusIcon className="w-8 h-8 text-white" /> : <MinusIcon className="w-8 h-8 text-white" />}
            </div>
            
            <h2 className="text-2xl font-black text-center text-gray-900 mb-1">
              Registrar {showMovimentacao.tipo === 'entrada' ? 'Entrada' : 'Saída'}
            </h2>
            <p className="text-center text-gray-500 font-medium mb-8">{showMovimentacao.material.nome}</p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Quantidade ({showMovimentacao.material.unidade})</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  autoFocus
                  value={qtde}
                  onChange={e => setQtde(e.target.value)}
                  className="w-full px-5 py-4 rounded-2xl border-2 border-gray-100 bg-gray-50 focus:border-[#0b7336] focus:bg-white outline-none text-xl font-black text-gray-900 transition-all text-center"
                />
              </div>

              {showMovimentacao.tipo === 'saida' && (
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Placa / Destino (Opcional)</label>
                  <input
                    type="text"
                    value={placa}
                    onChange={e => setPlaca(e.target.value.toUpperCase())}
                    placeholder="Ex: ABC1234"
                    className="w-full px-5 py-4 rounded-2xl border-2 border-gray-100 bg-gray-50 focus:border-rose-400 focus:bg-white outline-none text-gray-900 font-bold uppercase transition-all"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Observações (Opcional)</label>
                <textarea
                  value={obs}
                  onChange={e => setObs(e.target.value)}
                  rows={2}
                  className="w-full px-5 py-4 rounded-2xl border-2 border-gray-100 bg-gray-50 focus:border-[#0b7336] focus:bg-white outline-none text-gray-900 font-medium transition-all resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                type="button"
                onClick={() => setShowMovimentacao(null)}
                className="flex-1 py-4 text-gray-500 font-bold hover:bg-gray-50 rounded-2xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={`flex-1 py-4 text-white font-black rounded-2xl shadow-lg hover:opacity-90 active:scale-95 transition-all uppercase tracking-widest ${showMovimentacao.tipo === 'entrada' ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-rose-500 shadow-rose-500/20'}`}
              >
                Confirmar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Cadastro/Edição (Admin Only) */}
      {isAdmin && showCadastro && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <form onSubmit={handleCadastro} className="w-full max-w-md bg-white rounded-[2rem] p-6 sm:p-8 animate-slide-up">
            <h2 className="text-2xl font-black text-gray-900 mb-6">
              {editMaterial ? 'Editar Material' : 'Novo Material'}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Nome do Material</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  className="w-full px-5 py-4 rounded-2xl border-2 border-gray-100 bg-gray-50 focus:border-[#0b7336] focus:bg-white outline-none text-gray-900 font-bold transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Unidade</label>
                  <select
                    value={unidade}
                    onChange={e => setUnidade(e.target.value)}
                    className="w-full px-5 py-4 rounded-2xl border-2 border-gray-100 bg-gray-50 focus:border-[#0b7336] focus:bg-white outline-none text-gray-900 font-bold transition-all appearance-none cursor-pointer"
                  >
                    <option value="un">Unidade</option>
                    <option value="kg">KG</option>
                    <option value="l">Litros</option>
                    <option value="m">Metros</option>
                    <option value="cx">Caixa</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Estoque Mín.</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={estoqueMin}
                    onChange={e => setEstoqueMin(e.target.value)}
                    className="w-full px-5 py-4 rounded-2xl border-2 border-gray-100 bg-gray-50 focus:border-[#0b7336] focus:bg-white outline-none text-gray-900 font-bold transition-all text-center"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                type="button"
                onClick={() => { setShowCadastro(false); setEditMaterial(null); }}
                className="flex-1 py-4 text-gray-500 font-bold hover:bg-gray-50 rounded-2xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 py-4 bg-[#0b7336] text-white font-black rounded-2xl shadow-lg hover:bg-[#09602c] active:scale-95 transition-all"
              >
                Salvar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
