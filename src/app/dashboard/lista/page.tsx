"use client";

import { useState, useEffect } from "react";
import { PlusIcon, XMarkIcon, CheckCircleIcon, CalendarIcon, PencilIcon, ClockIcon, TrashIcon, EnvelopeIcon } from "@heroicons/react/24/outline";
import { supabase } from "@/lib/supabase";
import { toast } from "react-hot-toast";
import { User } from "@supabase/supabase-js";

interface PlanoAcao {
  id: string;
  nome: string;
  descricao: string;
  prazo: string;
  horaOpcional?: string;
  prioridade: "Baixa" | "Média" | "Alta";
  status: "Pendente" | "Concluído";
  user_id?: string;
}

export default function ListaTarefas() {
  const [user, setUser] = useState<User | null>(null);
  const [planos, setPlanos] = useState<PlanoAcao[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [prazo, setPrazo] = useState("");
  const [horaOpcional, setHoraOpcional] = useState("");
  const [prioridade, setPrioridade] = useState<"Baixa" | "Média" | "Alta">("Média");
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        fetchPlanos(session.user.id);
        // Busca email de notificação
        supabase
          .from("perfis")
          .select("email_notificacao")
          .eq("user_id", session.user.id)
          .single()
          .then(({ data }) => {
            if (data?.email_notificacao) setUserEmail(data.email_notificacao);
            else setUserEmail(session.user.email || null);
          });

        // REALTIME: escuta mudanças na tabela planos_acao
        const channel = supabase
          .channel('realtime-planos')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'planos_acao' }, () => {
            fetchPlanos(session.user.id);
          })
          .subscribe();

        return () => { supabase.removeChannel(channel); };
      }
    });
  }, []);

  const fetchPlanos = async (userId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("planos_acao")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    
    if (error) {
      console.error("Erro ao buscar planos:", error.message);
      toast.error("Erro ao carregar planos. Verifique se a tabela 'planos_acao' foi criada no Supabase.");
    } else {
      setPlanos(data || []);
    }
    setLoading(false);
  };

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

  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailDestino, setEmailDestino] = useState("");
  const [itemParaEnviar, setItemParaEnviar] = useState<PlanoAcao | null>(null);

  const enviarDadosPorEmail = async (email: string) => {
    if (!email || (planos.length === 0 && !itemParaEnviar)) {
      toast.error("Nada para enviar ou e-mail inválido.");
      return;
    }

    const toastId = toast.loading("Preparando e-mail...");
    const itensParaEnviar = itemParaEnviar ? [itemParaEnviar] : planos;
    
    try {
      const htmlLista = `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #0b7336; border-bottom: 2px solid #0b7336; padding-bottom: 10px; margin-bottom: 20px;">
            ${itemParaEnviar ? 'Detalhes da Tarefa' : 'Relatório de Planos de Ação'} - CYMI
          </h2>
          <p>Olá, segue os detalhes solicitados do sistema CYMI:</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
            <thead>
              <tr style="background-color: #f8f9fa; text-align: left;">
                <th style="padding: 12px; border: 1px solid #dee2e6;">Tarefa</th>
                <th style="padding: 12px; border: 1px solid #dee2e6;">Prazo</th>
                <th style="padding: 12px; border: 1px solid #dee2e6;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${itensParaEnviar.map(p => `
                <tr>
                  <td style="padding: 12px; border: 1px solid #dee2e6;">
                    <strong>${p.nome}</strong><br/>
                    <small style="color: #666;">${p.descricao}</small>
                  </td>
                  <td style="padding: 12px; border: 1px solid #dee2e6;">${new Date(p.prazo + "T00:00:00").toLocaleDateString('pt-BR')} ${p.horaOpcional || ''}</td>
                  <td style="padding: 12px; border: 1px solid #dee2e6;">${p.status}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <br/>
          <p style="font-size: 11px; color: #999;">Este relatório foi gerado automaticamente pelo Sistema CYMI O&M.</p>
        </div>
      `;

      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: email,
          subject: `${itemParaEnviar ? '👉 Tarefa:' : '📋 Planos de Ação:'} ${itemParaEnviar?.nome || 'CYMI'}`,
          html: htmlLista
        })
      });

      if (res.ok) {
        toast.success("E-mail enviado com sucesso!", { id: toastId });
        setIsEmailModalOpen(false);
        setItemParaEnviar(null);
      } else {
        throw new Error("Falha no envio");
      }
    } catch (e) {
      toast.error("Erro ao enviar e-mail. Verifique os endereços.", { id: toastId });
    }
  };

  const abrirModalNovo = () => {
    setEditingId(null);
    setNome(""); setDescricao(""); setPrazo(""); setHoraOpcional("");
    setPrioridade("Média");
    setIsModalOpen(true);
  };

  const abrirModalEditar = (plano: PlanoAcao) => {
    setEditingId(plano.id);
    setNome(plano.nome);
    setDescricao(plano.descricao);
    setPrazo(plano.prazo);
    setHoraOpcional(plano.horaOpcional || "");
    setPrioridade(plano.prioridade || "Média");
    setIsModalOpen(true);
  };

  const salvarPlano = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (editingId) {
      const { error } = await supabase
        .from("planos_acao")
        .update({ nome, descricao, prazo, horaOpcional, prioridade })
        .eq("id", editingId);
      
      if (error) {
        toast.error("Erro ao atualizar: " + error.message);
      } else {
        enviarNotificacaoEmail(nome, "Atualizado");
        toast.success("Plano atualizado com sucesso!");
        fetchPlanos(user.id);
      }
    } else {
      const { error } = await supabase
        .from("planos_acao")
        .insert([{ nome, descricao, prazo, horaOpcional, prioridade, status: "Pendente", user_id: user.id }]);
      
      if (error) {
        toast.error("Erro ao criar plano: " + error.message);
      } else {
        enviarNotificacaoEmail(nome, "Criado");
        toast.success("Plano criado e equipe notificada!");
        fetchPlanos(user.id);
      }
    }
    setIsModalOpen(false);
  };

  const alternarStatus = async (id: string, statusAtual: string) => {
    const novoStatus = statusAtual === "Pendente" ? "Concluído" : "Pendente";
    const { error } = await supabase
      .from("planos_acao")
      .update({ status: novoStatus })
      .eq("id", id);
    
    if (!error && user) {
      toast.success(novoStatus === "Concluído" ? "Plano concluído!" : "Plano reaberto.");
      fetchPlanos(user.id);
    }
  };

  const excluirPlano = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir este plano permanentemente?")) {
      const { error } = await supabase.from("planos_acao").delete().eq("id", id);
      if (error) {
        toast.error("Erro ao excluir: " + error.message);
      } else {
        toast.success("Plano de Ação excluído!");
        if (user) fetchPlanos(user.id);
      }
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Planos de Ação</h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400 font-medium">Acompanhe tarefas e prazos da equipe CYMI.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              setEmailDestino(userEmail || "");
              setIsEmailModalOpen(true);
            }}
            title="Enviar lista por e-mail"
            className="flex items-center px-5 py-3.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-bold rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-750 transition-all duration-300"
          >
            <EnvelopeIcon className="w-5 h-5 mr-2" />
            Enviar p/ Email
          </button>

          <button 
            onClick={abrirModalNovo}
            className="group flex items-center px-6 py-3.5 bg-[#0b7336] hover:bg-[#09602c] text-white text-sm font-bold rounded-2xl shadow-lg shadow-green-500/30 transition-all duration-300 hover:shadow-green-500/50 hover:-translate-y-0.5"
          >
            <PlusIcon className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform duration-300" />
            Novo Plano
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-8">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0b7336]"></div>
          </div>
        ) : planos.length === 0 ? (
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
                   <div className={`absolute left-0 top-0 w-1.5 h-full ${
                     plano.status === 'Concluído' ? 'bg-[#0b7336]' : 
                     plano.prioridade === 'Alta' ? 'bg-red-500' :
                     plano.prioridade === 'Média' ? 'bg-amber-500' :
                     'bg-emerald-500'
                   }`}></div>
                  
                  <div>
                    <div className="flex justify-between items-start mb-2 pl-2">
                       <h3 className={`text-xl font-bold leading-tight ${plano.status === 'Concluído' ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-900 dark:text-white'}`}>
                         {plano.nome}
                       </h3>
                     <div className="flex space-x-1">
                       <button 
                         onClick={() => {
                           setItemParaEnviar(plano);
                           setEmailDestino(userEmail || "");
                           setIsEmailModalOpen(true);
                         }}
                         className="p-1.5 rounded-full text-gray-400 hover:text-[#0b7336] hover:bg-green-50 transition-colors" 
                         title="Enviar esta tarefa por e-mail"
                       >
                         <EnvelopeIcon className="w-5 h-5" />
                       </button>
                       <button onClick={() => abrirModalEditar(plano)} className="p-1.5 rounded-full text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors" title="Editar">
                         <PencilIcon className="w-6 h-6" />
                       </button>
                       <button onClick={() => alternarStatus(plano.id, plano.status)} className={`p-1.5 rounded-full transition-colors ${plano.status === 'Concluído' ? 'text-[#0b7336] bg-green-50' : 'text-gray-300 hover:text-green-500 hover:bg-green-50'}`} title="Concluir">
                         <CheckCircleIcon className="w-8 h-8" />
                       </button>
                       <button onClick={() => excluirPlano(plano.id)} className="p-1.5 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Excluir">
                         <TrashIcon className="w-6 h-6" />
                       </button>
                     </div>
                    </div>
                    <p className={`pl-2 text-sm mb-6 ${plano.status === 'Concluído' ? 'text-gray-400' : 'text-gray-600 dark:text-gray-300'}`}>
                      {plano.descricao}
                    </p>
                    <div className="pl-2 flex space-x-2 mb-4">
                      <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border ${
                        plano.prioridade === 'Alta' ? 'bg-red-50 text-red-600 border-red-100' :
                        plano.prioridade === 'Média' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                        'bg-emerald-50 text-emerald-600 border-emerald-100'
                      }`}>
                        {plano.prioridade}
                      </span>
                      {estaAtrasado && (
                        <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-red-500 text-white">Atrasado</span>
                      )}
                    </div>
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

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Nível de Prioridade</label>
                <select
                  value={prioridade} onChange={(e) => setPrioridade(e.target.value as "Baixa" | "Média" | "Alta")}
                  className="w-full px-5 py-4 border-0 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:ring-2 focus:ring-[#0b7336] text-gray-900 dark:text-white transition-all font-medium appearance-none"
                >
                  <option value="Baixa">🟢 Baixa (Rotina/Normal)</option>
                  <option value="Média">🟡 Média (Atenção)</option>
                  <option value="Alta">🔴 Alta (Crítico/Urgente)</option>
                </select>
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
      {/* Modal de E-mail Personalizado */}
      {isEmailModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-0">
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md transition-opacity" onClick={() => setIsEmailModalOpen(false)}></div>
          <div className="relative bg-white dark:bg-gray-800 rounded-[2rem] shadow-2xl overflow-hidden w-full max-w-md transform transition-all p-8 border border-white/20">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black text-gray-900 dark:text-white">Relatório de Tarefas</h3>
              <button onClick={() => setIsEmailModalOpen(false)} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-500">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 font-medium leading-relaxed">
              Digite os e-mails de destino. Use <strong>Enter</strong> ou vírgula para separar múltiplos endereços.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">E-mails de Destino</label>
                <div className="relative">
                  <EnvelopeIcon className="absolute left-4 top-4 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    autoFocus
                    value={emailDestino}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (emailDestino && !emailDestino.endsWith(',')) {
                          setEmailDestino(emailDestino + ", ");
                        }
                      }
                    }}
                    onChange={(e) => setEmailDestino(e.target.value)}
                    placeholder="email@cymi.com, outro@cymi.com"
                    className="w-full pl-12 pr-5 py-4 border-0 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:ring-2 focus:ring-[#0b7336] text-gray-900 dark:text-white transition-all font-medium"
                  />
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-2xl border border-amber-100 dark:border-amber-900/30 mb-4">
                <p className="text-[10px] text-amber-700 dark:text-amber-400 font-bold leading-tight">
                  ⚠️ NOTA: Na versão de testes, o serviço (Resend) pode restringir o envio apenas para e-mails autorizados da conta.
                </p>
              </div>

              <button 
                onClick={() => enviarDadosPorEmail(emailDestino)}
                className="w-full py-4 bg-[#0b7336] hover:bg-[#09602c] text-white font-bold rounded-2xl shadow-lg shadow-green-500/30 transition-all hover:shadow-green-500/50 hover:-translate-y-0.5"
              >
                Enviar p/ Emails Agora
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
