"use client";

import { useEffect, useState, useMemo } from "react";
import { 
  MagnifyingGlassIcon,
  DocumentArrowUpIcon
} from "@heroicons/react/24/outline";
import { toast } from "react-hot-toast";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import { dataCache } from "@/lib/cache";

interface Abastecimento {
  id: string;
  data_transacao: string;
  placa: string;
  tipo_frota: string;
  modelo_veiculo: string;
  tipo_combustivel: string;
  litros: number;
  valor_litro: number;
  hodometro_horimetro: number;
  km_rodados: number;
  km_litro: number;
  valor_emissao: number;
  nome_estabelecimento: string;
  cidade: string;
  created_at: string;
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
    // Tenta carregar do cache RAM (instantâneo e sem limite)
    if (dataCache.abastecimentos && dataCache.veiculosAtivos) {
      setData(dataCache.abastecimentos);
      setVeiculosAtivos(dataCache.veiculosAtivos);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // 1. Busca frota ativa
      const { data: frota } = await supabase.from('frota_veiculos').select('placa').eq('status', 'Ativo');
      
      const normalize = (p: string) => p?.toString().replace(/[^a-zA-Z0-9]/g, '').toUpperCase().trim() || "";
      
      if (frota) {
        const setAtivos = new Set<string>(frota.map(v => normalize(v.placa)));
        setVeiculosAtivos(setAtivos);
        dataCache.veiculosAtivos = setAtivos;
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
        if (allData.length > 100000) break;
      }
      setData(allData as Abastecimento[]);
      dataCache.abastecimentos = allData;

    } catch (err: any) {
      console.error("Erro ao carregar dados complexos:", err);
      toast.error("Erro ao carregar histórico.");
    } finally {
      setLoading(false);
    }
  };

  const saveToSupabase = async (items: Abastecimento[]) => {
    const confirm = window.confirm(`Deseja sincronizar ${items.length} registros?`);
    if (!confirm) return;
    setLoading(true);
    try {
      dataCache.clear(); // Limpa o cache RAM ao subir nova planilha
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
        
        // Função auxiliar para buscar valores em colunas com nomes variados
        const getV = (row: any, names: string[]) => {
          for (const name of names) {
            const found = Object.keys(row).find(k => k.toUpperCase().trim() === name.toUpperCase().trim());
            if (found) return row[found];
          }
          return "";
        };

        const formatted = rawData.map((row: any) => {
          const placa = String(getV(row, ["PLACA"]) || "").trim();
          
          return {
            placa: placa,
            data_transacao: parseExcelDate(getV(row, ["DATA TRANSACAO", "DATA"])) || "",
            tipo_frota: String(getV(row, ["TIPO FROTA", "TIPO DE FROTA"]) || ""),
            modelo_veiculo: String(getV(row, ["MODELO VEICULO", "MODELO"]) || ""),
            tipo_combustivel: String(getV(row, ["TIPO COMBUSTIVEL", "COMBUSTIVEL"]) || ""),
            litros: Number(String(getV(row, ["LITROS", "QTD"]) || 0).replace(',', '.')),
            valor_litro: Number(String(getV(row, ["VL/LITRO", "VALOR LITRO"]) || 0).replace(',', '.')),
            hodometro_horimetro: Number(String(getV(row, ["HODOMETRO OU HORIMETRO", "HODOMETRO", "HORIMETRO"]) || 0).replace(',', '.')),
            km_rodados: Number(String(getV(row, ["KM RODADOS OU HORAS TRABALHADAS", "KM RODADOS"]) || 0).replace(',', '.')),
            km_litro: Number(String(getV(row, ["KM/LITRO OU LITROS/HORA", "KM/LITRO"]) || 0).replace(',', '.')),
            valor_emissao: Number(String(getV(row, ["VALOR EMISSAO", "VALOR TOTAL"]) || 0).replace(',', '.')),
            nome_estabelecimento: String(getV(row, ["NOME ESTABELECIMENTO", "ESTABELECIMENTO"]) || ""),
            cidade: String(getV(row, ["CIDADE", "MUNICIPIO"]) || ""),
          };
        }).filter(item => item.placa !== "");

        console.log("Dados formatados para envio:", formatted.slice(0, 2));
        await saveToSupabase(formatted);
      } catch (err) { 
        console.error("Erro no processamento do arquivo:", err);
        toast.error("Erro no processamento do arquivo. Verifique o console."); 
      } finally { setLoading(false); }
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
             item.modelo_veiculo.toLowerCase().includes(search) ||
             item.nome_estabelecimento.toLowerCase().includes(search);
    });
  }, [data, searchTerm, veiculosAtivos]);

  const stats = useMemo(() => {
    const totalLiters = filteredData.reduce((acc, curr) => acc + (Number(curr.litros) || 0), 0);
    const totalValue = filteredData.reduce((acc, curr) => acc + (Number(curr.valor_emissao) || 0), 0);
    return {
      totalLiters: totalLiters.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
      totalValue: totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      count: filteredData.length,
      avgConsumo: (filteredData.reduce((acc, curr) => acc + (Number(curr.km_litro) || 0), 0) / (filteredData.length || 1)).toFixed(2)
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
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Média Consumo</p>
            <p className="text-3xl font-black">{stats.avgConsumo} <span className="text-sm">KM/L</span></p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm font-bold">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Abastecimentos</p>
            <p className="text-3xl font-black">{stats.count}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm text-[#0b7336]">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Gasto</p>
            <p className="text-3xl font-black">{stats.totalValue}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Litros</p>
            <p className="text-3xl font-black">{stats.totalLiters} <span className="text-sm text-gray-400">L</span></p>
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
                    <th className="px-6 py-4">Modelo</th>
                    <th className="px-6 py-4 text-right">Litros</th>
                    <th className="px-6 py-4 text-right">KM/L</th>
                    <th className="px-6 py-4 text-right">Valor Total</th>
                    <th className="px-6 py-4">Posto / Cidade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredData.slice(0, 2000).map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-gray-400 whitespace-nowrap">{item.data_transacao ? new Date(item.data_transacao + "T12:00:00").toLocaleDateString('pt-BR') : '---'}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white px-2 py-1 rounded-md font-black text-[10px] border border-gray-200">{item.placa}</span>
                      </td>
                      <td className="px-6 py-4 font-black text-gray-800 uppercase text-[10px]">{item.modelo_veiculo}</td>
                      <td className="px-6 py-4 text-right font-bold tabular-nums">{item.litros.toLocaleString('pt-BR')} L</td>
                      <td className="px-6 py-4 text-right font-black text-blue-600 tabular-nums">{item.km_litro?.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}</td>
                      <td className="px-6 py-4 text-right font-black text-[#0b7336] tabular-nums">{Number(item.valor_emissao).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                         <div className="uppercase font-bold text-gray-500 text-[9px]">{item.nome_estabelecimento}</div>
                         <div className="uppercase font-medium text-gray-400 text-[8px]">{item.cidade}</div>
                      </td>
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
