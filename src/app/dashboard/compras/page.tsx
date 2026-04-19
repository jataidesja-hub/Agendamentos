"use client";

import { useState } from "react";
import {
  ShoppingCartIcon,
  CubeIcon,
  BuildingOfficeIcon,
  ScaleIcon,
  ClipboardDocumentListIcon,
} from "@heroicons/react/24/outline";
import TabCompras from "./TabCompras";
import TabCotacoes from "./TabCotacoes";
import TabProdutos from "./TabProdutos";
import TabFornecedores from "./TabFornecedores";

const TABS = [
  { id: "compras", label: "Compras", shortLabel: "Compras", icon: ClipboardDocumentListIcon },
  { id: "cotacoes", label: "Cotações", shortLabel: "Cotações", icon: ScaleIcon },
  { id: "produtos", label: "Produtos", shortLabel: "Produtos", icon: CubeIcon },
  { id: "fornecedores", label: "Fornecedores", shortLabel: "Fornec.", icon: BuildingOfficeIcon },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function ComprasPage() {
  const [activeTab, setActiveTab] = useState<TabId>("compras");

  return (
    <div className="min-h-full bg-gray-50 dark:bg-gray-950 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0b7336] to-[#298d4a] shadow-lg shadow-green-500/30 flex items-center justify-center flex-shrink-0">
            <ShoppingCartIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Gestão de Compras</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">CYMI O&M · Controle de processos, cotações e fornecedores</p>
          </div>
        </div>

        {/* Fluxo do analista */}
        <div className="mt-4 flex items-center gap-1.5 overflow-x-auto pb-1">
          {[
            { label: "Solicitação", color: "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300" },
            { label: "↓" },
            { label: "Cotações (3)", color: "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300" },
            { label: "↓" },
            { label: "Análise", color: "bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300" },
            { label: "↓" },
            { label: "Aprovação", color: "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300" },
            { label: "↓" },
            { label: "Liberado", color: "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" },
            { label: "↓" },
            { label: "Pedido", color: "bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300" },
          ].map((step, i) =>
            step.color ? (
              <span key={i} className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${step.color}`}>
                {step.label}
              </span>
            ) : (
              <span key={i} className="text-gray-400 text-xs">{step.label}</span>
            )
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden shadow-sm mb-4">
        <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold whitespace-nowrap transition-all border-b-2 -mb-px ${
                  isActive
                    ? "border-[#0b7336] text-[#0b7336] dark:text-green-400 bg-[#0b7336]/5"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/30"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Conteúdo da aba */}
      <div>
        {activeTab === "compras" && <TabCompras />}
        {activeTab === "cotacoes" && <TabCotacoes />}
        {activeTab === "produtos" && <TabProdutos />}
        {activeTab === "fornecedores" && <TabFornecedores />}
      </div>
    </div>
  );
}
