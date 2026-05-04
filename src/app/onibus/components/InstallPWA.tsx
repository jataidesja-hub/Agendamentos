"use client";
import { useEffect, useState } from "react";

interface Props {
  tema?: "blue" | "amber";
}

export default function InstallPWA({ tema = "blue" }: Props) {
  const [prompt, setPrompt] = useState<any>(null);
  const [mostrar, setMostrar] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;

    setIsStandalone(standalone);
    if (standalone) return;

    // Não mostrar banner se dispensou recentemente (7 dias)
    const dismissed = localStorage.getItem("pwa-dismissed");
    if (dismissed && Date.now() - parseInt(dismissed) < 7 * 86400_000) return;

    const win = window as any;

    const aplicar = (e: any) => {
      win.__pwaPrompt = e;
      setPrompt(e);
      setMostrar(true);
    };

    // Evento já capturado antes do componente montar (via layout script)
    if (win.__pwaPrompt) {
      aplicar(win.__pwaPrompt);
      return;
    }

    // Captura direta (fallback se layout script não rodou)
    const handler = (e: Event) => {
      e.preventDefault();
      aplicar(e);
    };
    window.addEventListener("beforeinstallprompt", handler as any);

    // Escuta evento custom disparado pelo layout script
    const onReady = () => { if (win.__pwaPrompt) aplicar(win.__pwaPrompt); };
    window.addEventListener("pwaPromptReady", onReady);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler as any);
      window.removeEventListener("pwaPromptReady", onReady);
    };
  }, []);

  const instalar = async () => {
    if (!prompt) {
      setShowInstructions(true);
      return;
    }
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setIsStandalone(true);
    setMostrar(false);
    setPrompt(null);
  };

  const dispensar = () => {
    setMostrar(false);
    localStorage.setItem("pwa-dismissed", String(Date.now()));
  };

  // Botão fixo no header quando não instalado e não mostrando banner
  const corBtn = tema === "amber"
    ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
    : "bg-blue-600/20 text-blue-400 border-blue-500/30";

  if (isStandalone) return null;

  return (
    <>
      {/* Botão compacto sempre visível no header (renderizado pelo parent via slot) */}
      {!mostrar && (
        <button
          id="pwa-install-btn"
          onClick={instalar}
          className={`hidden items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold ${corBtn}`}
          style={{ display: "none" }} // visibilidade controlada pelo parent
        >
          ⬇ Instalar
        </button>
      )}

      {/* Banner deslizante */}
      {mostrar && (
        <div className="fixed bottom-0 left-0 right-0 z-[2000] p-4">
          <div className={`bg-gray-900 border rounded-3xl p-4 shadow-2xl flex items-center gap-3 ${tema === "amber" ? "border-amber-500/30" : "border-blue-500/30"}`}>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 shadow-lg ${tema === "amber" ? "bg-amber-500" : "bg-blue-600"}`}>
              {tema === "amber" ? "🚌" : "🧍"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-black text-sm">Instalar aplicativo</p>
              <p className="text-gray-400 text-xs mt-0.5">Acesse direto da tela inicial, funciona offline</p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={dispensar} className="px-3 py-2 rounded-xl text-gray-500 text-xs font-bold bg-gray-800 active:bg-gray-700">
                Depois
              </button>
              <button onClick={instalar} className={`px-4 py-2 rounded-xl text-white text-xs font-black active:opacity-80 shadow-lg ${tema === "amber" ? "bg-amber-500" : "bg-blue-600"}`}>
                Instalar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Instruções manuais (iOS Safari não suporta beforeinstallprompt) */}
      {showInstructions && (
        <div className="fixed inset-0 z-[3000] bg-black/70 flex items-end p-4" onClick={() => setShowInstructions(false)}>
          <div className="bg-gray-900 rounded-3xl p-6 w-full border border-gray-700 space-y-4" onClick={e => e.stopPropagation()}>
            <p className="text-white font-black text-base">Como instalar o app</p>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-xs font-black text-white flex-shrink-0">1</div>
                <p className="text-gray-300 text-sm">Toque no ícone <span className="text-white font-bold">⎋ Compartilhar</span> na barra do navegador</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-xs font-black text-white flex-shrink-0">2</div>
                <p className="text-gray-300 text-sm">Role para baixo e toque em <span className="text-white font-bold">"Adicionar à Tela de Início"</span></p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-xs font-black text-white flex-shrink-0">3</div>
                <p className="text-gray-300 text-sm">Confirme tocando em <span className="text-white font-bold">Adicionar</span></p>
              </div>
            </div>
            <button onClick={() => setShowInstructions(false)} className="w-full py-3 bg-gray-700 rounded-2xl text-white font-bold text-sm">
              Entendi
            </button>
          </div>
        </div>
      )}
    </>
  );
}
