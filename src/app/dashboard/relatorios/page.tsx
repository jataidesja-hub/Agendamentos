"use client";

import { useState } from "react";
import { 
  ChartBarSquareIcon, 
  MapPinIcon, 
  BuildingStorefrontIcon, 
  TruckIcon
} from "@heroicons/react/24/outline";
import MapaRelatorio from "./MapaRelatorio";
import RelatorioPostos from "./RelatorioPostos";
import RelatorioGestores from "./RelatorioGestores";
import { UserGroupIcon } from "@heroicons/react/24/outline";

export default function Relatorios() {
  const [activeTab, setActiveTab] = useState<'projetos' | 'postos' | 'gestores'>('projetos');

  return (
    <div className="h-full flex flex-col p-6 gap-6">
      {/* Header Info */}
      <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-[2.5rem] p-8 border border-white/40 shadow-xl w-full flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-gradient-to-br from-[#0b7336] to-[#298d4a] rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/30">
            <ChartBarSquareIcon className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight italic uppercase">Relatórios de Abastecimento</h2>
            <p className="text-gray-500 dark:text-gray-400 text-xs font-black tracking-widest uppercase mt-1">
              Indicadores de consumo, frota ativa e custo por estabelecimento
            </p>
          </div>
        </div>
        <div className="hidden md:flex gap-2 bg-gray-100/50 dark:bg-gray-900/50 p-1.5 rounded-3xl border border-gray-200/50 dark:border-gray-700/50">
          <button 
            onClick={() => setActiveTab('projetos')}
            className={`flex items-center gap-2 px-6 py-3 rounded-2.5xl text-xs font-black tracking-widest transition-all ${
              activeTab === 'projetos' 
              ? 'bg-[#0b7336] text-white shadow-lg shadow-green-500/20' 
              : 'text-gray-500 hover:text-green-600'
            }`}
          >
            <TruckIcon className="w-4 h-4" />
            PROJETOS
          </button>
          <button 
            onClick={() => setActiveTab('postos')}
            className={`flex items-center gap-2 px-6 py-3 rounded-2.5xl text-xs font-black tracking-widest transition-all ${
              activeTab === 'postos' 
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
              : 'text-gray-500 hover:text-blue-600'
            }`}
          >
            <BuildingStorefrontIcon className="w-4 h-4" />
            POSTOS
          </button>
          <button 
            onClick={() => setActiveTab('gestores')}
            className={`flex items-center gap-2 px-6 py-3 rounded-2.5xl text-xs font-black tracking-widest transition-all ${
              activeTab === 'gestores' 
              ? 'bg-orange-600 text-white shadow-lg shadow-orange-500/20' 
              : 'text-gray-500 hover:text-orange-600'
            }`}
          >
            <UserGroupIcon className="w-4 h-4" />
            GESTORES
          </button>
        </div>
      </div>

      {/* Conteúdo Dinâmico */}
      <div className="flex-1">
        {activeTab === 'projetos' ? (
          <div className="min-h-[600px]">
            <MapaRelatorio />
          </div>
        ) : activeTab === 'postos' ? (
          <RelatorioPostos />
        ) : (
          <RelatorioGestores />
        )}
      </div>
    </div>
  );
}
