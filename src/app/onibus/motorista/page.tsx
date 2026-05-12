"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import type { PosicaoMapa } from "../components/MapaLeaflet";
import InstallPWA, { useInstallPrompt } from "../components/InstallPWA";

const MapaLeaflet = dynamic(() => import("../components/MapaLeaflet"), { ssr: false });

interface Motorista { id: string; nome: string; }
interface Rota { id: string; nome: string; cor: string; }
interface Ponto { id: string; lat: number; lng: number; nome: string; ordem: number; tipo: string; }

export default function AppMotorista() {
  const router = useRouter();
  const { canInstall, showInstructions, instalar: instalarPWA } = useInstallPrompt();
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
  const [showInstallInstructions, setShowInstallInstructions] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // Refs para closures estáveis no realtime
  const minhaPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const paradasRef = useRef<Ponto[]>([]);
  const motoristaRef = useRef<Motorista | null>(null);
  const rotaRef = useRef<Rota | null>(null);
  useEffect(() => { minhaPosRef.current = minhaPos; }, [minhaPos]);
  useEffect(() => { paradasRef.current = paradas; }, [paradas]);
  useEffect(() => { motoristaRef.current = motorista; }, [motorista]);
  useEffect(() => { rotaRef.current = rotaSelecionada; }, [rotaSelecionada]);

  useEffect(() => {
    supabase.from("onibus_perfis").select("id, nome").eq("tipo", "motorista").order("nome")
      .then(({ data }) => setMotoristas(data || []));
    supabase.from("onibus_rotas").select("id, nome, cor").eq("ativa", true)
      .then(({ data }) => setRotas(data || []));
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
      await supabase.from("onibus_posicoes").upsert({
        referencia_id: m.id,
        tipo: "motorista",
        nome: m.nome,
        lat, lng,
        velocidade: speed ? speed * 3.6 : 0,
        rota_ativa_id: r?.id || null,
        atualizado_em: new Date().toISOString(),
      }, { onConflict: "referencia_id" });
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

  const iniciarRota = async () => {
    if (!rotaSelecionada || !motorista) return;
    const { data } = await supabase.from("onibus_viagens").insert({
      rota_id: rotaSelecionada.id,
      motorista_id: motorista.id,
      ativa: true,
    }).select().single();
    setViagemId(data.id);
    setEmRota(true);
  };

  const encerrarRota = async () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
    if (viagemId) await supabase.from("onibus_viagens").update({ ativa: false, encerrada_em: new Date().toISOString() }).eq("id", viagemId);
    if (motorista) await supabase.from("onibus_posicoes").delete().eq("referencia_id", motorista.id);
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

        {/* Botão instalar na tela de seleção */}
        {(canInstall || showInstructions) && (
          <div className="px-4 pb-safe pb-4 flex-shrink-0">
            <button
              onClick={async () => {
                const r = await instalarPWA();
                if (r !== "accepted") setShowInstallInstructions(true);
              }}
              className="w-full py-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-400 text-sm font-bold flex items-center justify-center gap-2"
            >
              ⬇ Instalar aplicativo
            </button>
          </div>
        )}

        <InstallPWA tema="amber" />

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
          {(canInstall || showInstructions) && !emRota && (
            <button
              onClick={async () => { const r = await instalarPWA(); if (r !== "accepted") setShowInstallInstructions(true); }}
              className="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-bold"
            >
              ⬇ Instalar
            </button>
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

      <InstallPWA tema="amber" />
    </div>
  );
}
