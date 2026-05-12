"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import type { PosicaoMapa } from "../components/MapaLeaflet";

const MapaLeaflet = dynamic(() => import("../components/MapaLeaflet"), { ssr: false });

function ModalInstalacaoAndroid({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[3000] bg-black/85 flex items-end p-4" onClick={onClose}>
      <div className="bg-gray-900 rounded-3xl p-6 w-full border border-amber-500/30 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-2xl bg-amber-500 flex items-center justify-center text-xl flex-shrink-0">🚌</div>
          <div>
            <p className="text-white font-black text-base">Instalar aplicativo</p>
            <p className="text-gray-400 text-xs">Motorista CYMI</p>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-4 bg-gray-800 rounded-2xl p-3">
            <span className="text-2xl flex-shrink-0 w-8 text-center">⋮</span>
            <p className="text-gray-300 text-sm">Toque no menu <span className="text-white font-bold">⋮</span> no canto superior direito do Chrome</p>
          </div>
          <div className="flex items-center gap-4 bg-gray-800 rounded-2xl p-3">
            <span className="text-2xl flex-shrink-0 w-8 text-center">📲</span>
            <p className="text-gray-300 text-sm">Toque em <span className="text-white font-bold">"Adicionar à tela inicial"</span></p>
          </div>
          <div className="flex items-center gap-4 bg-gray-800 rounded-2xl p-3">
            <span className="text-2xl flex-shrink-0 w-8 text-center">✅</span>
            <p className="text-gray-300 text-sm">Confirme tocando em <span className="text-white font-bold">Adicionar</span></p>
          </div>
        </div>
        <p className="text-gray-600 text-xs text-center">Após instalar, o app continua funcionando mesmo ao trocar de tela</p>
        <button onClick={onClose} className="w-full py-3 bg-amber-500 rounded-2xl text-white font-black">
          Entendi
        </button>
      </div>
    </div>
  );
}

/* ── Banner de instalação automático ─────────────────────────────────── */
function BannerInstalarPWA({
  onInstalar,
  onFechar,
}: {
  onInstalar: () => void;
  onFechar: () => void;
}) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-[2500] p-4 animate-slide-up">
      <div className="bg-gradient-to-r from-amber-600 to-amber-500 rounded-2xl p-4 shadow-2xl shadow-amber-500/30 border border-amber-400/30">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-2xl flex-shrink-0 backdrop-blur-sm">
            🚌
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-black text-sm">Instalar Motorista CYMI</p>
            <p className="text-amber-100/80 text-xs mt-0.5">
              Instale o app para acesso rápido e uso offline
            </p>
          </div>
          <button
            onClick={onFechar}
            className="text-amber-200/60 hover:text-white text-lg px-1 flex-shrink-0"
          >
            ✕
          </button>
        </div>
        <button
          onClick={onInstalar}
          className="w-full mt-3 py-3 bg-white rounded-xl text-amber-700 font-black text-sm active:scale-95 transition-all shadow-lg"
        >
          📲 Instalar agora
        </button>
      </div>
    </div>
  );
}

interface Motorista { id: string; nome: string; }
interface Rota { id: string; nome: string; cor: string; }
interface Ponto { id: string; lat: number; lng: number; nome: string; ordem: number; tipo: string; }

