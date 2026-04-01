import { ChartBarSquareIcon } from "@heroicons/react/24/outline";

export default function Relatorios() {
  return (
    <div className="h-full flex flex-col items-center justify-center">
      <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-3xl p-12 text-center border border-white/40 shadow-xl max-w-lg w-full">
        <div className="w-24 h-24 bg-gradient-to-br from-[#0b7336] to-[#298d4a] rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/30">
          <ChartBarSquareIcon className="w-12 h-12 text-white" />
        </div>
        <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-4 tracking-tight">Relatórios Gerenciais</h2>
        <p className="text-gray-500 dark:text-gray-400 text-lg leading-relaxed">
          Este módulo está em desenvolvimento. Ele trará gráficos, estatísticas de uso, manutenções por torre, histórico de prioridades e o tempo de conclusão.
        </p>
        <div className="mt-8">
          <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-bold bg-green-50 text-[#0b7336] dark:bg-green-500/10 dark:text-green-400 border border-green-200 dark:border-green-500/20">
            Módulo Futuro
          </span>
        </div>
      </div>
    </div>
  );
}
