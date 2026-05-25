"use client";

import { useState, useEffect } from "react";
import { PlusIcon, XMarkIcon, CheckCircleIcon, CalendarIcon, PencilIcon, ClockIcon, TrashIcon, EnvelopeIcon } from "@heroicons/react/24/outline";
import { supabase } from "@/lib/supabase";
import { toast } from "react-hot-toast";
import { User } from "@supabase/supabase-js";

interface ChecklistItem {
  texto: string;
  concluido: boolean;
  status: "Pendente" | "Andamento" | "Concluido";
  prioridade: "Baixa" | "Média" | "Alta";
  prazo?: string;
}

interface PlanoAcao {
  id: string;
  nome: string;
  descricao: string;
  prazo?: string;
  horaOpcional?: string;
  prioridade?: "Baixa" | "Média" | "Alta";
  status: "Pendente" | "Concluído";
  checklist?: ChecklistItem[];
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
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [novoItemTexto, setNovoItemTexto] = useState("");
  const [novoItemPrioridade, setNovoItemPrioridade] = useState<"Baixa" | "Média" | "Alta">("Média");
  const [novoItemPrazo, setNovoItemPrazo] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Notas Pessoais
  const [notaPessoal, setNotaPessoal] = useState("");
  const [salvandoNota, setSalvandoNota] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        fetchPlanos(session.user.id);
        fetchNotaPessoal(session.user.id);
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

  const fetchNotaPessoal = async (userId: string) => {
    const { data, error } = await supabase.from("notas_pessoais").select("texto").eq("user_id", userId).single();
    if (data) setNotaPessoal(data.texto || "");
  };

  const handleNotaChange = (val: string) => {
    setNotaPessoal(val);
    if (typingTimeout) clearTimeout(typingTimeout);
    setSalvandoNota(true);
    setTypingTimeout(setTimeout(async () => {
      if (user) {
        await supabase.from("notas_pessoais").upsert({ user_id: user.id, texto: val, updated_at: new Date().toISOString() });
      }
      setSalvandoNota(false);
    }, 1000));
  };

