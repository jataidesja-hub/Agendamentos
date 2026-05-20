"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { UserGroupIcon, PlusIcon, PencilIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [projetosDisponiveis, setProjetosDisponiveis] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Form states
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [telas, setTelas] = useState<string[]>([]);
  const [projetos, setProjetos] = useState<string[]>([]);
  const [master, setMaster] = useState(false);
  const [abasRelatorio, setAbasRelatorio] = useState<string[]>(['projetos', 'postos', 'gestores', 'mapa']);

  const telasDisponiveis = [
    { id: 'agenda', nome: 'Agenda/Agendamentos' },
    { id: 'tarefas', nome: 'Lista de Tarefas' },
    { id: 'alertas', nome: 'Alertas' },
    { id: 'relatorios', nome: 'Relatórios/Mapa' },
    { id: 'configuracoes', nome: 'Configurações' },
    { id: 'chaves', nome: 'Controle de Chaves' },
    { id: 'perfis', nome: 'Perfis (Admin)' },
    { id: 'veiculos', nome: 'Veículos' },
    { id: 'projetos', nome: 'Projetos/Fazendas' },
    { id: 'abastecimentos', nome: 'Abastecimentos' },
    { id: 'sustentabilidade', nome: 'Sustentabilidade/Ambiente' },
    { id: 'manutencao', nome: 'Manutenção' },
    { id: 'compras', nome: 'Gestão de Compras' },
    { id: 'checklist', nome: 'Checklist Veículos' },
    { id: 'km', nome: 'Relatório de KM' },
    { id: 'cot', nome: 'COT – Tarefas' },
    { id: 'gestao-eventos', nome: 'Gestão de Eventos' },
  ];

  useEffect(() => {
    fetchUsuarios();
    fetchProjetos();
  }, []);

  async function fetchProjetos() {
    const { data } = await supabase
      .from('frota_veiculos')
      .select('projeto')
      .not('projeto', 'is', null)
      .neq('projeto', '');
    if (data) {
      const unicos = Array.from(new Set(data.map((d: any) => String(d.projeto).trim()).filter(Boolean))).sort();
      setProjetosDisponiveis(unicos as string[]);
    }
  }

  async function fetchUsuarios() {
    try {
      const { data, error } = await supabase.from('perfis_acesso').select('*');
      if (error) {
        console.warn('Tabela perfis_acesso talvez não exista', error);
        setUsuarios([]);
      } else {
        setUsuarios(data || []);
      }
    } catch {
      toast.error('Erro ao carregar perfis');
    } finally {
      setLoading(false);
    }
  }

  const toggleTela = (id: string) =>
    setTelas(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);

  const toggleProjeto = (p: string) =>
    setProjetos(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

  const toggleAba = (a: string) =>
    setAbasRelatorio(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        email,
        telas_acesso: telas,
        projetos_acesso: master ? [] : projetos,
        master,
        abas_relatorio: abasRelatorio,
      };

      if (editId) {
        const { error } = await supabase.from('perfis_acesso').update(payload).eq('id', editId);
        if (error) { toast.error('Erro ao salvar: ' + error.message); return; }
        toast.success('Perfil atualizado!');
      } else {
        const { error: authError } = await supabase.auth.signUp({ email, password: senha });
        if (authError) toast.error('Erro na autenticação: ' + authError.message);

        const { error } = await supabase.from('perfis_acesso').insert(payload);
        if (error) { toast.error('Erro ao criar: ' + error.message); return; }
        toast.success('Perfil criado!');
      }
      setShowForm(false);
      fetchUsuarios();
      resetForm();
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + (err?.message || err));
    }
  };

  const resetForm = () => {
    setEmail(''); setSenha(''); setTelas([]); setProjetos([]); setMaster(false);
    setAbasRelatorio(['projetos', 'postos', 'gestores', 'mapa']); setEditId(null);
  };

  const handleEdit = (u: any) => {
    setEditId(u.id);
    setEmail(u.email);
    setSenha('');
    setTelas(u.telas_acesso || []);
    setProjetos(u.projetos_acesso || []);
    setMaster(u.master || false);
    setAbasRelatorio(u.abas_relatorio || ['projetos', 'postos', 'gestores', 'mapa']);
    setShowForm(true);
  };

  if (loading) return <div className="p-8 text-center text-gray-500 animate-pulse font-bold">Carregando perfis...</div>;

  return (
    <div className="p-4 md:p-8 w-full max-w-6xl mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-[#0b7336] to-[#298d4a] rounded-xl shadow-lg">
            <UserGroupIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Gerenciamento de Perfis</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Controle os usuários, senhas, telas e projetos de acesso</p>
          </div>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(!showForm); }}
          className="flex items-center gap-2 bg-[#0b7336] hover:bg-[#298d4a] text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg hover:scale-105 active:scale-95"
        >
          {showForm ? 'Cancelar' : <><PlusIcon className="w-5 h-5" /> Novo Perfil</>}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border border-gray-100 dark:border-gray-700/50 rounded-3xl p-6 md:p-8 shadow-xl animate-in slide-in-from-top-4 duration-300">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-6">
            {editId ? 'Editar Perfil' : 'Criar Novo Perfil'}
          </h2>

          {/* Email + Senha */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-gray-400 uppercase ml-1">E-mail</label>
              <input
                type="email" required
                value={email} onChange={e => setEmail(e.target.value)}
                className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#0b7336] outline-none text-gray-900 dark:text-white"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-gray-400 uppercase ml-1">{editId ? 'Nova Senha (opcional)' : 'Senha'}</label>
              <input
                type="password" required={!editId}
                value={senha} onChange={e => setSenha(e.target.value)}
                className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#0b7336] outline-none text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {/* Telas */}
          <div className="mb-8">
            <label className="text-xs font-bold text-gray-400 uppercase ml-1 block mb-4">Permissões de Telas</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {telasDisponiveis.map(t => (
                <label key={t.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  telas.includes(t.id) ? 'border-[#0b7336] bg-green-50 dark:bg-[#0b7336]/10' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}>
                  <input type="checkbox" checked={telas.includes(t.id)} onChange={() => toggleTela(t.id)} className="w-4 h-4 text-[#0b7336] rounded focus:ring-[#0b7336]" />
                  <span className={`text-sm font-semibold ${telas.includes(t.id) ? 'text-[#0b7336] dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>{t.nome}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Abas do Relatório */}
          {telas.includes('relatorios') && (
            <div className="mb-8">
              <label className="text-xs font-bold text-gray-400 uppercase ml-1 block mb-4">Abas visíveis em Relatórios</label>
              <div className="flex flex-wrap gap-3">
                {[
                  { id: 'projetos', nome: 'Projetos', cor: 'border-[#0b7336] bg-green-50 dark:bg-[#0b7336]/10 text-[#0b7336] dark:text-green-400' },
                  { id: 'postos', nome: 'Postos', cor: 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' },
                  { id: 'gestores', nome: 'Gestores', cor: 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400' },
                  { id: 'mapa', nome: 'Mapa', cor: 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400' },
                ].map(a => (
                  <label key={a.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${
                    abasRelatorio.includes(a.id) ? a.cor : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}>
                    <input type="checkbox" checked={abasRelatorio.includes(a.id)} onChange={() => toggleAba(a.id)} className="w-4 h-4 rounded" />
                    <span className="text-sm font-black uppercase tracking-wider">{a.nome}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Projetos */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <label className="text-xs font-bold text-gray-400 uppercase ml-1">Acesso a Projetos (Relatórios)</label>
              {/* Toggle Master */}
              <label className={`flex items-center gap-2 px-4 py-2 rounded-xl border cursor-pointer transition-all select-none ${
                master ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400' : 'border-gray-200 dark:border-gray-700 text-gray-500'
              }`}>
                <input type="checkbox" checked={master} onChange={e => setMaster(e.target.checked)} className="w-4 h-4 rounded" />
                <ShieldCheckIcon className="w-4 h-4" />
                <span className="text-xs font-black uppercase tracking-wider">Master — todos os projetos</span>
              </label>
            </div>

            {master ? (
              <p className="text-sm text-amber-600 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-900/20 rounded-xl px-4 py-3">
                Perfil Master visualiza todos os projetos automaticamente.
              </p>
            ) : projetosDisponiveis.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Nenhum projeto encontrado na frota de veículos.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
                {projetosDisponiveis.map(p => (
                  <label key={p} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    projetos.includes(p) ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}>
                    <input type="checkbox" checked={projetos.includes(p)} onChange={() => toggleProjeto(p)} className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500" />
                    <span className={`text-xs font-bold truncate ${projetos.includes(p) ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}>{p}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button type="submit" className="bg-[#0b7336] text-white px-8 py-3 rounded-xl font-bold hover:bg-[#298d4a] transition-all shadow-lg active:scale-95">
              Salvar Perfil
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {usuarios.map(u => (
          <div key={u.id} className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/40 dark:border-gray-700/50 rounded-3xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#0b7336]/10 to-transparent rounded-bl-full -z-10" />
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-xl font-black text-gray-800 dark:text-white truncate flex-1">{u.email}</h3>
              {u.master && (
                <span className="ml-2 shrink-0 flex items-center gap-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[9px] font-black uppercase px-2 py-1 rounded-full">
                  <ShieldCheckIcon className="w-3 h-3" /> Master
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="text-xs text-gray-500 font-semibold bg-gray-100 dark:bg-gray-900 px-3 py-1 rounded-full uppercase tracking-wider">
                {u.telas_acesso ? u.telas_acesso.length : 0} telas
              </span>
              <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-full uppercase tracking-wider">
                {u.master ? 'Todos os projetos' : `${(u.projetos_acesso || []).length} projetos`}
              </span>
            </div>
            <button onClick={() => handleEdit(u)} className="w-full flex items-center justify-center gap-2 bg-gray-100/80 dark:bg-gray-700/80 hover:bg-white dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 py-2 rounded-xl text-sm font-bold transition-all shadow-sm">
              <PencilIcon className="w-4 h-4" /> Editar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
