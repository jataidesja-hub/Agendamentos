"use client";
import Link from "next/link";

export default function OnibusHome() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center mb-10">
          <div className="w-20 h-20 rounded-3xl bg-amber-500 flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-amber-500/30">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h8M8 11h8M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" />
            </svg>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Ônibus CYMI</h1>
          <p className="text-gray-400 text-sm mt-1">Monitoramento em tempo real</p>
        </div>

        <Link href="/onibus/app" className="block w-full p-5 bg-blue-600 hover:bg-blue-500 rounded-3xl text-white font-black text-lg text-center transition-all active:scale-95 shadow-xl shadow-blue-600/30">
          <div className="text-3xl mb-1">🧍</div>
          Sou Passageiro
          <p className="text-blue-200 text-xs font-medium mt-0.5">Ver ônibus e rotas</p>
        </Link>

        <Link href="/onibus/motorista" className="block w-full p-5 bg-amber-500 hover:bg-amber-400 rounded-3xl text-white font-black text-lg text-center transition-all active:scale-95 shadow-xl shadow-amber-500/30">
          <div className="text-3xl mb-1">🚌</div>
          Sou Motorista
          <p className="text-amber-100 text-xs font-medium mt-0.5">Iniciar rota e navegação</p>
        </Link>

        <Link href="/onibus/admin" className="block w-full p-4 bg-gray-800 hover:bg-gray-700 rounded-3xl text-white font-bold text-base text-center transition-all active:scale-95 border border-gray-700">
          <div className="text-2xl mb-0.5">⚙️</div>
          Administrador
          <p className="text-gray-400 text-xs font-medium mt-0.5">Gerenciar rotas e usuários</p>
        </Link>
      </div>
    </div>
  );
}
