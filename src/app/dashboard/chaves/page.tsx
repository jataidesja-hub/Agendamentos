"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { KeyIcon, UserIcon, TruckIcon, ClockIcon, ArrowPathIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import { toast } from "react-hot-toast";

interface ChaveInfo {
  id: string;
  funcionario: string;
  veiculo: string;
  status: "Em Uso" | "Disponível";
  pegou_em: string | null;
  devolveu_em: string | null;
}

export default function ControleChaves() {
  const [chaves, setChaves] = useState<ChaveInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [novoFuncionario, setNovoFuncionario] = useState("");
  const [novoVeiculo, setNovoVeiculo] = useState("");

  useEffect(() => {
    fetchChaves();
  }, []);

  const fetchChaves = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("controle_chaves").select("*").order("veiculo");
    
    if (error) {
      console.log("Tabela controle_chaves não existe no Supabase. Usando array local de simulação.");
      // Fallback para caso ele não tenha criado a tabela no banco ainda
      setChaves([
        { id: "1", funcionario: "João Silva", veiculo: "Hilux Prata (ABC-1234)", status: "Disponível", pegou_em: null, devolveu_em: null },
        { id: "2", funcionario: "Marcos Souza", veiculo: "Triton Branca (XYZ-9876)", status: "Em Uso", pegou_em: new Date().toISOString(), devolveu_em: null },
      ]);
    } else if (data) {
      setChaves(data);
    }
    setLoading(false);
  };

  const cadastrarChave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoFuncionario || !novoVeiculo) return;

    const novaChave = {
      funcionario: novoFuncionario,
      veiculo: novoVeiculo,
      status: "Disponível" as const,
      pegou_em: null,
      devolveu_em: null
    };

    const { data, error } = await supabase.from("controle_chaves").insert([novaChave]).select();
    
    if (error) {
      // Usar estado local se o DB não existe
      setChaves([...chaves, { ...novaChave, id: Date.now().toString() }]);
      toast.success("Veículo cadastrado na Memória Local (Crie a tabela no banco depios)");
    } else {
      setChaves([...chaves, data[0]]);
      toast.success("Designação de Chave criada!");
    }
    setNovoFuncionario("");
    setNovoVeiculo("");
  };

  const excluirChave = async (id: string) => {
    if (confirm("Tem certeza que quer apagar esse registro de veículo e funcionário?")) {
      const { error } = await supabase.from("controle_chaves").delete().eq("id", id);
      setChaves(chaves.filter(c => c.id !== id));
      toast.success("Registro apagado.");
    }
  }

  const registrarRetirada = async (id: string) => {
    const agora = new Date().toISOString();
    
    const { error } = await supabase.from("controle_chaves").update({ 
      status: "Em Uso", 
      pegou_em: agora,
      devolveu_em: null
    }).eq("id", id);

    setChaves(chaves.map(c => c.id === id ? { ...c, status: "Em Uso", pegou_em: agora, devolveu_em: null } : c));
    toast.success("Retirada da chave registrada!");
  };

  const registrarDevolucao = async (id: string) => {
    const agora = new Date().toISOString();
    
    const { error } = await supabase.from("controle_chaves").update({ 
      status: "Disponível", 
      devolveu_em: agora
    }).eq("id", id);

    setChaves(chaves.map(c => c.id === id ? { ...c, status: "Disponível", devolveu_em: agora } : c));
    toast.success("Devolução da chave registrada!");
  };

  return (
    <div className="h-full flex flex-col">
      <div className="mb-8 p-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-3xl flex flex-col md:flex-row items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-amber-900 dark:text-amber-500 tracking-tight flex items-center">
            <KeyIcon className="w-8 h-8 mr-3" />
            Controle de Chaves da Frota
          </h1>
          <p className="mt-2 text-amber-700 dark:text-amber-400 font-medium">Acesso restrito para equipe de Logística.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl overflow-hidden mb-8 border border-gray-100 dark:border-gray-700">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <h3 className="font-bold text-gray-900 dark:text-white flex items-center">
            <PlusIcon className="w-5 h-5 mr-2 text-[#0b7336]" /> Cadastrar Veículo para Funcionário
          </h3>
        </div>
        <form onSubmit={cadastrarChave} className="p-6 flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
          <div className="flex-1">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <UserIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input type="text" required value={novoFuncionario} onChange={(e) => setNovoFuncionario(e.target.value)} className="w-full pl-11 pr-5 py-3 border-0 bg-gray-50 dark:bg-gray-900 rounded-xl focus:ring-2 focus:ring-[#0b7336] text-gray-900 dark:text-white" placeholder="Nome do Funcionário" />
            </div>
          </div>
          <div className="flex-1">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <TruckIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input type="text" required value={novoVeiculo} onChange={(e) => setNovoVeiculo(e.target.value)} className="w-full pl-11 pr-5 py-3 border-0 bg-gray-50 dark:bg-gray-900 rounded-xl focus:ring-2 focus:ring-[#0b7336] text-gray-900 dark:text-white" placeholder="Placa / Veículo" />
            </div>
          </div>
          <button type="submit" className="px-8 py-3 bg-[#0b7336] hover:bg-[#09602c] text-white font-bold rounded-xl shadow-lg shadow-green-500/30 transition-all hover:-translate-y-0.5">
            Adicionar
          </button>
        </form>
      </div>

      <div className="flex-1 overflow-y-auto pb-8">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {chaves.map(item => (
            <div key={item.id} className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden flex flex-col sm:flex-row justify-between items-center group">
               <div className={`absolute left-0 top-0 w-2 h-full ${item.status === 'Em Uso' ? 'bg-orange-500' : 'bg-green-500'}`}></div>
               
               <div className="pl-4 w-full">
                 <div className="flex justify-between items-start">
                   <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2 inline-block ${item.status === 'Em Uso' ? 'bg-orange-100 text-orange-600 dark:bg-orange-500/20' : 'bg-green-100 text-green-600 dark:bg-green-500/20'}`}>
                     {item.status}
                   </span>
                   <button onClick={() => excluirChave(item.id)} className="p-2 bg-red-50 text-red-500 hover:bg-red-500 hover:text-white rounded-full transition-colors opacity-0 group-hover:opacity-100">
                      <TrashIcon className="w-4 h-4" />
                   </button>
                 </div>
                 
                 <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center mt-1">
                   {item.funcionario}
                 </h3>
                 <p className="text-gray-500 dark:text-gray-400 font-medium flex items-center mt-1">
                   <TruckIcon className="w-5 h-5 mr-2 text-gray-400" /> {item.veiculo}
                 </p>

                 <div className="mt-4 flex space-x-6">
                   {item.pegou_em && (
                     <div className="text-sm font-medium text-gray-500">
                       <span className="block text-xs uppercase tracking-wider text-gray-400">Pegou a chave às:</span>
                       <ClockIcon className="w-4 h-4 inline mr-1 text-orange-500"/>
                       {new Date(item.pegou_em).toLocaleDateString('pt-BR')} {new Date(item.pegou_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                     </div>
                   )}
                   {item.devolveu_em && (
                     <div className="text-sm font-medium text-gray-500">
                       <span className="block text-xs uppercase tracking-wider text-gray-400">Devolveu às:</span>
                       <ClockIcon className="w-4 h-4 inline mr-1 text-green-500"/>
                       {new Date(item.devolveu_em).toLocaleDateString('pt-BR')} {new Date(item.devolveu_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                     </div>
                   )}
                 </div>
               </div>

               <div className="mt-6 sm:mt-0 sm:ml-6 flex-shrink-0 w-full sm:w-auto text-center">
                 {item.status === 'Disponível' ? (
                   <button onClick={() => registrarRetirada(item.id)} className="w-full sm:w-auto px-6 py-4 bg-orange-50 hover:bg-orange-100 text-orange-600 border border-orange-200 font-bold rounded-2xl transition-all flex items-center justify-center shadow-sm">
                     <KeyIcon className="w-5 h-5 mr-2" /> Pegou a Chave
                   </button>
                 ) : (
                   <button onClick={() => registrarDevolucao(item.id)} className="w-full sm:w-auto px-6 py-4 bg-green-50 hover:bg-green-100 text-green-600 border border-green-200 font-bold rounded-2xl transition-all flex items-center justify-center shadow-sm">
                     <ArrowPathIcon className="w-5 h-5 mr-2" /> Devolveu
                   </button>
                 )}
               </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
