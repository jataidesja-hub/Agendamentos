"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { KeyIcon, UserIcon, TruckIcon, ClockIcon, ArrowPathIcon, PlusIcon, TrashIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { toast } from "react-hot-toast";

interface VeiculoChave {
  id: string;
  identificacao: string; // Ex: Chave 1 - Hilux
  placa: string;
  status: "Em Uso" | "Disponível";
  funcionario_atual: string | null;
  pegou_em: string | null;
}

interface Funcionario {
  id: string;
  nome: string;
}

export default function ControleChaves() {
  const [veiculos, setVeiculos] = useState<VeiculoChave[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  
  // Modals
  const [novaChaveInfo, setNovaChaveInfo] = useState("");
  const [novaPlaca, setNovaPlaca] = useState("");
  const [novoFuncionario, setNovoFuncionario] = useState("");

  const [veiculoParaSaida, setVeiculoParaSaida] = useState<VeiculoChave | null>(null);
  const [funcionarioSelecionado, setFuncionarioSelecionado] = useState("");

  useEffect(() => {
    // Para resolver o problema de apagar quando atualiza, 
    // enquanto o banco na Nuvem (Supabase) não estiver com a tabela pronta, salvamos localmente no navegador:
    const chavesSalvas = localStorage.getItem("cymi_chaves");
    const funcSalvos = localStorage.getItem("cymi_funcionarios");
    
    if (chavesSalvas) setVeiculos(JSON.parse(chavesSalvas));
    if (funcSalvos) setFuncionarios(JSON.parse(funcSalvos));
  }, []);

  // Salvar no localStorage sempre que houver mudanças para não perder ao F5
  useEffect(() => {
    localStorage.setItem("cymi_chaves", JSON.stringify(veiculos));
  }, [veiculos]);

  useEffect(() => {
    localStorage.setItem("cymi_funcionarios", JSON.stringify(funcionarios));
  }, [funcionarios]);

  const cadastrarFuncionario = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoFuncionario) return;
    
    if (funcionarios.find(f => f.nome.toLowerCase() === novoFuncionario.toLowerCase())) {
      toast.error("Funcionário já cadastrado!");
      return;
    }

    setFuncionarios([...funcionarios, { id: Date.now().toString(), nome: novoFuncionario }]);
    setNovoFuncionario("");
    toast.success("Funcionário cadastrado!");
  };

  const excluirFuncionario = (id: string) => {
    if (confirm("Quer remover este funcionário?")) {
      setFuncionarios(funcionarios.filter(f => f.id !== id));
    }
  };

  const cadastrarVeiculo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaChaveInfo || !novaPlaca) return;

    const novaChave: VeiculoChave = {
      id: Date.now().toString(),
      identificacao: novaChaveInfo,
      placa: novaPlaca,
      status: "Disponível",
      funcionario_atual: null,
      pegou_em: null,
    };
    
    setVeiculos([...veiculos, novaChave]);
    setNovaChaveInfo("");
    setNovaPlaca("");
    toast.success("Veículo/Chave adicionado à frota!");
  };

  const excluirVeiculo = (id: string) => {
    if (confirm("Remover permanentemente este veículo da frota?")) {
      setVeiculos(veiculos.filter(v => v.id !== id));
      toast.success("Veículo excluído.");
    }
  };

  const registrarRetirada = (e: React.FormEvent) => {
    e.preventDefault();
    if (!veiculoParaSaida || !funcionarioSelecionado) return;

    const agora = new Date().toISOString();
    
    setVeiculos(veiculos.map(v => 
      v.id === veiculoParaSaida.id 
        ? { ...v, status: "Em Uso", funcionario_atual: funcionarioSelecionado, pegou_em: agora } 
        : v
    ));
    
    setVeiculoParaSaida(null);
    setFuncionarioSelecionado("");
    toast.success(`Chave entregue para ${funcionarioSelecionado}!`);
  };

  const registrarDevolucao = (id: string) => {
    setVeiculos(veiculos.map(v => 
      v.id === id 
        ? { ...v, status: "Disponível", funcionario_atual: null, pegou_em: null } 
        : v
    ));
    toast.success("Chave devolvida à base.");
  };

  return (
    <div className="h-full flex flex-col">
      <div className="mb-8 p-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-3xl flex flex-col md:flex-row items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-amber-900 dark:text-amber-500 tracking-tight flex items-center">
            <KeyIcon className="w-8 h-8 mr-3" />
            Central Logística de Chaves
          </h1>
          <p className="mt-2 text-amber-700 dark:text-amber-400 font-medium">Gestão de frota, chaves e funcionários autorizados.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Painel: Cadastrar Veículos */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700">
          <div className="p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <h3 className="font-bold text-gray-900 dark:text-white flex items-center">
              <TruckIcon className="w-5 h-5 mr-2 text-[#0b7336]" /> Novo Veículo (Chave)
            </h3>
          </div>
          <form onSubmit={cadastrarVeiculo} className="p-5 flex flex-col space-y-3">
            <div className="flex space-x-3">
              <input type="text" required value={novaChaveInfo} onChange={(e) => setNovaChaveInfo(e.target.value)} className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-[#0b7336] text-gray-900 dark:text-white text-sm" placeholder="Ex: Master Branca (Chave 12)" />
              <input type="text" required value={novaPlaca} onChange={(e) => setNovaPlaca(e.target.value)} className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-[#0b7336] text-gray-900 dark:text-white text-sm" placeholder="Placa XYZ-1234" />
            </div>
            <button type="submit" className="w-full py-2.5 bg-[#0b7336] hover:bg-[#09602c] text-white font-bold rounded-xl shadow-lg shadow-green-500/30 transition-all hover:-translate-y-0.5 text-sm">
              Cadastrar Veículo na Frota
            </button>
          </form>
        </div>

        {/* Painel: Cadastrar Funcionários */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700">
          <div className="p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-between items-center">
            <h3 className="font-bold text-gray-900 dark:text-white flex items-center">
              <UserIcon className="w-5 h-5 mr-2 text-blue-500" /> Cadastrar Funcionário
            </h3>
            <span className="text-xs font-bold text-gray-400">{funcionarios.length} cadastrados</span>
          </div>
          <div className="p-5 flex flex-col space-y-3">
            <form onSubmit={cadastrarFuncionario} className="flex space-x-3">
              <input type="text" required value={novoFuncionario} onChange={(e) => setNovoFuncionario(e.target.value)} className="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white text-sm" placeholder="Nome Completo" />
              <button type="submit" className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all hover:-translate-y-0.5 text-sm">
                Add
              </button>
            </form>
            <div className="flex flex-wrap gap-2 mt-2">
              {funcionarios.map(f => (
                <span key={f.id} className="inline-flex items-center px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full text-xs font-medium border border-gray-200 dark:border-gray-700">
                  {f.nome}
                  <button onClick={() => excluirFuncionario(f.id)} className="ml-2 text-gray-400 hover:text-red-500"><XMarkIcon className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <h2 className="text-xl font-black mb-4 dark:text-white">Gerenciamento de Chaves</h2>
      <div className="flex-1 overflow-y-auto pb-8">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {veiculos.length === 0 && (
            <div className="col-span-1 xl:col-span-2 text-center py-12 bg-gray-50 dark:bg-gray-800/30 rounded-3xl border border-dashed border-gray-300 dark:border-gray-700 text-gray-500">
              Nenhum veículo cadastrado na frota. Use o painel acima.
            </div>
          )}
          {veiculos.map(item => (
            <div key={item.id} className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden flex flex-col sm:flex-row justify-between items-center group">
               <div className={`absolute left-0 top-0 w-2 h-full ${item.status === 'Em Uso' ? 'bg-orange-500' : 'bg-[#0b7336]'}`}></div>
               
               <div className="pl-4 w-full">
                 <div className="flex justify-between items-start">
                   <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2 inline-block ${item.status === 'Em Uso' ? 'bg-orange-100 text-orange-600 dark:bg-orange-500/20' : 'bg-green-100 text-green-700 dark:bg-green-500/20'}`}>
                     {item.status}
                   </span>
                   <button onClick={() => excluirVeiculo(item.id)} className="p-2 bg-red-50 text-red-500 hover:bg-red-500 hover:text-white rounded-full transition-colors opacity-0 group-hover:opacity-100">
                      <TrashIcon className="w-4 h-4" />
                   </button>
                 </div>
                 
                 <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center mt-1">
                   <KeyIcon className="w-5 h-5 mr-2 text-gray-400" /> {item.identificacao}
                 </h3>
                 <p className="text-gray-500 dark:text-gray-400 text-sm font-medium flex items-center mt-1 bg-gray-100 dark:bg-gray-900 w-max px-2 py-1 rounded-lg">
                   Placa: {item.placa}
                 </p>

                 <div className="mt-4 flex flex-col space-y-2">
                   {item.status === "Em Uso" && item.funcionario_atual && (
                     <div className="text-sm font-bold text-gray-900 dark:text-gray-200">
                       <UserIcon className="w-4 h-4 inline mr-2 text-blue-500"/>
                       Com: {item.funcionario_atual}
                     </div>
                   )}
                   {item.pegou_em && (
                     <div className="text-xs font-medium text-gray-500">
                       <span className="text-gray-400 uppercase">Saiu às: </span>
                       <ClockIcon className="w-3.5 h-3.5 inline mr-1 text-orange-500"/>
                       {new Date(item.pegou_em).toLocaleDateString('pt-BR')} {new Date(item.pegou_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                     </div>
                   )}
                 </div>
               </div>

               <div className="mt-6 sm:mt-0 sm:ml-6 flex-shrink-0 w-full sm:w-auto text-center">
                 {item.status === 'Disponível' ? (
                   <button 
                    onClick={() => {
                      if (funcionarios.length === 0) return toast.error("Cadastre pelo menos 1 funcionário primeiro!");
                      setVeiculoParaSaida(item);
                    }} 
                    className="w-full sm:w-auto px-6 py-4 bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 font-bold rounded-2xl transition-all flex items-center justify-center shadow-sm"
                   >
                     Entregar Chave <ArrowPathIcon className="w-5 h-5 ml-2" />
                   </button>
                 ) : (
                   <button onClick={() => registrarDevolucao(item.id)} className="w-full sm:w-auto px-6 py-4 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 font-bold rounded-2xl transition-all flex items-center justify-center shadow-sm">
                     <ArrowPathIcon className="w-5 h-5 mr-2" /> Confirmar Devolução
                   </button>
                 )}
               </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal Saída de Chave */}
      {veiculoParaSaida && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-[2rem] shadow-2xl w-full max-w-md p-8 relative">
            <button onClick={() => setVeiculoParaSaida(null)} className="absolute top-6 right-6 p-2 rounded-full text-gray-400 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
              <XMarkIcon className="w-6 h-6" />
            </button>

            <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Entregar Chave</h2>
            <p className="text-gray-500 mb-6">Para quem você está entregando a <strong className="text-gray-900 dark:text-gray-200">{veiculoParaSaida.identificacao}</strong>?</p>

            <form onSubmit={registrarRetirada} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Selecione o Funcionário</label>
                <select 
                  required
                  value={funcionarioSelecionado}
                  onChange={(e) => setFuncionarioSelecionado(e.target.value)}
                  className="w-full px-4 py-4 border-0 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:ring-2 focus:ring-[#0b7336] text-gray-900 dark:text-white transition-all font-bold"
                >
                  <option value="" disabled>Escolha alguém na lista...</option>
                  {funcionarios.map(f => (
                    <option key={f.id} value={f.nome}>{f.nome}</option>
                  ))}
                </select>
              </div>

              <button type="submit" className="w-full flex items-center justify-center py-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl shadow-lg shadow-orange-500/30 transition-all hover:shadow-orange-500/50 hover:-translate-y-0.5">
                <KeyIcon className="w-5 h-5 mr-2" /> Confirmar Retirada
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
