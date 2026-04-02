"use client";

import { useState, useEffect } from "react";
import { PlusIcon, XMarkIcon, CheckCircleIcon, CalendarIcon, PencilIcon, ClockIcon } from "@heroicons/react/24/outline";
import { supabase } from "@/lib/supabase";

interface PlanoAcao {
  id: string;
  nome: string;
  descricao: string;
  prazo: string;
  horaOpcional?: string;
  status: "Pendente" | "Concluído";
}

export default function ListaTarefas() {
  const [planos, setPlanos] = useState<PlanoAcao[]>([
    {
      id: "1",
      nome: "Substituição do Transformador TP-02",
      descricao: "Realizar o isolamento e troca da peça defeituosa identificada na inspeção.",
      prazo: "2026-04-15",
      status: "Pendente"
    }
  ]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [prazo, setPrazo] = useState("");
  const [horaOpcional, setHoraOpcional] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // Busca o email configurado no perfil
        supabase
          .from("perfis")
          .select("email_notificacao")
          .eq("user_id", session.user.id)
          .single()
          .then(({ data }) => {
            if (data?.email_notificacao) setUserEmail(data.email_notificacao);
            else setUserEmail(session.user.email || null);
          });
      }
    });
  }, []);

  const enviarNotificacaoEmail = async (nomePlano: string, acao: 'Criado' | 'Atualizado') => {
    if (!userEmail) return;
    
    try {
      await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: userEmail,
          subject: `[CYMI] Plano de Ação ${acao}`,
          html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
              <h2 style="color: #0b7336;">Plano de Ação ${acao}</h2>
              <p>O plano de ação <strong>${nomePlano}</strong> foi ${acao.toLowerCase()} no sistema.</p>
              <p><strong>Prazo:</strong> ${prazo.split('-').reverse().join('/')} ${horaOpcional ? `às ${horaOpcional}` : ''}</p>
              <br/>
              <p>Acesse o painel do CYMI O&M para mais detalhes.</p>
            </div>
          `
        })
      });
    } catch(e) {
      console.error("Erro ao enviar email", e);
    }
  };

  const abrirModalNovo = () => {
    setEditingId(null);
    setNome(""); setDescricao(""); setPrazo(""); setHoraOpcional("");
    setIsModalOpen(true);
  };

  const abrirModalEditar = (plano: PlanoAcao) => {
    setEditingId(plano.id);
    setNome(plano.nome);
    setDescricao(plano.descricao);
    setPrazo(plano.prazo);
    setHoraOpcional(plano.horaOpcional || "");
    setIsModalOpen(true);
  };

  const salvarPlano = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      setPlanos(planos.map(p => p.id === editingId ? { ...p, nome, descricao, prazo, horaOpcional } : p));
      enviarNotificacaoEmail(nome, "Atualizado");
      alert("Sucesso! O Plano de Ação foi atualizado e um e-mail real foi enviado.");
    } else {
      const novoPlano: PlanoAcao = {
        id: Date.now().toString(),
        nome,
        descricao,
        prazo,
        horaOpcional,
        status: "Pendente"
      };
      setPlanos([...planos, novoPlano]);
      enviarNotificacaoEmail(nome, "Criado");
      alert("Plano criado! Verifique sua caixa de e-mail (foi enviado um e-mail real).");
    }
    setIsModalOpen(false);
  };

  const alternarStatus = (id: string) => {
    setPlanos(planos.map(plano => {
      if (plano.id === id) {
        return { ...plano, status: plano.status === "Pendente" ? "Concluído" : "Pendente" };
      }
      return plano;
    }));
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Planos de Ação</h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400 font-medium">Acompanhe tarefas e prazos da equipe CYMI.</p>
        </div>
        <button 
          onClick={abrirModalNovo}
          className="group flex items-center px-6 py-3.5 bg-[#0b7336] hover:bg-[#09602c] text-white text-sm font-bold rounded-2xl shadow-lg shadow-green-500/30 transition-all duration-300 hover:shadow-green-500/50 hover:-translate-y-0.5"
        >
          <PlusIcon className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform duration-300" />
          Novo Plano
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-8">
        {planos.length === 0 ? (
           <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-3xl p-12 text-center border border-white/40 shadow-xl flex flex-col items-center justify-center min-h-[300px]">
             <h3 className="text-xl font-bold text-gray-900 dark:text-white">Nenhum plano ativo</h3>
             <p className="mt-2 text-gray-500">Crie seu primeiro plano de ação acima.</p>
           </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {planos.map((plano) => {
               const estaAtrasado = plano.status === 'Pendente' && new Date(plano.prazo) < new Date();
               return (
                <div key={plano.id} className="group bg-white/70 dark:bg-gray-800/70 backdrop-blur-lg rounded-3xl p-6 border border-white/50 dark:border-gray-700/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(11,115,54,0.1)] transition-all duration-300 relative overflow-hidden flex flex-col justify-between">
                  <div className={`absolute left-0 top-0 w-1.5 h-full ${plano.status === 'Concluído' ? 'bg-[#0b7336]' : estaAtrasado ? 'bg-red-500' : 'bg-amber-500'}`}></div>
                  
                  <div>
                    <div className="flex justify-between items-start mb-2 pl-2">
                       <h3 className={`text-xl font-bold leading-tight ${plano.status === 'Concluído' ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-900 dark:text-white'}`}>
                         {plano.nome}
                       </h3>
                     <div className="flex space-x-2">
                       <button onClick={() => abrirModalEditar(plano)} className="p-1.5 rounded-full text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors">
                         <PencilIcon className="w-6 h-6" />
                       </button>
                       <button onClick={() => alternarStatus(plano.id)} className={`p-1.5 rounded-full transition-colors ${plano.status === 'Concluído' ? 'text-[#0b7336] bg-green-50' : 'text-gray-300 hover:text-green-500 hover:bg-green-50'}`}>
                         <CheckCircleIcon className="w-8 h-8" />
                       </button>
                     </div>
                    </div>
                    <p className={`pl-2 text-sm mb-6 ${plano.status === 'Concluído' ? 'text-gray-400' : 'text-gray-600 dark:text-gray-300'}`}>
                      {plano.descricao}
                    </p>
                  </div>
                  
                  <div className="pl-2 pt-4 border-t border-gray-100 dark:border-gray-700/50 flex items-center">
                    <span className={`flex items-center text-sm font-bold px-3 py-1.5 rounded-xl ${plano.status === 'Concluído' ? 'bg-gray-100 text-gray-400' : estaAtrasado ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'}`}>
                      <CalendarIcon className="w-4 h-4 mr-2" />
                      Prazo: {new Date(plano.prazo + "T00:00:00").toLocaleDateString('pt-BR')}
                    </span>
                    {plano.horaOpcional && (
                      <span className="ml-3 flex items-center text-sm font-bold px-3 py-1.5 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400">
                        <ClockIcon className="w-4 h-4 mr-1.5" />
                        {plano.horaOpcional}
                      </span>
                    )}
                  </div>
                </div>
               );
            })}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
          <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative bg-white dark:bg-gray-800 rounded-[2rem] shadow-2xl overflow-hidden w-full max-w-lg transform transition-all p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black text-gray-900 dark:text-white">
                {editingId ? "Editar/Prorrogar Plano" : "Novo Plano de Ação"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full transition-colors text-gray-500">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={salvarPlano} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Nome do Plano</label>
                <input
                  type="text" required value={nome} onChange={(e) => setNome(e.target.value)}
                  className="w-full px-5 py-4 border-0 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:ring-2 focus:ring-[#0b7336] text-gray-900 dark:text-white transition-all font-medium"
                  placeholder="Título resumido do plano"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Descrição / Escopo</label>
                <textarea
                  required value={descricao} onChange={(e) => setDescricao(e.target.value)}
                  rows={3}
                  className="w-full px-5 py-4 border-0 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:ring-2 focus:ring-[#0b7336] text-gray-900 dark:text-white transition-all font-medium resize-none"
                  placeholder="Detalhamento claro das ações tomadas..."
                />
              </div>

              <div className="flex space-x-4">
                <div className="flex-1">
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Data Limite</label>
                  <input
                    type="date" required value={prazo} onChange={(e) => setPrazo(e.target.value)}
                    className="w-full px-5 py-4 border-0 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:ring-2 focus:ring-[#0b7336] text-gray-900 dark:text-white transition-all font-medium"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Hora (Opcional)</label>
                  <input
                    type="time" value={horaOpcional} onChange={(e) => setHoraOpcional(e.target.value)}
                    className="w-full px-5 py-4 border-0 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:ring-2 focus:ring-[#0b7336] text-gray-900 dark:text-white transition-all font-medium"
                  />
                </div>
              </div>

              <div className="pt-4">
                <button type="submit" className="w-full py-4 bg-[#0b7336] hover:bg-[#09602c] text-white font-bold rounded-2xl shadow-lg shadow-green-500/30 transition-all hover:-translate-y-0.5">
                  {editingId ? "Salvar Alterações" : "Adicionar Plano"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
