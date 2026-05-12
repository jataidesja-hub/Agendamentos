"use client";
import { useEffect, useState } from "react";

interface Props {
  tema?: "blue" | "amber";
}

// Singleton — captura o evento nativo do Chrome Android
let _deferredPrompt: any = null;
const _listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  // Lê se o layout script já capturou antes deste módulo carregar
  if ((window as any).__pwaPrompt) _deferredPrompt = (window as any).__pwaPrompt;

  window.addEventListener("beforeinstallprompt", (e: Event) => {
    e.preventDefault();
    _deferredPrompt = e;
    (window as any).__pwaPrompt = e;
    _listeners.forEach(fn => fn());
  });

  // Layout scripts disparam este evento após capturar
  window.addEventListener("pwaPromptReady", () => {
    if ((window as any).__pwaPrompt && !_deferredPrompt) {
      _deferredPrompt = (window as any).__pwaPrompt;
      _listeners.forEach(fn => fn());
    }
  });
}

function isRunningStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
}

function detectDevice(): "ios" | "android" | "other" {
  if (typeof navigator === "undefined") return "other";
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) return "ios";
  if (/Android/i.test(navigator.userAgent)) return "android";
  return "other";
}

export function useInstallPrompt() {
  const [prompt, setPrompt] = useState<any>(() =>
    typeof window !== "undefined" ? (_deferredPrompt || (window as any).__pwaPrompt || null) : null
  );
  const [isStandalone, setIsStandalone] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setIsStandalone(isRunningStandalone());
    setChecked(true);

    // Re-lê caso o layout script tenha capturado antes deste efeito
    const latest = _deferredPrompt || (window as any).__pwaPrompt || null;
    if (latest) setPrompt(latest);

    const update = () => {
      const p = _deferredPrompt || (window as any).__pwaPrompt || null;
      setPrompt(p);
    };
    _listeners.add(update);
    window.addEventListener("pwaPromptReady", update);
    return () => {
      _listeners.delete(update);
      window.removeEventListener("pwaPromptReady", update);
    };
  }, []);

  const instalar = async (): Promise<"accepted" | "dismissed" | "instructions"> => {
    const p = prompt || (window as any).__pwaPrompt;
    if (!p) return "instructions";
    try {
      await p.prompt();
      const { outcome } = await p.userChoice;
      if (outcome === "accepted") {
        _deferredPrompt = null;
        (window as any).__pwaPrompt = null;
        setPrompt(null);
      }
      return outcome as any;
    } catch {
      return "instructions";
    }
  };

  const hasPrompt = !!(prompt || (typeof window !== "undefined" && (window as any).__pwaPrompt));
  const canInstall = checked && hasPrompt && !isStandalone;
  const showInstructions = checked && !isStandalone && !hasPrompt;
  const device = typeof window !== "undefined" ? detectDevice() : "other";

  return { canInstall, showInstructions, isStandalone, instalar, device };
}

export default function InstallPWA({ tema = "blue" }: Props) {
  const { canInstall, showInstructions, instalar, device } = useInstallPrompt();
  const [mostrar, setMostrar] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!canInstall && !showInstructions) return;
    const dismissed = localStorage.getItem("pwa-dismissed");
    if (!dismissed || Date.now() - parseInt(dismissed) >= 3 * 86400_000) {
      setMostrar(true);
    }
  }, [canInstall, showInstructions]);

  const handleInstalar = async () => {
    if (canInstall) {
      const result = await instalar();
      if (result === "accepted") { setMostrar(false); return; }
    }
    setShowModal(true);
  };

  const dispensar = () => {
    setMostrar(false);
    localStorage.setItem("pwa-dismissed", String(Date.now()));
  };

  const cor = tema === "amber";

  return (
    <>
      {mostrar && (
        <div className="fixed bottom-0 left-0 right-0 z-[2000] p-4 pointer-events-none">
          <div className={`pointer-events-auto bg-gray-900 border rounded-3xl p-4 shadow-2xl flex items-center gap-3 ${cor ? "border-amber-500/40" : "border-blue-500/40"}`}>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 ${cor ? "bg-amber-500" : "bg-blue-600"}`}>
              {cor ? "🚌" : "🧍"}
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
                className={`px-4 py-2 rounded-xl text-white text-xs font-black ${cor ? "bg-amber-500 active:bg-amber-600" : "bg-blue-600 active:bg-blue-700"}`}
              >
                Instalar
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-[3000] bg-black/80 flex items-end p-4" onClick={() => setShowModal(false)}>
          <div className="bg-gray-900 rounded-3xl p-6 w-full border border-gray-700 space-y-4" onClick={e => e.stopPropagation()}>
            <p className="text-white font-black text-base text-center">Adicionar à tela inicial</p>

            {device === "ios" ? (
              <div className="space-y-3">
                <div className="flex items-center gap-4 bg-gray-800 rounded-2xl p-3">
                  <span className="text-3xl flex-shrink-0">⎋</span>
                  <p className="text-gray-300 text-sm">Toque no botão <span className="text-white font-bold">Compartilhar</span> na barra do Safari</p>
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
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-4 bg-gray-800 rounded-2xl p-3">
                  <span className="text-3xl flex-shrink-0">⋮</span>
                  <p className="text-gray-300 text-sm">Toque no menu <span className="text-white font-bold">⋮</span> no canto superior direito do Chrome</p>
                </div>
                <div className="flex items-center gap-4 bg-gray-800 rounded-2xl p-3">
                  <span className="text-3xl flex-shrink-0">📲</span>
                  <p className="text-gray-300 text-sm">Toque em <span className="text-white font-bold">"Adicionar à tela inicial"</span> ou <span className="text-white font-bold">"Instalar app"</span></p>
                </div>
                <div className="flex items-center gap-4 bg-gray-800 rounded-2xl p-3">
                  <span className="text-3xl flex-shrink-0">✅</span>
                  <p className="text-gray-300 text-sm">Confirme tocando em <span className="text-white font-bold">Adicionar</span></p>
                </div>
              </div>
            )}

            <button onClick={() => setShowModal(false)} className="w-full py-3.5 bg-gray-700 rounded-2xl text-white font-bold">
              Entendi
            </button>
          </div>
        </div>
      )}
    </>
  );
}
