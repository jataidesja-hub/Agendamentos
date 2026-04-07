import { BellAlertIcon } from "@heroicons/react/24/outline";

export default function Alertas() {
  return (
    <div className="h-full flex flex-col items-center justify-center">
      <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-3xl p-12 text-center border border-white/40 shadow-xl max-w-lg w-full">
        <div className="w-24 h-24 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-red-500/30">
          <BellAlertIcon className="w-12 h-12 text-white" />
        </div>
        <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-4 tracking-tight">Central de Alertas</h2>
        <p className="text-gray-500 dark:text-gray-400 text-lg leading-relaxed">
          Este módulo está em desenvolvimento. Aqui você irá visualizar todas as notificações urgentes e os eventos que foram marcados com a tag "Alerta" no painel principal.
        </p>
        <div className="mt-8">
          <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-bold bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 border border-red-200 dark:border-red-500/20">
            Em breve
          </span>
        </div>
      </div>
    </div>
  );
}
