"use client";

import { useEffect, useState, useMemo } from "react";
import {
  MagnifyingGlassIcon,
  DocumentArrowUpIcon,
  CheckCircleIcon,
  ClockIcon,
  PaperAirplaneIcon,
  ArrowPathIcon,
  WrenchScrewdriverIcon,
  XMarkIcon,
  EnvelopeIcon,
  TruckIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { toast } from "react-hot-toast";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";

// Etapas do processo de manutenção
const ETAPAS = [
  { id: "aguardando_envio", label: "Aguardando Envio", color: "amber", icon: ClockIcon },
  { id: "enviado", label: "Enviado p/ Email", color: "blue", icon: PaperAirplaneIcon },
  { id: "aguardando_aprovacao", label: "Aguardando Aprovação", color: "purple", icon: ClockIcon },
  { id: "aprovado", label: "Aprovado", color: "emerald", icon: CheckCircleIcon },
] as const;

type EtapaId = typeof ETAPAS[number]["id"];

interface ManutencaoVeiculo {
  id: string;
  placa: string;
  admins: string;
  emails_admin: string;
  gerentes: string;
  emails_gerente: string;
  status: string | null;
  servicos: string;
  updated_at: string;
}

const etapaColors: Record<string, { bg: string; border: string; text: string; badge: string; dot: string; headerBg: string }> = {
  aguardando_envio: {
    bg: "bg-amber-50/80 dark:bg-amber-500/5",
    border: "border-amber-200/60 dark:border-amber-500/20",
    text: "text-amber-700 dark:text-amber-400",
    badge: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30",
    dot: "bg-amber-400",
    headerBg: "bg-gradient-to-r from-amber-100/80 to-amber-50/40 dark:from-amber-500/10 dark:to-transparent",
  },
  enviado: {
    bg: "bg-blue-50/80 dark:bg-blue-500/5",
    border: "border-blue-200/60 dark:border-blue-500/20",
    text: "text-blue-700 dark:text-blue-400",
    badge: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30",
    dot: "bg-blue-400",
    headerBg: "bg-gradient-to-r from-blue-100/80 to-blue-50/40 dark:from-blue-500/10 dark:to-transparent",
  },
  aguardando_aprovacao: {
    bg: "bg-purple-50/80 dark:bg-purple-500/5",
    border: "border-purple-200/60 dark:border-purple-500/20",
    text: "text-purple-700 dark:text-purple-400",
    badge: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-500/20 dark:text-purple-400 dark:border-purple-500/30",
    dot: "bg-purple-400",
    headerBg: "bg-gradient-to-r from-purple-100/80 to-purple-50/40 dark:from-purple-500/10 dark:to-transparent",
  },
  aprovado: {
    bg: "bg-emerald-50/80 dark:bg-emerald-500/5",
    border: "border-emerald-200/60 dark:border-emerald-500/20",
    text: "text-emerald-700 dark:text-emerald-400",
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30",
    dot: "bg-emerald-400",
    headerBg: "bg-gradient-to-r from-emerald-100/80 to-emerald-50/40 dark:from-emerald-500/10 dark:to-transparent",
  },
};

export default function ManutencaoPage() {
  const [data, setData] = useState<ManutencaoVeiculo[]>([]);
  const [loading, setLoading] = useState(false);
  const [plateSearch, setPlateSearch] = useState("");
  const [searchResult, setSearchResult] = useState<ManutencaoVeiculo | null>(null);
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [selectedEtapa, setSelectedEtapa] = useState<EtapaId>("aguardando_envio");
  const [servicoText, setServicoText] = useState("");
  const [suggestions, setSuggestions] = useState<ManutencaoVeiculo[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

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

  // Upload da base (vincula placa -> admins/gerentes) — sem mudar o status
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
          const keys = Object.keys(row);
          for (const name of names) {
            const found = keys.find(k => k.toUpperCase().trim() === name.toUpperCase().trim());
            if (found) return row[found];
          }
          if (names.includes("EMAIL_GERENTE")) {
             const found = keys.find(k => k.toUpperCase().includes("EMAIL") && k.toUpperCase().includes("GERENTE"));
             if (found) return row[found];
          }
          if (names.includes("EMAIL_ADM")) {
             const found = keys.find(k => k.toUpperCase().includes("EMAIL") && (k.toUpperCase().includes("ADM") || k.toUpperCase().includes("ADMIN")));
             if (found) return row[found];
          }
          return "";
        };

        const formatted = rawData.map((row: any) => {
          const rawEmailsAdmin = String(getV(row, ["EMAIL_ADM", "EMAIL ADM"]) || "").trim();
          const rawEmailsGerente = String(getV(row, ["EMAIL_GERENTE", "EMAIL_GERENTE e SERVICOs"]) || "").trim();
          
          const normalizeEmails = (str: string) => {
            if (!str || str === "#N/D") return "";
            return str.replace(/[\/;]/g, ',').replace(/\s/g, '').replace(/,$/, '').replace(/^,/, '');
          };

          return {
            placa: String(getV(row, ["PLACA", "VEICULO"]) || "").trim().toUpperCase(),
            admins: String(getV(row, ["ADM", "ADMINISTRATIVO"]) || "").trim(),
            emails_admin: normalizeEmails(rawEmailsAdmin),
            gerentes: String(getV(row, ["GERENTE", "GESTOR"]) || "").trim(),
            emails_gerente: normalizeEmails(rawEmailsGerente),
            servicos: String(getV(row, ["SERVICOS", "SERVIÇOS", "DESCRICAO"]) || "").trim(),
            updated_at: new Date().toISOString()
          };
        }).filter(item => item.placa !== "" && item.placa !== "#N/D");

        if (formatted.length === 0) {
           toast.error("Nenhum dado válido encontrado na planilha.");
           return;
        }

        const confirm = window.confirm(`Deseja importar ${formatted.length} registros para a base de manutenção?`);
        if (!confirm) return;

        for (const item of formatted) {
          const { error } = await supabase
            .from('manutencao_veiculos')
            .upsert(item, { onConflict: 'placa' });
          if (error) throw error;
        }

        toast.success(`${formatted.length} registros importados com sucesso!`);
        loadData();
      } catch (err) { 
        console.error("Erro no processamento do arquivo:", err);
        toast.error("Erro ao processar planilha."); 
      } finally { setLoading(false); }
    };
    reader.readAsBinaryString(file);
  };

  // Busca sugestões ao digitar placa
  const handlePlateInput = (value: string) => {
    const upper = value.toUpperCase();
    setPlateSearch(upper);
    setSearchResult(null);
    
    if (upper.length >= 2) {
      const matches = data.filter(item => item.placa.includes(upper));
      setSuggestions(matches.slice(0, 8));
      setShowSuggestions(matches.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  // Seleciona uma placa da lista de sugestões ou busca 
  const selectPlate = (item: ManutencaoVeiculo) => {
    setSearchResult(item);
    setPlateSearch(item.placa);
    setShowSuggestions(false);
    setServicoText(item.servicos || "");
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
        toast.error("Placa não encontrada na base de manutenção.");
        setSearchResult(null);
      } else {
        setSearchResult(result);
        setServicoText(result.servicos || "");
      }
    } catch (err) {
      toast.error("Erro na busca.");
    } finally {
      setLoading(false);
    }
  };

  // Inicia o processo de manutenção: coloca o veículo na etapa selecionada
  const startMaintenance = async () => {
    if (!searchResult) return;
    try {
      const { error } = await supabase
        .from('manutencao_veiculos')
        .update({ 
          status: selectedEtapa, 
          servicos: servicoText,
          updated_at: new Date().toISOString() 
        })
        .eq('id', searchResult.id);

      if (error) throw error;
      
      const etapaLabel = ETAPAS.find(e => e.id === selectedEtapa)?.label || selectedEtapa;
      toast.success(`${searchResult.placa} movido para "${etapaLabel}"`);
      setSearchResult(null);
      setPlateSearch("");
      setServicoText("");
      setShowSearchPanel(false);
      loadData();
    } catch (err) {
      toast.error("Erro ao iniciar manutenção.");
    }
  };

  // Mover veículo para outra etapa
  const moveToEtapa = async (id: string, newEtapa: EtapaId) => {
    try {
      const { error } = await supabase
        .from('manutencao_veiculos')
        .update({ status: newEtapa, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      
      setData(prev => prev.map(item => item.id === id ? { ...item, status: newEtapa } : item));
      const etapaLabel = ETAPAS.find(e => e.id === newEtapa)?.label || newEtapa;
      toast.success(`Veículo movido para "${etapaLabel}"`);
    } catch (err) {
      toast.error("Erro ao mover veículo.");
    }
  };

  // Finalizar (remover do kanban - status volta a null)
  const finalizeMaintenance = async (id: string) => {
    if (!window.confirm("Deseja finalizar e arquivar este processo?")) return;
    try {
      const { error } = await supabase
        .from('manutencao_veiculos')
        .update({ 
          status: null,
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

  // Enviar email 
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

    let mailtoUrl = `mailto:${to}`;
    const params = [];
    if (cc) params.push(`cc=${cc}`);
    params.push(`subject=${encodeURIComponent(subject)}`);
    params.push(`body=${encodeURIComponent(body)}`);
    
    if (params.length > 0) {
      mailtoUrl += "?" + params.join("&");
    }
    
    window.location.href = mailtoUrl;

    // Mover para "enviado" automaticamente
    if (item.status === 'aguardando_envio') {
      moveToEtapa(item.id, 'enviado');
    }
  };

  // Veículos agrupados por etapa (kanban)
  const vehiclesByEtapa = useMemo(() => {
    const grouped: Record<EtapaId, ManutencaoVeiculo[]> = {
      aguardando_envio: [],
      enviado: [],
      aguardando_aprovacao: [],
      aprovado: [],
    };

    data.forEach(item => {
      if (item.status && item.status in grouped) {
        grouped[item.status as EtapaId].push(item);
      }
    });

    return grouped;
  }, [data]);

  const totalAtivos = useMemo(() => {
    return data.filter(item => item.status && ETAPAS.some(e => e.id === item.status)).length;
  }, [data]);

  return (
    <div className="h-full flex flex-col pb-10 px-4 md:px-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4 mt-8">
        <div>
          <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter">Manutenção de Frota</h1>
          <p className="text-gray-500 font-medium text-sm mt-1">
            Gestão de orçamentos e aprovações • <span className="text-[#0b7336] font-bold">{totalAtivos}</span> veículos em processo
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <button 
            onClick={loadData}
            className="p-3 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-2xl border border-gray-100 dark:border-gray-700 hover:bg-gray-50 transition-all shadow-sm"
            title="Atualizar"
          >
            <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <label className="flex items-center px-5 py-3 bg-gray-800 dark:bg-gray-700 text-white rounded-2xl font-bold text-sm cursor-pointer hover:opacity-90 transition-all shadow-lg">
            <DocumentArrowUpIcon className="w-5 h-5 mr-2" />
            Subir Base
            <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileUpload} />
          </label>
          <button 
            onClick={() => setShowSearchPanel(!showSearchPanel)}
            className="flex items-center px-6 py-3 bg-[#0b7336] text-white rounded-2xl font-bold text-sm hover:bg-[#075a2a] transition-all shadow-xl gap-2"
          >
            <PlusIcon className="w-5 h-5" />
            Nova Manutenção
          </button>
        </div>
      </div>

      {/* Painel de Nova Manutenção (buscar placa) */}
      {showSearchPanel && (
        <div className="mb-6 bg-white dark:bg-gray-900 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-xl animate-in slide-in-from-top-4 duration-300">
          <div className="flex justify-between items-center mb-5">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Iniciar Nova Manutenção</label>
            <button onClick={() => { setShowSearchPanel(false); setSearchResult(null); setPlateSearch(""); }} className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex gap-4 relative">
            <div className="flex-1 relative">
              <input 
                type="text" 
                placeholder="Digite a placa do veículo..." 
                value={plateSearch}
                onChange={(e) => handlePlateInput(e.target.value)}
                className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-800 border-0 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-[#0b7336] transition-all"
                onKeyDown={(e) => e.key === 'Enter' && searchPlate()}
                onFocus={() => plateSearch.length >= 2 && suggestions.length > 0 && setShowSuggestions(true)}
              />
              {/* Dropdown de sugestões */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl z-50 max-h-60 overflow-auto">
                  {suggestions.map(s => (
                    <button 
                      key={s.id}
                      onClick={() => selectPlate(s)}
                      className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left first:rounded-t-2xl last:rounded-b-2xl"
                    >
                      <div className="w-8 h-8 bg-[#0b7336]/10 rounded-lg flex items-center justify-center">
                        <TruckIcon className="w-4 h-4 text-[#0b7336]" />
                      </div>
                      <span className="font-black text-sm text-gray-800 dark:text-white">{s.placa}</span>
                      {s.status && (
                        <span className="ml-auto text-[9px] font-bold uppercase text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">Em processo</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button 
              onClick={searchPlate}
              className="px-8 py-4 bg-[#0b7336] text-white rounded-2xl font-bold text-sm hover:scale-105 transition-all shadow-lg active:scale-95 flex items-center gap-2 shrink-0"
            >
              <MagnifyingGlassIcon className="w-5 h-5" />
              Buscar
            </button>
          </div>

          {/* Resultado da busca */}
          {searchResult && (
            <div className="mt-6 p-6 bg-green-50/50 dark:bg-green-500/10 border border-green-100 dark:border-green-500/20 rounded-2xl">
              <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-14 h-14 bg-[#0b7336] rounded-xl flex items-center justify-center text-white font-black text-lg shadow-lg shadow-green-500/20">
                    {searchResult.placa.substring(0, 3)}
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-gray-900 dark:text-white">{searchResult.placa}</h3>
                    <p className="text-sm text-gray-500 font-medium">Veículo encontrado na base</p>
                  </div>
                </div>

                {/* Serviço */}
                <div className="flex-1 w-full">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Serviço / Descrição</label>
                  <input 
                    type="text"
                    value={servicoText}
                    onChange={(e) => setServicoText(e.target.value)}
                    placeholder="Descreva o serviço..."
                    className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#0b7336] transition-all"
                  />
                </div>

                {/* Seletor de Etapa */}
                <div className="shrink-0">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Etapa</label>
                  <select 
                    value={selectedEtapa}
                    onChange={(e) => setSelectedEtapa(e.target.value as EtapaId)}
                    className="px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-[#0b7336] transition-all cursor-pointer"
                  >
                    {ETAPAS.map(etapa => (
                      <option key={etapa.id} value={etapa.id}>{etapa.label}</option>
                    ))}
                  </select>
                </div>

                <button 
                  onClick={startMaintenance}
                  className="px-6 py-3 bg-[#0b7336] text-white rounded-xl font-bold text-sm hover:bg-[#075a2a] transition-all shadow-lg shrink-0"
                >
                  Adicionar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* KANBAN - Colunas por Etapa */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 min-h-[400px] overflow-hidden">
        {ETAPAS.map(etapa => {
          const items = vehiclesByEtapa[etapa.id];
          const colors = etapaColors[etapa.id];
          const EtapaIcon = etapa.icon;

          return (
            <div key={etapa.id} className={`flex flex-col rounded-[1.5rem] border ${colors.border} ${colors.bg} overflow-hidden shadow-sm`}>
              {/* Cabeçalho da coluna */}
              <div className={`px-5 py-4 ${colors.headerBg} border-b ${colors.border}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-2.5 h-2.5 rounded-full ${colors.dot} animate-pulse`} />
                    <span className={`text-xs font-black uppercase tracking-wider ${colors.text}`}>{etapa.label}</span>
                  </div>
                  <span className={`text-xs font-black px-2.5 py-1 rounded-full border ${colors.badge}`}>
                    {items.length}
                  </span>
                </div>
              </div>

              {/* Cards dos veículos */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                    <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-full mb-3">
                      <EtapaIcon className="w-6 h-6 text-gray-300 dark:text-gray-600" />
                    </div>
                    <p className="text-xs text-gray-400 font-bold">Nenhum veículo</p>
                  </div>
                ) : (
                  items.map(item => (
                    <div 
                      key={item.id} 
                      className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-200 group"
                    >
                      {/* Placa */}
                      <div className="flex items-center justify-between mb-3">
                        <span className="bg-[#0b7336]/10 text-[#0b7336] dark:text-green-400 px-3 py-1.5 rounded-lg font-black text-sm border border-[#0b7336]/20">
                          {item.placa}
                        </span>
                        <button 
                          onClick={() => finalizeMaintenance(item.id)}
                          className="p-1.5 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                          title="Finalizar"
                        >
                          <XMarkIcon className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Serviço */}
                      {item.servicos && (
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3 line-clamp-2" title={item.servicos}>
                          <WrenchScrewdriverIcon className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                          {item.servicos}
                        </p>
                      )}

                      {/* Ações */}
                      <div className="flex flex-col gap-2">
                        {/* Mover para outra etapa */}
                        <select
                          value={item.status || ""}
                          onChange={(e) => moveToEtapa(item.id, e.target.value as EtapaId)}
                          className="w-full text-[10px] font-bold uppercase px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 cursor-pointer focus:ring-2 focus:ring-[#0b7336] transition-all"
                        >
                          {ETAPAS.map(e => (
                            <option key={e.id} value={e.id}>{e.label}</option>
                          ))}
                        </select>

                        {/* Botão Enviar Email (apenas na etapa aguardando_envio) */}
                        {item.status === 'aguardando_envio' && (
                          <button
                            onClick={() => handleSendEmail(item)}
                            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-[#0b7336] text-white rounded-lg text-[10px] font-bold uppercase hover:bg-[#075a2a] transition-all"
                          >
                            <EnvelopeIcon className="w-3.5 h-3.5" />
                            Enviar Email
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
