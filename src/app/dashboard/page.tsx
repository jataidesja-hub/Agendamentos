"use client";

import { useEffect, useState } from "react";
import { PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { supabase } from "@/lib/supabase";

interface Agendamento {
  id: string;
  descricao: string;
  data: string;
  prioridade: "Baixa" | "Média" | "Alta";
  status: "Pendente" | "Em Andamento" | "Concluído" | "Cancelado";
  alerta: boolean;
  data_alerta?: string;
}

export default function Dashboard() {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [descricao, setDescricao] = useState("");
  const [dataAgendamento, setDataAgendamento] = useState("");
  const [prioridade, setPrioridade] = useState<"Baixa" | "Média" | "Alta">("Média");
  const [alerta, setAlerta] = useState(false);

  useEffect(() => {
    fetchAgendamentos();
  }, []);

  const fetchAgendamentos = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("agendamentos")
      .select("*")
      .order("data", { ascending: true });

    if (error) {
      console.error("Erro ao buscar agendamentos:", error);
    } else if (data) {
      setAgendamentos(data);
    }
    setLoading(false);
  };

  const criarAgendamento = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Converte a data para o formato padrão do banco UTC
    const dateISO = new Date(dataAgendamento).toISOString();
    
    const { data, error } = await supabase
      .from("agendamentos")
      .insert([
        { 
          descricao, 
          data: dateISO, 
          prioridade, 
          alerta,
          status: "Pendente" // valor padrão
        }
      ])
      .select();

    if (error) {
      alert("Erro ao criar o agendamento!");
      console.error(error);
    } else if (data) {
      setAgendamentos([...agendamentos, data[0]]);
      setIsModalOpen(false);
      // Limpar form
      setDescricao("");
      setDataAgendamento("");
      setPrioridade("Média");
      setAlerta(false);
    }
  };

  const atualizarStatus = async (id: string, novoStatus: string) => {
    const { error } = await supabase
      .from("agendamentos")
      .update({ status: novoStatus })
      .eq("id", id);
      
    if (!error) {
      fetchAgendamentos();
    }
  };

  const prioridadeColor = (nivel: string) => {
    switch(nivel) {
      case "Alta": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      case "Média": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      case "Baixa": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Visão Geral dos Agendamentos</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Total de {agendamentos.length} agendamentos registrados.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center px-4 py-2 bg-[#0b7336] hover:bg-[#09602c] text-white text-sm font-medium rounded-md shadow-sm transition-colors"
        >
          <PlusIcon className="w-5 h-5 mr-2" />
          Novo Agendamento
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Carregando dados...</div>
        ) : agendamentos.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Nenhum agendamento encontrado. Clique em "Novo Agendamento" para começar.</div>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {agendamentos.map((item) => (
              <li key={item.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <p className="text-sm font-medium text-[#0b7336] dark:text-green-400 truncate flex items-center space-x-2">
                      <span>{item.descricao}</span>
                      {item.alerta && (
                        <span className="bg-red-500 w-2 h-2 rounded-full inline-block" title="Possui alerta programado"></span>
                      )}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Data: {new Date(item.data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2 flex-shrink-0">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${prioridadeColor(item.prioridade)}`}>
                      {item.prioridade}
                    </span>
                    <select
                      value={item.status}
                      onChange={(e) => atualizarStatus(item.id, e.target.value)}
                      className={`text-xs font-semibold rounded-full px-2 py-1 outline-none border cursor-pointer border-transparent ${
                        item.status === 'Concluído' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 border-blue-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 border-gray-200'
                      }`}
                    >
                      <option value="Pendente">Pendente</option>
                      <option value="Em Andamento">Em Andamento</option>
                      <option value="Concluído">Concluído</option>
                      <option value="Cancelado">Cancelado</option>
                    </select>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Modal para Novo Agendamento */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 dark:bg-gray-900 opacity-75 custom-blur"></div>
            </div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full">
              <div className="px-4 pt-5 pb-4 sm:p-6 sm:pb-4 flex justify-between items-center border-b dark:border-gray-700">
                <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100">Registrar Agendamento</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              <form onSubmit={criarAgendamento} className="px-4 pt-4 pb-4 sm:p-6 sm:pb-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Descrição do Serviço / Evento</label>
                  <input
                    type="text"
                    required
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-[#0b7336] focus:border-[#0b7336] sm:text-sm"
                    placeholder="Ex: Manutenção da Subestação A"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Data e Hora</label>
                  <input
                    type="datetime-local"
                    required
                    value={dataAgendamento}
                    onChange={(e) => setDataAgendamento(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-[#0b7336] focus:border-[#0b7336] sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Prioridade</label>
                  <select
                    value={prioridade}
                    onChange={(e) => setPrioridade(e.target.value as "Baixa" | "Média" | "Alta")}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-[#0b7336] focus:border-[#0b7336] sm:text-sm"
                  >
                     <option value="Baixa">Baixa (Rotina/Normal)</option>
                     <option value="Média">Média (Atenção)</option>
                     <option value="Alta">Alta (Crítico/Urgente)</option>
                  </select>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="alerta"
                    checked={alerta}
                    onChange={(e) => setAlerta(e.target.checked)}
                    className="h-4 w-4 text-[#0b7336] focus:ring-[#0b7336] border-gray-300 rounded"
                  />
                  <label htmlFor="alerta" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                    Ativar notificação / Alerta (🔔)
                  </label>
                </div>

                <div className="pt-4 border-t dark:border-gray-700 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#0b7336] border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-[#09602c] focus:outline-none"
                  >
                    Salvar Agendamento
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
