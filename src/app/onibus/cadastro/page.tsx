"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { PosicaoMapa } from "../components/MapaLeaflet";

const MapaLeaflet = dynamic(() => import("../components/MapaLeaflet"), { ssr: false });

interface Sugestao { nome: string; lat: number; lng: number; }

export default function CadastroPassageiro() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [senha, setSenha] = useState("");
  const [endereco, setEndereco] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  // Centro do mapa — só muda ao buscar novo endereço ou GPS, nunca ao clicar no mapa
  const [mapCentro, setMapCentro] = useState<[number, number] | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [buscandoLoc, setBuscandoLoc] = useState(false);

  // Autocomplete de endereço
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [buscandoEnd, setBuscandoEnd] = useState(false);
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const enderecoRef = useRef<HTMLInputElement>(null);

  // Debounce na busca de endereço
  useEffect(() => {
    if (!endereco || endereco.length < 5) { setSugestoes([]); return; }
    const timer = setTimeout(async () => {
      setBuscandoEnd(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(endereco)}&format=json&limit=5&countrycodes=br&accept-language=pt-BR`,
          { headers: { "User-Agent": "OnibusApp/1.0" } }
        );
        const data = await res.json();
        setSugestoes(data.map((r: any) => ({
          nome: r.display_name,
          lat: parseFloat(r.lat),
          lng: parseFloat(r.lon),
        })));
        setMostrarSugestoes(true);
      } catch {
        setSugestoes([]);
      } finally {
        setBuscandoEnd(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [endereco]);

  const selecionarSugestao = (s: Sugestao) => {
    const nomeCurto = s.nome.split(",").slice(0, 3).join(",").trim();
    setEndereco(nomeCurto);
    setLat(s.lat);
    setLng(s.lng);
    setMapCentro([s.lat, s.lng]);
    setSugestoes([]);
    setMostrarSugestoes(false);
  };

  const buscarLocalizacao = () => {
    setBuscandoLoc(true);
    setErro("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setLat(latitude);
        setLng(longitude);
        setMapCentro([latitude, longitude]);
        setBuscandoLoc(false);
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=pt-BR`
          );
          const data = await res.json();
          if (data.display_name) {
            const nomeCurto = data.display_name.split(",").slice(0, 4).join(",").trim();
            setEndereco(nomeCurto);
          }
        } catch {}
      },
      () => {
        setBuscandoLoc(false);
        setErro("Não foi possível obter sua localização. Permita o acesso ao GPS.");
      },
      { enableHighAccuracy: true }
    );
  };

  const handleMapClick = (clickLat: number, clickLng: number) => {
    setLat(clickLat);
    setLng(clickLng);
    fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${clickLat}&lon=${clickLng}&format=json&accept-language=pt-BR`
    )
      .then(r => r.json())
      .then(data => {
        if (data.display_name) {
          const nomeCurto = data.display_name.split(",").slice(0, 4).join(",").trim();
          setEndereco(nomeCurto);
        }
      })
      .catch(() => {});
  };

  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lat || !lng) { setErro("Informe sua localização no mapa."); return; }
    setLoading(true);
    setErro("");

    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password: senha });

    if (authError) {
      setErro(authError.message.includes("already") ? "E-mail já cadastrado." : authError.message);
      setLoading(false);
      return;
    }

    const userId = authData.user?.id;
    if (!userId) { setErro("Erro ao criar conta."); setLoading(false); return; }

    await supabase.from("onibus_perfis").insert({ id: userId, tipo: "passageiro", nome, telefone });
    await supabase.from("onibus_usuarios").insert({ id: userId, endereco, lat, lng });

    router.push("/onibus/app");
  };

  const posicaoPin: PosicaoMapa[] = lat !== null && lng !== null
    ? [{ id: "pin", lat, lng, nome: "Sua casa", tipo: "minha" }]
    : [];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      <div className="w-full max-w-sm">
        <Link href="/onibus" className="text-gray-500 text-sm mb-8 block">← Voltar</Link>

        <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-blue-600/30">
          <span className="text-3xl">🧍</span>
        </div>
        <h1 className="text-2xl font-black text-white text-center mb-1">Criar Conta</h1>
        <p className="text-gray-400 text-sm text-center mb-8">Passageiro</p>

        {/* Progress */}
        <div className="flex gap-2 mb-8">
          <div className={`flex-1 h-1 rounded-full ${step >= 1 ? 'bg-blue-500' : 'bg-gray-700'}`} />
          <div className={`flex-1 h-1 rounded-full ${step >= 2 ? 'bg-blue-500' : 'bg-gray-700'}`} />
        </div>

        <form onSubmit={step === 1 ? (e) => { e.preventDefault(); setStep(2); } : handleCadastro} className="space-y-4">
          {step === 1 && (
            <>
              <input type="text" required value={nome} onChange={e => setNome(e.target.value)}
                placeholder="Nome completo"
                className="w-full px-4 py-4 bg-gray-800 border border-gray-700 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                placeholder="E-mail"
                className="w-full px-4 py-4 bg-gray-800 border border-gray-700 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
              <input type="tel" value={telefone} onChange={e => setTelefone(e.target.value)}
                placeholder="Telefone (WhatsApp)"
                className="w-full px-4 py-4 bg-gray-800 border border-gray-700 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
              <input type="password" required minLength={6} value={senha} onChange={e => setSenha(e.target.value)}
                placeholder="Senha (mín. 6 caracteres)"
                className="w-full px-4 py-4 bg-gray-800 border border-gray-700 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
              <button type="submit" className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-2xl font-black text-white transition-all active:scale-95">
                Continuar →
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <p className="text-gray-400 text-xs text-center">
                Digite seu endereço ou use o GPS — o mapa aparece para você confirmar e ajustar o pino.
              </p>

              {/* Campo endereço com autocomplete */}
              <div className="relative">
                <input
                  ref={enderecoRef}
                  type="text"
                  value={endereco}
                  onChange={e => { setEndereco(e.target.value); setMostrarSugestoes(true); }}
                  onFocus={() => sugestoes.length > 0 && setMostrarSugestoes(true)}
                  onBlur={() => setTimeout(() => setMostrarSugestoes(false), 200)}
                  placeholder="Digite seu endereço..."
                  className="w-full px-4 py-4 bg-gray-800 border border-gray-700 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm pr-10"
                />
                {buscandoEnd && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                {lat !== null && !buscandoEnd && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-green-400 text-sm">✓</div>
                )}

                {/* Dropdown sugestões */}
                {mostrarSugestoes && sugestoes.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 bg-gray-800 border border-gray-700 rounded-2xl mt-1 overflow-hidden shadow-2xl">
                    {sugestoes.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        onMouseDown={() => selecionarSugestao(s)}
                        className="w-full px-4 py-3 text-left text-white text-xs hover:bg-gray-700 active:bg-gray-600 border-b border-gray-700/50 last:border-0"
                      >
                        <span className="text-blue-400 mr-1.5">📍</span>
                        <span className="line-clamp-2">{s.nome}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Botão GPS */}
              <button type="button" onClick={buscarLocalizacao} disabled={buscandoLoc}
                className="w-full py-3 bg-gray-700 hover:bg-gray-600 active:bg-gray-600 rounded-2xl font-bold text-white text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                {buscandoLoc
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Buscando GPS...</>
                  : "📡 Usar minha localização GPS"}
              </button>

              {/* Mini mapa */}
              {lat !== null && lng !== null ? (
                <div className="space-y-1.5">
                  <div className="w-full rounded-2xl overflow-hidden border border-gray-700 relative" style={{ height: "220px" }}>
                    <MapaLeaflet
                      posicoes={posicaoPin}
                      centro={mapCentro}
                      zoom={17}
                      onMapClick={handleMapClick}
                    />
                    <div className="absolute bottom-2 left-2 right-2 bg-gray-900/85 backdrop-blur rounded-xl px-3 py-1.5 text-[10px] text-gray-300 text-center z-[1000] pointer-events-none">
                      Toque no mapa para ajustar o pino 📍
                    </div>
                  </div>
                  <p className="text-gray-600 text-[10px] text-center">
                    {lat.toFixed(5)}, {lng.toFixed(5)}
                  </p>
                </div>
              ) : (
                <div className="w-full rounded-2xl border border-dashed border-gray-700 bg-gray-800/50 flex flex-col items-center justify-center gap-2 text-gray-600" style={{ height: "120px" }}>
                  <span className="text-2xl">🗺️</span>
                  <span className="text-xs">O mapa aparece após buscar o endereço</span>
                </div>
              )}

              {erro && <p className="text-red-400 text-xs text-center">{erro}</p>}

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(1)}
                  className="flex-1 py-4 bg-gray-800 hover:bg-gray-700 rounded-2xl font-bold text-gray-400 text-sm transition-all">
                  ← Voltar
                </button>
                <button type="submit" disabled={loading || lat === null}
                  className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 rounded-2xl font-black text-white transition-all active:scale-95 disabled:opacity-50">
                  {loading ? "Criando..." : "Cadastrar"}
                </button>
              </div>
            </>
          )}
        </form>

        <p className="text-center text-gray-500 text-sm mt-6">
          Já tem conta?{" "}
          <Link href="/onibus/login" className="text-blue-400 font-bold">Entrar</Link>
        </p>
      </div>
    </div>
  );
}
