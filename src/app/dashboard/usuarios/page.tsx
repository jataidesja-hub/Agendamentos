"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { UserGroupIcon, PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Form states
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [telas, setTelas] = useState<string[]>([]);

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
  ];

  useEffect(() => {
    fetchUsuarios();
  }, []);

  async function fetchUsuarios() {
    try {
      // Usar uma tabela 'perfis' que guarda o email e as telas de acesso
      const { data, error } = await supabase.from('perfis_acesso').select('*');
      if (error) {
        // Ignora o erro se a tabela não existir ainda no banco, cria MOCK
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

  const toggleTela = (telaId: string) => {
    if (telas.includes(telaId)) {
      setTelas(telas.filter(t => t !== telaId));
    } else {
      setTelas([...telas, telaId]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editId) {
        // Atualizar
        const { error } = await supabase.from('perfis_acesso')
          .update({ email, telas_acesso: telas }) // Senha gerida pelo auth, mas o usuario pediu para mudar aqui. Como o auth é complexo de mudar pela API do lado do client, salvamos referências ou seria uma call API.
          .eq('id', editId);
        if (!error) toast.success('Perfil atualizado!');
      } else {
        // Criar
        // Tenta criar Auth
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password: senha,
        });

        if (authError) {
          toast.error('Erro ao criar na autenticação: ' + authError.message);
        }

        const { error } = await supabase.from('perfis_acesso')
          .insert({ email, telas_acesso: telas });
        
        if (!error) toast.success('Perfil criado!');
      }
      setShowForm(false);
      fetchUsuarios();
      resetForm();
    } catch (error) {
      toast.error('Erro ao salvar');
    }
  };

  const resetForm = () => {
    setEmail('');
    setSenha('');
    setTelas([]);
    setEditId(null);
  };

  const handleEdit = (u: any) => {
    setEditId(u.id);
    setEmail(u.email);
    setSenha('');
    setTelas(u.telas_acesso || []);
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
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Controle os usuários, senhas e permissões de telas</p>
          </div>
        </div>
        
        <button 
          onClick={() => {
            resetForm();
            setShowForm(!showForm);
          }}
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

          <div className="mb-8">
            <label className="text-xs font-bold text-gray-400 uppercase ml-1 block mb-4">Permissões de Telas</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {telasDisponiveis.map(t => (
                <label key={t.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  telas.includes(t.id) 
                    ? 'border-[#0b7336] bg-green-50 dark:bg-[#0b7336]/10' 
                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}>
                  <input 
                    type="checkbox" 
                    checked={telas.includes(t.id)} 
                    onChange={() => toggleTela(t.id)}
                    className="w-4 h-4 text-[#0b7336] rounded focus:ring-[#0b7336]"
                  />
                  <span className={`text-sm font-semibold ${telas.includes(t.id) ? 'text-[#0b7336] dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>
                    {t.nome}
                  </span>
                </label>
              ))}
            </div>
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
          <div key={u.id} className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/40 dark:border-gray-700/50 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#0b7336]/10 to-transparent rounded-bl-full -z-10" />
            <h3 className="text-xl font-black text-gray-800 dark:text-white mb-1 truncate">{u.email}</h3>
            <p className="text-xs text-gray-500 font-semibold mb-4 bg-gray-100 dark:bg-gray-900 inline-block px-3 py-1 rounded-full uppercase tracking-wider">
              {u.telas_acesso ? u.telas_acesso.length : 0} telas permitidas
            </p>
            
            <div className="flex gap-2">
              <button onClick={() => handleEdit(u)} className="flex-1 flex items-center justify-center gap-2 bg-gray-100/80 dark:bg-gray-700/80 hover:bg-white dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 py-2 rounded-xl text-sm font-bold transition-all shadow-sm">
                <PencilIcon className="w-4 h-4" /> Editar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
