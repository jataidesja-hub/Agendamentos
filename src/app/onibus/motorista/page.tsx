"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import type { PosicaoMapa } from "../components/MapaLeaflet";
import InstallPWA from "../components/InstallPWA";

const MapaLeaflet = dynamic(() => import("../components/MapaLeaflet"), { ssr: false });

interface Rota { id: string; nome: string; cor: string; }
interface Ponto { id: string; lat: number; lng: number; nome: string; ordem: number; }

export default function AppMotorista() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [rotaSelecionada, setRotaSelecionada] = useState<Rota | null>(null);
  const [pontos, setPontos] = useState<Ponto[]>([]);
  const [posicoes, setPosicoes] = useState<PosicaoMapa[]>([]);
  const [viagemId, setViagemId] = useState<string | null>(null);
  const [emRota, setEmRota] = useState(false);
  const [minhaPos, setMinhaPos] = useState<{ lat: number; lng: number } | null>(null);
  const [aba, setAba] = useState<"mapa" | "passageiros">("mapa");
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push("/onibus/login?tipo=motorista"); return; }
      const { data: perfil } = await supabase.from("onibus_perfis").select("*").eq("id", session.user.id).single();
      if (!perfil || perfil.tipo !== "motorista") { router.push("/onibus/login?tipo=motorista"); return; }
      setUser({ ...session.user, nome: perfil.nome });
    });
    supabase.from("onibus_rotas").select("id, nome, cor").eq("ativa", true).then(({ data }) => setRotas(data || []));
  }, []);

  useEffect(() => {
    if (!rotaSelecionada) return;
    supabase.from("onibus_pontos").select("*").eq("rota_id", rotaSelecionada.id)
      .eq("tipo", "parada").order("ordem").then(({ data }) => setPontos(data || []));
  }, [rotaSelecionada]);

  const enviarLocalizacao = useCallback(async (userId: string, nome: string) => {
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude: lat, longitude: lng, speed } = pos.coords;
      setMinhaPos({ lat, lng });
      await supabase.from("onibus_posicoes").upsert({
        referencia_id: userId, tipo: "motorista", nome, lat, lng,
        velocidade: speed ? speed * 3.6 : 0,
        rota_ativa_id: rotaSelecionada?.id || null,
        atualizado_em: new Date().toISOString(),
      }, { onConflict: "referencia_id" });
    }, undefined, { enableHighAccuracy: true });
  }, [rotaSelecionada]);

  useEffect(() => {
    if (!emRota || !user) return;
    enviarLocalizacao(user.id, user.nome);
    intervalRef.current = setInterval(() => enviarLocalizacao(user.id, user.nome), 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [emRota, user]);

  useEffect(() => {
    if (!emRota) return;
    const carregar = async () => {
      const { data } = await supabase.from("onibus_posicoes").select("*").eq("tipo", "passageiro");
      const pos: PosicaoMapa[] = (data || []).map((p: any) => ({
        id: p.referencia_id, lat: p.lat, lng: p.lng, nome: p.nome, tipo: "passageiro", velocidade: p.velocidade,
      }));
      if (minhaPos) pos.push({ id: user.id, lat: minhaPos.lat, lng: minhaPos.lng, nome: "Você", tipo: "motorista" });
      pontos.forEach(p => pos.push({ id: p.id, lat: p.lat, lng: p.lng, nome: p.nome, tipo: "ponto" }));
      setPosicoes(pos);
    };
    carregar();
    const sub = supabase.channel("pos-motorista")
      .on("postgres_changes", { event: "*", schema: "public", table: "onibus_posicoes" }, carregar)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [emRota, pontos, minhaPos]);

  const iniciarRota = async () => {
    if (!rotaSelecionada || !user) return;
    const { data } = await supabase.from("onibus_viagens").insert({
      rota_id: rotaSelecionada.id, motorista_id: user.id, ativa: true,
    }).select().single();
    setViagemId(data.id);
    setEmRota(true);
  };

  const encerrarRota = async () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (viagemId) await supabase.from("onibus_viagens").update({ ativa: false, encerrada_em: new Date().toISOString() }).eq("id", viagemId);
    await supabase.from("onibus_posicoes").delete().eq("referencia_id", user.id);
    setEmRota(false); setViagemId(null); setPosicoes([]);
  };

  const handleSair = async () => {
    if (emRota) await encerrarRota();
    await supabase.auth.signOut();
    router.push("/onibus");
  };

  const passageirosOnline = posicoes.filter(p => p.tipo === "passageiro");

  if (!user) return (
    <div className="h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div className="h-[100dvh] flex flex-col bg-gray-950 overflow-hidden select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-safe pt-4 pb-3 flex-shrink-0">
        <button
          onClick={() => router.push("/onibus/motorista/perfil")}
          className="flex items-center gap-2.5 active:opacity-70 transition-opacity"
        >
          <div className="w-9 h-9 rounded-2xl bg-amber-500 flex items-center justify-center text-base flex-shrink-0">🚌</div>
          <div className="text-left">
            <p className="text-white font-black text-sm leading-none">{user.nome}</p>
            <p className={`text-[10px] font-bold mt-0.5 ${emRota ? "text-green-400" : "text-gray-500"}`}>
              {emRota ? `🟢 Em rota: ${rotaSelecionada?.nome}` : "⚪ Aguardando"}
            </p>
          </div>
        </button>
        <button onClick={handleSair} className="text-gray-500 text-xs px-3 py-2 rounded-xl bg-gray-800 active:bg-gray-700 font-bold">
          Sair
        </button>
      </div>

      {/* Seleção de rota */}
      {!emRota && (
        <div className="px-4 pb-3 space-y-3 flex-shrink-0">
          <select value={rotaSelecionada?.id || ""}
            onChange={e => setRotaSelecionada(rotas.find(r => r.id === e.target.value) || null)}
            className="w-full px-4 py-3.5 bg-gray-800 border border-gray-700 rounded-2xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 appearance-none">
            <option value="">Selecionar rota...</option>
            {rotas.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
          <button onClick={iniciarRota} disabled={!rotaSelecionada}
            className="w-full py-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 rounded-2xl font-black text-white text-base transition-all active:scale-95 shadow-lg shadow-amber-500/20">
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
            🧍 Passageiros {passageirosOnline.length > 0 && (
              <span className="ml-1 bg-white/20 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">{passageirosOnline.length}</span>
            )}
          </button>
        </div>
      )}

      {/* Mapa */}
      {(aba === "mapa" || !emRota) && (
        <div className="flex-1 relative overflow-hidden">
          <MapaLeaflet
            posicoes={emRota ? posicoes : pontos.map(p => ({ id: p.id, lat: p.lat, lng: p.lng, nome: p.nome, tipo: "ponto" as const }))}
            centro={minhaPos ? [minhaPos.lat, minhaPos.lng] : undefined}
            rotaPontos={pontos}
            rotaCor={rotaSelecionada?.cor}
          />
          {emRota && (
            <button onClick={encerrarRota}
              className="absolute bottom-safe bottom-4 left-4 right-4 py-4 bg-red-600 hover:bg-red-500 rounded-3xl font-black text-white text-base z-[1000] shadow-2xl shadow-red-600/30 active:scale-95 transition-all">
              ⏹ Encerrar Rota
            </button>
          )}
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
          ) : (
            passageirosOnline.map(p => (
              <div key={p.id} className="bg-gray-800 rounded-2xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-lg flex-shrink-0">🧍</div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-sm">{p.nome}</p>
                  <p className="text-gray-400 text-xs">{p.lat.toFixed(4)}, {p.lng.toFixed(4)}</p>
                </div>
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
              </div>
            ))
          )}
        </div>
      )}

      <InstallPWA tema="amber" />
    </div>
  );
}
