"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import type { PosicaoMapa } from "../components/MapaLeaflet";
import InstallPWA, { useInstallPrompt } from "../components/InstallPWA";

const MapaLeaflet = dynamic(() => import("../components/MapaLeaflet"), { ssr: false });

interface Viagem { id: string; rota_id: string; onibus_rotas: { nome: string; cor: string }; }
interface Ponto { lat: number; lng: number; nome: string; ordem: number; }

const LIMIAR_CHEGANDO_METROS = 500;

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function AppPassageiro() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [posicoes, setPosicoes] = useState<PosicaoMapa[]>([]);
  const [viagemAtiva, setViagemAtiva] = useState<Viagem | null>(null);
  const [rotaGeometria, setRotaGeometria] = useState<{ lat: number; lng: number }[]>([]);
  const [rotaCor, setRotaCor] = useState("#0b7336");
  const [minhaPos, setMinhaPos] = useState<{ lat: number; lng: number } | null>(null);
  const [distanciaMotorista, setDistanciaMotorista] = useState<number | null>(null);
  const { canInstall, instalar: instalarPWA } = useInstallPrompt();
  const [showInstallInstructions, setShowInstallInstructions] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const notificacaoEnviadaRef = useRef(false);

  // Refs para evitar closures velhas na subscription realtime
  const minhaPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const userRef = useRef<any>(null);
  useEffect(() => { minhaPosRef.current = minhaPos; }, [minhaPos]);
  useEffect(() => { userRef.current = user; }, [user]);

  // Pede permissão de notificação ao carregar
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Calcula distância até o motorista e dispara notificação quando próximo
  useEffect(() => {
    const motoristaPosicao = posicoes.find(p => p.tipo === "motorista");
    if (!motoristaPosicao || !minhaPos) {
      setDistanciaMotorista(null);
      return;
    }
    const dist = haversine(minhaPos.lat, minhaPos.lng, motoristaPosicao.lat, motoristaPosicao.lng);
    setDistanciaMotorista(dist);

    if (dist > LIMIAR_CHEGANDO_METROS) {
      notificacaoEnviadaRef.current = false;
      return;
    }
    if (!notificacaoEnviadaRef.current && typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      notificacaoEnviadaRef.current = true;
      new Notification("🚌 Ônibus chegando!", {
        body: `O ônibus está a ${Math.round(dist)}m de você. Prepare-se!`,
        icon: "/icon-192.png",
      });
    }
  }, [posicoes, minhaPos]);


  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push("/onibus/login"); return; }
      const { data: perfil } = await supabase.from("onibus_perfis").select("*").eq("id", session.user.id).single();
      if (!perfil || perfil.tipo !== "passageiro") { router.push("/onibus/login"); return; }
      setUser({ ...session.user, nome: perfil.nome });
    });
  }, []);

  // GPS — envia a cada 5s e já busca posições de todos (garante atualização mesmo sem Realtime)
  const enviarLocalizacao = useCallback(async (userId: string, nome: string) => {
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude: lat, longitude: lng, speed } = pos.coords;
      setMinhaPos({ lat, lng });
      await supabase.from("onibus_posicoes").upsert({
        referencia_id: userId, tipo: "passageiro", nome, lat, lng,
        velocidade: speed ? speed * 3.6 : 0,
        atualizado_em: new Date().toISOString(),
      }, { onConflict: "referencia_id" });

      // Polling de todas as posições para garantir que o mapa atualize
      const { data: todasPos } = await supabase.from("onibus_posicoes").select("*");
      const mapped: PosicaoMapa[] = (todasPos || []).map((p: any) => ({
        id: p.referencia_id, lat: p.lat, lng: p.lng, nome: p.nome, tipo: p.tipo, velocidade: p.velocidade,
      }));
      mapped.push({ id: "minha", lat, lng, nome: "Você", tipo: "minha" });
      setPosicoes(mapped);
    }, undefined, { enableHighAccuracy: true });
  }, []);

  useEffect(() => {
    if (!user) return;
    enviarLocalizacao(user.id, user.nome);
    intervalRef.current = setInterval(() => enviarLocalizacao(user.id, user.nome), 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [user]);

  // Carrega geometria OSRM da rota ativa
  const carregarGeometria = useCallback(async (rotaId: string, cor: string) => {
    setRotaCor(cor);
    const { data: wps } = await supabase.from("onibus_pontos")
      .select("lat, lng, ordem").eq("rota_id", rotaId).eq("tipo", "waypoint").order("ordem");
    if (!wps || wps.length < 2) {
      // fallback: paradas como linha
      const { data: pds } = await supabase.from("onibus_pontos")
        .select("lat, lng, ordem").eq("rota_id", rotaId).eq("tipo", "parada").order("ordem");
      setRotaGeometria((pds || []).map((p: any) => ({ lat: p.lat, lng: p.lng })));
      return;
    }
    try {
      const coords = wps.map((p: any) => `${p.lng},${p.lat}`).join(";");
      const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?geometries=geojson&overview=full`);
      const data = await res.json();
      if (data.routes?.[0]) {
        setRotaGeometria(data.routes[0].geometry.coordinates.map(([lng, lat]: number[]) => ({ lat, lng })));
      }
    } catch {
      setRotaGeometria(wps.map((p: any) => ({ lat: p.lat, lng: p.lng })));
    }
  }, []);

  // Realtime — subscription criada UMA VEZ quando user carrega
  useEffect(() => {
    if (!user) return;

    const carregarDados = async () => {
      const u = userRef.current;
      const mp = minhaPosRef.current;

      const { data: viagem } = await supabase
        .from("onibus_viagens").select("id, rota_id, onibus_rotas(nome, cor)")
        .eq("ativa", true).limit(1).maybeSingle();

      setViagemAtiva(viagem as any);

      if (viagem) {
        const cor = (viagem.onibus_rotas as any)?.cor || "#0b7336";
        carregarGeometria(viagem.rota_id, cor);
      } else {
        // Rota encerrou — limpa tudo imediatamente
        setRotaGeometria([]);
        setRotaCor("#0b7336");
      }

      const { data: pos } = await supabase.from("onibus_posicoes").select("*");
      const mapped: PosicaoMapa[] = (pos || []).map((p: any) => ({
        id: p.referencia_id, lat: p.lat, lng: p.lng, nome: p.nome, tipo: p.tipo, velocidade: p.velocidade,
      }));
      if (u && mp) mapped.push({ id: "minha", lat: mp.lat, lng: mp.lng, nome: "Você", tipo: "minha" });
      setPosicoes(mapped);
    };

    carregarDados();

    // Canal estável — não é recriado quando minhaPos muda
    const sub = supabase.channel("passageiro-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "onibus_posicoes" }, carregarDados)
      .on("postgres_changes", { event: "*", schema: "public", table: "onibus_viagens" }, carregarDados)
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [user?.id]); // só recria quando o user muda, NÃO quando minhaPos muda

  const handleSair = async () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (user) await supabase.from("onibus_posicoes").delete().eq("referencia_id", user.id);
    await supabase.auth.signOut();
    router.push("/onibus");
  };

  const motorista = posicoes.find(p => p.tipo === "motorista");

  const etaMinutos = (() => {
    if (!distanciaMotorista || !motorista?.velocidade || motorista.velocidade < 2) return null;
    const speedMs = motorista.velocidade * 1000 / 3600;
    return Math.ceil(distanciaMotorista / speedMs / 60);
  })();

  const distanciaTexto = (() => {
    if (distanciaMotorista === null) return null;
    return distanciaMotorista >= 1000
      ? `${(distanciaMotorista / 1000).toFixed(1)} km`
      : `${Math.round(distanciaMotorista)} m`;
  })();

  if (!user) return (
    <div className="h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div className="h-[100dvh] flex flex-col bg-gray-950 overflow-hidden select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-safe pt-4 pb-3 bg-gray-950 z-10 flex-shrink-0">
        <button onClick={() => router.push("/onibus/app/perfil")}
          className="flex items-center gap-2.5 active:opacity-70 transition-opacity">
          <div className="w-9 h-9 rounded-2xl bg-blue-600 flex items-center justify-center text-base flex-shrink-0">🧍</div>
          <div className="text-left">
            <p className="text-white font-black text-sm leading-none">{user.nome}</p>
            <p className={`text-[10px] font-bold mt-0.5 ${viagemAtiva ? "text-green-400" : "text-gray-500"}`}>
              {viagemAtiva ? `🟢 ${(viagemAtiva.onibus_rotas as any)?.nome}` : "⚪ Aguardando rota"}
            </p>
          </div>
        </button>
        <div className="flex items-center gap-2">
          {canInstall && (
            <button
              onClick={async () => { const r = await instalarPWA(); if (r === "instructions") setShowInstallInstructions(true); }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 text-xs font-bold active:bg-blue-600/30">
              ⬇ Instalar
            </button>
          )}
          <button onClick={handleSair} className="text-gray-500 text-xs px-3 py-2 rounded-xl bg-gray-800 active:bg-gray-700 font-bold">
            Sair
          </button>
        </div>
      </div>

      {/* Mapa */}
      <div className="flex-1 relative overflow-hidden">
        <MapaLeaflet
          posicoes={posicoes}
          centro={minhaPos ? [minhaPos.lat, minhaPos.lng] : undefined}
          rotaPontos={rotaGeometria.length > 0 ? rotaGeometria : undefined}
          rotaCor={rotaCor}
        />

        {motorista && (
          <div className={`absolute bottom-safe bottom-4 left-4 right-4 backdrop-blur-md rounded-3xl p-4 shadow-2xl z-[1000] border transition-colors duration-500 ${distanciaMotorista !== null && distanciaMotorista <= LIMIAR_CHEGANDO_METROS ? "bg-amber-500/20 border-amber-500/50" : "bg-gray-900/96 border-gray-800/50"}`}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center text-2xl flex-shrink-0 shadow-lg">🚌</div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-black text-sm">{motorista.nome || "Motorista"}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-amber-400 text-xs font-bold">{motorista.velocidade?.toFixed(0) || 0} km/h</span>
                  <span className="text-gray-600 text-xs">·</span>
                  <span className="text-gray-500 text-xs">{(viagemAtiva?.onibus_rotas as any)?.nome || "Em rota"}</span>
                  {distanciaTexto && (
                    <>
                      <span className="text-gray-600 text-xs">·</span>
                      <span className="text-blue-400 text-xs font-bold">{distanciaTexto} de você</span>
                    </>
                  )}
                  {etaMinutos !== null && (
                    <>
                      <span className="text-gray-600 text-xs">·</span>
                      <span className="text-green-400 text-xs font-bold">~{etaMinutos} min</span>
                    </>
                  )}
                </div>
                {distanciaMotorista !== null && distanciaMotorista <= LIMIAR_CHEGANDO_METROS && (
                  <p className="text-amber-400 text-[11px] font-black mt-1 animate-pulse">⚠ Ônibus chegando! Prepare-se.</p>
                )}
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[9px] text-green-500 font-bold">AO VIVO</span>
              </div>
            </div>
          </div>
        )}

        {!motorista && (
          <div className="absolute bottom-safe bottom-4 left-4 right-4 bg-gray-900/90 backdrop-blur-md rounded-3xl p-4 z-[1000] border border-gray-800/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gray-800 flex items-center justify-center text-xl flex-shrink-0">🚌</div>
              <div>
                <p className="text-gray-300 text-sm font-bold">Ônibus não iniciado</p>
                <p className="text-gray-500 text-xs">Aguardando o motorista iniciar a rota</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <InstallPWA tema="blue" />

      {showInstallInstructions && (
        <div className="fixed inset-0 z-[3000] bg-black/80 flex items-end p-4" onClick={() => setShowInstallInstructions(false)}>
          <div className="bg-gray-900 rounded-3xl p-6 w-full border border-gray-700 space-y-4" onClick={e => e.stopPropagation()}>
            <p className="text-white font-black text-base text-center">Adicionar à tela inicial</p>
            <div className="space-y-3">
              {[["⎋","Toque no botão Compartilhar na barra do navegador"],["➕","Role e toque em 'Adicionar à Tela de Início'"],["✅","Confirme tocando em Adicionar"]].map(([icon, text], i) => (
                <div key={i} className="flex items-center gap-4 bg-gray-800 rounded-2xl p-3">
                  <span className="text-2xl flex-shrink-0">{icon}</span>
                  <p className="text-gray-300 text-sm">{text}</p>
                </div>
              ))}
            </div>
            <button onClick={() => setShowInstallInstructions(false)} className="w-full py-3 bg-gray-700 rounded-2xl text-white font-bold">Entendi</button>
          </div>
        </div>
      )}
    </div>
  );
}
