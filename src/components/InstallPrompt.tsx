"use client";

import { useEffect, useState } from "react";
import { ArrowUpTrayIcon, XMarkIcon } from "@heroicons/react/24/outline";

export default function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Verifica se é iOS
    const isIos = () => {
      const userAgent = window.navigator.userAgent.toLowerCase();
      return /iphone|ipad|ipod/.test(userAgent);
    };

    // Verifica se já está instalado (standalone)
    const isInStandaloneMode = () => {
      return ('standalone' in window.navigator) && (window.navigator as any).standalone;
    };

    // Mostrar se for iOS e não estiver instalado, e se não foi fechado hoje
    if (isIos() && !isInStandaloneMode()) {
      const lastDismissed = localStorage.getItem("iosInstallPromptDismissed");
      const today = new Date().toLocaleDateString();
      if (lastDismissed !== today) {
        // Pequeno atraso para não assustar o usuário assim que abre a página
        setTimeout(() => setShowPrompt(true), 2000);
      }
    }
  }, []);

  const dismiss = () => {
    setShowPrompt(false);
    localStorage.setItem("iosInstallPromptDismissed", new Date().toLocaleDateString());
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed inset-x-0 bottom-24 mx-4 md:hidden z-[60] animate-bounce-short">
      <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-3xl shadow-2xl rounded-3xl p-5 border border-white/40 dark:border-gray-700/50 relative overflow-hidden">
        <div className="absolute -left-12 -top-12 w-24 h-24 bg-[#0b7336]/20 rounded-full blur-2xl"></div>
        <button onClick={dismiss} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <XMarkIcon className="w-5 h-5" />
        </button>
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-gradient-to-br from-[#0b7336] to-[#298d4a] rounded-xl flex items-center justify-center mb-3 shadow-lg shadow-green-500/20">
            <span className="text-white font-black text-xl">C</span>
          </div>
          <h3 className="font-bold text-gray-900 dark:text-white text-lg">Instale o App CYMI</h3>
          <p className="text-gray-600 dark:text-gray-300 text-sm mt-2 font-medium">
            Para instalar no seu iPhone e acessar rápido:
          </p>
          <div className="mt-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-4 w-full flex items-center justify-center space-x-3 border border-gray-100 dark:border-gray-700">
            <span className="text-sm font-bold text-gray-700 dark:text-gray-200">1. Toque em</span>
            <div className="bg-white dark:bg-gray-800 p-1.5 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <ArrowUpTrayIcon className="w-5 h-5 text-blue-500" />
            </div>
          </div>
          <div className="mt-2 bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-4 w-full border border-gray-100 dark:border-gray-700">
            <span className="text-sm font-bold text-gray-700 dark:text-gray-200">2. Role para baixo e selecione <br/><span className="text-gray-900 dark:text-white bg-white dark:bg-gray-800 px-2 py-1 rounded-md inline-block mt-2 shadow-sm border border-gray-100 dark:border-gray-700">Adicionar à Tela de Início</span></span>
          </div>
        </div>
      </div>
      {/* Triângulo apontando para baixo (dock do iOS) */}
      <div className="w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[12px] border-t-white/95 dark:border-t-gray-800/95 absolute -bottom-3 left-1/2 transform -translate-x-1/2 drop-shadow-md"></div>
    </div>
  );
}
