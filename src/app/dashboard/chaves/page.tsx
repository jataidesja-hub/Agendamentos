"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { KeyIcon, UserIcon, TruckIcon, ClockIcon, ArrowPathIcon, TrashIcon, XMarkIcon, EyeIcon } from "@heroicons/react/24/outline";
import { toast } from "react-hot-toast";

interface VeiculoChave {
  id: string;
  identificacao: string;
  placa: string;
  status: string;
  funcionario_atual: string | null;
  pegou_em: string | null;
  ultima_devolucao: string | null;
}

interface Funcionario {
  id: string;
  nome: string;
}

interface HistoricoItem {
  id: string;
  veiculo_id: string;
  funcionario: string;
  tipo: string;
  data_hora: string;
}

export default function ControleChaves() {
  const [veiculos, setVeiculos] = useState<VeiculoChave[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [novaChaveInfo, setNovaChaveInfo] = useState("");
  const [novaPlaca, setNovaPlaca] = useState("");
  const [novoFuncionario, setNovoFuncionario] = useState("");

  const [veiculoParaSaida, setVeiculoParaSaida] = useState<VeiculoChave | null>(null);
  const [funcionarioSelecionado, setFuncionarioSelecionado] = useState("");

  // Histórico
  const [historicoAberto, setHistoricoAberto] = useState<string | null>(null);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);

  useEffect(() => {
    fetchVeiculos();
    fetchFuncionarios();

    // REALTIME: escuta mudanças na frota e funcionários
    const channelFrota = supabase
      .channel('realtime-frota')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'frota_veiculos' }, () => {
        fetchVeiculos();
      })
      .subscribe();
    
    const channelFunc = supabase
      .channel('realtime-funcionarios')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'funcionarios' }, () => {
        fetchFuncionarios();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channelFrota);
      supabase.removeChannel(channelFunc);
    };
  }, []);

  const fetchVeiculos = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("frota_veiculos").select("*").order("identificacao");
    if (error) {
      toast.error("Erro ao carregar frota. Verifique se rodou o SQL no Supabase.");
      console.error(error);
    } else {
      setVeiculos(data || []);
    }
    setLoading(false);
  };

  const fetchFuncionarios = async () => {
    const { data, error } = await supabase.from("funcionarios").select("*").order("nome");
    if (error) {
      console.error("Erro ao carregar funcionários:", error.message);
    } else {
      setFuncionarios(data || []);
    }
  };

  const fetchHistorico = async (veiculoId: string) => {
    setLoadingHistorico(true);
    setHistoricoAberto(veiculoId);
    const { data, error } = await supabase
      .from("historico_chaves")
      .select("*")
      .eq("veiculo_id", veiculoId)
      .order("data_hora", { ascending: false });
    
    if (error) {
      toast.error("Erro ao buscar histórico.");
    } else {
      setHistorico(data || []);
    }
    setLoadingHistorico(false);
  };

  const cadastrarFuncionario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoFuncionario) return;
    
    const { data, error } = await supabase.from("funcionarios").insert([{ nome: novoFuncionario }]).select();
    if (error) {
      if (error.message.includes("unique") || error.message.includes("duplicate")) {
        toast.error("Funcionário já cadastrado!");
      } else {
        toast.error("Erro: " + error.message);
      }
    } else {
      setFuncionarios([...funcionarios, data[0]]);
      toast.success("Funcionário cadastrado!");
    }
    setNovoFuncionario("");
  };

  const excluirFuncionario = async (id: string) => {
    if (confirm("Quer remover este funcionário?")) {
      await supabase.from("funcionarios").delete().eq("id", id);
      setFuncionarios(funcionarios.filter(f => f.id !== id));
    }
  };

  const cadastrarVeiculo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaChaveInfo || !novaPlaca) return;

    const { data, error } = await supabase.from("frota_veiculos").insert([{
      identificacao: novaChaveInfo,
      placa: novaPlaca,
      status: "Disponível",
    }]).select();
    
    if (error) {
      toast.error("Erro: " + error.message);
    } else {
      setVeiculos([...veiculos, data[0]]);
      toast.success("Veículo/Chave adicionado à frota!");
    }
    setNovaChaveInfo("");
    setNovaPlaca("");
  };

  const excluirVeiculo = async (id: string) => {
    if (confirm("Remover permanentemente este veículo da frota?")) {
      const { error } = await supabase.from("frota_veiculos").delete().eq("id", id);
      if (error) {
        toast.error("Erro: " + error.message);
      } else {
        setVeiculos(veiculos.filter(v => v.id !== id));
        toast.success("Veículo excluído.");
      }
    }
  };

  const registrarRetirada = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!veiculoParaSaida || !funcionarioSelecionado) return;

    const agora = new Date().toISOString();
    
    // Atualiza o veículo
    const { error } = await supabase.from("frota_veiculos").update({
      status: "Em Uso",
      funcionario_atual: funcionarioSelecionado,
      pegou_em: agora,
    }).eq("id", veiculoParaSaida.id);

    if (error) {
      toast.error("Erro: " + error.message);
      return;
    }

    // Registra no histórico
    await supabase.from("historico_chaves").insert([{
      veiculo_id: veiculoParaSaida.id,
      funcionario: funcionarioSelecionado,
      tipo: "RETIRADA",
      data_hora: agora,
    }]);
    
    toast.success(`Chave entregue para ${funcionarioSelecionado}!`);
    setVeiculoParaSaida(null);
    setFuncionarioSelecionado("");
    fetchVeiculos();
  };

  const registrarDevolucao = async (id: string, funcionarioNome: string) => {
    const agora = new Date().toISOString();

    const { error } = await supabase.from("frota_veiculos").update({
      status: "Disponível",
      funcionario_atual: null,
      pegou_em: null,
      ultima_devolucao: agora,
    }).eq("id", id);

    if (error) {
      toast.error("Erro: " + error.message);
      return;
    }

    // Registra no histórico
    await supabase.from("historico_chaves").insert([{
      veiculo_id: id,
      funcionario: funcionarioNome || "Desconhecido",
      tipo: "DEVOLUCAO",
      data_hora: agora,
    }]);

    toast.success("Chave devolvida à base.");
    fetchVeiculos();
  };

  const formatarDataHora = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR') + " às " + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="mb-8 p-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-3xl">
        <h1 className="text-3xl font-black text-amber-900 dark:text-amber-500 tracking-tight flex items-center">
          <KeyIcon className="w-8 h-8 mr-3" />
          Central Logística de Chaves
        </h1>
        <p className="mt-2 text-amber-700 dark:text-amber-400 font-medium">Gestão de frota, chaves e funcionários autorizados.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Cadastrar Veículos */}
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

        {/* Cadastrar Funcionários */}
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

      <div className="flex-1 overflow-y-auto pb-8">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0b7336]"></div>
          </div>
        ) : (
          <div className="space-y-12">
            {/* Seção: Disponíveis */}
            <section>
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-2 h-8 bg-[#0b7336] rounded-full"></div>
                <h2 className="text-2xl font-black dark:text-white uppercase tracking-tight">Disponíveis</h2>
                <span className="px-3 py-1 bg-green-100 text-[#0b7336] dark:bg-green-500/10 text-xs font-black rounded-xl border border-green-100 dark:border-green-500/20">
                  {veiculos.filter(v => v.status === "Disponível").length}
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {veiculos.filter(v => v.status === "Disponível").length === 0 ? (
                  <div className="col-span-1 md:col-span-2 text-center py-8 bg-gray-50/50 dark:bg-gray-800/30 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700 text-gray-400 text-sm">
                    Nenhum veículo disponível no momento.
                  </div>
                ) : (
                  veiculos.filter(v => v.status === "Disponível").map(item => (
                    <div key={item.id} className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden group">
                      <div className="absolute left-0 top-0 w-2 h-full bg-[#0b7336]"></div>
                      <div className="pl-4">
                        <div className="flex justify-between items-start">
                          <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2 inline-block bg-green-100 text-green-700 dark:bg-green-500/20">
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

                        <div className="mt-4 space-y-2">
                          {item.ultima_devolucao && (
                            <div className="text-xs font-medium text-gray-500">
                              <span className="text-green-600 font-bold">Última devolução: </span>
                              <ClockIcon className="w-3.5 h-3.5 inline mr-1"/>
                              {formatarDataHora(item.ultima_devolucao)}
                            </div>
                          )}
                        </div>

                        <div className="mt-5 flex flex-wrap gap-3">
                          <button 
                            onClick={() => {
                              if (funcionarios.length === 0) return toast.error("Cadastre pelo menos 1 funcionário primeiro!");
                              setVeiculoParaSaida(item);
                            }} 
                            className="px-5 py-3 bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 font-bold rounded-2xl transition-all flex items-center shadow-sm text-sm"
                          >
                            Entregar Chave <ArrowPathIcon className="w-4 h-4 ml-2" />
                          </button>
                          <button onClick={() => fetchHistorico(item.id)} className="px-5 py-3 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 font-bold rounded-2xl transition-all flex items-center shadow-sm text-sm">
                            <EyeIcon className="w-4 h-4 mr-2" /> Ver Histórico
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Seção: Em Uso */}
            <section>
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-2 h-8 bg-orange-500 rounded-full"></div>
                <h2 className="text-2xl font-black dark:text-white uppercase tracking-tight">Em Uso</h2>
                <span className="px-3 py-1 bg-orange-100 text-orange-600 dark:bg-orange-500/10 text-xs font-black rounded-xl border border-orange-100 dark:border-orange-500/20">
                  {veiculos.filter(v => v.status === "Em Uso").length}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {veiculos.filter(v => v.status === "Em Uso").length === 0 ? (
                  <div className="col-span-1 md:col-span-2 text-center py-8 bg-gray-50/50 dark:bg-gray-800/30 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700 text-gray-400 text-sm">
                    Nenhum veículo em uso no momento.
                  </div>
                ) : (
                  veiculos.filter(v => v.status === "Em Uso").map(item => (
                    <div key={item.id} className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden group">
                      <div className="absolute left-0 top-0 w-2 h-full bg-orange-500"></div>
                      <div className="pl-4">
                        <div className="flex justify-between items-start">
                          <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2 inline-block bg-orange-100 text-orange-600 dark:bg-orange-500/20">
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

                        <div className="mt-4 space-y-2">
                          {item.funcionario_atual && (
                            <div className="text-sm font-bold text-gray-900 dark:text-gray-200">
                              <UserIcon className="w-4 h-4 inline mr-2 text-blue-500"/>
                              Com: {item.funcionario_atual}
                            </div>
                          )}
                          {item.pegou_em && (
                            <div className="text-xs font-medium text-gray-500">
                              <span className="text-orange-500 font-bold">Retirou: </span>
                              <ClockIcon className="w-3.5 h-3.5 inline mr-1"/>
                              {formatarDataHora(item.pegou_em)}
                            </div>
                          )}
                        </div>

                        <div className="mt-5 flex flex-wrap gap-3">
                          <button onClick={() => registrarDevolucao(item.id, item.funcionario_atual || "")} className="px-5 py-3 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 font-bold rounded-2xl transition-all flex items-center shadow-sm text-sm">
                            <ArrowPathIcon className="w-4 h-4 mr-2" /> Confirmar Devolução
                          </button>
                          <button onClick={() => fetchHistorico(item.id)} className="px-5 py-3 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 font-bold rounded-2xl transition-all flex items-center shadow-sm text-sm">
                            <EyeIcon className="w-4 h-4 mr-2" /> Ver Histórico
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        )}
      </div>

      {/* Modal Entregar Chave */}
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

      {/* Modal Histórico */}
      {historicoAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-[2rem] shadow-2xl w-full max-w-lg p-8 relative max-h-[80vh] overflow-hidden flex flex-col">
            <button onClick={() => setHistoricoAberto(null)} className="absolute top-6 right-6 p-2 rounded-full text-gray-400 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
              <XMarkIcon className="w-6 h-6" />
            </button>

            <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-1">Histórico da Chave</h2>
            <p className="text-gray-500 mb-6 text-sm">Registro completo de retiradas e devoluções.</p>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              {loadingHistorico ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0b7336]"></div>
                </div>
              ) : historico.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <ClockIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  Nenhum registro encontrado para este veículo.
                </div>
              ) : (
                historico.map((h) => (
                  <div key={h.id} className={`flex items-start p-4 rounded-2xl border ${h.tipo === 'RETIRADA' ? 'bg-orange-50 border-orange-200 dark:bg-orange-500/10 dark:border-orange-500/20' : 'bg-green-50 border-green-200 dark:bg-green-500/10 dark:border-green-500/20'}`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mr-4 ${h.tipo === 'RETIRADA' ? 'bg-orange-200 text-orange-600' : 'bg-green-200 text-green-600'}`}>
                      {h.tipo === 'RETIRADA' ? <KeyIcon className="w-5 h-5" /> : <ArrowPathIcon className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white text-sm">
                        {h.tipo === 'RETIRADA' ? 'Retirada' : 'Devolução'}
                      </p>
                      <p className="text-gray-600 dark:text-gray-300 text-sm">
                        <UserIcon className="w-3.5 h-3.5 inline mr-1" />
                        {h.funcionario}
                      </p>
                      <p className="text-gray-400 text-xs mt-1">
                        <ClockIcon className="w-3 h-3 inline mr-1" />
                        {formatarDataHora(h.data_hora)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