export default function AppMotorista() {
  const router = useRouter();
  const [pwaPrompt, setPwaPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(true); // assume true to avoid flash
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [motorista, setMotorista] = useState<Motorista | null>(null);
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [rotaSelecionada, setRotaSelecionada] = useState<Rota | null>(null);
  const [paradas, setParadas] = useState<Ponto[]>([]);
  const [rotaGeometria, setRotaGeometria] = useState<{ lat: number; lng: number }[]>([]);
  const [carregandoRota, setCarregandoRota] = useState(false);
  const [posicoes, setPosicoes] = useState<PosicaoMapa[]>([]);
  const [viagemId, setViagemId] = useState<string | null>(null);
  const [emRota, setEmRota] = useState(false);
  const [minhaPos, setMinhaPos] = useState<{ lat: number; lng: number } | null>(null);
  const [aba, setAba] = useState<"mapa" | "passageiros">("mapa");
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const wakeLockRef = useRef<any>(null);
  const offlineQueueRef = useRef<any[]>([]);
  const [online, setOnline] = useState(true);
  const [telaAtiva, setTelaAtiva] = useState(false);

  // Refs para closures estáveis no realtime
  const minhaPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const paradasRef = useRef<Ponto[]>([]);
  const motoristaRef = useRef<Motorista | null>(null);
  const rotaRef = useRef<Rota | null>(null);
  useEffect(() => { minhaPosRef.current = minhaPos; }, [minhaPos]);
  useEffect(() => { paradasRef.current = paradas; }, [paradas]);
  useEffect(() => { motoristaRef.current = motorista; }, [motorista]);
  useEffect(() => { rotaRef.current = rotaSelecionada; }, [rotaSelecionada]);

  // ── Função centralizada para acionar instalação ─────────────────────────
  const acionarInstalacao = useCallback(() => {
    const prompt = pwaPrompt || (window as any).__pwaPrompt;

    // SEMPRE mostra as instruções manuais imediatamente
    setShowInstallModal(true);
    setShowBanner(false);

    // Tenta o prompt nativo em paralelo (fire-and-forget)
    if (prompt) {
      try {
        prompt.prompt();
        prompt.userChoice.then((result: any) => {
          if (result.outcome === "accepted") {
            setShowInstallModal(false);
            setIsStandalone(true);
          }
          setPwaPrompt(null);
          (window as any).__pwaPrompt = null;
        }).catch(() => {
          setPwaPrompt(null);
          (window as any).__pwaPrompt = null;
        });
      } catch {
        setPwaPrompt(null);
        (window as any).__pwaPrompt = null;
      }
    }
  }, [pwaPrompt]);

  // PWA setup + restaura sessão
  useEffect(() => {
    // Detecta se já está instalado como standalone
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;
    setIsStandalone(standalone);

    // Pega prompt que o beforeInteractive script já capturou
    if ((window as any).__pwaPrompt) {
      setPwaPrompt((window as any).__pwaPrompt);
    }

    // Escuta caso o prompt chegue depois
    const onPromptReady = () => {
      if ((window as any).__pwaPrompt) {
        setPwaPrompt((window as any).__pwaPrompt);
      }
    };
    window.addEventListener("pwaPromptReady", onPromptReady);

    // Escuta também o evento nativo diretamente (redundância)
    const handlePrompt = (e: Event) => {
      e.preventDefault();
      setPwaPrompt(e);
      (window as any).__pwaPrompt = e;
    };
    window.addEventListener("beforeinstallprompt", handlePrompt as any);

    // Restaura sessão salva (Android mata o tab em background)
    try {
      const saved = localStorage.getItem("motorista_sessao");
      if (saved) {
        const s = JSON.parse(saved);
        setMotorista({ id: s.motoristaId, nome: s.motoristaNome });
        setRotaSelecionada({ id: s.rotaId, nome: s.rotaNome, cor: s.rotaCor });
        setViagemId(s.viagemId);
        setEmRota(true);
        solicitarWakeLock();
      }
    } catch {}

    // ── Auto-mostra banner de instalação ───────────────────────────────
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (!standalone) {
      const dismissed = sessionStorage.getItem("pwa-banner-dismissed");
      if (!dismissed) {
        timer = setTimeout(() => {
          // Verifica novamente standalone (pode ter mudado)
          const isNowStandalone =
            window.matchMedia("(display-mode: standalone)").matches ||
            (navigator as any).standalone === true;
          if (!isNowStandalone) {
            setShowBanner(true);
          }
        }, 2000);
      }
    }

    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("pwaPromptReady", onPromptReady);
      window.removeEventListener("beforeinstallprompt", handlePrompt as any);
    };
  }, []);

  useEffect(() => {
    supabase.from("onibus_perfis").select("id, nome").eq("tipo", "motorista").order("nome")
      .then(({ data }) => setMotoristas(data || []));
    supabase.from("onibus_rotas").select("id, nome, cor").eq("ativa", true)
      .then(({ data }) => setRotas(data || []));

    // Detecta conectividade
    const handleOnline = async () => {
      setOnline(true);
      // Envia última posição da fila ao reconectar
      const q = offlineQueueRef.current;
      if (q.length > 0) {
        const last = q[q.length - 1];
        offlineQueueRef.current = [];
        try { await supabase.from("onibus_posicoes").upsert(last, { onConflict: "referencia_id" }); } catch {}
      }
    };
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    setOnline(navigator.onLine);
    return () => { window.removeEventListener("online", handleOnline); window.removeEventListener("offline", handleOffline); };
  }, []);

  // Ao selecionar rota: busca paradas + calcula OSRM pelos waypoints
  useEffect(() => {
    if (!rotaSelecionada) { setParadas([]); setRotaGeometria([]); return; }
    const carregar = async () => {
      setCarregandoRota(true);
      const { data: todos } = await supabase.from("onibus_pontos")
        .select("*").eq("rota_id", rotaSelecionada.id).order("ordem");
      const wps = (todos || []).filter((p: Ponto) => p.tipo === "waypoint");
      const pds = (todos || []).filter((p: Ponto) => p.tipo === "parada");
      setParadas(pds);
      const base = wps.length >= 2 ? wps : pds;
      if (base.length >= 2) {
        try {
          const coords = base.map((p: Ponto) => `${p.lng},${p.lat}`).join(";");
          const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?geometries=geojson&overview=full`);
          const data = await res.json();
          if (data.routes?.[0]) {
            setRotaGeometria(data.routes[0].geometry.coordinates.map(([lng, lat]: number[]) => ({ lat, lng })));
          }
        } catch {
          setRotaGeometria(base.map((p: Ponto) => ({ lat: p.lat, lng: p.lng })));
        }
      }
      setCarregandoRota(false);
    };
    carregar();
  }, [rotaSelecionada?.id]);

  // watchPosition — continua em segundo plano, sem timer JavaScript (que é congelado pelo SO)
  useEffect(() => {
    if (!emRota || !motorista) return;

    const onPos = async (pos: GeolocationPosition) => {
      const m = motoristaRef.current;
      const r = rotaRef.current;
      if (!m) return;
      const { latitude: lat, longitude: lng, speed } = pos.coords;
      setMinhaPos({ lat, lng });
      const payload = {
        referencia_id: m.id, tipo: "motorista", nome: m.nome, lat, lng,
        velocidade: speed ? speed * 3.6 : 0,
        rota_ativa_id: r?.id || null,
        atualizado_em: new Date().toISOString(),
      };
      if (navigator.onLine) {
        try {
          await supabase.from("onibus_posicoes").upsert(payload, { onConflict: "referencia_id" });
          offlineQueueRef.current = []; // limpa fila ao enviar com sucesso
        } catch {
          offlineQueueRef.current.push(payload);
        }
      } else {
        // Sem internet: guarda na fila (mantém só últimas 50)
        offlineQueueRef.current.push(payload);
        if (offlineQueueRef.current.length > 50) offlineQueueRef.current.shift();
      }
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      onPos,
      undefined,
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [emRota, motorista?.id]);

  // Realtime passageiros — subscription estável
  useEffect(() => {
    if (!emRota || !motorista) return;
    const carregar = async () => {
      const mp = minhaPosRef.current;
      const pds = paradasRef.current;
      const { data } = await supabase.from("onibus_posicoes").select("*").eq("tipo", "passageiro");
      const pos: PosicaoMapa[] = (data || []).map((p: any) => ({
        id: p.referencia_id, lat: p.lat, lng: p.lng, nome: p.nome, tipo: "passageiro" as const,
      }));
      if (mp) pos.push({ id: motorista.id, lat: mp.lat, lng: mp.lng, nome: "Você", tipo: "motorista" });
      pds.forEach(p => pos.push({ id: p.id, lat: p.lat, lng: p.lng, nome: p.nome, tipo: "ponto" }));
      setPosicoes(pos);
    };
    carregar();
    const sub = supabase.channel("motorista-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "onibus_posicoes" }, carregar)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [emRota, motorista?.id]);

  const solicitarWakeLock = async () => {
    if (!("wakeLock" in navigator)) return;
    try {
      wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
      setTelaAtiva(true);
      wakeLockRef.current.addEventListener("release", () => setTelaAtiva(false));
    } catch {}
  };

  const liberarWakeLock = () => {
    wakeLockRef.current?.release();
    wakeLockRef.current = null;
    setTelaAtiva(false);
  };

  // Re-adquire wake lock quando a aba volta ao foco (ex: usuário voltou do GPS nativo)
  useEffect(() => {
    if (!emRota) return;
    const reativar = () => { if (document.visibilityState === "visible") solicitarWakeLock(); };
    document.addEventListener("visibilitychange", reativar);
    return () => document.removeEventListener("visibilitychange", reativar);
  }, [emRota]);

  const iniciarRota = async () => {
    if (!rotaSelecionada || !motorista) return;
    const { data } = await supabase.from("onibus_viagens").insert({
      rota_id: rotaSelecionada.id,
      motorista_id: motorista.id,
      ativa: true,
    }).select().single();
    setViagemId(data.id);
    setEmRota(true);
    solicitarWakeLock();
    localStorage.setItem("motorista_sessao", JSON.stringify({
      motoristaId: motorista.id,
      motoristaNome: motorista.nome,
      rotaId: rotaSelecionada.id,
      rotaNome: rotaSelecionada.nome,
      rotaCor: rotaSelecionada.cor,
      viagemId: data.id,
    }));
  };

  const encerrarRota = async () => {
    liberarWakeLock();
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
    if (viagemId) await supabase.from("onibus_viagens").update({ ativa: false, encerrada_em: new Date().toISOString() }).eq("id", viagemId);
    if (motorista) await supabase.from("onibus_posicoes").delete().eq("referencia_id", motorista.id);
    localStorage.removeItem("motorista_sessao");
    setEmRota(false); setViagemId(null); setPosicoes([]);
  };

  const passageirosOnline = posicoes.filter(p => p.tipo === "passageiro");

  const posicoesNaMapa: PosicaoMapa[] = emRota
    ? posicoes
    : paradas.map(p => ({ id: p.id, lat: p.lat, lng: p.lng, nome: p.nome, tipo: "ponto" as const }));

  // ── Tela 1: Selecionar motorista ──────────────────────────────────────────
  if (!motorista) {
    return (
      <div className="h-[100dvh] flex flex-col bg-gray-950 overflow-hidden">
        <div className="px-6 pt-safe pt-10 pb-6 flex-shrink-0">
          <div className="w-16 h-16 rounded-2xl bg-amber-500 flex items-center justify-center text-3xl mx-auto mb-4 shadow-xl shadow-amber-500/30">🚌</div>
          <h1 className="text-white font-black text-2xl text-center">Quem é você?</h1>
          <p className="text-gray-500 text-sm text-center mt-1">Selecione seu nome para iniciar</p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-safe pb-6 space-y-3">
          {motoristas.length === 0 && (
            <div className="text-center py-12 text-gray-600 text-sm">
              <p className="text-3xl mb-3">🚌</p>
              <p>Nenhum motorista cadastrado.</p>
              <p className="text-xs mt-1">Peça ao administrador para cadastrar.</p>
            </div>
          )}
          {motoristas.map(m => (
            <button
              key={m.id}
              onClick={() => setMotorista(m)}
              className="w-full bg-gray-800 hover:bg-gray-750 active:bg-gray-700 rounded-2xl p-4 flex items-center gap-4 transition-all active:scale-95 border border-gray-700"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center text-2xl flex-shrink-0">🚌</div>
              <div className="text-left">
                <p className="text-white font-black text-base">{m.nome}</p>
                <p className="text-gray-500 text-xs">Motorista</p>
              </div>
              <div className="ml-auto text-gray-600 text-lg">›</div>
            </button>
          ))}
        </div>

        {/* Botão instalar */}
        {!isStandalone && (
          <div className="px-4 pb-safe pb-4 flex-shrink-0">
            <button
              onClick={acionarInstalacao}
              className="w-full py-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-400 text-sm font-bold flex items-center justify-center gap-2"
            >
              ⬇ Instalar aplicativo
            </button>
          </div>
        )}

        {showInstallModal && <ModalInstalacaoAndroid onClose={() => setShowInstallModal(false)} />}
        {showBanner && (
          <BannerInstalarPWA
            onInstalar={acionarInstalacao}
            onFechar={() => {
              setShowBanner(false);
              sessionStorage.setItem("pwa-banner-dismissed", "1");
            }}
          />
        )}
      </div>
    );
  }

  // ── Tela 2: App principal ──────────────────────────────────────────────────
  return (
    <div className="h-[100dvh] flex flex-col bg-gray-950 overflow-hidden select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-safe pt-4 pb-3 flex-shrink-0">
        <button
          onClick={() => !emRota && setMotorista(null)}
          className="flex items-center gap-2.5 active:opacity-70 transition-opacity"
        >
          <div className="w-9 h-9 rounded-2xl bg-amber-500 flex items-center justify-center text-base flex-shrink-0">🚌</div>
          <div className="text-left">
            <p className="text-white font-black text-sm leading-none">{motorista.nome}</p>
            <p className={`text-[10px] font-bold mt-0.5 ${emRota ? "text-green-400" : "text-gray-500"}`}>
              {emRota ? `🟢 Em rota: ${rotaSelecionada?.nome}` : "⚪ Toque para trocar"}
            </p>
          </div>
        </button>
        <div className="flex items-center gap-2">
          {!isStandalone && !emRota && (
            <button
              onClick={acionarInstalacao}
              className="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-bold"
            >
              ⬇ Instalar
            </button>
          )}
          {emRota && telaAtiva && (
            <span className="px-2 py-1.5 rounded-xl bg-green-500/20 border border-green-500/30 text-green-400 text-[10px] font-black">
              🔆 TELA ON
            </span>
          )}
          {!online && (
            <span className="px-2 py-1.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-[10px] font-black">
              📵 OFFLINE
            </span>
          )}
          {emRota && (
            <button onClick={encerrarRota} className="text-red-400 text-xs px-3 py-2 rounded-xl bg-red-500/10 active:bg-red-500/20 font-bold border border-red-500/20">
              ⏹ Encerrar
            </button>
          )}
        </div>
      </div>

      {/* Seleção de rota */}
      {!emRota && (
        <div className="px-4 pb-3 space-y-3 flex-shrink-0">
          <select
            value={rotaSelecionada?.id || ""}
            onChange={e => setRotaSelecionada(rotas.find(r => r.id === e.target.value) || null)}
            className="w-full px-4 py-3.5 bg-gray-800 border border-gray-700 rounded-2xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 appearance-none"
          >
            <option value="">Selecionar rota...</option>
            {rotas.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
          {carregandoRota && (
            <div className="flex items-center gap-2 text-amber-400 text-xs px-1">
              <div className="w-3 h-3 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
              Calculando rota por estradas...
            </div>
          )}
          <button
            onClick={iniciarRota}
            disabled={!rotaSelecionada || carregandoRota}
            className="w-full py-4 bg-amber-500 disabled:opacity-40 rounded-2xl font-black text-white text-base active:scale-95 transition-all shadow-lg shadow-amber-500/20"
          >
            🚀 Iniciar Rota
          </button>
        </div>
      )}

      {/* Tabs em rota */}
      {emRota && (
        <div className="flex mx-4 mb-3 bg-gray-800 rounded-2xl p-1 flex-shrink-0">
          <button onClick={() => setAba("mapa")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all ${aba === "mapa" ? "bg-amber-500 text-white" : "text-gray-400"}`}>
            🗺️ Mapa
          </button>
          <button onClick={() => setAba("passageiros")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all ${aba === "passageiros" ? "bg-amber-500 text-white" : "text-gray-400"}`}>
            🧍 Passageiros
            {passageirosOnline.length > 0 && (
              <span className="ml-1.5 bg-white/20 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">{passageirosOnline.length}</span>
            )}
          </button>
        </div>
      )}

      {/* Mapa */}
      {(aba === "mapa" || !emRota) && (
        <div className="flex-1 relative overflow-hidden">
          <MapaLeaflet
            posicoes={posicoesNaMapa}
            centro={minhaPos ? [minhaPos.lat, minhaPos.lng] : undefined}
            rotaPontos={rotaGeometria.length > 0 ? rotaGeometria : undefined}
            rotaCor={rotaSelecionada?.cor}
          />
        </div>
      )}

      {/* Lista passageiros */}
      {aba === "passageiros" && emRota && (
        <div className="flex-1 overflow-y-auto px-4 pb-safe pb-4 space-y-2">
          {passageirosOnline.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-600">
              <span className="text-4xl">🧍</span>
              <p className="text-sm">Nenhum passageiro online</p>
            </div>
          ) : passageirosOnline.map(p => (
            <div key={p.id} className="bg-gray-800 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-lg flex-shrink-0">🧍</div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm">{p.nome}</p>
                <p className="text-gray-400 text-xs">{p.lat.toFixed(4)}, {p.lng.toFixed(4)}</p>
              </div>
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
            </div>
          ))}
        </div>
      )}

      {showInstallModal && <ModalInstalacaoAndroid onClose={() => setShowInstallModal(false)} />}
      {showBanner && (
        <BannerInstalarPWA
          onInstalar={acionarInstalacao}
          onFechar={() => {
            setShowBanner(false);
            sessionStorage.setItem("pwa-banner-dismissed", "1");
          }}
        />
      )}
    </div>
  );
}
