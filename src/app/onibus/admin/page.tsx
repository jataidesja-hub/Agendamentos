"use client";
import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { PosicaoMapa } from "../components/MapaLeaflet";

const MapaLeaflet = dynamic(() => import("../components/MapaLeaflet"), { ssr: false });

interface Rota { id: string; nome: string; cor: string; ativa: boolean; }
interface Ponto { id: string; rota_id: string; nome: string; lat: number; lng: number; ordem: number; }
interface Perfil { id: string; nome: string; tipo: string; telefone: string; onibus_usuarios?: { endereco: string } }

const CORES = ["#0b7336", "#2563eb", "#d97706", "#dc2626", "#7c3aed", "#0891b2"];

export default function AdminOnibus() {
  const router = useRouter();
  const [aba, setAba] = useState<"mapa" | "rotas" | "usuarios" | "motoristas">("mapa");
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [rotaSelecionada, setRotaSelecionada] = useState<Rota | null>(null);
  const [pontos, setPontos] = useState<Ponto[]>([]);
  const [posicoes, setPosicoes] = useState<PosicaoMapa[]>([]);
  const [usuarios, setUsuarios] = useState<Perfil[]>([]);
  const [adicionandoPonto, setAdicionandoPonto] = useState(false);
  const [nomePonto, setNomePonto] = useState("");
  const [pendingLatLng, setPendingLatLng] = useState<{ lat: number; lng: number } | null>(null);

  // Form nova rota
  const [nomeRota, setNomeRota] = useState("");
  const [corRota, setCorRota] = useState(CORES[0]);
  const [descRota, setDescRota] = useState("");

  // Form novo motorista
  const [nomeMotorista, setNomeMotorista] = useState("");
  const [emailMotorista, setEmailMotorista] = useState("");
  const [senhaMotorista, setSenhaMotorista] = useState("");
  const [telefMotorista, setTelefMotorista] = useState("");
  const [veiculoMotorista, setVeiculoMotorista] = useState("");
  const [criandoMotorista, setCriandoMotorista] = useState(false);

  useEffect(() => {
    // Admin: verifica sessão existente (usa o mesmo auth do dashboard)
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
    if (!rotaSelecionada) return;
    supabase.from("onibus_pontos").select("*").eq("rota_id", rotaSelecionada.id).order("ordem").then(({ data }) => setPontos(data || []));
  }, [rotaSelecionada]);

  const criarRota = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data, error } = await supabase.from("onibus_rotas").insert({ nome: nomeRota, cor: corRota, descricao: descRota }).select().single();
    if (error) { toast.error("Erro ao criar rota."); return; }
    setRotas(prev => [...prev, data]);
    setNomeRota(""); setDescRota("");
    toast.success("Rota criada!");
  };

  const excluirRota = async (id: string) => {
    if (!confirm("Excluir rota e todos os pontos?")) return;
    await supabase.from("onibus_rotas").delete().eq("id", id);
    setRotas(prev => prev.filter(r => r.id !== id));
    if (rotaSelecionada?.id === id) { setRotaSelecionada(null); setPontos([]); }
    toast.success("Rota excluída.");
  };

  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (!adicionandoPonto) return;
    setPendingLatLng({ lat, lng });
  }, [adicionandoPonto]);

  const confirmarPonto = async () => {
    if (!pendingLatLng || !rotaSelecionada || !nomePonto) return;
    const ordem = pontos.length;
    const { data, error } = await supabase.from("onibus_pontos").insert({
      rota_id: rotaSelecionada.id, nome: nomePonto,
      lat: pendingLatLng.lat, lng: pendingLatLng.lng, ordem,
    }).select().single();
    if (error) { toast.error("Erro ao adicionar ponto."); return; }
    setPontos(prev => [...prev, data]);
    setNomePonto(""); setPendingLatLng(null);
    toast.success("Ponto adicionado!");
  };

  const excluirPonto = async (id: string) => {
    await supabase.from("onibus_pontos").delete().eq("id", id);
    setPontos(prev => prev.filter(p => p.id !== id));
  };

  const criarMotorista = async (e: React.FormEvent) => {
    e.preventDefault();
    setCriandoMotorista(true);
    const { data, error } = await supabase.auth.signUp({ email: emailMotorista, password: senhaMotorista });
    if (error) { toast.error("Erro: " + error.message); setCriandoMotorista(false); return; }
    const uid = data.user?.id;
    if (!uid) { toast.error("Erro ao criar conta."); setCriandoMotorista(false); return; }
    await supabase.from("onibus_perfis").insert({ id: uid, tipo: "motorista", nome: nomeMotorista, telefone: telefMotorista });
    await supabase.from("onibus_motoristas").insert({ id: uid, veiculo: veiculoMotorista });
    toast.success(`Motorista ${nomeMotorista} criado!`);
    setNomeMotorista(""); setEmailMotorista(""); setSenhaMotorista(""); setTelefMotorista(""); setVeiculoMotorista("");
    carregarTudo();
    setCriandoMotorista(false);
  };

  const todasPosicoesNaMapa: PosicaoMapa[] = [
    ...posicoes,
    ...pontos.map(p => ({ id: p.id, lat: p.lat, lng: p.lng, nome: p.nome, tipo: "ponto" as const })),
  ];

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

      {/* Tabs */}
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
        <div className="flex-1 relative">
          <MapaLeaflet
            posicoes={todasPosicoesNaMapa}
            onMapClick={handleMapClick}
            rotaPontos={rotaSelecionada ? pontos : undefined}
            rotaCor={rotaSelecionada?.cor}
          />
          {/* Overlay: selecionar rota */}
          <div className="absolute top-3 left-3 right-3 z-[1000] flex gap-2">
            <select
              value={rotaSelecionada?.id || ""}
              onChange={e => setRotaSelecionada(rotas.find(r => r.id === e.target.value) || null)}
              className="flex-1 px-3 py-2 bg-gray-900/95 border border-gray-700 rounded-xl text-white text-xs focus:outline-none"
            >
              <option value="">Ver todas as posições</option>
              {rotas.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
            </select>
            {rotaSelecionada && (
              <button onClick={() => setAdicionandoPonto(v => !v)}
                className={`px-3 py-2 rounded-xl text-xs font-black transition-all ${adicionandoPonto ? 'bg-amber-500 text-white' : 'bg-gray-800 text-gray-400'}`}>
                {adicionandoPonto ? "🖱️ Clique no mapa" : "➕ Ponto"}
              </button>
            )}
          </div>
          {/* Form nome do ponto */}
          {pendingLatLng && (
            <div className="absolute bottom-4 left-4 right-4 z-[1000] bg-gray-900/95 backdrop-blur rounded-3xl p-4 space-y-3">
              <p className="text-white text-sm font-bold">📍 {pendingLatLng.lat.toFixed(5)}, {pendingLatLng.lng.toFixed(5)}</p>
              <input value={nomePonto} onChange={e => setNomePonto(e.target.value)} placeholder="Nome da parada..."
                className="w-full px-4 py-3 bg-gray-800 rounded-2xl text-white text-sm focus:outline-none border border-gray-700" />
              <div className="flex gap-2">
                <button onClick={() => setPendingLatLng(null)} className="flex-1 py-2.5 bg-gray-700 rounded-2xl text-gray-300 text-sm font-bold">Cancelar</button>
                <button onClick={confirmarPonto} disabled={!nomePonto} className="flex-1 py-2.5 bg-amber-500 rounded-2xl text-white text-sm font-black disabled:opacity-40">Salvar</button>
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
              {CORES.map(c => (
                <button key={c} type="button" onClick={() => setCorRota(c)}
                  style={{ background: c }}
                  className={`w-8 h-8 rounded-full transition-all ${corRota === c ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-800 scale-110' : ''}`} />
              ))}
            </div>
            <button type="submit" className="w-full py-3 bg-green-600 hover:bg-green-500 rounded-2xl font-black text-white text-sm">Criar Rota</button>
          </form>

          <div className="space-y-2">
            {rotas.map(r => (
              <div key={r.id} className="bg-gray-800 rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: r.cor }} />
                  <div className="flex-1">
                    <p className="text-white font-bold text-sm">{r.nome}</p>
                    <button onClick={() => { setRotaSelecionada(r); setAba("mapa"); setAdicionandoPonto(true); }}
                      className="text-amber-400 text-xs font-bold mt-0.5">+ Adicionar pontos no mapa</button>
                  </div>
                  <button onClick={() => excluirRota(r.id)} className="text-red-500 text-xs px-2 py-1 rounded-lg bg-red-500/10 active:bg-red-500/20">Excluir</button>
                </div>
                {rotaSelecionada?.id === r.id && pontos.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {pontos.sort((a,b) => a.ordem - b.ordem).map((p, i) => (
                      <div key={p.id} className="flex items-center gap-2 pl-2">
                        <span className="text-gray-500 text-[10px] w-4">{i+1}.</span>
                        <span className="text-gray-300 text-xs flex-1">{p.nome}</span>
                        <button onClick={() => excluirPonto(p.id)} className="text-red-500 text-[10px]">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* USUÁRIOS */}
      {aba === "usuarios" && (
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
          <p className="text-gray-500 text-xs pb-1">{usuarios.filter(u => u.tipo === 'passageiro').length} passageiros cadastrados</p>
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
          {usuarios.filter(u => u.tipo === 'passageiro').length === 0 && (
            <div className="text-center py-12 text-gray-500 text-sm">Nenhum passageiro cadastrado.</div>
          )}
        </div>
      )}

      {/* MOTORISTAS */}
      {aba === "motoristas" && (
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
          <form onSubmit={criarMotorista} className="bg-gray-800 rounded-3xl p-4 space-y-3">
            <p className="text-white font-black text-sm">Novo Motorista</p>
            <input required value={nomeMotorista} onChange={e => setNomeMotorista(e.target.value)} placeholder="Nome completo"
              className="w-full px-4 py-3 bg-gray-900 rounded-2xl text-white text-sm border border-gray-700 focus:outline-none" />
            <input required type="email" value={emailMotorista} onChange={e => setEmailMotorista(e.target.value)} placeholder="E-mail"
              className="w-full px-4 py-3 bg-gray-900 rounded-2xl text-white text-sm border border-gray-700 focus:outline-none" />
            <input required type="password" minLength={6} value={senhaMotorista} onChange={e => setSenhaMotorista(e.target.value)} placeholder="Senha"
              className="w-full px-4 py-3 bg-gray-900 rounded-2xl text-white text-sm border border-gray-700 focus:outline-none" />
            <input value={telefMotorista} onChange={e => setTelefMotorista(e.target.value)} placeholder="Telefone"
              className="w-full px-4 py-3 bg-gray-900 rounded-2xl text-white text-sm border border-gray-700 focus:outline-none" />
            <input value={veiculoMotorista} onChange={e => setVeiculoMotorista(e.target.value)} placeholder="Veículo (modelo/placa)"
              className="w-full px-4 py-3 bg-gray-900 rounded-2xl text-white text-sm border border-gray-700 focus:outline-none" />
            <button type="submit" disabled={criandoMotorista} className="w-full py-3 bg-amber-500 hover:bg-amber-400 rounded-2xl font-black text-white text-sm disabled:opacity-50">
              {criandoMotorista ? "Criando..." : "Criar Motorista"}
            </button>
          </form>

          <div className="space-y-2">
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
        </div>
      )}
    </div>
  );
}
