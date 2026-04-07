"use client";

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  MagnifyingGlassIcon, 
  MapPinIcon,
  TableCellsIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function ProjetosList() {
  const [projetos, setProjetos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchProjetos();
  }, []);

  async function fetchProjetos() {
    setLoading(true);
    try {
      // Busca nomes únicos de projetos na tabela de abastecimentos
      const { data, error } = await supabase
        .from('abastecimentos')
        .select('projeto')
        .order('projeto', { ascending: true });

      if (error) throw error;
      
      const uniqueProjects = Array.from(new Set((data || []).map((d: any) => d.projeto))).filter(p => !!p);
      setProjetos(uniqueProjects as string[]);
    } catch (error) {
      console.error('Erro ao buscar projetos:', error);
      toast.error('Erro ao carregar lista de projetos');
    } finally {
      setLoading(false);
    }
  }

  const filteredProjetos = useMemo(() => {
    return projetos.filter(p => p.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [projetos, searchTerm]);

  return (
    <div className="flex flex-col gap-8 w-full p-6">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-[3rem] shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tighter">Projetos Ativos</h2>
          <p className="text-gray-500 font-medium text-sm mt-1">Lista de projetos detectados automaticamente via base de dados.</p>
        </div>
        <div className="relative w-full md:w-96">
          <MagnifyingGlassIcon className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder="Pesquisar projeto..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-6 py-4 bg-gray-50 border-0 rounded-2xl text-sm focus:ring-2 focus:ring-[#0b7336]/20 font-medium"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
           {[1,2,3,4,5,6].map(i => <div key={i} className="h-32 bg-gray-100 rounded-[2rem]"></div>)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {filteredProjetos.map((p) => (
            <div key={p} className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm hover:border-[#0b7336]/30 hover:shadow-xl hover:shadow-[#0b7336]/5 transition-all group flex items-start gap-4">
              <div className="p-4 bg-green-50 rounded-2xl group-hover:bg-[#0b7336] transition-colors">
                <MapPinIcon className="w-6 h-6 text-[#0b7336] group-hover:text-white" />
              </div>
              <div>
                <h4 className="text-xl font-black text-gray-900 group-hover:text-[#0b7336] transition-colors uppercase leading-tight">{p}</h4>
                <div className="flex items-center gap-2 mt-2">
                  <TableCellsIcon className="w-4 h-4 text-gray-300" />
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Sincronizado via Planilha</span>
                </div>
              </div>
            </div>
          ))}
          {filteredProjetos.length === 0 && !loading && (
            <div className="col-span-full py-20 text-center bg-gray-50 rounded-[3rem] border-2 border-dashed border-gray-100">
               <p className="text-gray-400 font-bold">Nenhum projeto encontrado. Importe uma planilha para começar.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
