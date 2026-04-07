"use client";

import { useEffect, useState, useMemo } from "react";
import { 
  MagnifyingGlassIcon,
  DocumentArrowUpIcon
} from "@heroicons/react/24/outline";
import { toast } from "react-hot-toast";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";

interface Abastecimento {
  codigo_transacao: string;
  forma_pagamento: string;
  codigo_cliente: string;
  nome_reduzido: string;
  data_transacao: string;
  placa: string;
  tipo_frota: string;
  modelo_veiculo: string;
  projeto: string;
  ano_referencia: string;
  matricula: string;
  nome_motorista: string;
  servico: string;
  tipo_combustivel: string;
  litros: number;
  valor_litro: number;
  hodometro_horimetro: number;
  km_rodados_horas: number;
  km_litro_rendimento: number;
  valor_emissao: number;
  codigo_estabelecimento: string;
  estrela_auto_posto: string;
  estabelecimento: string;
  endereco: string;
  bairro: string;
  cidade: string;
  uf: string;
  info_adicional_1: string;
  info_adicional_2: string;
  info_adicional_3: string;
  status_transacao: string;
  info_adicional_5: string;
  forma_transacao: string;
  codigo_liberacao: string;
  serie_pos: string;
  numero_cartao: string;
  familia_veiculo: string;
  grupo_restricao: string;
  codigo_emissora: string;
  responsavel: string;
  tipo_entrada_hodometro: string;
}

