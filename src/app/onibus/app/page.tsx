"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import type { PosicaoMapa } from "../components/MapaLeaflet";

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
  const [infoAberta, setInfoAberta] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push("/onibus/login"); return; }
      const { data: perfil } = await supabase.from("onibus_perfis").select("*").eq("id", session.user.id).single();
      if (!perfil || perfil.tipo !== "passageiro") { router.push("/onibus/login"); return; }
      setUser({ ...session.user, nome: perfil.nome });
    });
  }, []);

  // Envia localização a cada 5s
  const enviarLocalizacao = useCallback(async (userId: string, nome: string) => {
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude: lat, longitude: lng, speed } = pos.coords;
      setMinhaPos({ lat, lng });
      await supabase.from("onibus_posicoes").upsert({
        referencia_id: userId,
        tipo: "passageiro",
        nome,
        lat, lng,
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

  // Busca viagem ativa e posições
  useEffect(() => {
    const carregarDados = async () => {
      const { data: viagem } = await supabase
        .from("onibus_viagens")
        .select("id, rota_id, onibus_rotas(nome, cor)")
        .eq("ativa", true)
        .limit(1)
        .maybeSingle();

      setViagemAtiva(viagem as any);

      if (viagem) {
        const { data: pts } = await supabase
          .from("onibus_pontos")
          .select("lat, lng, nome, ordem")
          .eq("rota_id", viagem.rota_id)
          .order("ordem");
        setPontos(pts || []);
      }

      const { data: pos } = await supabase.from("onibus_posicoes").select("*");
      const mapped: PosicaoMapa[] = (pos || []).map((p: any) => ({
        id: p.referencia_id,
        lat: p.lat, lng: p.lng,
        nome: p.nome,
        tipo: p.tipo,
        velocidade: p.velocidade,
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
    if (user) await supabase.from("onibus_posicoes").delete().eq("referencia_id", user.id);
    await supabase.auth.signOut();
    router.push("/onibus");
  };

  const motorista = posicoes.find(p => p.tipo === "motorista");

  return (
    <div className="h-screen flex flex-col bg-gray-950 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 bg-gray-950 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-sm">🧍</div>
          <div>
            <p className="text-white font-black text-sm leading-none">{user?.nome || "Passageiro"}</p>
            <p className="text-gray-500 text-[10px]">
              {viagemAtiva ? `🟢 ${(viagemAtiva.onibus_rotas as any)?.nome}` : "⚪ Nenhuma rota ativa"}
            </p>
          </div>
        </div>
        <button onClick={handleSair} className="text-gray-500 text-xs px-3 py-1.5 rounded-xl bg-gray-800 active:bg-gray-700">Sair</button>
      </div>

      {/* Mapa */}
      <div className="flex-1 relative">
        <MapaLeaflet
          posicoes={posicoes}
          centro={minhaPos ? [minhaPos.lat, minhaPos.lng] : undefined}
          rotaPontos={pontos}
          rotaCor={(viagemAtiva?.onibus_rotas as any)?.cor || "#0b7336"}
        />

        {/* Painel info ônibus */}
        {motorista && (
          <div className="absolute bottom-4 left-4 right-4 bg-gray-900/95 backdrop-blur rounded-3xl p-4 shadow-2xl z-[1000]">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center text-2xl flex-shrink-0">🚌</div>
              <div className="flex-1">
                <p className="text-white font-black text-sm">{motorista.nome || "Motorista"}</p>
                <p className="text-amber-400 text-xs font-bold">{motorista.velocidade?.toFixed(0) || 0} km/h</p>
                <p className="text-gray-500 text-[10px]">Ônibus em rota</p>
              </div>
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            </div>
          </div>
        )}

        {!motorista && (
          <div className="absolute bottom-4 left-4 right-4 bg-gray-900/90 backdrop-blur rounded-3xl p-4 z-[1000] text-center">
            <p className="text-gray-400 text-sm">Aguardando o ônibus iniciar rota...</p>
          </div>
        )}
      </div>
    </div>
  );
}
