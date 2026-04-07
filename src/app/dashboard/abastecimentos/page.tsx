"use client";

import { useEffect, useState, useMemo } from "react";
import { 
  CloudArrowDownIcon, 
  TableCellsIcon, 
  FunnelIcon, 
  MagnifyingGlassIcon,
  ArrowPathIcon,
  CloudArrowUpIcon,
  ChartBarSquareIcon,
  HashtagIcon,
  CurrencyDollarIcon,
  GlobeAltIcon
} from "@heroicons/react/24/outline";
import { toast } from "react-hot-toast";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";

interface Abastecimento {
  placa: string;
  data_transacao: string;
  tipo_combustivel: string;
  litros: number;
  valor_litro: number;
  valor_total: number;
  codigo_estabelecimento: string;
  nome_estabelecimento: string;
}

export default function AbastecimentosPage() {
  const [data, setData] = useState<Abastecimento[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [oneDriveUrl, setOneDriveUrl] = useState("");
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  useEffect(() => {
    const savedUrl = localStorage.getItem("onedrive_abastecimentos_url");
    if (savedUrl) setOneDriveUrl(savedUrl);
    loadFromSupabase();
  }, []);

  const loadFromSupabase = async () => {
    setLoading(true);
    try {
      // FETCH RECURSIVO PARA BYPASSAR O LIMITE DE 1000 DO SUPABASE
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
        if (allData.length > 30000) break; // Limite de segurança de 30k linhas
      }

      if (allData.length > 0) {
        setData(allData);
        setLastUpdate("Sincronizado");
      }
    } catch (err: any) {
      console.error("Erro ao carregar do Supabase:", err);
      toast.error("Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  };

  const saveToSupabase = async (items: Abastecimento[]) => {
    const confirm = window.confirm(`Isso irá substituir os dados atuais por ${items.length} novos registros. Continuar?`);
    if (!confirm) return;

    setLoading(true);
    try {
      // Deleta por blocos se necessário, mas aqui deletamos tudo primeiro
      await supabase.from('abastecimentos').delete().neq('placa', 'PLACEHOLDER');

      // Inserção em lotes de 1000 para evitar erros de payload do Supabase
      const chunkSize = 1000;
      for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        const { error } = await supabase.from('abastecimentos').insert(chunk);
        if (error) throw error;
      }

      toast.success("Dados salvos permanentemente no Supabase!");
      loadFromSupabase(); // Recarrega tudo para garantir sincronia
    } catch (err: any) {
      console.error("Erro ao salvar no Supabase:", err);
      toast.error("Erro ao salvar no servidor.");
    } finally {
      setLoading(false);
    }
  };

  const parseExcelDate = (val: any) => {
    if (!val) return new Date().toISOString().split('T')[0];
    if (typeof val === 'number') {
      const date = new Date((val - 25569) * 86400 * 1000);
      return date.toISOString().split('T')[0];
    }
    if (typeof val === 'string') {
      const cleanStr = val.trim();
      const slashParts = cleanStr.split('/');
      if (slashParts.length === 3) {
        const d = slashParts[0].padStart(2, '0');
        const m = slashParts[1].padStart(2, '0');
        let y = slashParts[2];
        if (y.length === 2) y = "20" + y;
        return `${y}-${m}-${d}`;
      }
      const dashParts = cleanStr.split('-');
      if (dashParts.length === 3) {
        const d = dashParts[0].padStart(2, '0');
        const monthStr = dashParts[1].toLowerCase();
        let y = dashParts[2];
        if (y.length === 2) y = "20" + y;
        const monthsMap: any = {
          jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
          jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
          set: '09', out: '10', dez: '12'
        };
        const m = monthsMap[monthStr.substring(0, 3)] || '01';
        return `${y}-${m}-${d}`;
      }
      if (/^\d{4}-\d{2}-\d{2}/.test(cleanStr)) return cleanStr.substring(0, 10);
    }
    return String(val);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawData = XLSX.utils.sheet_to_json(ws) as any[];

        const formattedData: Abastecimento[] = rawData.map((row: any) => ({
          placa: String(row["PLACA"] || "").trim(),
          data_transacao: parseExcelDate(row["DATA TRANSACA"] || row["DATA TRANSACAO"] || row["DATA"]),
          tipo_combustivel: String(row["TIPO COMBUSTIVEL"] || row["COMBUSTIVEL"] || row["TIPO"] || "").trim(),
          litros: Number(row["LITROS"] || row["QTDE"] || 0),
          valor_litro: Number(row["VL/LITRO"] || row["PRECO"] || row["VALOR UNITARIO"] || 0),
          valor_total: Number(row["VALOR EMISSAO"] || row["VALOR TOTAL"] || row["VALOR"] || 0),
          codigo_estabelecimento: String(row["CODIGO ESTABELECIMENTO"] || row["CODIGO"] || ""),
          nome_estabelecimento: String(row["NOME ESTABELECIMENTO"] || row["POSTO"] || row["ESTABELECIMENTO"] || "")
        })).filter(item => item.placa !== "" && item.placa !== "null");

        setData(formattedData);
        await saveToSupabase(formattedData);
        toast.success("Arquivo importado e salvo!");
      } catch (err) {
        toast.error("Erro ao ler arquivo Excel.");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const fetchFromOneDrive = async () => {
    if (!oneDriveUrl) {
      toast.error("Configure o link do OneDrive!");
      setIsConfigOpen(true);
      return;
    }

    setLoading(true);
    try {
      const cleanUrl = oneDriveUrl.trim();
      const bytes = new TextEncoder().encode(cleanUrl);
      const binString = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
      const encoded = btoa(binString);
      const base64Url = encoded.replace(/=/g, '').replace(/\//g, '_').replace(/\+/g, '-');

      const downloadUrl = `https://api.onedrive.com/v1.0/shares/u!${base64Url}/root/content`;
      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error("Erro ao acessar OneDrive.");

      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawData = XLSX.utils.sheet_to_json(worksheet) as any[];

      const formattedData: Abastecimento[] = rawData.map((row: any) => ({
        placa: String(row["PLACA"] || "").trim(),
        data_transacao: parseExcelDate(row["DATA TRANSACA"] || row["DATA TRANSACAO"] || row["DATA"]),
        tipo_combustivel: String(row["TIPO COMBUSTIVEL"] || row["COMBUSTIVEL"] || row["TIPO"] || "").trim(),
        litros: Number(row["LITROS"] || row["QTDE"] || 0),
        valor_litro: Number(row["VL/LITRO"] || row["PRECO"] || row["VALOR UNITARIO"] || 0),
        valor_total: Number(row["VALOR EMISSAO"] || row["VALOR TOTAL"] || row["VALOR"] || 0),
        codigo_estabelecimento: String(row["CODIGO ESTABELECIMENTO"] || row["CODIGO"] || ""),
        nome_estabelecimento: String(row["NOME ESTABELECIMENTO"] || row["POSTO"] || row["ESTABELECIMENTO"] || "")
      })).filter(item => item.placa !== "" && item.placa !== "null");

      setData(formattedData);
      await saveToSupabase(formattedData);
      toast.success("Sincronizado com sucesso!");
    } catch (error: any) {
      toast.error(error.message || "Erro no OneDrive.");
    } finally {
      setLoading(false);
    }
  };

  const filteredData = useMemo(() => {
    return data.filter(item => 
      item.placa.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.nome_estabelecimento.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.tipo_combustivel.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [data, searchTerm]);

  const stats = useMemo(() => {
    const totalLiters = filteredData.reduce((acc, curr) => acc + curr.litros, 0);
    const totalValue = filteredData.reduce((acc, curr) => acc + curr.valor_total, 0);
    const avgPrice = totalLiters > 0 ? totalValue / totalLiters : 0;
    
    return {
      totalLiters: totalLiters.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
      totalValue: totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      avgPrice: avgPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      count: filteredData.length
    };
  }, [filteredData]);

  return (
    <div className="h-full flex flex-col pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <span className="flex items-center px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-xl text-xs font-bold uppercase tracking-wider">
              <CloudArrowDownIcon className="w-4 h-4 mr-2" />
              Sincronizado via OneDrive
            </span>
          </div>
          <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter">Abastecimentos</h1>
          <p className="text-gray-500 font-medium text-sm mt-1">Monitoramento de consumo e gastos da frota armazenado permanentemente no Supabase.</p>
        </div>
        
        <div className="flex gap-3">
          <label className="flex items-center px-6 py-3 bg-gray-900 text-white rounded-[1.5rem] font-bold text-sm cursor-pointer hover:bg-black transition-all shadow-xl shadow-black/10">
            <TableCellsIcon className="w-5 h-5 mr-2" />
            Importar Arquivo
            <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileUpload} />
          </label>
          <button onClick={() => setIsConfigOpen(true)} className="p-3 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <GlobeAltIcon className="w-6 h-6 text-gray-400" />
          </button>
          <button 
            onClick={fetchFromOneDrive}
            disabled={loading}
            className="flex items-center px-6 py-3 bg-[#0b7336] text-white rounded-[1.5rem] font-bold text-sm hover:bg-[#095d2c] transition-all shadow-xl shadow-green-500/20 disabled:opacity-50"
          >
            <ArrowPathIcon className={`w-5 h-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Sincronizar OneDrive
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        <div className="bg-white dark:bg-gray-800/60 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 w-fit rounded-2xl mb-4">
            <ChartBarSquareIcon className="w-6 h-6 text-blue-500" />
          </div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Registros</p>
          <p className="text-3xl font-black text-gray-900 dark:text-white leading-none">{stats.count}</p>
        </div>
        <div className="bg-white dark:bg-gray-800/60 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 w-fit rounded-2xl mb-4">
            <HashtagIcon className="w-6 h-6 text-amber-500" />
          </div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Litros</p>
          <p className="text-3xl font-black text-gray-900 dark:text-white leading-none">{stats.totalLiters} L</p>
        </div>
        <div className="bg-white dark:bg-gray-800/60 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="p-3 bg-green-50 dark:bg-green-900/20 w-fit rounded-2xl mb-4">
            <CurrencyDollarIcon className="w-6 h-6 text-[#0b7336]" />
          </div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Custo Total</p>
          <p className="text-3xl font-black text-gray-900 dark:text-white leading-none">{stats.totalValue}</p>
        </div>
        <div className="bg-white dark:bg-gray-800/60 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="p-3 bg-purple-50 dark:bg-purple-900/20 w-fit rounded-2xl mb-4">
            <GlobeAltIcon className="w-6 h-6 text-purple-500" />
          </div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Média P/ Litro</p>
          <p className="text-3xl font-black text-gray-900 dark:text-white leading-none">{stats.avgPrice}</p>
        </div>
      </div>

      <div className="flex-1 bg-white dark:bg-gray-800/60 rounded-[3rem] border border-gray-100 dark:border-gray-700 shadow-xl overflow-hidden flex flex-col">
        <div className="p-8 border-b border-gray-50 dark:border-gray-700 flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-50/30 dark:bg-gray-900/30">
          <div className="relative w-full md:w-96">
            <MagnifyingGlassIcon className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Pesquisar placa ou posto..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-6 py-4 bg-white dark:bg-gray-900 border-0 rounded-[1.5rem] text-sm focus:ring-2 focus:ring-[#0b7336]/20 transition-all font-medium"
            />
          </div>
          <div className="flex items-center space-x-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
            <FunnelIcon className="w-4 h-4" />
            <span>Exibindo {stats.count} resultados</span>
          </div>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-gray-50/90 dark:bg-gray-900/90 backdrop-blur-md z-10">
              <tr className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                <th className="px-8 py-6">Data</th>
                <th className="px-6 py-6 font-center">Placa</th>
                <th className="px-6 py-6">Combustível</th>
                <th className="px-6 py-6 text-right">Litros</th>
                <th className="px-6 py-6 text-right">Vl. Litro</th>
                <th className="px-6 py-6 text-right">Total</th>
                <th className="px-8 py-6">Estabelecimento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {filteredData.map((item, idx) => (
                <tr key={idx} className="group hover:bg-gray-50/50 dark:hover:bg-gray-900/30 transition-all">
                  <td className="px-8 py-5 text-sm font-medium text-gray-500 whitespace-nowrap">
                    {new Date(item.data_transacao + "T12:00:00").toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-5">
                    <span className="bg-gray-900 text-white px-3 py-1.5 rounded-lg font-black text-sm shadow-lg shadow-black/10 tracking-tight">
                      {item.placa}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <span className="text-[10px] font-black text-gray-400 uppercase bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-md">
                      {item.tipo_combustivel}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right font-black text-gray-900 dark:text-white tabular-nums">
                    {item.litros.toFixed(2)} L
                  </td>
                  <td className="px-6 py-5 text-right font-bold text-gray-500 text-xs tabular-nums">
                    {item.valor_litro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td className="px-6 py-5 text-right font-black text-[#0b7336] tabular-nums">
                    {item.valor_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td className="px-8 py-5">
                    <p className="text-xs font-black text-gray-900 dark:text-white uppercase leading-tight truncate max-w-[200px]">
                      {item.nome_estabelecimento}
                    </p>
                    <p className="text-[9px] font-bold text-gray-400 mt-1 uppercase">Cód: {item.codigo_estabelecimento}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isConfigOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2 leading-tight">Configuração OneDrive</h2>
            <p className="text-sm text-gray-500 font-medium mb-8">Cole o link de compartilhamento da sua planilha Excel.</p>
            <input 
              type="text" 
              placeholder="https://1drv.ms/x/s!..."
              value={oneDriveUrl}
              onChange={(e) => setOneDriveUrl(e.target.value)}
              className="w-full p-5 bg-gray-50 dark:bg-gray-800 border-0 rounded-2xl text-sm mb-8 focus:ring-2 focus:ring-[#0b7336]/20 font-medium"
            />
            <div className="flex gap-3">
              <button 
                onClick={() => setIsConfigOpen(false)}
                className="flex-1 px-6 py-4 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-white rounded-2xl font-bold text-sm"
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  localStorage.setItem("onedrive_abastecimentos_url", oneDriveUrl);
                  setIsConfigOpen(false);
                  fetchFromOneDrive();
                }}
                className="flex-[2] px-6 py-4 bg-[#0b7336] text-white rounded-2xl font-bold text-sm shadow-xl shadow-green-500/20"
              >
                Salvar e Sincronizar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
