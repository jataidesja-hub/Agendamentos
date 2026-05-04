"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { PosicaoMapa, Waypoint } from "../components/MapaLeaflet";

const MapaLeaflet = dynamic(() => import("../components/MapaLeaflet"), { ssr: false });

interface Rota { id: string; nome: string; cor: string; ativa: boolean; }
interface Ponto { id: string; rota_id: string; nome: string; lat: number; lng: number; ordem: number; tipo: "waypoint" | "parada"; }
interface Perfil { id: string; nome: string; tipo: string; telefone: string; onibus_usuarios?: { endereco: string } }

const CORES = ["#0b7336", "#2563eb", "#d97706", "#dc2626", "#7c3aed", "#0891b2"];
type Camada = "rota" | "paradas";

export default function AdminOnibus() {
  const router = useRouter();
  const importRef = useRef<HTMLInputElement>(null);
  const [aba, setAba] = useState<"mapa" | "rotas" | "usuarios" | "motoristas">("mapa");
  const [camada, setCamada] = useState<Camada>("rota");

  const [rotas, setRotas] = useState<Rota[]>([]);
  const [rotaSelecionada, setRotaSelecionada] = useState<Rota | null>(null);
  const [waypoints, setWaypoints] = useState<Ponto[]>([]);
  const [paradas, setParadas] = useState<Ponto[]>([]);
  const [posicoes, setPosicoes] = useState<PosicaoMapa[]>([]);
  const [usuarios, setUsuarios] = useState<Perfil[]>([]);

  const [adicionando, setAdicionando] = useState(false);
  const [nomePonto, setNomePonto] = useState("");
  const [pendingLatLng, setPendingLatLng] = useState<{ lat: number; lng: number } | null>(null);

  // Modo mover ponto
  const [movingId, setMovingId] = useState<string | null>(null);
  const movingIdRef = useRef<string | null>(null);
  useEffect(() => { movingIdRef.current = movingId; }, [movingId]);

  // Painel lista de pontos
  const [painelPontos, setPainelPontos] = useState(false);

  const [rotaGeometria, setRotaGeometria] = useState<{ lat: number; lng: number }[]>([]);
  const [distanciaKm, setDistanciaKm] = useState<number | null>(null);
  const [carregandoRota, setCarregandoRota] = useState(false);

  const [nomeRota, setNomeRota] = useState("");
  const [corRota, setCorRota] = useState(CORES[0]);
  const [descRota, setDescRota] = useState("");

  const [nomeMotorista, setNomeMotorista] = useState("");
  const [emailMotorista, setEmailMotorista] = useState("");
  const [senhaMotorista, setSenhaMotorista] = useState("");
  const [telefMotorista, setTelefMotorista] = useState("");
  const [veiculoMotorista, setVeiculoMotorista] = useState("");
  const [criandoMotorista, setCriandoMotorista] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push("/login"); return; }
    });
    carregarTudo();
  }, []);

  const carregarTudo = async () => {
    const { data: r } = await supabase.from("onibus_rotas").select("*").order("created_at");
    setRotas(r || []);
    const { data: u } = await supabase.from("onibus_perfis").select("*, onibus_usuarios(endereco)").order("nome");
    setUsuarios(u || []);
    const { data: pos } = await supabase.from("onibus_posicoes").select("*");
    setPosicoes((pos || []).map((p: any) => ({ id: p.referencia_id, lat: p.lat, lng: p.lng, nome: p.nome, tipo: p.tipo, velocidade: p.velocidade })));
  };

  useEffect(() => {
    if (!rotaSelecionada) {
      setWaypoints([]); setParadas([]); setRotaGeometria([]); setDistanciaKm(null);
      return;
    }
    supabase.from("onibus_pontos").select("*").eq("rota_id", rotaSelecionada.id).order("ordem").then(({ data }) => {
      const todos = (data || []) as Ponto[];
      const wps = todos.filter(p => p.tipo === "waypoint");
      const pds = todos.filter(p => p.tipo === "parada");
      setWaypoints(wps);
      setParadas(pds);
      if (wps.length >= 2) calcularOSRM(wps);
    });
  }, [rotaSelecionada]);

  useEffect(() => {
    if (waypoints.length >= 2) calcularOSRM(waypoints);
    else setRotaGeometria([]);
  }, [waypoints]);

  const calcularOSRM = async (wps: Ponto[]) => {
    setCarregandoRota(true);
    try {
      const ordenados = [...wps].sort((a, b) => a.ordem - b.ordem);
      const coords = ordenados.map(p => `${p.lng},${p.lat}`).join(";");
      const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?geometries=geojson&overview=full`);
      const data = await res.json();
      if (data.routes?.[0]) {
        setRotaGeometria(data.routes[0].geometry.coordinates.map(([lng, lat]: [number, number]) => ({ lat, lng })));
        setDistanciaKm(data.routes[0].distance / 1000);
      }
    } catch { toast.error("Erro ao calcular rota por estradas."); }
    finally { setCarregandoRota(false); }
  };

  const handleMapClick = useCallback((lat: number, lng: number) => {
    // Usa ref para sempre ter o valor atual sem recriar o callback
    const mid = movingIdRef.current;
    if (mid) {
      supabase.from("onibus_pontos").update({ lat, lng }).eq("id", mid).then(({ error }) => {
        if (error) { toast.error("Erro ao mover."); return; }
        setWaypoints(prev => prev.map(w => w.id === mid ? { ...w, lat, lng } : w));
        setParadas(prev => prev.map(p => p.id === mid ? { ...p, lat, lng } : p));
        setMovingId(null);
        toast.success("Ponto movido!");
      });
      return;
    }
    if (!adicionando) return;
    setPendingLatLng({ lat, lng });
  }, [adicionando]);

  const confirmarPonto = async () => {
    if (!pendingLatLng || !rotaSelecionada) return;
    if (camada === "paradas" && !nomePonto) return;

    const tipo = camada === "rota" ? "waypoint" : "parada";
    const lista = camada === "rota" ? waypoints : paradas;
    const ordem = lista.length;
    const nome = camada === "rota" ? `W${ordem + 1}` : nomePonto;

    const { data, error } = await supabase.from("onibus_pontos").insert({
      rota_id: rotaSelecionada.id, nome, lat: pendingLatLng.lat, lng: pendingLatLng.lng, ordem, tipo,
    }).select().single();

    if (error) { toast.error("Erro ao salvar."); return; }

    if (tipo === "waypoint") setWaypoints(prev => [...prev, data as Ponto]);
    else setParadas(prev => [...prev, data as Ponto]);

    setNomePonto(""); setPendingLatLng(null);
    toast.success(tipo === "waypoint" ? "Waypoint adicionado!" : `Parada "${nome}" adicionada!`);
  };

  const excluirPonto = async (id: string, tipo: "waypoint" | "parada") => {
    await supabase.from("onibus_pontos").delete().eq("id", id);
    if (tipo === "waypoint") {
      const restantes = waypoints.filter(p => p.id !== id).map((p, i) => ({ ...p, ordem: i }));
      for (const p of restantes) await supabase.from("onibus_pontos").update({ ordem: p.ordem }).eq("id", p.id);
      setWaypoints(restantes);
    } else {
      const restantes = paradas.filter(p => p.id !== id).map((p, i) => ({ ...p, ordem: i }));
      for (const p of restantes) await supabase.from("onibus_pontos").update({ ordem: p.ordem }).eq("id", p.id);
      setParadas(restantes);
    }
    toast.success("Ponto removido.");
  };

  const renomearParada = async (id: string, novoNome: string) => {
    if (!novoNome.trim()) return;
    await supabase.from("onibus_pontos").update({ nome: novoNome }).eq("id", id);
    setParadas(prev => prev.map(p => p.id === id ? { ...p, nome: novoNome } : p));
    toast.success("Parada renomeada!");
  };

  const importarArquivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !rotaSelecionada) return;
    e.target.value = "";
    const text = await file.text();
    let pts: { lat: number; lng: number; nome: string }[] = [];
    try {
      if (file.name.endsWith(".gpx")) pts = parsearGPX(text);
      else if (file.name.endsWith(".geojson") || file.name.endsWith(".json")) pts = parsearGeoJSON(text);
      else if (file.name.endsWith(".kml")) pts = parsearKML(text);
      else { toast.error("Use GPX, GeoJSON ou KML."); return; }
    } catch { toast.error("Erro ao ler arquivo."); return; }
    if (!pts.length) { toast.error("Nenhum ponto encontrado."); return; }

    const step = Math.max(1, Math.floor(pts.length / 100));
    const amostrados = pts.filter((_, i) => i % step === 0 || i === pts.length - 1);
    const tipo = camada === "rota" ? "waypoint" : "parada";
    const listaAtual = camada === "rota" ? waypoints : paradas;

    if (!confirm(`Importar ${amostrados.length} pontos como ${tipo === "waypoint" ? "waypoints de rota" : "paradas"}?`)) return;

    const toInsert = amostrados.map((p, i) => ({
      rota_id: rotaSelecionada.id,
      nome: p.nome || (tipo === "waypoint" ? `W${listaAtual.length + i + 1}` : `Parada ${listaAtual.length + i + 1}`),
      lat: p.lat, lng: p.lng, ordem: listaAtual.length + i, tipo,
    }));

    const { data, error } = await supabase.from("onibus_pontos").insert(toInsert).select();
    if (error) { toast.error("Erro ao salvar pontos."); return; }
    if (tipo === "waypoint") setWaypoints(prev => [...prev, ...(data as Ponto[])]);
    else setParadas(prev => [...prev, ...(data as Ponto[])]);
    toast.success(`${amostrados.length} pontos importados!`);
  };

  const parsearGPX = (text: string) => {
    const xml = new DOMParser().parseFromString(text, "text/xml");
    const wpts = xml.querySelectorAll("wpt"); const trkpts = xml.querySelectorAll("trkpt");
    const nodes = wpts.length > 0 ? wpts : trkpts;
    return Array.from(nodes).map(n => ({ lat: parseFloat(n.getAttribute("lat") || "0"), lng: parseFloat(n.getAttribute("lon") || "0"), nome: n.querySelector("name")?.textContent || "" })).filter(p => p.lat !== 0);
  };
  const parsearGeoJSON = (text: string) => {
    const geo = JSON.parse(text); const result: { lat: number; lng: number; nome: string }[] = [];
    const features = geo.type === "FeatureCollection" ? geo.features : [geo];
    features.forEach((f: any) => {
      const geom = f.geometry || f; const nome = f.properties?.name || "";
      if (geom.type === "Point") result.push({ lng: geom.coordinates[0], lat: geom.coordinates[1], nome });
      else if (geom.type === "LineString") geom.coordinates.forEach(([lng, lat]: number[]) => result.push({ lat, lng, nome }));
      else if (geom.type === "MultiLineString") geom.coordinates.forEach((l: number[][]) => l.forEach(([lng, lat]) => result.push({ lat, lng, nome })));
    });
    return result;
  };
  const parsearKML = (text: string) => {
    const xml = new DOMParser().parseFromString(text, "text/xml"); const result: { lat: number; lng: number; nome: string }[] = [];
    xml.querySelectorAll("Placemark").forEach(pm => {
      const nome = pm.querySelector("name")?.textContent || "";
      pm.querySelectorAll("coordinates").forEach(c => c.textContent?.trim().split(/\s+/).forEach(coord => { const [lng, lat] = coord.split(",").map(Number); if (lat && lng) result.push({ lat, lng, nome }); }));
    });
    return result;
  };

  const criarRota = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data, error } = await supabase.from("onibus_rotas").insert({ nome: nomeRota, cor: corRota, descricao: descRota }).select().single();
    if (error) { toast.error("Erro."); return; }
    setRotas(prev => [...prev, data]); setNomeRota(""); setDescRota("");
    toast.success("Rota criada!");
  };

  const excluirRota = async (id: string) => {
    if (!confirm("Excluir rota?")) return;
    await supabase.from("onibus_rotas").delete().eq("id", id);
    setRotas(prev => prev.filter(r => r.id !== id));
    if (rotaSelecionada?.id === id) setRotaSelecionada(null);
  };

  const criarMotorista = async (e: React.FormEvent) => {
    e.preventDefault(); setCriandoMotorista(true);
    const { data, error } = await supabase.auth.signUp({ email: emailMotorista, password: senhaMotorista });
    if (error) { toast.error(error.message); setCriandoMotorista(false); return; }
    const uid = data.user?.id;
    if (!uid) { setCriandoMotorista(false); return; }
    await supabase.from("onibus_perfis").insert({ id: uid, tipo: "motorista", nome: nomeMotorista, telefone: telefMotorista });
    await supabase.from("onibus_motoristas").insert({ id: uid, veiculo: veiculoMotorista });
    toast.success(`Motorista ${nomeMotorista} criado!`);
    setNomeMotorista(""); setEmailMotorista(""); setSenhaMotorista(""); setTelefMotorista(""); setVeiculoMotorista("");
    carregarTudo(); setCriandoMotorista(false);
  };

  const posicoesNaMapa: PosicaoMapa[] = [
    ...posicoes,
    ...paradas.map(p => ({ id: p.id, lat: p.lat, lng: p.lng, nome: p.nome, tipo: "ponto" as const })),
  ];

  const waypointsNaMapa: Waypoint[] = waypoints.map((w, i) => ({ id: w.id, lat: w.lat, lng: w.lng, ordem: i }));

  const listaCamadaAtual = camada === "rota" ? waypoints : paradas;

  return (
    <div className="h-screen flex flex-col bg-gray-950 overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gray-700 flex items-center justify-center text-sm">⚙️</div>
          <p className="text-white font-black text-sm">Admin Ônibus</p>
        </div>
        <button onClick={() => router.push("/dashboard")} className="text-gray-500 text-xs px-3 py-1.5 rounded-xl bg-gray-800">Dashboard</button>
      </div>

      {/* Tabs principais */}
      <div className="flex mx-4 mb-3 bg-gray-800 rounded-2xl p-1 gap-1">
        {[["mapa","🗺️","Mapa"],["rotas","🛣️","Rotas"],["usuarios","🧍","Usuários"],["motoristas","🚌","Motoristas"]].map(([id, emoji, label]) => (
          <button key={id} onClick={() => setAba(id as any)}
            className={`flex-1 py-2 rounded-xl text-[11px] font-black transition-all ${aba === id ? 'bg-gray-600 text-white' : 'text-gray-500'}`}>
            {emoji} {label}
          </button>
        ))}
      </div>

      {/* MAPA */}
      {aba === "mapa" && (
        <div className="flex-1 relative overflow-hidden">
          <MapaLeaflet
            posicoes={posicoesNaMapa}
            waypoints={waypointsNaMapa}
            onMapClick={handleMapClick}
            rotaPontos={rotaGeometria.length > 0 ? rotaGeometria : undefined}
            rotaCor={rotaSelecionada?.cor}
          />

          {/* Toolbar flutuante */}
          <div className="absolute top-3 left-3 right-3 z-[1000] space-y-2">
            {/* Seletor de rota + importar */}
            <div className="flex gap-2">
              <select value={rotaSelecionada?.id || ""} onChange={e => setRotaSelecionada(rotas.find(r => r.id === e.target.value) || null)}
                className="flex-1 px-3 py-2 bg-gray-900/95 border border-gray-700 rounded-xl text-white text-xs focus:outline-none">
                <option value="">Selecionar rota...</option>
                {rotas.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
              </select>
              {rotaSelecionada && (
                <button onClick={() => importRef.current?.click()} className="px-3 py-2 rounded-xl text-xs font-black bg-blue-600 text-white">📂</button>
              )}
              <input ref={importRef} type="file" accept=".gpx,.geojson,.json,.kml" className="hidden" onChange={importarArquivo} />
            </div>

            {/* Seletor de camada */}
            {rotaSelecionada && (
              <div className="flex gap-1 bg-gray-900/95 p-1 rounded-2xl border border-gray-700">
                <button
                  onClick={() => { setCamada("rota"); setAdicionando(false); setPendingLatLng(null); setMovingId(null); }}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${camada === "rota" ? "bg-gray-500 text-white" : "text-gray-400"}`}>
                  <div className="w-3 h-3 rounded-full bg-gray-400 border-2 border-white" />
                  Camada: Rota
                </button>
                <button
                  onClick={() => { setCamada("paradas"); setAdicionando(false); setPendingLatLng(null); setMovingId(null); }}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${camada === "paradas" ? "bg-green-700 text-white" : "text-gray-400"}`}>
                  <div className="text-sm">🚏</div>
                  Camada: Paradas
                </button>
              </div>
            )}

            {/* Botões ação + lista */}
            {rotaSelecionada && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setAdicionando(v => !v); setMovingId(null); setPendingLatLng(null); }}
                  className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${adicionando
                    ? (camada === "rota" ? "bg-gray-500 text-white animate-pulse" : "bg-green-600 text-white animate-pulse")
                    : "bg-gray-800 text-gray-300"}`}>
                  {adicionando
                    ? `🖱️ Clique no mapa para ${camada === "rota" ? "waypoint" : "parada"}`
                    : `➕ ${camada === "rota" ? "Waypoint" : "Parada"}`}
                </button>
                {/* Botão abrir lista */}
                <button
                  onClick={() => setPainelPontos(v => !v)}
                  className={`py-2 px-3 rounded-xl text-xs font-black transition-all ${painelPontos ? "bg-gray-600 text-white" : "bg-gray-800 text-gray-300"}`}>
                  📋 {listaCamadaAtual.length}
                </button>
              </div>
            )}

            {/* Stats */}
            {rotaSelecionada && (
              <div className="flex gap-2 flex-wrap">
                {carregandoRota && (
                  <div className="flex items-center gap-1.5 bg-gray-900/90 px-3 py-1 rounded-xl">
                    <div className="w-3 h-3 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
                    <span className="text-amber-400 text-[10px] font-bold">Calculando por estradas...</span>
                  </div>
                )}
                {!carregandoRota && distanciaKm !== null && (
                  <div className="bg-gray-900/90 px-3 py-1 rounded-xl text-[10px] font-black text-green-400">
                    📏 {distanciaKm.toFixed(1)} km
                  </div>
                )}
                <div className="bg-gray-900/90 px-3 py-1 rounded-xl text-[10px] font-bold text-gray-400">
                  {waypoints.length} waypoints · {paradas.length} paradas
                </div>
              </div>
            )}
          </div>

          {/* Banner modo mover */}
          {movingId && (
            <div className="absolute top-[220px] left-4 right-4 z-[1002] bg-blue-600/97 backdrop-blur rounded-2xl px-4 py-3 flex items-center gap-3 shadow-2xl border border-blue-400/30">
              <div className="flex-1">
                <p className="text-white text-xs font-black">🎯 Modo mover ativo</p>
                <p className="text-blue-200 text-[10px]">Toque no mapa para reposicionar o ponto</p>
              </div>
              <button onClick={() => setMovingId(null)} className="text-white bg-blue-800 px-3 py-1.5 rounded-xl text-xs font-bold active:bg-blue-900">
                Cancelar
              </button>
            </div>
          )}

          {/* Form confirmação novo ponto */}
          {pendingLatLng && !movingId && (
            <div className="absolute bottom-4 left-4 right-4 z-[1000] bg-gray-900/98 backdrop-blur rounded-3xl p-4 space-y-3 border border-gray-700">
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${camada === "rota" ? "bg-gray-500" : "bg-green-600"}`}>
                  {camada === "rota" ? "•" : "🚏"}
                </div>
                <p className="text-white text-xs font-bold">
                  {camada === "rota" ? `Waypoint ${waypoints.length + 1}` : "Nova Parada"} — {pendingLatLng.lat.toFixed(5)}, {pendingLatLng.lng.toFixed(5)}
                </p>
              </div>
              {camada === "paradas" && (
                <input value={nomePonto} onChange={e => setNomePonto(e.target.value)} placeholder="Nome da parada (ex: Terminal Centro)"
                  autoFocus
                  className="w-full px-4 py-3 bg-gray-800 rounded-2xl text-white text-sm focus:outline-none border border-gray-700" />
              )}
              <div className="flex gap-2">
                <button onClick={() => setPendingLatLng(null)} className="flex-1 py-2.5 bg-gray-700 rounded-2xl text-gray-300 text-sm font-bold">Cancelar</button>
                <button onClick={confirmarPonto} disabled={camada === "paradas" && !nomePonto}
                  className={`flex-1 py-2.5 rounded-2xl text-white text-sm font-black disabled:opacity-40 ${camada === "rota" ? "bg-gray-500" : "bg-green-600"}`}>
                  Salvar
                </button>
              </div>
            </div>
          )}

          {/* Painel lista de pontos */}
          {rotaSelecionada && painelPontos && (
            <div className="absolute bottom-0 left-0 right-0 z-[1001] bg-gray-900/99 backdrop-blur rounded-t-3xl border-t border-gray-700 flex flex-col max-h-[60vh]">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 flex-shrink-0">
                <p className="text-white font-black text-sm">
                  {camada === "rota" ? `Waypoints (${waypoints.length})` : `Paradas (${paradas.length})`}
                </p>
                <button onClick={() => setPainelPontos(false)} className="w-7 h-7 flex items-center justify-center text-gray-400 bg-gray-800 rounded-full text-lg leading-none">×</button>
              </div>
              <div className="overflow-y-auto flex-1 px-4 py-2 space-y-1">
                {listaCamadaAtual.length === 0 && (
                  <p className="text-gray-500 text-xs py-6 text-center">Nenhum ponto adicionado ainda.</p>
                )}
                {listaCamadaAtual.map((p, i) => (
                  <PontoListItem
                    key={p.id}
                    ponto={p}
                    index={i}
                    camada={camada}
                    isMoving={movingId === p.id}
                    onMover={() => { setMovingId(p.id); setAdicionando(false); setPendingLatLng(null); setPainelPontos(false); toast("🎯 Toque no mapa para reposicionar"); }}
                    onExcluir={() => excluirPonto(p.id, camada === "rota" ? "waypoint" : "parada")}
                    onRenomear={camada === "paradas" ? (nome) => renomearParada(p.id, nome) : undefined}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ROTAS */}
      {aba === "rotas" && (
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
          <form onSubmit={criarRota} className="bg-gray-800 rounded-3xl p-4 space-y-3">
            <p className="text-white font-black text-sm">Nova Rota</p>
            <input required value={nomeRota} onChange={e => setNomeRota(e.target.value)} placeholder="Nome da rota"
              className="w-full px-4 py-3 bg-gray-900 rounded-2xl text-white text-sm border border-gray-700 focus:outline-none" />
            <input value={descRota} onChange={e => setDescRota(e.target.value)} placeholder="Descrição (opcional)"
              className="w-full px-4 py-3 bg-gray-900 rounded-2xl text-white text-sm border border-gray-700 focus:outline-none" />
            <div className="flex gap-2">
              {CORES.map(c => <button key={c} type="button" onClick={() => setCorRota(c)} style={{ background: c }} className={`w-8 h-8 rounded-full transition-all ${corRota === c ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-800 scale-110' : ''}`} />)}
            </div>
            <button type="submit" className="w-full py-3 bg-green-600 hover:bg-green-500 rounded-2xl font-black text-white text-sm">Criar Rota</button>
          </form>

          {rotas.map(r => (
            <div key={r.id} className="bg-gray-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: r.cor }} />
                <p className="text-white font-bold text-sm flex-1">{r.nome}</p>
                <button onClick={() => excluirRota(r.id)} className="text-red-500 text-xs px-2 py-1 rounded-lg bg-red-500/10">Excluir</button>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setRotaSelecionada(r); setCamada("rota"); setAdicionando(true); setAba("mapa"); }}
                  className="flex-1 py-2 bg-gray-700 rounded-xl text-gray-300 text-xs font-bold text-center">
                  🛣️ Editar Rota
                </button>
                <button onClick={() => { setRotaSelecionada(r); setCamada("paradas"); setAdicionando(true); setAba("mapa"); }}
                  className="flex-1 py-2 bg-green-900/50 rounded-xl text-green-400 text-xs font-bold text-center">
                  🚏 Editar Paradas
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* USUÁRIOS */}
      {aba === "usuarios" && (
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
          <p className="text-gray-500 text-xs pb-1">{usuarios.filter(u => u.tipo === 'passageiro').length} passageiros</p>
          {usuarios.filter(u => u.tipo === 'passageiro').map(u => (
            <div key={u.id} className="bg-gray-800 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-lg flex-shrink-0">🧍</div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm">{u.nome}</p>
                <p className="text-gray-400 text-xs truncate">{(u.onibus_usuarios as any)?.endereco || "Sem endereço"}</p>
                {u.telefone && <p className="text-gray-500 text-[10px]">📱 {u.telefone}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MOTORISTAS */}
      {aba === "motoristas" && (
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
          <form onSubmit={criarMotorista} className="bg-gray-800 rounded-3xl p-4 space-y-3">
            <p className="text-white font-black text-sm">Novo Motorista</p>
            {[
              [nomeMotorista, setNomeMotorista, "Nome completo", "text", false],
              [emailMotorista, setEmailMotorista, "E-mail", "email", true],
              [senhaMotorista, setSenhaMotorista, "Senha", "password", true],
              [telefMotorista, setTelefMotorista, "Telefone", "tel", false],
              [veiculoMotorista, setVeiculoMotorista, "Veículo (modelo/placa)", "text", false],
            ].map(([val, setter, ph, type, req], i) => (
              <input key={i} type={type as string} required={req as boolean} value={val as string}
                onChange={e => (setter as any)(e.target.value)} placeholder={ph as string}
                className="w-full px-4 py-3 bg-gray-900 rounded-2xl text-white text-sm border border-gray-700 focus:outline-none" />
            ))}
            <button type="submit" disabled={criandoMotorista} className="w-full py-3 bg-amber-500 rounded-2xl font-black text-white text-sm disabled:opacity-50">
              {criandoMotorista ? "Criando..." : "Criar Motorista"}
            </button>
          </form>

          {usuarios.filter(u => u.tipo === 'motorista').map(u => (
            <div key={u.id} className="bg-gray-800 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-lg flex-shrink-0">🚌</div>
              <div>
                <p className="text-white font-bold text-sm">{u.nome}</p>
                {u.telefone && <p className="text-gray-400 text-xs">📱 {u.telefone}</p>}
              </div>
              <div className={`ml-auto w-2 h-2 rounded-full ${posicoes.find(p => p.id === u.id) ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Componente separado para evitar re-renders excessivos na lista
function PontoListItem({
  ponto, index, camada, isMoving, onMover, onExcluir, onRenomear,
}: {
  ponto: Ponto;
  index: number;
  camada: Camada;
  isMoving: boolean;
  onMover: () => void;
  onExcluir: () => void;
  onRenomear?: (nome: string) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [nomeEdit, setNomeEdit] = useState(ponto.nome);

  const salvar = () => {
    onRenomear?.(nomeEdit);
    setEditando(false);
  };

  return (
    <div className={`flex items-center gap-2 py-2.5 px-1 rounded-2xl transition-all ${isMoving ? "bg-blue-900/40 border border-blue-600/50" : ""}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 ${camada === "rota" ? "bg-gray-600 text-white" : "bg-green-700 text-white"}`}>
        {index + 1}
      </div>

      {editando ? (
        <input
          autoFocus
          value={nomeEdit}
          onChange={e => setNomeEdit(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") salvar(); if (e.key === "Escape") setEditando(false); }}
          className="flex-1 bg-gray-700 text-white text-xs px-3 py-1.5 rounded-xl border border-gray-500 focus:outline-none focus:border-green-500"
        />
      ) : (
        <span
          className={`flex-1 text-sm truncate ${camada === "paradas" ? "text-white cursor-pointer active:text-green-400" : "text-gray-300"}`}
          onClick={() => camada === "paradas" && setEditando(true)}
        >
          {ponto.nome}
          {camada === "paradas" && <span className="text-gray-600 text-[9px] ml-1">✎</span>}
        </span>
      )}

      {editando ? (
        <button onClick={salvar} className="text-green-400 text-xs px-2 py-1 rounded-lg bg-green-500/10 font-bold">✓</button>
      ) : (
        <button onClick={onMover} className="text-blue-400 text-[11px] px-2 py-1 rounded-lg bg-blue-500/10 font-bold flex-shrink-0">
          ↕
        </button>
      )}

      {!editando && (
        <button onClick={onExcluir} className="text-red-400 text-[11px] px-2 py-1 rounded-lg bg-red-500/10 font-bold flex-shrink-0">
          ✕
        </button>
      )}
    </div>
  );
}
