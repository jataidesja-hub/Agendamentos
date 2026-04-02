"use client";

import { useEffect, useState } from "react";
import { PlusIcon, XMarkIcon, ClockIcon, FlagIcon, CalendarDaysIcon, BellIcon, UserIcon, PencilIcon } from "@heroicons/react/24/outline";
import { supabase } from "@/lib/supabase";
import { toast } from "react-hot-toast";
import { User } from "@supabase/supabase-js";

interface Agendamento {
  id: string;
  descricao: string;
  data: string;
  horaOpcional?: string;
  prioridade: "Baixa" | "Média" | "Alta";
  status: "Pendente" | "Em Andamento" | "Concluído" | "Cancelado";
  alerta: boolean;
  user_id: string;
}

export default function Dashboard() {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  const [descricao, setDescricao] = useState("");
  const [dataAgendamento, setDataAgendamento] = useState("");
  const [horaAgendamento, setHoraAgendamento] = useState("");
  const [prioridade, setPrioridade] = useState<"Baixa" | "Média" | "Alta">("Média");
  const [alerta, setAlerta] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        window.location.href = "/";
      } else {
        setUser(session.user);
        fetchAgendamentos(session.user.id);
        
        // Busca email
        supabase.from("perfis").select("email_notificacao").eq("user_id", session.user.id).single().then(({ data }) => {
          if (data?.email_notificacao) setUserEmail(data.email_notificacao);
          else setUserEmail(session.user.email || null);
        });
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        window.location.href = "/";
      } else {
        setUser(session.user);
        fetchAgendamentos(session.user.id);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const fetchAgendamentos = async (userId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("agendamentos")
      .select("*")
      .eq("user_id", userId)
      .order("data", { ascending: true });

    if (!error && data) {
      setAgendamentos(data);
    }
    setLoading(false);
  };

  const abrirModalNovo = () => {
    setEditingId(null);
    setDescricao(""); setDataAgendamento(""); setHoraAgendamento(""); 
    setPrioridade("Média"); setAlerta(false);
    setIsModalOpen(true);
  };

  const abrirModalEditar = (item: Agendamento) => {
    setEditingId(item.id);
    setDescricao(item.descricao);
    setDataAgendamento(item.data.split("T")[0]); // extrai YYYY-MM-DD
    setHoraAgendamento(item.horaOpcional || "");
    setPrioridade(item.prioridade);
    setAlerta(item.alerta);
    setIsModalOpen(true);
  };

  const enviarNotificacaoEmail = async (nomeAgendamento: string, acao: 'Criado' | 'Atualizado') => {
    if (!userEmail) return;
    try {
      await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: userEmail,
          subject: `[CYMI] Agendamento ${acao}`,
          html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
              <h2 style="color: #0b7336;">Agendamento ${acao}</h2>
              <p>O agendamento <strong>${nomeAgendamento}</strong> foi ${acao.toLowerCase()}.</p>
              <p><strong>Data Limite:</strong> ${dataAgendamento.split('-').reverse().join('/')} ${horaAgendamento ? `às ${horaAgendamento}` : ''}</p>
              <p><strong>Prioridade:</strong> ${prioridade}</p>
              <p>Acesse o painel do CYMI O&M para mais detalhes.</p>
            </div>
          `
        })
      });
    } catch(e) {
      console.error(e);
    }
  };

  const gerarEBaixarICS = (nome: string, dataLocal: string, horaLocal: string) => {
    try {
      // Formata: YYYYMMDDTHHMMSS
      const startDay = dataLocal.replace(/-/g, '');
      const defaultTime = "090000";
      const startTime = horaLocal ? horaLocal.replace(":", "") + "00" : defaultTime;
      const startString = startDay + "T" + startTime;
      
      const horaNum = parseInt(startTime.substring(0,2));
      const endHoraStr = (horaNum < 23 ? horaNum + 1 : 23).toString().padStart(2, '0');
      const endTime = endHoraStr + startTime.substring(2);
      const endString = startDay + "T" + endTime;

      const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//CYMI O&M//Agenda//PT
BEGIN:VEVENT
UID:${Date.now()}@cymi.com
DTSTAMP:${startString}Z
DTSTART:${startString}
DTEND:${endString}
SUMMARY:${nome}
DESCRIPTION:Agendamento criado no sistema CYMI O&M
END:VEVENT
END:VCALENDAR`;

      const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = `Agendamento_${nome.replace(/\s+/g, '_')}.ics`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch(err) {
      console.error("Erro gerando ICS", err);
    }
  };

  const salvarAgendamento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    // Armazena a data em ISO no banco para consistência
    const dateISO = new Date(dataAgendamento + "T00:00:00").toISOString();

    const payload = {
      descricao,
      data: dateISO,
      horaOpcional: horaAgendamento,
      prioridade,
      alerta,
      status: "Pendente",
      user_id: user.id
    };

    if (editingId) {
      const { error } = await supabase.from("agendamentos").update(payload).eq("id", editingId);
      if (error) {
        toast.error("Erro ao atualizar: " + error.message);
      } else {
        enviarNotificacaoEmail(descricao, "Atualizado");
        toast.success("Atualizado com sucesso! E-mail enviado.");
        fetchAgendamentos(user.id);
        setIsModalOpen(false);
      }
    } else {
      const { data, error } = await supabase.from("agendamentos").insert([payload]).select();
      if (error) {
        toast.error("Erro ao salvar! Verifique a conexão com o banco.");
      } else if (data) {
        enviarNotificacaoEmail(descricao, "Criado");
        toast.success("Agendamento criado! Seu calendário foi aberto.");
        gerarEBaixarICS(descricao, dataAgendamento, horaAgendamento);
        setAgendamentos([...agendamentos, data[0]]);
        setIsModalOpen(false);
      }
    }
  };

  const atualizarStatus = async (id: string, novoStatus: string) => {
    const { error } = await supabase.from("agendamentos").update({ status: novoStatus }).eq("id", id);
    if (!error && user) fetchAgendamentos(user.id);
  };

  const prioridadeColor = (nivel: string) => {
    switch (nivel) {
      case "Alta": return "bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20";
      case "Média": return "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20";
      case "Baixa": return "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20";
      default: return "bg-gray-50 text-gray-600 border-gray-200";
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "Concluído": return "bg-[#0b7336] text-white";
      case "Em Andamento": return "bg-blue-500 text-white";
      case "Cancelado": return "bg-gray-500 text-white";
      default: return "bg-white text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-200";
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-end mb-8">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <span className="flex items-center px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl text-sm font-bold">
              <UserIcon className="w-4 h-4 mr-2" />
              {user?.email}
            </span>
          </div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Visão Geral</h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400 font-medium">Você tem {agendamentos.length} agendamentos registrados no sistema.</p>
        </div>
        <button
          onClick={abrirModalNovo}
          className="group flex items-center px-6 py-3.5 bg-[#0b7336] hover:bg-[#09602c] text-white text-sm font-bold rounded-2xl shadow-lg shadow-green-500/30 transition-all duration-300 hover:shadow-green-500/50 hover:-translate-y-0.5"
        >
          <PlusIcon className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform duration-300" />
          Novo Agendamento
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-8">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0b7336]"></div>
          </div>
        ) : agendamentos.length === 0 ? (
          <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-3xl p-12 text-center border border-white/40 shadow-xl flex flex-col items-center justify-center min-h-[400px]">
            <CalendarDaysIcon className="w-20 h-20 text-gray-300 mb-6" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Nenhum agendamento ainda</h3>
            <p className="mt-2 text-gray-500">Comece adicionando seu primeiro evento no botão acima.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {agendamentos.map((item) => {
              const data = new Date(item.data);
              return (
                <div key={item.id} className="group bg-white/70 dark:bg-gray-800/70 backdrop-blur-lg rounded-3xl p-6 border border-white/50 dark:border-gray-700/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(11,115,54,0.1)] transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
                  {/* Accent Line */}
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#0b7336] to-[#298d4a] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                  <div className="flex justify-between items-start mb-4">
                    <div className="flex space-x-2 items-center">
                      <span className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-xl border ${prioridadeColor(item.prioridade)}`}>
                        {item.prioridade}
                      </span>
                      {item.alerta && (
                        <span className="flex items-center text-red-500 bg-red-50 dark:bg-red-500/10 px-2.5 py-1 rounded-xl text-xs font-bold">
                          <BellIcon className="w-3.5 h-3.5 mr-1" />
                          Alerta
                        </span>
                      )}
                    </div>
                    <button onClick={() => abrirModalEditar(item)} className="p-1.5 rounded-full text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors">
                      <PencilIcon className="w-5 h-5" />
                    </button>
                  </div>

                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3 leading-tight line-clamp-2 min-h-[3.5rem]">
                    {item.descricao}
                  </h3>

                  <div className="flex items-center text-gray-500 dark:text-gray-400 text-sm font-medium mb-6 bg-gray-50 dark:bg-gray-900/50 px-3 py-2 rounded-xl w-max">
                    <ClockIcon className="w-4 h-4 mr-2 text-[#0b7336]" />
                    {data.toLocaleDateString('pt-BR')} 
                    {item.horaOpcional ? ` às ${item.horaOpcional}` : ""}
                  </div>

                  <div className="pt-4 border-t border-gray-100 dark:border-gray-700/50 flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Status</span>
                    <select
                      value={item.status}
                      onChange={(e) => atualizarStatus(item.id, e.target.value)}
                      className={`text-sm font-bold rounded-xl px-4 py-2 outline-none cursor-pointer transition-colors border shadow-sm ${statusColor(item.status)}`}
                    >
                      <option value="Pendente" className="text-gray-900 bg-white">Pendente</option>
                      <option value="Em Andamento" className="text-gray-900 bg-white">Em Andamento</option>
                      <option value="Concluído" className="text-gray-900 bg-white">Concluído</option>
                      <option value="Cancelado" className="text-gray-900 bg-white">Cancelado</option>
                    </select>
                  </div>
                </div>
              )
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
                {editingId ? "Editar Agendamento" : "Novo Agendamento"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full transition-colors text-gray-500">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={salvarAgendamento} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Qual o serviço ou evento?</label>
                <input
                  type="text" required value={descricao} onChange={(e) => setDescricao(e.target.value)}
                  className="w-full px-5 py-4 border-0 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:ring-2 focus:ring-[#0b7336] text-gray-900 dark:text-white placeholder-gray-400 transition-all font-medium"
                  placeholder="Ex: Manutenção da Subestação A"
                />
              </div>

              <div className="flex space-x-4">
                <div className="flex-1">
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Data Limite / Início</label>
                  <input
                    type="date" required value={dataAgendamento} onChange={(e) => setDataAgendamento(e.target.value)}
                    className="w-full px-5 py-4 border-0 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:ring-2 focus:ring-[#0b7336] text-gray-900 dark:text-white transition-all font-medium"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Hora (Opcional)</label>
                  <input
                    type="time" value={horaAgendamento} onChange={(e) => setHoraAgendamento(e.target.value)}
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

              <div className="bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                <label className="flex items-center cursor-pointer">
                  <div className="relative">
                    <input type="checkbox" className="sr-only" checked={alerta} onChange={(e) => setAlerta(e.target.checked)} />
                    <div className={`block w-14 h-8 rounded-full transition-colors ${alerta ? 'bg-[#0b7336]' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                    <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${alerta ? 'transform translate-x-6' : ''}`}></div>
                  </div>
                  <div className="ml-4">
                    <span className="block text-sm font-bold text-gray-900 dark:text-white">Ativar Alertas</span>
                    <span className="block text-xs font-medium text-gray-500">Notificar equipe sobre este evento</span>
                  </div>
                </label>
              </div>

              <div className="pt-4 flex space-x-4">
                <button type="submit" className="flex-1 py-4 bg-[#0b7336] hover:bg-[#09602c] text-white font-bold rounded-2xl shadow-lg shadow-green-500/30 transition-all hover:shadow-green-500/50 hover:-translate-y-0.5">
                  {editingId ? "Salvar Alterações" : "Criar e Notificar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
