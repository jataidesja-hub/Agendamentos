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

  // Carrega configurações do Supabase (Prioridade) e fallback localStorage
  useEffect(() => {
    const savedUrl = localStorage.getItem("onedrive_abastecimentos_url");
    if (savedUrl) setOneDriveUrl(savedUrl);
    
    loadFromSupabase();
  }, []);

  const loadFromSupabase = async () => {
    setLoading(true);
    try {
      const { data: dbData, error } = await supabase
        .from('abastecimentos')
        .select('*')
        .order('data_transacao', { ascending: false });

      if (error) throw error;

      if (dbData && dbData.length > 0) {
        setData(dbData);
        // Pega a data da última sincronização do localStorage se disponível, ou do registro mais novo
        const savedTime = localStorage.getItem("onedrive_abastecimentos_last_update");
        setLastUpdate(savedTime || "Banco de Dados");
      } else {
        // Fallback para cache local se banco estiver vazio
        const savedData = localStorage.getItem("onedrive_abastecimentos_cache");
        if (savedData) setData(JSON.parse(savedData));
      }
    } catch (err: any) {
      console.error("Erro ao carregar do Supabase:", err);
      toast.error("Erro ao carregar dados do servidor.");
    } finally {
      setLoading(false);
    }
  };

  const saveToSupabase = async (items: Abastecimento[]) => {
    try {
      // Limpa dados antigos para uma sincronização limpa (Opcional - pode-se usar upsert se houver IDs únicos)
      // Aqui vamos deletar e inserir para garantir que a planilha seja a fonte da verdade
      const { error: delError } = await supabase.from('abastecimentos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (delError) throw delError;

      // Supabase insert permite arrays massivos
      const { error: insError } = await supabase.from('abastecimentos').insert(items);
      if (insError) throw insError;

      const now = new Date().toLocaleString("pt-BR");
      setLastUpdate(now);
      localStorage.setItem("onedrive_abastecimentos_last_update", now);
      localStorage.setItem("onedrive_abastecimentos_cache", JSON.stringify(items));
      
      toast.success("Dados salvos permanentemente no banco!");
    } catch (err: any) {
      console.error("Erro ao salvar no Supabase:", err);
      toast.error("Erro ao salvar no servidor: " + err.message);
    }
  };

  // Helper para converter data do Excel (suporta Serial, DD/MM/YYYY, DD-MMM-YY)
  const parseExcelDate = (val: any) => {
    if (!val) return new Date().toISOString().split('T')[0];
    
    // Se for número (Serial do Excel)
    if (typeof val === 'number') {
      const date = new Date((val - 25569) * 86400 * 1000);
      return date.toISOString().split('T')[0];
    }

    if (typeof val === 'string') {
      const cleanStr = val.trim();
      
      // Caso 1: DD/MM/YYYY
      const slashParts = cleanStr.split('/');
      if (slashParts.length === 3) {
        const d = slashParts[0].padStart(2, '0');
        const m = slashParts[1].padStart(2, '0');
        let y = slashParts[2];
        if (y.length === 2) y = "20" + y;
        return `${y}-${m}-${d}`;
      }

      // Caso 2: DD-MMM-YY (ex: 28-Jan-26 ou 28-Jan-2026)
      const dashParts = cleanStr.split('-');
      if (dashParts.length === 3) {
        const d = dashParts[0].padStart(2, '0');
        const monthStr = dashParts[1].toLowerCase();
        let y = dashParts[2];
        if (y.length === 2) y = "20" + y;

        const monthsMap: any = {
          jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
          jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
          set: '09', out: '10', dez: '12' // Suporte a abreviações em PT-BR comuns
        };

        const m = monthsMap[monthStr.substring(0, 3)] || '01';
        return `${y}-${m}-${d}`;
      }

      // Caso 3: ISO já formatado ou YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}/.test(cleanStr)) {
        return cleanStr.substring(0, 10);
      }
    }

    return String(val);
  };

  const fetchFromOneDrive = async () => {
    if (!oneDriveUrl) {
      toast.error("Configure o link do OneDrive primeiro!");
      setIsConfigOpen(true);
      return;
    }

    setLoading(true);
    try {
      const cleanUrl = oneDriveUrl.trim();
      
      let base64Url = "";
      try {
        const bytes = new TextEncoder().encode(cleanUrl);
        const binString = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
        const encoded = btoa(binString);
        base64Url = encoded.replace(/=/g, '').replace(/\//g, '_').replace(/\+/g, '-');
      } catch (e) {
        throw new Error("O link fornecido é inválido.");
      }

      const downloadUrl = `https://api.onedrive.com/v1.0/shares/u!${base64Url}/root/content`;
      const response = await fetch(downloadUrl);
      
      if (!response.ok) {
        if (response.status === 403 || response.status === 401) {
          throw new Error("Acesso negado. Verifique o compartilhamento.");
        }
        throw new Error(`Erro (${response.status}).`);
      }

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

      if (formattedData.length === 0) {
        throw new Error("Nenhum dado encontrado.");
      }

      setData(formattedData);
      await saveToSupabase(formattedData);
      toast.success("Sincronizado com sucesso!");
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Erro ao buscar do OneDrive.");
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = () => {
    localStorage.setItem("onedrive_abastecimentos_url", oneDriveUrl);
    setIsConfigOpen(false);
    toast.success("Configuração salva!");
    fetchFromOneDrive();
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
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <span className="flex items-center px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-xl text-xs font-bold uppercase tracking-wider">
              <CloudArrowDownIcon className="w-4 h-4 mr-2" />
              Sincronizado via OneDrive
            </span>
            {lastUpdate && (
              <span className="text-xs font-medium text-gray-400 italic">
                Última atualização: {lastUpdate}
              </span>
            )}
          </div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Abastecimentos</h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400 font-medium">
            Monitoramento de consumo e gastos da frota armazenado permanentemente no Supabase.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <label className="flex-1 md:flex-none flex items-center justify-center px-6 py-3.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-bold rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:bg-gray-50 transition-all duration-300 cursor-pointer">
            <TableCellsIcon className="w-5 h-5 mr-2 text-blue-500" />
            Importar Arquivo
            <input 
              type="file" 
              accept=".xlsx, .xls" 
              className="hidden" 
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setLoading(true);
                try {
                  const arrayBuffer = await file.arrayBuffer();
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
                    nome_estabelecimento: String(row["NOME ESTABELECIMENTO"] || row["POSTO"] || row["ESTABELECIMENTO"] || row["NOME ESTABELEVIMENTO"] || "")
                  })).filter(item => item.placa !== "" && item.placa !== "null");

                  setData(formattedData);
                  await saveToSupabase(formattedData);
                  toast.success("Arquivo importado e salvo no banco!");
                } catch (err) {
                  console.error(err);
                  toast.error("Erro ao ler o arquivo selecionado.");
                } finally {
                  setLoading(false);
                }
              }}
            />
          </label>

          <button
            onClick={() => setIsConfigOpen(true)}
            className="p-3.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:bg-gray-50 transition-all duration-300"
            title="Configurar Link OneDrive"
          >
            <CloudArrowDownIcon className="w-6 h-6 text-green-600" />
          </button>
          
          <button
            onClick={fetchFromOneDrive}
            disabled={loading}
            className="flex-1 md:flex-none flex items-center justify-center px-6 py-3.5 bg-[#0b7336] hover:bg-[#09602c] text-white text-sm font-bold rounded-2xl shadow-lg shadow-green-500/30 transition-all duration-300 disabled:opacity-50"
          >
            <ArrowPathIcon className={`w-5 h-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {loading ? "Sincronizando..." : "Sincronizar OneDrive"}
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl p-6 rounded-3xl border border-white/40 dark:border-gray-700/50 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-900/30 rounded-xl">
              <ChartBarSquareIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">Registros</p>
          <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.count}</p>
        </div>

        <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl p-6 rounded-3xl border border-white/40 dark:border-gray-700/50 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 bg-amber-50 dark:bg-amber-900/30 rounded-xl">
              <HashtagIcon className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
          <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">Total Litros</p>
          <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.totalLiters} L</p>
        </div>

        <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl p-6 rounded-3xl border border-white/40 dark:border-gray-700/50 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl">
              <CurrencyDollarIcon className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">Custo Total</p>
          <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.totalValue}</p>
        </div>

        <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl p-6 rounded-3xl border border-white/40 dark:border-gray-700/50 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 bg-purple-50 dark:bg-purple-900/30 rounded-xl">
              <GlobeAltIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">Média p/ Litro</p>
          <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.avgPrice}</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-3xl border border-white/40 dark:border-gray-700/50 shadow-xl overflow-hidden flex flex-col flex-1 min-h-[500px]">
        {/* Filters */}
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-96">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Pesquisar placa ou posto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-5 py-3.5 border-0 bg-gray-50 dark:bg-gray-900/50 rounded-2xl focus:ring-2 focus:ring-[#0b7336] text-sm text-gray-900 dark:text-white transition-all font-medium"
            />
          </div>
          
          <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
            <FunnelIcon className="w-4 h-4" />
            <span>Exibindo {filteredData.length} resultados</span>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {data.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-12 text-center">
              <TableCellsIcon className="w-20 h-20 text-gray-200 mb-4" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Nenhum dado carregado</h3>
              <p className="text-gray-500 max-w-sm mb-8">
                Configure o link da sua planilha OneDrive e clique em "Sincronizar" para começar.
              </p>
              <button
                onClick={() => setIsConfigOpen(true)}
                className="px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl font-bold hover:scale-105 transition-all outline-none"
              >
                Configurar Agora
              </button>
            </div>
          ) : (
            <table className="w-full text-left border-separate border-spacing-0">
              <thead>
                <tr className="bg-gray-50/50 dark:bg-gray-900/50 sticky top-0 z-10">
                  <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-700">Data</th>
                  <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-700">Placa</th>
                  <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-700">Combustível</th>
                  <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-700 text-right">Litros</th>
                  <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-700 text-right">Vl. Litro</th>
                  <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-700 text-right">Total</th>
                  <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-700">Estabelecimento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {filteredData.map((item, idx) => (
                  <tr key={idx} className="group hover:bg-green-50/30 dark:hover:bg-green-900/10 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {new Date(item.data_transacao).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-black text-gray-900 dark:text-white tabular-nums bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded-lg">
                        {item.placa}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-600 dark:text-gray-300">
                      {item.tipo_combustivel}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-900 dark:text-white text-right tabular-nums">
                      {item.litros.toFixed(2)} L
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-500 dark:text-gray-400 text-right tabular-nums">
                      {item.valor_litro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="px-6 py-4 text-sm font-black text-[#0b7336] dark:text-green-400 text-right tabular-nums">
                      {item.valor_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-bold text-gray-900 dark:text-white">{item.nome_estabelecimento}</div>
                        <div className="text-xs text-gray-400 font-medium">Cód: {item.codigo_estabelecimento}</div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Config Modal */}
      {isConfigOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsConfigOpen(false)}></div>
          <div className="relative bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-2xl overflow-hidden w-full max-w-xl p-10">
            <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Conectar OneDrive</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-8 font-medium">
              Siga os passos abaixo para conectar sua planilha de abastecimentos.
            </p>

            <div className="space-y-6">
              <div className="bg-gray-50 dark:bg-gray-900/50 p-6 rounded-3xl border border-gray-100 dark:border-gray-700/50">
                <p className="text-xs font-black text-[#0b7336] uppercase tracking-widest mb-4">Instruções</p>
                <ol className="text-sm text-gray-600 dark:text-gray-300 space-y-3 list-decimal ml-4 font-medium">
                  <li>Abra sua planilha no OneDrive Web.</li>
                  <li>Clique em <strong>Compartilhar</strong>.</li>
                  <li>Escolha <strong>"Qualquer pessoa com o link pode exibir"</strong>.</li>
                  <li>Copie o link gerado e cole abaixo.</li>
                </ol>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Link de Compartilhamento</label>
                <input
                  type="text"
                  value={oneDriveUrl}
                  onChange={(e) => setOneDriveUrl(e.target.value)}
                  placeholder="https://1drv.ms/x/s!..."
                  className="w-full px-6 py-4 bg-gray-100 dark:bg-gray-900 border-0 rounded-2xl focus:ring-2 focus:ring-[#0b7336] text-gray-900 dark:text-white font-medium"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => setIsConfigOpen(false)}
                  className="flex-1 py-4 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold rounded-2xl hover:bg-gray-200 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveConfig}
                  className="flex-1 py-4 bg-[#0b7336] hover:bg-[#09602c] text-white font-bold rounded-2xl shadow-lg shadow-green-500/30 transition-all hover:shadow-green-500/50"
                >
                  Salvar e Sincronizar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
