"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import type { PosicaoMapa } from "../components/MapaLeaflet";
import InstallPWA from "../components/InstallPWA";

const MapaLeaflet = dynamic(() => import("../components/MapaLeaflet"), { ssr: false });

interface Viagem {
  id: string;
  rota_id: string;
  onibus_rotas: { nome: string; cor: string };
}

interface Ponto { lat: number; lng: number; nome: string; ordem: number; }

export default function AppPassageiro() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [posicoes, setPosicoes] = useState<PosicaoMapa[]>([]);
  const [viagemAtiva, setViagemAtiva] = useState<Viagem | null>(null);
  const [pontos, setPontos] = useState<Ponto[]>([]);
  const [minhaPos, setMinhaPos] = useState<{ lat: number; lng: number } | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push("/onibus/login"); return; }
      const { data: perfil } = await supabase.from("onibus_perfis").select("*").eq("id", session.user.id).single();
      if (!perfil || perfil.tipo !== "passageiro") { router.push("/onibus/login"); return; }
      setUser({ ...session.user, nome: perfil.nome });
    });
  }, []);

  const enviarLocalizacao = useCallback(async (userId: string, nome: string) => {
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude: lat, longitude: lng, speed } = pos.coords;
      setMinhaPos({ lat, lng });
      await supabase.from("onibus_posicoes").upsert({
        referencia_id: userId, tipo: "passageiro", nome, lat, lng,
        velocidade: speed ? speed * 3.6 : 0,
        atualizado_em: new Date().toISOString(),
      }, { onConflict: "referencia_id" });
    }, undefined, { enableHighAccuracy: true });
  }, []);

  useEffect(() => {
    if (!user) return;
    enviarLocalizacao(user.id, user.nome);
    intervalRef.current = setInterval(() => enviarLocalizacao(user.id, user.nome), 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [user]);

  useEffect(() => {
    const carregarDados = async () => {
      const { data: viagem } = await supabase
        .from("onibus_viagens").select("id, rota_id, onibus_rotas(nome, cor)")
        .eq("ativa", true).limit(1).maybeSingle();
      setViagemAtiva(viagem as any);
      if (viagem) {
        const { data: pts } = await supabase.from("onibus_pontos")
          .select("lat, lng, nome, ordem").eq("rota_id", viagem.rota_id)
          .eq("tipo", "parada").order("ordem");
        setPontos(pts || []);
      }
      const { data: pos } = await supabase.from("onibus_posicoes").select("*");
      const mapped: PosicaoMapa[] = (pos || []).map((p: any) => ({
        id: p.referencia_id, lat: p.lat, lng: p.lng, nome: p.nome, tipo: p.tipo, velocidade: p.velocidade,
      }));
      if (user && minhaPos) {
        mapped.push({ id: "minha", lat: minhaPos.lat, lng: minhaPos.lng, nome: "Você", tipo: "minha" });
      }
      setPosicoes(mapped);
    };
    carregarDados();
    const sub = supabase.channel("posicoes-passageiro")
      .on("postgres_changes", { event: "*", schema: "public", table: "onibus_posicoes" }, carregarDados)
      .on("postgres_changes", { event: "*", schema: "public", table: "onibus_viagens" }, carregarDados)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [user, minhaPos]);

  const handleSair = async () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (user) await supabase.from("onibus_posicoes").delete().eq("referencia_id", user.id);
    await supabase.auth.signOut();
    router.push("/onibus");
  };

  const motorista = posicoes.find(p => p.tipo === "motorista");

  if (!user) return (
    <div className="h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div className="h-[100dvh] flex flex-col bg-gray-950 overflow-hidden select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-safe pt-4 pb-3 bg-gray-950 z-10 flex-shrink-0">
        <button
          onClick={() => router.push("/onibus/app/perfil")}
          className="flex items-center gap-2.5 active:opacity-70 transition-opacity"
        >
          <div className="w-9 h-9 rounded-2xl bg-blue-600 flex items-center justify-center text-base flex-shrink-0">🧍</div>
          <div className="text-left">
            <p className="text-white font-black text-sm leading-none">{user.nome}</p>
            <p className={`text-[10px] font-bold mt-0.5 ${viagemAtiva ? "text-green-400" : "text-gray-500"}`}>
              {viagemAtiva ? `🟢 ${(viagemAtiva.onibus_rotas as any)?.nome}` : "⚪ Nenhuma rota ativa"}
            </p>
          </div>
        </button>
        <button onClick={handleSair} className="text-gray-500 text-xs px-3 py-2 rounded-xl bg-gray-800 active:bg-gray-700 font-bold">
          Sair
        </button>
      </div>

      {/* Mapa */}
      <div className="flex-1 relative overflow-hidden">
        <MapaLeaflet
          posicoes={posicoes}
          centro={minhaPos ? [minhaPos.lat, minhaPos.lng] : undefined}
          rotaPontos={pontos}
          rotaCor={(viagemAtiva?.onibus_rotas as any)?.cor || "#0b7336"}
        />

        {/* Card ônibus */}
        {motorista && (
          <div className="absolute bottom-safe bottom-4 left-4 right-4 bg-gray-900/96 backdrop-blur-md rounded-3xl p-4 shadow-2xl z-[1000] border border-gray-800/50">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center text-2xl flex-shrink-0 shadow-lg">🚌</div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-black text-sm">{motorista.nome || "Motorista"}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-amber-400 text-xs font-bold">{motorista.velocidade?.toFixed(0) || 0} km/h</span>
                  <span className="text-gray-600 text-xs">·</span>
                  <span className="text-gray-500 text-xs">Em rota</span>
                </div>
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

      {/* Prompt instalação PWA */}
      <InstallPWA tema="blue" />
    </div>
  );
}