  const enviarNotificacaoEmail = async (nomePlano: string, acao: 'Criado' | 'Atualizado') => {
    if (!userEmail) return;
    
    try {
      await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: userEmail,
          subject: `[CYMI] Anotação ${acao}: ${nomePlano}`,
          html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
              <h2 style="color: #0b7336;">Anotação ${acao}</h2>
              <p>Uma nota de reunião foi ${acao.toLowerCase()} no sistema.</p>
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

  const abrirOutlook = (item?: PlanoAcao) => {
    const itens = item ? [item] : planos;
    if (itens.length === 0) {
      toast.error("Nenhum dado para enviar.");
      return;
    }

    const subject = encodeURIComponent(`${item ? '👉 Detalhes da Nota' : '📋 Notas & Tarefas'} - CYMI`);
    
    let bodyText = `Olá,\n\nSegue os detalhes solicitados do sistema CYMI (Notas & Tarefas):\n\n`;
    itens.forEach(i => {
      bodyText += `-----------------------------------\n`;
      bodyText += `ASSUNTO: ${i.nome}\n`;
      bodyText += `DECISÕES: ${i.descricao}\n`;
      if (i.checklist && i.checklist.length > 0) {
        bodyText += `\nLISTA DE TAREFAS:\n`;
        i.checklist.forEach(c => {
          bodyText += `[${c.status === 'Concluido' ? 'X' : c.status === 'Andamento' ? '/' : ' '}] ${c.texto}`;
          if (c.prazo) bodyText += ` (Prazo: ${new Date(c.prazo + "T00:00:00").toLocaleDateString('pt-BR')})`;
          bodyText += ` - Urgência: ${c.prioridade}\n`;
        });
      }
      if (i.prazo) bodyText += `\nPRAZO GERAL: ${new Date(i.prazo + "T00:00:00").toLocaleDateString('pt-BR')} ${i.horaOpcional || ''}\n`;
    });
    bodyText += `\n-----------------------------------\n`;
    bodyText += `Relatório gerado automaticamente pelo Sistema CYMI O&M.`;

    const mailtoLink = `mailto:${userEmail || ''}?subject=${subject}&body=${encodeURIComponent(bodyText)}`;
    window.location.href = mailtoLink;
  };

  const abrirModalNovo = () => {
    setEditingId(null);
    setNome(""); setDescricao(""); setPrazo(""); setHoraOpcional("");
    setPrioridade("Média");
    setChecklist([]);
    setNovoItemTexto("");
    setNovoItemPrioridade("Média");
    setNovoItemPrazo("");
    setIsModalOpen(true);
  };

  const abrirModalEditar = (plano: PlanoAcao) => {
    setEditingId(plano.id);
    setNome(plano.nome);
    setDescricao(plano.descricao);
    setPrazo(plano.prazo || "");
    setHoraOpcional(plano.horaOpcional || "");
    setPrioridade(plano.prioridade || "Média");
    setChecklist(plano.checklist || []);
    setNovoItemTexto("");
    setNovoItemPrioridade("Média");
    setNovoItemPrazo("");
    setIsModalOpen(true);
  };

  const adicionarItem = () => {
    if (!novoItemTexto.trim()) return;
    const item: ChecklistItem = { 
      texto: novoItemTexto.trim(), 
      concluido: false, 
      status: "Pendente",
      prioridade: novoItemPrioridade,
      prazo: novoItemPrazo || undefined
    };
    setChecklist([...checklist, item]);
    setNovoItemTexto("");
    setNovoItemPrioridade("Média");
    setNovoItemPrazo("");
  };

  const removerItem = (index: number) => {
    setChecklist(checklist.filter((_, i) => i !== index));
  };

  const alternarCheckItem = (index: number, novoStatus?: "Pendente" | "Andamento" | "Concluido") => {
    const list = [...checklist];
    if (novoStatus) {
      list[index].status = novoStatus;
      list[index].concluido = novoStatus === "Concluido";
    } else {
       // Toggle simples
       const s = list[index].status;
       if (s === "Pendente") list[index].status = "Andamento";
       else if (s === "Andamento") { list[index].status = "Concluido"; list[index].concluido = true; }
       else { list[index].status = "Pendente"; list[index].concluido = false; }
    }
    setChecklist(list);
  };

  const salvarPlano = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const payload = { nome, descricao, prazo, horaOpcional, prioridade, checklist };

    if (editingId) {
      const { error } = await supabase
        .from("planos_acao")
        .update(payload)
        .eq("id", editingId);
      
      if (error) {
        toast.error("Erro ao atualizar: " + error.message);
      } else {
        enviarNotificacaoEmail(nome, "Atualizado");
        toast.success("Anotação atualizada!");
        fetchPlanos(user.id);
      }
    } else {
      const { error } = await supabase
        .from("planos_acao")
        .insert([{ ...payload, status: "Pendente", user_id: user.id }]);
      
      if (error) {
        toast.error("Erro ao criar: " + error.message);
      } else {
        enviarNotificacaoEmail(nome, "Criado");
        toast.success("Anotação registrada!");
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
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Notas Pessoais</h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400 font-medium">Anote suas provisões, pensamentos e rascunhos livres.</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-8">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0b7336]"></div>
          </div>
        ) : (
          <div className="flex-1 pb-20 h-full">
            {/* BLOCO DE NOTAS PESSOAIS */}
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-2xl rounded-3xl p-6 border border-white/50 dark:border-gray-700 shadow-[0_10px_40px_rgb(0,0,0,0.06)] flex flex-col h-full min-h-[600px]">
              <div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-gray-700 pb-4">
                <h2 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                  <PencilIcon className="w-5 h-5 text-[#0b7336]" />
                  Bloco de Notas
                </h2>
                {salvandoNota && <span className="text-[10px] uppercase font-bold text-gray-400 animate-pulse bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">Salvando...</span>}
              </div>
              <textarea
                value={notaPessoal}
                onChange={e => handleNotaChange(e.target.value)}
                placeholder="Digite suas anotações livres, pensamentos, rascunhos..."
                className="flex-1 w-full bg-transparent border-none resize-none focus:ring-0 text-lg text-gray-700 dark:text-gray-300 placeholder-gray-400 p-0 leading-relaxed font-medium h-full"
              />
            </div>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
          <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative bg-white dark:bg-gray-800 rounded-[2rem] shadow-2xl overflow-hidden w-full max-w-lg transform transition-all p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black text-gray-900 dark:text-white">
                {editingId ? "Editar Anotação" : "Nova Anotação de Reunião"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full transition-colors text-gray-500">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={salvarPlano} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Assunto / Pauta</label>
                <input
                  type="text" required value={nome} onChange={(e) => setNome(e.target.value)}
                  className="w-full px-5 py-4 border-0 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:ring-2 focus:ring-[#0b7336] text-gray-900 dark:text-white transition-all font-medium"
                  placeholder="Ex: Reunião de Alinhamento Semanal"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Decisões & Tarefas</label>
                <textarea
                  required value={descricao} onChange={(e) => setDescricao(e.target.value)}
                  rows={4}
                  className="w-full px-5 py-4 border-0 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:ring-2 focus:ring-[#0b7336] text-gray-900 dark:text-white transition-all font-medium resize-none"
                  placeholder="Detalhamento das ações decididas, provisões e quem será o responsável..."
                />
              </div>

              <div className="flex space-x-4">
                <div className="flex-1">
                   <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Data de Entrega</label>
                   <input
                     type="date" required value={prazo} onChange={(e) => setPrazo(e.target.value)}
                     className="w-full px-5 py-4 border-0 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:ring-2 focus:ring-[#0b7336] text-gray-900 dark:text-white transition-all font-medium"
                   />
                </div>
                <div className="flex-1">
                   <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Hora Final (Opcional)</label>
                   <input
                     type="time" value={horaOpcional} onChange={(e) => setHoraOpcional(e.target.value)}
                     className="w-full px-5 py-4 border-0 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:ring-2 focus:ring-[#0b7336] text-gray-900 dark:text-white transition-all font-medium"
                   />
                </div>
              </div>

              <div className="pt-2">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">Lista de Tarefas / Checklist</label>
                
                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-3 mb-4">
                  <input
                    type="text"
                    value={novoItemTexto}
                    onChange={(e) => setNovoItemTexto(e.target.value)}
                    className="w-full px-4 py-3 border-0 bg-white dark:bg-gray-800 rounded-xl focus:ring-2 focus:ring-[#0b7336] text-sm text-gray-900 dark:text-white"
                    placeholder="O que precisa ser feito?"
                  />
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="date"
                      value={novoItemPrazo}
                      onChange={(e) => setNovoItemPrazo(e.target.value)}
                      className="flex-1 min-w-[140px] px-3 py-2 border-0 bg-white dark:bg-gray-800 rounded-xl focus:ring-2 focus:ring-[#0b7336] text-xs text-gray-900 dark:text-white"
                    />
                    <select
                      value={novoItemPrioridade}
                      onChange={(e) => setNovoItemPrioridade(e.target.value as any)}
                      className="flex-1 min-w-[140px] px-3 py-2 border-0 bg-white dark:bg-gray-800 rounded-xl focus:ring-2 focus:ring-[#0b7336] text-xs text-gray-900 dark:text-white"
                    >
                      <option value="Baixa">🟢 Baixa</option>
                      <option value="Média">🟡 Média</option>
                      <option value="Alta">🔴 Alta</option>
                    </select>
                    <button
                      type="button"
                      onClick={adicionarItem}
                      className="px-4 py-2 bg-[#0b7336] text-white rounded-xl font-bold text-xs shadow-md transition-transform active:scale-95"
                    >
                      Adicionar
                    </button>
                  </div>
                </div>

                <div className="space-y-2 max-h-[250px] overflow-y-auto no-scrollbar pr-2">
                  {checklist.map((item, idx) => (
                    <div key={idx} className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm relative group">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center">
                          <select
                            value={item.status}
                            onChange={(e) => alternarCheckItem(idx, e.target.value as any)}
                            className="bg-transparent text-[9px] font-black uppercase text-[#0b7336] border-none focus:ring-0 p-0 mr-2"
                          >
                            <option value="Pendente">⏳</option>
                            <option value="Andamento">🚀</option>
                            <option value="Concluido">✅</option>
                          </select>
                          <span className={`text-sm font-semibold ${item.status === 'Concluido' ? 'line-through text-gray-400' : 'text-gray-800 dark:text-gray-200'}`}>
                            {item.texto}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removerItem(idx)}
                          className="p-1 text-gray-300 hover:text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <XMarkIcon className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${
                          item.prioridade === 'Alta' ? 'bg-red-50 text-red-600 border-red-100' :
                          item.prioridade === 'Média' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                          'bg-emerald-50 text-emerald-600 border-emerald-100'
                        }`}>
                          {item.prioridade}
                        </span>
                        {item.prazo && (
                          <span className="text-[8px] font-bold text-gray-400 flex items-center bg-gray-50 dark:bg-gray-900 px-2 py-0.5 rounded-full">
                            <CalendarIcon className="w-2.5 h-2.5 mr-1" />
                            {new Date(item.prazo + "T00:00:00").toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {checklist.length === 0 && (
                    <div className="text-center py-6 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-2xl">
                      <p className="text-xs text-gray-400">Nenhuma tarefa para esta nota.</p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Urgência</label>
                <select
                  value={prioridade} onChange={(e) => setPrioridade(e.target.value as "Baixa" | "Média" | "Alta")}
                  className="w-full px-5 py-4 border-0 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:ring-2 focus:ring-[#0b7336] text-gray-900 dark:text-white transition-all font-medium appearance-none"
                >
                  <option value="Baixa">🟢 Baixa (No prazo)</option>
                  <option value="Média">🟡 Média (Importante)</option>
                  <option value="Alta">🔴 Alta (Crítico/Urgente)</option>
                </select>
              </div>

              <div className="pt-4">
                <button type="submit" className="w-full py-4 bg-[#0b7336] hover:bg-[#09602c] text-white font-bold rounded-2xl shadow-lg shadow-green-500/30 transition-all hover:-translate-y-0.5">
                  {editingId ? "Salvar Alterações" : "Registrar Nota & Tarefas"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
