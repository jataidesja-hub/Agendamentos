"use client";
import { useEffect, useState } from "react";

interface Props {
  tema?: "blue" | "amber";
}

export default function InstallPWA({ tema = "blue" }: Props) {
  const [prompt, setPrompt] = useState<any>(null);
  const [mostrar, setMostrar] = useState(false);
  const [instalado, setInstalado] = useState(false);

  useEffect(() => {
    // Registra service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    // Verifica se já está instalado (standalone = já abriu como app)
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalado(true);
      return;
    }

    const dismissed = localStorage.getItem("pwa-dismissed");
    if (dismissed) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e);
      setMostrar(true);
    };

    window.addEventListener("beforeinstallprompt", handler as any);
    return () => window.removeEventListener("beforeinstallprompt", handler as any);
  }, []);

  const instalar = async () => {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setInstalado(true);
    setMostrar(false);
    setPrompt(null);
  };

  const dispensar = () => {
    setMostrar(false);
    localStorage.setItem("pwa-dismissed", "1");
  };

  if (!mostrar || instalado) return null;

  const cor = tema === "amber"
    ? { bg: "bg-amber-500", text: "text-amber-600", ring: "ring-amber-400", emoji: "🚌" }
    : { bg: "bg-blue-600", text: "text-blue-600", ring: "ring-blue-400", emoji: "🧍" };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[2000] p-4 animate-in slide-in-from-bottom duration-300">
      <div className="bg-gray-900 border border-gray-700 rounded-3xl p-4 shadow-2xl flex items-center gap-3">
        <div className={`w-12 h-12 rounded-2xl ${cor.bg} flex items-center justify-center text-2xl flex-shrink-0 shadow-lg`}>
          {cor.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-black text-sm leading-tight">Instalar aplicativo</p>
          <p className="text-gray-400 text-xs mt-0.5">Acesse offline e receba notificações</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={dispensar}
            className="px-3 py-2 rounded-xl text-gray-500 text-xs font-bold bg-gray-800 active:bg-gray-700"
          >
            Agora não
          </button>
          <button
            onClick={instalar}
            className={`px-4 py-2 rounded-xl text-white text-xs font-black ${cor.bg} active:opacity-80 shadow-lg`}
          >
            Instalar
          </button>
        </div>
      </div>
    </div>
  );
}
