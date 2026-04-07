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
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadFromSupabase();
  }, []);

  const loadFromSupabase = async () => {
    setLoading(true);
    try {
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
      await supabase.from('abastecimentos').delete().neq('placa', 'PLACEHOLDER');
      const chunkSize = 500;
      for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        const { error } = await supabase.from('abastecimentos').insert(chunk);
        if (error) throw error;
      }
      toast.success("Dados salvos e sincronizados!");
      loadFromSupabase();
    } catch (err: any) {
      console.error("Erro ao salvar no Supabase:", err);
      toast.error("Erro ao salvar dados detalhados. Verifique se o SQL foi rodado.");
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
      const cleanStr = val.trim();
      const parts = cleanStr.split(/[-/]/);
      if (parts.length === 3) {
         if (parts[0].length === 4) return cleanStr.substring(0, 10);
         const d = parts[0].padStart(2, '0');
         const m = parts[1].padStart(2, '0');
         let y = parts[2];
         if (y.length === 2) y = "20" + y;
         if (isNaN(Number(m))) {
             const monthsMap: any = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12', set: '09', out: '10', dez: '12' };
             const convertedM = monthsMap[m.toLowerCase().substring(0, 3)] || '01';
             return `${y}-${convertedM}-${d}`;
         }
         return `${y}-${m}-${d}`;
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
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawData: any[] = XLSX.utils.sheet_to_json(ws);

        const formattedData: Abastecimento[] = rawData.map((row: any) => ({
          codigo_transacao: String(row["CODIGO TRANSACAO"] || ""),
          forma_pagamento: String(row["FORMA DE PAGAMENTO"] || ""),
          codigo_cliente: String(row["CODIGO CLIENTE"] || ""),
          nome_reduzido: String(row["NOME REDUZIDO"] || ""),
          data_transacao: parseExcelDate(row["DATA TRANSACAO"] || row["DATA"] || "") || "",
          placa: String(row["PLACA"] || "").trim(),
          tipo_frota: String(row["TIPO FROTA"] || ""),
          modelo_veiculo: String(row["MODELO VEICULO"] || ""),
          projeto: String(row["PROJETOS"] || row["PROJETO"] || "SEM PROJETO").trim(),
          ano_referencia: String(row["ANO"] || ""),
          matricula: String(row["MATRICULA"] || ""),
          nome_motorista: String(row["NOME MOTORISTA"] || ""),
          servico: String(row["SERVICO"] || ""),
          tipo_combustivel: String(row["TIPO COMBUSTIVEL"] || ""),
          litros: Number(row["LITROS"] || 0),
          valor_litro: Number(row["VL/LITRO"] || 0),
          hodometro_horimetro: Number(row["HODOMETRO OU HORIMETRO"] || 0),
          km_rodados_horas: Number(row["KM RODADOS OU HORAS TRABALHADAS"] || 0),
          km_litro_rendimento: Number(row["KM/LITRO OU LITROS/HORA"] || 0),
          valor_emissao: Number(row["VALOR EMISSAO"] || 0),
          codigo_estabelecimento: String(row["CODIGO ESTABELECIMENTO"] || ""),
          estrela_auto_posto: String(row["ESTRELA AUTO POSTO"] || ""),
          estabelecimento: String(row["ESTABELECIMENTO"] || ""),
          endereco: String(row["ENDERECO"] || ""),
          bairro: String(row["BAIRRO"] || ""),
          cidade: String(row["CIDADE"] || ""),
          uf: String(row["UF"] || ""),
          info_adicional_1: String(row["INFORMACAO ADIDIONAL 1"] || ""),
          info_adicional_2: String(row["INFORMACAO ADIDIONAL 2"] || ""),
          info_adicional_3: String(row["INFORMACAO ADIDIONAL 3"] || ""),
          status_transacao: String(row["STATUS"] || ""),
          info_adicional_5: String(row["INFORMACAO ADIDIONAL 5"] || ""),
          forma_transacao: String(row["FORMA TRANSACAO"] || ""),
          codigo_liberacao: String(row["CODIGO LIBERACAO RESTRICAO"] || ""),
          serie_pos: String(row["SERIE POS"] || ""),
          numero_cartao: String(row["NUMERO CARTAO"] || ""),
          familia_veiculo: String(row["FAMILIA VEICULO"] || ""),
          grupo_restricao: String(row["GRUPO RESTRICAO"] || ""),
          codigo_emissora: String(row["CODIGO EMISSORA"] || ""),
          responsavel: String(row["RESPONSAVEL"] || ""),
          tipo_entrada_hodometro: String(row["TIPO ENTRADA HODOMETRO"] || "")
        })).filter((item: Abastecimento) => item.placa !== "");

        await saveToSupabase(formattedData);
      } catch (err) {
        toast.error("Erro ao ler colunas do arquivo.");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const filteredData = useMemo(() => {
    return data.filter((item: Abastecimento) => 
      item.placa.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.projeto.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.nome_motorista.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [data, searchTerm]);

  const stats = useMemo(() => {
    const totalLiters = filteredData.reduce((acc: number, curr: Abastecimento) => acc + curr.litros, 0);
    const totalValue = filteredData.reduce((acc: number, curr: Abastecimento) => acc + (curr.valor_emissao || 0), 0);
    return {
      totalLiters: totalLiters.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
      totalValue: totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      count: filteredData.length,
      projectsCount: new Set(filteredData.map((d: Abastecimento) => d.projeto)).size
    };
  }, [filteredData]);

  return (
    <div className="h-full flex flex-col pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 px-4">
        <div>
          <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter">Base de Dados Frota</h1>
          <p className="text-gray-500 font-medium text-sm mt-1">Gestão completa de {stats.count} registros em {stats.projectsCount} projetos.</p>
        </div>
        <div className="flex gap-3">
          <label className="flex items-center px-6 py-3 bg-gray-900 text-white rounded-[1.5rem] font-bold text-sm cursor-pointer hover:bg-black transition-all shadow-xl">
            <DocumentArrowUpIcon className="w-5 h-5 mr-2" />
            Importar Planilha (A-AO)
            <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 px-4 mb-8">
         <div className="bg-white dark:bg-gray-800 p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm text-center">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Projetos</p>
            <p className="text-3xl font-black">{stats.projectsCount}</p>
         </div>
         <div className="bg-white dark:bg-gray-800 p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm text-center">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Registros</p>
            <p className="text-3xl font-black">{stats.count}</p>
         </div>
         <div className="bg-white dark:bg-gray-800 p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm text-center text-[#0b7336]">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Custo Total</p>
            <p className="text-3xl font-black">{stats.totalValue}</p>
         </div>
         <div className="bg-white dark:bg-gray-800 p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm text-center">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Litros</p>
            <p className="text-3xl font-black">{stats.totalLiters} L</p>
         </div>
      </div>

      <div className="flex-1 bg-white dark:bg-gray-800 rounded-[3rem] border border-gray-100 dark:border-gray-700 shadow-xl overflow-hidden flex flex-col mx-4">
        <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
           <div className="relative w-80">
              <MagnifyingGlassIcon className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Placa, Projeto ou Motorista..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white border-0 rounded-2xl text-sm shadow-sm"
              />
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
                <th className="px-6 py-4 text-right">L / KM</th>
                <th className="px-6 py-4 text-right">Valor</th>
                <th className="px-6 py-4">Posto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredData.slice(0, 500).map((item: Abastecimento, idx: number) => (
                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-bold text-gray-500">
                    {item.data_transacao ? new Date(item.data_transacao + "T12:00:00").toLocaleDateString('pt-BR') : '---'}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="bg-[#0b7336] text-white px-2 py-1 rounded-md font-black">
                      {item.placa}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-black text-gray-800">{item.projeto}</td>
                  <td className="px-6 py-4 font-medium text-gray-600 uppercase">{item.nome_motorista || '---'}</td>
                  <td className="px-6 py-4 text-right tabular-nums">
                    <div>{item.litros.toFixed(2)} L</div>
                    <div className="text-[10px] text-gray-400">{item.km_rodados_horas} KM</div>
                  </td>
                  <td className="px-6 py-4 text-right font-black text-gray-900 bg-green-50/30">
                    {item.valor_emissao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td className="px-6 py-4 truncate max-w-[150px] uppercase font-bold text-gray-400">
                    {item.estabelecimento}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
