"use client";

import { useEffect, useState, useMemo } from "react";
import { 
  MagnifyingGlassIcon,
  DocumentArrowUpIcon,
  EnvelopeIcon,
  CheckCircleIcon,
  ClockIcon,
  PaperAirplaneIcon,
  ArrowPathIcon,
  TruckIcon
} from "@heroicons/react/24/outline";
import { toast } from "react-hot-toast";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";

interface ManutencaoVeiculo {
  id: string;
  placa: string;
  admins: string;
  emails_admin: string;
  gerentes: string;
  emails_gerente: string;
  status: 'aguardando envio' | 'enviado para email' | 'aguardando aprovação' | 'aprovado';
  servicos: string;
  updated_at: string;
}

export default function ManutencaoPage() {
  const [data, setData] = useState<ManutencaoVeiculo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [plateSearch, setPlateSearch] = useState("");
  const [searchResult, setSearchResult] = useState<ManutencaoVeiculo | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: result, error } = await supabase
        .from('manutencao_veiculos')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setData(result || []);
    } catch (err: any) {
      console.error("Erro ao carregar dados de manutenção:", err);
      toast.error("Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (evt: any) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary' });
        const rawData: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        
        const getV = (row: any, names: string[]) => {
          for (const name of names) {
            const found = Object.keys(row).find(k => k.toUpperCase().trim() === name.toUpperCase().trim());
            if (found) return row[found];
          }
          return "";
        };

        const formatted = rawData.map((row: any) => {
          const rawEmailsAdmin = String(getV(row, ["EMAIL_ADM", "EMAIL ADM", "EMAIL ADMINISTRATIVO"]) || "").trim();
          const rawEmailsGerente = String(getV(row, ["EMAIL_GERENTE", "EMAIL GERENTE", "EMAIL GESTOR", "EMAIL_GERENTE e SERVICOs"]) || "").trim();
          
          // Normaliza emails: troca "/" ou ";" por "," para o mailto funcionar
          const normalizeEmails = (str: string) => str.replace(/[\/;]/g, ',').replace(/\s/g, '');

          return {
            placa: String(getV(row, ["PLACA", "VEICULO"]) || "").trim().toUpperCase(),
            admins: String(getV(row, ["ADM", "ADMINISTRATIVO", "ADMINS"]) || "").trim(),
            emails_admin: normalizeEmails(rawEmailsAdmin),
            gerentes: String(getV(row, ["GERENTE", "GESTOR", "GERENTES"]) || "").trim(),
            emails_gerente: normalizeEmails(rawEmailsGerente),
            status: 'aguardando envio',
            servicos: String(getV(row, ["SERVICOS", "SERVIÇOS", "DESCRICAO"]) || "").trim(),
            updated_at: new Date().toISOString()
          };
        }).filter(item => item.placa !== "");

        if (formatted.length === 0) {
           toast.error("Nenhum dado válido encontrado na planilha.");
           return;
        }

        const confirm = window.confirm(`Deseja importar ${formatted.length} registros de manutenção?`);
        if (!confirm) return;

        // Upsert based on placa
        for (const item of formatted) {
          const { error } = await supabase
            .from('manutencao_veiculos')
            .upsert(item, { onConflict: 'placa' });
          if (error) throw error;
        }

        toast.success("Dados importados com sucesso!");
        loadData();
      } catch (err) { 
        console.error("Erro no processamento do arquivo:", err);
        toast.error("Erro ao processar planilha."); 
      } finally { setLoading(false); }
    };
    reader.readAsBinaryString(file);
  };

  const searchPlate = async () => {
    if (!plateSearch) return;
    setLoading(true);
    try {
      const { data: result, error } = await supabase
        .from('manutencao_veiculos')
        .select('*')
        .eq('placa', plateSearch.toUpperCase().trim())
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (!result) {
        toast.error("Veículo não encontrado na base de contatos.");
        setSearchResult(null);
      } else {
        setSearchResult(result);
      }
    } catch (err) {
      toast.error("Erro na busca.");
    } finally {
      setLoading(false);
    }
  };

  const startMaintenance = async (item: ManutencaoVeiculo) => {
    try {
      const { error } = await supabase
        .from('manutencao_veiculos')
        .update({ 
          status: 'aguardando envio', 
          updated_at: new Date().toISOString() 
        })
        .eq('id', item.id);

      if (error) throw error;
      
      toast.success("Processo de manutenção iniciado!");
      setSearchResult(null);
      setPlateSearch("");
      loadData();
    } catch (err) {
      toast.error("Erro ao iniciar manutenção.");
    }
  };

  const updateStatus = async (id: string, newStatus: ManutencaoVeiculo['status']) => {
    try {
      const { error } = await supabase
        .from('manutencao_veiculos')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      
      setData(prev => prev.map(item => item.id === id ? { ...item, status: newStatus } : item));
      toast.success(`Status atualizado para ${newStatus}`);
    } catch (err) {
      toast.error("Erro ao atualizar status.");
    }
  };

  const finalizeMaintenance = async (id: string) => {
    if (!window.confirm("Deseja finalizar e arquivar este processo de manutenção?")) return;
    try {
      const { error } = await supabase
        .from('manutencao_veiculos')
        .update({ 
          status: null, // Ou 'finalizado'
          updated_at: new Date().toISOString() 
        })
        .eq('id', id);

      if (error) throw error;
      
      toast.success("Manutenção finalizada!");
      loadData();
    } catch (err) {
      toast.error("Erro ao finalizar.");
    }
  };

  const handleSendEmail = (item: ManutencaoVeiculo) => {
    const to = item.emails_admin;
    const cc = item.emails_gerente;
    const subject = `Orçamento - ${item.placa}`;
    
    const now = new Date();
    const hour = now.getHours();
    const saudacao = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

    const body = `${saudacao},

Por favor, solicita-se a assinatura do gestor do projeto no orçamento para que possamos agilizar o reparo do veículo de placa "${item.placa}".

Serviços: ${item.servicos || "N/A"}`;

    const mailtoUrl = `mailto:${to}?cc=${cc}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    window.location.href = mailtoUrl;

    // Atualiza status para 'enviado para email'
    if (item.status === 'aguardando envio') {
      updateStatus(item.id, 'enviado para email');
    }
  };

  const filteredData = useMemo(() => {
    // Apenas processos em andamento (status não nulo e diferente de 'finalizado' se você usar assim)
    const active = data.filter(item => item.status && item.status !== 'finalizado' as any);
    
    if (!searchTerm) return active;
    
    return active.filter(item => 
      item.placa.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.admins.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.gerentes.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [data, searchTerm]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'aguardando envio': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'enviado para email': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'aguardando aprovação': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'aprovado': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'aguardando envio': return <ClockIcon className="w-4 h-4" />;
      case 'enviado para email': return <PaperAirplaneIcon className="w-4 h-4" />;
      case 'aguardando aprovação': return <ClockIcon className="w-4 h-4" />;
      case 'aprovado': return <CheckCircleIcon className="w-4 h-4" />;
      default: return null;
    }
  };

  return (
    <div className="h-full flex flex-col pb-10 px-4 md:px-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 mt-8">
        <div>
          <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter">Manutenção de Frota</h1>
          <p className="text-gray-500 font-medium text-sm mt-1">Gestão de orçamentos e aprovações • {data.length} veículos em manutenção.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={loadData}
            className="p-3 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-2xl border border-gray-100 dark:border-gray-700 hover:bg-gray-50 transition-all shadow-sm"
          >
            <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <label className="flex items-center px-6 py-3 bg-black dark:bg-[#0b7336] text-white rounded-[1.5rem] font-bold text-sm cursor-pointer hover:opacity-90 transition-all shadow-xl">
            <DocumentArrowUpIcon className="w-5 h-5 mr-3" />
            Subir Base Manutenção
            <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6 mb-8 mt-4">
        {/* Nova Seção de Início de Processo */}
        <div className="flex-1 bg-white dark:bg-gray-900 p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-xl">
          <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 block">Iniciar Nova Manutenção</label>
          <div className="flex gap-4">
            <input 
              type="text" 
              placeholder="Digite a placa do veículo..." 
              value={plateSearch}
              onChange={(e) => setPlateSearch(e.target.value.toUpperCase())}
              className="flex-1 px-6 py-4 bg-gray-50 dark:bg-gray-800 border-0 rounded-[1.5rem] text-sm font-bold focus:ring-2 focus:ring-[#0b7336] transition-all"
              onKeyDown={(e) => e.key === 'Enter' && searchPlate()}
            />
            <button 
              onClick={searchPlate}
              className="px-8 py-4 bg-[#0b7336] text-white rounded-[1.5rem] font-bold text-sm hover:scale-105 transition-all shadow-lg active:scale-95 flex items-center gap-2"
            >
              <MagnifyingGlassIcon className="w-5 h-5" />
              Buscar
            </button>
          </div>

          {searchResult && (
            <div className="mt-6 p-6 bg-green-50/50 dark:bg-green-500/10 border border-green-100 dark:border-green-500/20 rounded-[2rem] animate-in slide-in-from-top-4 duration-300">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#0b7336] rounded-xl flex items-center justify-center text-white font-black">
                    {searchResult.placa.substring(0, 3)}
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-gray-900 dark:text-white">{searchResult.placa}</h3>
                    <p className="text-sm text-gray-500 font-medium">ADM: {searchResult.admins} • Gerente: {searchResult.gerentes}</p>
                  </div>
                </div>
                <button 
                  onClick={() => startMaintenance(searchResult)}
                  className="px-6 py-3 bg-[#0b7336] text-white rounded-xl font-bold text-xs hover:bg-[#075a2a] transition-all"
                >
                  Iniciar Processo
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 bg-white dark:bg-gray-900 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-xl overflow-hidden flex flex-col min-h-[400px]">
        <div className="p-6 border-b border-gray-50 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
           <div className="relative w-full max-w-md">
              <MagnifyingGlassIcon className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Filtrar processos ativos..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className="w-full pl-12 pr-4 py-3 bg-white dark:bg-gray-800 border-0 rounded-2xl text-sm shadow-sm focus:ring-2 focus:ring-[#0b7336] transition-all" 
              />
           </div>
           <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
             {filteredData.length} Processos em Aberto
           </div>
        </div>

        <div className="overflow-auto flex-1 custom-scrollbar">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-gray-900 text-white z-10 text-[10px] uppercase font-black tracking-widest">
              <tr>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Placa</th>
                <th className="px-6 py-4">Administrativo</th>
                <th className="px-6 py-4">Gerente</th>
                <th className="px-6 py-4">Serviços</th>
                <th className="px-6 py-4 text-center">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredData.length === 0 && !loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center">
                        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-full mb-4">
                          <ClockIcon className="w-10 h-10 text-gray-200" />
                        </div>
                        <p className="text-gray-400 font-bold">Nenhum processo de manutenção ativo.</p>
                        <p className="text-gray-300 text-sm">Use o campo de busca acima para iniciar um novo.</p>
                      </div>
                  </td>
                </tr>
              ) : (
                filteredData.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <select 
                        value={item.status} 
                        onChange={(e) => updateStatus(item.id, e.target.value as any)}
                        className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-full border transition-all cursor-pointer outline-none ${getStatusColor(item.status)}`}
                      >
                        <option value="aguardando envio">Aguardando Envio</option>
                        <option value="enviado para email">Enviado para Email</option>
                        <option value="aguardando aprovação">Aguardando Aprovação</option>
                        <option value="aprovado">Aprovado</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-[#0b7336]/10 text-[#0b7336] dark:text-green-400 px-3 py-1 rounded-lg font-black text-sm border border-[#0b7336]/20">
                        {item.placa}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-800 dark:text-gray-200 text-xs">{item.admins}</span>
                        <span className="text-[10px] text-gray-400">{item.emails_admin}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-800 dark:text-gray-200 text-xs">{item.gerentes}</span>
                        <span className="text-[10px] text-gray-400">{item.emails_gerente}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[11px] text-gray-600 dark:text-gray-400 line-clamp-2 max-w-xs" title={item.servicos}>
                        {item.servicos || "---"}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-3">
                        {item.status === 'aguardando envio' ? (
                          <button 
                            onClick={() => handleSendEmail(item)}
                            className="flex items-center gap-2 px-4 py-2 bg-[#0b7336] hover:bg-[#075a2a] text-white rounded-xl text-xs font-bold transition-all shadow-md group"
                          >
                            <EnvelopeIcon className="w-4 h-4 group-hover:scale-110 transition-transform" />
                            Enviar Email
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5 text-gray-400">
                            {getStatusIcon(item.status)}
                            <span className="text-[10px] font-bold uppercase">{item.status}</span>
                          </div>
                        )}
                        
                        <button 
                          onClick={() => finalizeMaintenance(item.id)}
                          className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                          title="Finalizar e Arkivar"
                        >
                          <CheckCircleIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
