import { ChartBarSquareIcon } from "@heroicons/react/24/outline";
import dynamic from 'next/dynamic';

const MapaProjetos = dynamic(() => import("./MapaProjetos"), { 
  ssr: false,
  loading: () => <div className="h-[600px] w-full animate-pulse bg-gray-100 rounded-3xl" />
});

export default function Relatorios() {
  return (
    <div className="h-full flex flex-col p-6 gap-6">
      {/* Header Info */}
      <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-3xl p-8 border border-white/40 shadow-xl w-full flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-gradient-to-br from-[#0b7336] to-[#298d4a] rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/30">
            <ChartBarSquareIcon className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Relatórios Geográficos</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
              Visualize a distribuição das torres e projetos em tempo real.
            </p>
          </div>
        </div>
        <div className="hidden md:block">
          <span className="inline-flex items-center px-4 py-2 rounded-full text-xs font-black bg-green-50 text-[#0b7336] dark:bg-green-500/10 dark:text-green-400 border border-green-200 dark:border-green-500/20">
            Módulo Operacional
          </span>
        </div>
      </div>

      {/* Mapa Interativo */}
      <div className="flex-1 min-h-[600px]">
        <MapaProjetos />
      </div>
    </div>
  );
}