export default function AbastecimentosPage() {
  const [data, setData] = useState<Abastecimento[]>([]);
  const [veiculosAtivos, setVeiculosAtivos] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadFromSupabase();
  }, []);

  const loadFromSupabase = async () => {
    // Tenta carregar do cache para ser instantâneo
    const cachedData = sessionStorage.getItem('cache_abastecimentos');
    const cachedFrota = sessionStorage.getItem('cache_veiculos_ativos');

    if (cachedData && cachedFrota) {
      setData(JSON.parse(cachedData));
      setVeiculosAtivos(new Set(JSON.parse(cachedFrota)));
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // 1. Busca frota ativa na tabela correta
      const { data: frota } = await supabase.from('veiculos_frota').select('placa').eq('status', 'Ativo');
      
      // Normalização: Remove espaços e hífens para garantir o match
      const normalize = (p: string) => p?.toString().replace(/[^a-zA-Z0-9]/g, '').toUpperCase().trim() || "";
      
      let frotaNormalizada: string[] = [];
      if (frota) {
        const setAtivos = new Set<string>(frota.map(v => normalize(v.placa)));
        setVeiculosAtivos(setAtivos);
        frotaNormalizada = Array.from(setAtivos);
      }

      // 2. Busca exaustiva de abastecimentos
      let allData: any[] = [];
      let from = 0;
      let to = 999;
      let hasMore = true;

      while (hasMore) {
        const { data: chunk, error } = await supabase
          .from('abastecimentos')
          .select('*')
          .order('data_transacao', { ascending: false })
          .range(from, to);

        if (error) throw error;
        if (!chunk || chunk.length === 0) {
          hasMore = false;
        } else {
          allData = [...allData, ...chunk];
          if (chunk.length < 1000) {
            hasMore = false;
          } else {
            from += 1000;
            to += 1000;
          }
        }
        if (allData.length > 50000) break;
      }
      setData(allData as Abastecimento[]);
      
      // Salva no cache
      sessionStorage.setItem('cache_abastecimentos', JSON.stringify(allData));
      sessionStorage.setItem('cache_veiculos_ativos', JSON.stringify(frotaNormalizada));

    } catch (err: any) {
      console.error("Erro ao carregar dados complexos:", err);
      toast.error("Erro ao sincronizar histórico.");
    } finally {
      setLoading(false);
    }
  };

  const saveToSupabase = async (items: Abastecimento[]) => {
    const confirm = window.confirm(`Deseja sincronizar ${items.length} registros?`);
    if (!confirm) return;
    setLoading(true);
    try {
      sessionStorage.removeItem('cache_abastecimentos'); // Limpa o cache ao subir nova planilha
      await supabase.from('abastecimentos').delete().neq('placa', 'PLACEHOLDER');
      const chunkSize = 500;
      for (let i = 0; i < items.length; i += chunkSize) {
        const { error } = await supabase.from('abastecimentos').insert(items.slice(i, i + chunkSize));
        if (error) throw error;
      }
      toast.success("Sincronização completa!");
      loadFromSupabase();
    } catch (err) {
      toast.error("Erro na sincronização.");
    } finally {
      setLoading(false);
    }
  };

  const parseExcelDate = (val: any): string | null => {
    if (!val) return null;
    if (typeof val === 'number') {
      const date = new Date((val - 25569) * 86400 * 1000);
      return date.toISOString().split('T')[0];
    }
    if (typeof val === 'string') {
      const parts = val.trim().split(' ')[0].split(/[-/]/);
      if (parts.length === 3) {
         if (parts[0].length === 4) return val.trim().substring(0, 10);
         const d = parts[0].padStart(2, '0');
         const m = parts[1].padStart(2, '0');
         let y = parts[2];
         if (y.length === 2) y = "20" + y;
         if (isNaN(Number(m))) {
             const monthsMap: any = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12', set: '09', out: '10', dez: '12' };
             return `${y.substring(0,4)}-${monthsMap[m.toLowerCase().substring(0,3)] || '01'}-${d}`;
         }
         return `${y.substring(0,4)}-${m}-${d}`;
      }
    }
    return null;
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
        const formatted = rawData.map((row: any) => {
          const projKey = Object.keys(row).find(k => k.toUpperCase().match(/PROJETOS?|FAZENDA/));
          return {
            codigo_transacao: String(row["CODIGO TRANSACAO"] || ""),
            forma_pagamento: String(row["FORMA DE PAGAMENTO"] || ""),
            codigo_cliente: String(row["CODIGO CLIENTE"] || ""),
            nome_reduzido: String(row["NOME REDUZIDO"] || ""),
            data_transacao: parseExcelDate(row["DATA TRANSACAO"] || row["DATA TRANSACAC"] || row["DATA"] || "") || "",
            placa: String(row["PLACA"] || "").trim(),
            projeto: String(projKey ? row[projKey] : "SEM PROJETO").trim(),
            tipo_combustivel: String(row["TIPO COMBUSTIVEL"] || ""),
            litros: Number(String(row["LITROS"] || 0).replace(',', '.')),
            valor_litro: Number(String(row["VL/LITRO"] || 0).replace(',', '.')),
            valor_emissao: Number(String(row["VALOR EMISSAO"] || 0).replace(',', '.')),
            estabelecimento: String(row["ESTABELECIMENTO"] || ""),
            nome_motorista: String(row["NOME MOTORISTA"] || ""),
            cidade: String(row["CIDADE"] || ""),
            hodometro_horimetro: Number(String(row["HODOMETRO OU HORIMETRO"] || 0).replace(',', '.')),
            km_rodados_horas: Number(String(row["KM RODADOS OU HORAS TRABALHADAS"] || 0).replace(',', '.')),
            km_litro_rendimento: Number(String(row["KM/LITRO OU LITROS/HORA"] || 0).replace(',', '.')),
          } as any;
        }).filter(item => item.placa !== "");
        await saveToSupabase(formatted);
      } catch (err) { toast.error("Erro no processamento."); } finally { setLoading(false); }
    };
    reader.readAsBinaryString(file);
  };

  const filteredData = useMemo(() => {
    // Função interna para normalizar placas na hora do filtro
    const normalize = (p: string) => p?.toString().replace(/[^a-zA-Z0-9]/g, '').toUpperCase().trim() || "";
    
    return data.filter((item: Abastecimento) => {
      const placaNormalizada = normalize(item.placa);
      
      // FILTRO: Apenas veículos ativos na frota
      // Se não houver nenhum veículo ativo cadastrado, não filtramos nada (opcional)
      if (veiculosAtivos.size > 0 && !veiculosAtivos.has(placaNormalizada)) return false;

      const search = searchTerm.toLowerCase();
      return item.placa.toLowerCase().includes(search) ||
             item.projeto.toLowerCase().includes(search) ||
             item.nome_motorista.toLowerCase().includes(search);
    });
  }, [data, searchTerm, veiculosAtivos]);

  const stats = useMemo(() => {
    const totalLiters = filteredData.reduce((acc, curr) => acc + (Number(curr.litros) || 0), 0);
    const totalValue = filteredData.reduce((acc, curr) => acc + (Number(curr.valor_emissao) || 0), 0);
    return {
      totalLiters: totalLiters.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
      totalValue: totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      count: filteredData.length,
      projectsCount: new Set(filteredData.map(d => d.projeto)).size
    };
  }, [filteredData]);

  return (
    <div className="h-full flex flex-col pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 px-4">
        <div>
          <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter">Base de Dados Frota</h1>
          <p className="text-gray-500 font-medium text-sm mt-1">Histórico completo de veículos ativos • {stats.count} registros.</p>
        </div>
        <label className="flex items-center px-6 py-3 bg-gray-900 text-white rounded-[1.5rem] font-bold text-sm cursor-pointer hover:bg-black transition-all shadow-xl">
          <DocumentArrowUpIcon className="w-5 h-5 mr-3" />
          Sincronizar Planilha
          <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileUpload} />
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 px-4 mb-8 text-center">
         <div className="bg-white dark:bg-gray-800 p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Projetos Ativos</p>
            <p className="text-3xl font-black">{stats.projectsCount}</p>
         </div>
         <div className="bg-white dark:bg-gray-800 p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm font-bold">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Registros Totais</p>
            <p className="text-3xl font-black">{stats.count}</p>
         </div>
         <div className="bg-white dark:bg-gray-800 p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm text-[#0b7336]">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Investimento</p>
            <p className="text-3xl font-black">{stats.totalValue}</p>
         </div>
         <div className="bg-white dark:bg-gray-800 p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Litros</p>
            <p className="text-3xl font-black">{stats.totalLiters} L</p>
         </div>
      </div>

      <div className="flex-1 bg-white dark:bg-gray-800 rounded-[3rem] border border-gray-100 dark:border-gray-700 shadow-xl overflow-hidden flex flex-col mx-4 min-h-[400px]">
        {loading && data.length === 0 ? (
           <div className="flex-1 flex flex-col items-center justify-center animate-pulse">
              <div className="w-10 h-10 border-4 border-[#0b7336] border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="font-bold text-gray-400 text-[10px] uppercase tracking-widest">Sincronizando Frota Ativa...</p>
           </div>
        ) : (
          <>
            <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
               <div className="relative w-80">
                  <MagnifyingGlassIcon className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" placeholder="Filtrar placa, projeto ou motorista..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-white border-0 rounded-2xl text-sm shadow-sm" />
               </div>
            </div>
            <div className="overflow-auto custom-scrollbar">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-gray-900 text-white z-10">
                  <tr className="uppercase font-black tracking-tighter">
                    <th className="px-6 py-4">Data</th>
                    <th className="px-6 py-4 text-center">Placa</th>
                    <th className="px-6 py-4">Projeto</th>
                    <th className="px-6 py-4">Motorista</th>
                    <th className="px-6 py-4 text-right">L / Valor</th>
                    <th className="px-6 py-4">Estabelecimento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredData.slice(0, 2000).map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-gray-400 whitespace-nowrap">{item.data_transacao ? new Date(item.data_transacao + "T12:00:00").toLocaleDateString('pt-BR') : '---'}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="bg-[#0b7336] text-white px-2 py-1 rounded-md font-black text-[10px]">{item.placa}</span>
                      </td>
                      <td className="px-6 py-4 font-black text-gray-800 uppercase text-[10px]">{item.projeto}</td>
                      <td className="px-6 py-4 font-medium text-gray-600 uppercase text-[10px]">{item.nome_motorista || '---'}</td>
                      <td className="px-6 py-4 text-right tabular-nums">
                        <div className="font-bold">{item.litros} L</div>
                        <div className="text-emerald-600 font-bold">{Number(item.valor_emissao).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                      </td>
                      <td className="px-6 py-4 truncate max-w-[150px] uppercase font-bold text-gray-400 text-[9px]">{item.estabelecimento}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
