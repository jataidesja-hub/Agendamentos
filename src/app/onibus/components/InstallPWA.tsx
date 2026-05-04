"use client";
import { useEffect, useState } from "react";

interface Props {
  tema?: "blue" | "amber";
}

// Singleton global para o deferred prompt
let _deferredPrompt: any = null;
const _listeners = new Set<() => void>();

function notifyListeners() {
  _listeners.forEach(fn => fn());
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e: Event) => {
    e.preventDefault();
    _deferredPrompt = e;
    (window as any).__pwaPrompt = e;
    notifyListeners();
  });
}

export function useInstallPrompt() {
  const [prompt, setPrompt] = useState<any>(_deferredPrompt);
  const [isStandalone, setIsStandalone] = useState(true);

  useEffect(() => {
    setIsStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true
    );

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    // Pega se já estava capturado antes do componente montar
    if (_deferredPrompt) setPrompt(_deferredPrompt);

    const update = () => setPrompt(_deferredPrompt);
    _listeners.add(update);
    return () => { _listeners.delete(update); };
  }, []);

  const instalar = async (): Promise<"accepted" | "dismissed" | "instructions"> => {
    if (!prompt) return "instructions";
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    _deferredPrompt = null;
    (window as any).__pwaPrompt = null;
    setPrompt(null);
    return outcome as any;
  };

  return { canInstall: !!prompt && !isStandalone, isStandalone, instalar };
}

export default function InstallPWA({ tema = "blue" }: Props) {
  const { canInstall, instalar } = useInstallPrompt();
  const [mostrar, setMostrar] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    if (!canInstall) return;
    const dismissed = localStorage.getItem("pwa-dismissed");
    // Banner só aparece se não dispensou nos últimos 3 dias
    if (!dismissed || Date.now() - parseInt(dismissed) >= 3 * 86400_000) {
      setMostrar(true);
    }
  }, [canInstall]);

  const handleInstalar = async () => {
    const result = await instalar();
    if (result === "instructions") setShowInstructions(true);
    else setMostrar(false);
  };

  const dispensar = () => {
    setMostrar(false);
    localStorage.setItem("pwa-dismissed", String(Date.now()));
  };

  return (
    <>
      {/* Banner automático */}
      {mostrar && (
        <div className="fixed bottom-0 left-0 right-0 z-[2000] p-4 pointer-events-none">
          <div
            className={`pointer-events-auto bg-gray-900 border rounded-3xl p-4 shadow-2xl flex items-center gap-3 ${
              tema === "amber" ? "border-amber-500/40" : "border-blue-500/40"
            }`}
          >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 ${tema === "amber" ? "bg-amber-500" : "bg-blue-600"}`}>
              {tema === "amber" ? "🚌" : "🧍"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-black text-sm">Instalar aplicativo</p>
              <p className="text-gray-400 text-xs mt-0.5">Acesse da tela inicial sem abrir o navegador</p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={dispensar} className="px-3 py-2 rounded-xl text-gray-500 text-xs font-bold bg-gray-800 active:bg-gray-700">
                Depois
              </button>
              <button
                onClick={handleInstalar}
                className={`px-4 py-2 rounded-xl text-white text-xs font-black ${tema === "amber" ? "bg-amber-500 active:bg-amber-600" : "bg-blue-600 active:bg-blue-700"}`}
              >
                Instalar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Instruções para iOS */}
      {showInstructions && (
        <div className="fixed inset-0 z-[3000] bg-black/80 flex items-end p-4" onClick={() => setShowInstructions(false)}>
          <div className="bg-gray-900 rounded-3xl p-6 w-full border border-gray-700 space-y-4" onClick={e => e.stopPropagation()}>
            <p className="text-white font-black text-base text-center">Adicionar à tela inicial</p>
            <div className="space-y-4">
              <div className="flex items-center gap-4 bg-gray-800 rounded-2xl p-3">
                <span className="text-3xl flex-shrink-0">⎋</span>
                <p className="text-gray-300 text-sm">Toque no botão <span className="text-white font-bold">Compartilhar</span> na barra do navegador</p>
              </div>
              <div className="flex items-center gap-4 bg-gray-800 rounded-2xl p-3">
                <span className="text-3xl flex-shrink-0">➕</span>
                <p className="text-gray-300 text-sm">Role e toque em <span className="text-white font-bold">"Adicionar à Tela de Início"</span></p>
              </div>
              <div className="flex items-center gap-4 bg-gray-800 rounded-2xl p-3">
                <span className="text-3xl flex-shrink-0">✅</span>
                <p className="text-gray-300 text-sm">Confirme tocando em <span className="text-white font-bold">Adicionar</span></p>
              </div>
            </div>
            <button onClick={() => setShowInstructions(false)} className="w-full py-3.5 bg-gray-700 rounded-2xl text-white font-bold">
              Entendi
            </button>
          </div>
        </div>
      )}
    </>
  );
}
