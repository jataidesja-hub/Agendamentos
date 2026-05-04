"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import dynamic from "next/dynamic";
import toast from "react-hot-toast";
import type { PosicaoMapa } from "../../components/MapaLeaflet";

const MapaLeaflet = dynamic(() => import("../../components/MapaLeaflet"), { ssr: false });

interface Sugestao { nome: string; lat: number; lng: number; }

export default function PerfilPassageiro() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [aba, setAba] = useState<"dados" | "endereco" | "senha">("dados");

  // Dados pessoais
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");

  // Endereço
  const [endereco, setEndereco] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [mapCentro, setMapCentro] = useState<[number, number] | undefined>(undefined);
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [mostrarSug, setMostrarSug] = useState(false);
  const [buscandoEnd, setBuscandoEnd] = useState(false);
  const [buscandoLoc, setBuscandoLoc] = useState(false);

  // Senha
  const [senhaAtual, setSenhaAtual] = useState("");
  const [senhaNova, setSenhaNova] = useState("");
  const [senhaConf, setSenhaConf] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push("/onibus/login"); return; }
      const uid = session.user.id;
      const [{ data: perfil }, { data: usuario }] = await Promise.all([
        supabase.from("onibus_perfis").select("*").eq("id", uid).single(),
        supabase.from("onibus_usuarios").select("*").eq("id", uid).single(),
      ]);
      if (!perfil || perfil.tipo !== "passageiro") { router.push("/onibus/login"); return; }
      setUser({ ...session.user, ...perfil });
      setNome(perfil.nome || "");
      setTelefone(perfil.telefone || "");
      if (usuario) {
        setEndereco(usuario.endereco || "");
        if (usuario.lat && usuario.lng) {
          setLat(usuario.lat);
          setLng(usuario.lng);
          setMapCentro([usuario.lat, usuario.lng]);
        }
      }
      setLoading(false);
    });
  }, []);

  // Autocomplete endereço
  useEffect(() => {
    if (!endereco || endereco.length < 5) { setSugestoes([]); return; }
    const t = setTimeout(async () => {
      setBuscandoEnd(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(endereco)}&format=json&limit=5&countrycodes=br&accept-language=pt-BR`
        );
        const data = await res.json();
        setSugestoes(data.map((r: any) => ({ nome: r.display_name, lat: parseFloat(r.lat), lng: parseFloat(r.lon) })));
        setMostrarSug(true);
      } catch {} finally { setBuscandoEnd(false); }
    }, 600);
    return () => clearTimeout(t);
  }, [endereco]);

  const selecionarSugestao = (s: Sugestao) => {
    setEndereco(s.nome.split(",").slice(0, 3).join(",").trim());
    setLat(s.lat); setLng(s.lng);
    setMapCentro([s.lat, s.lng]);
    setSugestoes([]); setMostrarSug(false);
  };

  const buscarGPS = () => {
    setBuscandoLoc(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      setLat(latitude); setLng(longitude);
      setMapCentro([latitude, longitude]);
      setBuscandoLoc(false);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=pt-BR`);
        const data = await res.json();
        if (data.display_name) setEndereco(data.display_name.split(",").slice(0, 4).join(",").trim());
      } catch {}
    }, () => { setBuscandoLoc(false); toast.error("GPS não disponível."); }, { enableHighAccuracy: true });
  };

  const handleMapClick = (clickLat: number, clickLng: number) => {
    setLat(clickLat); setLng(clickLng);
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${clickLat}&lon=${clickLng}&format=json&accept-language=pt-BR`)
      .then(r => r.json())
      .then(data => { if (data.display_name) setEndereco(data.display_name.split(",").slice(0, 4).join(",").trim()); })
      .catch(() => {});
  };

  const salvarDados = async () => {
    if (!user || !nome.trim()) return;
    setSalvando(true);
    const { error } = await supabase.from("onibus_perfis").update({ nome: nome.trim(), telefone }).eq("id", user.id);
    setSalvando(false);
    if (error) { toast.error("Erro ao salvar."); return; }
    toast.success("Dados atualizados!");
  };

  const salvarEndereco = async () => {
    if (!user || !lat || !lng) { toast.error("Confirme o endereço no mapa."); return; }
    setSalvando(true);
    const { error } = await supabase.from("onibus_usuarios").upsert({ id: user.id, endereco, lat, lng }, { onConflict: "id" });
    setSalvando(false);
    if (error) { toast.error("Erro ao salvar endereço."); return; }
    toast.success("Endereço atualizado!");
  };

  const salvarSenha = async () => {
    if (senhaNova !== senhaConf) { toast.error("As senhas não coincidem."); return; }
    if (senhaNova.length < 6) { toast.error("Senha mínima de 6 caracteres."); return; }
    setSalvando(true);
    const { error } = await supabase.auth.updateUser({ password: senhaNova });
    setSalvando(false);
    if (error) { toast.error("Erro ao atualizar senha."); return; }
    toast.success("Senha atualizada!");
    setSenhaAtual(""); setSenhaNova(""); setSenhaConf("");
  };

  if (loading) return (
    <div className="h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
    </div>
  );

  const pinPos: PosicaoMapa[] = lat !== null && lng !== null
    ? [{ id: "pin", lat, lng, nome: "Sua casa", tipo: "minha" }]
    : [];

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col pb-safe">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-safe pt-5 pb-4 bg-gray-950 sticky top-0 z-10 border-b border-gray-800">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-2xl bg-gray-800 flex items-center justify-center text-white active:bg-gray-700">
          ←
        </button>
        <div className="flex-1">
          <p className="text-white font-black text-base leading-tight">Meu Perfil</p>
          <p className="text-gray-500 text-[11px]">{user?.email}</p>
        </div>
        <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-xl">🧍</div>
      </div>

      {/* Tabs */}
      <div className="flex mx-4 mt-4 mb-2 bg-gray-800 rounded-2xl p-1 gap-1">
        {[["dados","👤","Dados"],["endereco","📍","Endereço"],["senha","🔑","Senha"]].map(([id, emoji, label]) => (
          <button key={id} onClick={() => setAba(id as any)}
            className={`flex-1 py-2 rounded-xl text-[11px] font-black transition-all ${aba === id ? "bg-blue-600 text-white" : "text-gray-500"}`}>
            {emoji} {label}
          </button>
        ))}
      </div>

      <div className="flex-1 px-4 py-4 space-y-4">

        {/* ABA DADOS */}
        {aba === "dados" && (
          <>
            <div className="bg-gray-800 rounded-3xl p-4 space-y-3">
              <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Informações pessoais</p>
              <div className="space-y-3">
                <div>
                  <label className="text-gray-500 text-[11px] ml-1">Nome completo</label>
                  <input value={nome} onChange={e => setNome(e.target.value)}
                    className="w-full mt-1 px-4 py-3.5 bg-gray-900 border border-gray-700 rounded-2xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-gray-500 text-[11px] ml-1">Telefone / WhatsApp</label>
                  <input type="tel" value={telefone} onChange={e => setTelefone(e.target.value)}
                    placeholder="(00) 00000-0000"
                    className="w-full mt-1 px-4 py-3.5 bg-gray-900 border border-gray-700 rounded-2xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-gray-500 text-[11px] ml-1">E-mail</label>
                  <input value={user?.email || ""} disabled
                    className="w-full mt-1 px-4 py-3.5 bg-gray-900/50 border border-gray-800 rounded-2xl text-gray-500 text-sm cursor-not-allowed" />
                  <p className="text-gray-600 text-[10px] ml-1 mt-1">O e-mail não pode ser alterado</p>
                </div>
              </div>
            </div>
            <button onClick={salvarDados} disabled={salvando || !nome.trim()}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 active:scale-95 rounded-2xl font-black text-white transition-all disabled:opacity-50">
              {salvando ? "Salvando..." : "Salvar alterações"}
            </button>
          </>
        )}

        {/* ABA ENDEREÇO */}
        {aba === "endereco" && (
          <>
            <div className="bg-gray-800 rounded-3xl p-4 space-y-3">
              <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Localização da sua casa</p>
              <p className="text-gray-500 text-xs">O motorista usa esse endereço para te localizar.</p>

              {/* Campo com autocomplete */}
              <div className="relative">
                <input value={endereco} onChange={e => { setEndereco(e.target.value); setMostrarSug(true); }}
                  onBlur={() => setTimeout(() => setMostrarSug(false), 200)}
                  placeholder="Digite seu endereço..."
                  className="w-full px-4 py-3.5 bg-gray-900 border border-gray-700 rounded-2xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10" />
                {buscandoEnd
                  ? <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  : lat !== null && <div className="absolute right-4 top-1/2 -translate-y-1/2 text-green-400 text-sm">✓</div>}
                {mostrarSug && sugestoes.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 bg-gray-800 border border-gray-700 rounded-2xl mt-1 overflow-hidden shadow-2xl">
                    {sugestoes.map((s, i) => (
                      <button key={i} type="button" onMouseDown={() => selecionarSugestao(s)}
                        className="w-full px-4 py-3 text-left text-white text-xs hover:bg-gray-700 border-b border-gray-700/50 last:border-0">
                        <span className="text-blue-400 mr-1.5">📍</span>
                        <span className="line-clamp-2">{s.nome}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button onClick={buscarGPS} disabled={buscandoLoc}
                className="w-full py-3 bg-gray-700 active:bg-gray-600 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                {buscandoLoc
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Buscando...</>
                  : "📡 Usar minha localização GPS"}
              </button>

              {/* Mapa */}
              {lat !== null && lng !== null ? (
                <div className="space-y-1">
                  <div className="w-full rounded-2xl overflow-hidden border border-gray-700 relative" style={{ height: "220px" }}>
                    <MapaLeaflet posicoes={pinPos} centro={mapCentro} zoom={17} onMapClick={handleMapClick} />
                    <div className="absolute bottom-2 left-2 right-2 bg-gray-900/85 rounded-xl px-3 py-1.5 text-[10px] text-gray-300 text-center z-[1000] pointer-events-none">
                      Toque no mapa para ajustar o pino 📍
                    </div>
                  </div>
                  <p className="text-gray-600 text-[10px] text-center">{lat.toFixed(5)}, {lng.toFixed(5)}</p>
                </div>
              ) : (
                <div className="w-full rounded-2xl border border-dashed border-gray-700 bg-gray-900/50 flex flex-col items-center justify-center gap-2 text-gray-600" style={{ height: "100px" }}>
                  <span className="text-2xl">🗺️</span>
                  <span className="text-xs">Busque o endereço para ver o mapa</span>
                </div>
              )}
            </div>

            <button onClick={salvarEndereco} disabled={salvando || lat === null}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 active:scale-95 rounded-2xl font-black text-white transition-all disabled:opacity-50">
              {salvando ? "Salvando..." : "Salvar endereço"}
            </button>
          </>
        )}

        {/* ABA SENHA */}
        {aba === "senha" && (
          <>
            <div className="bg-gray-800 rounded-3xl p-4 space-y-3">
              <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Alterar senha</p>
              <div className="space-y-3">
                <div>
                  <label className="text-gray-500 text-[11px] ml-1">Nova senha</label>
                  <input type="password" value={senhaNova} onChange={e => setSenhaNova(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full mt-1 px-4 py-3.5 bg-gray-900 border border-gray-700 rounded-2xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-gray-500 text-[11px] ml-1">Confirmar nova senha</label>
                  <input type="password" value={senhaConf} onChange={e => setSenhaConf(e.target.value)}
                    placeholder="Repita a senha"
                    className={`w-full mt-1 px-4 py-3.5 bg-gray-900 border rounded-2xl text-white text-sm focus:outline-none focus:ring-2 ${senhaConf && senhaNova !== senhaConf ? "border-red-500 focus:ring-red-500" : "border-gray-700 focus:ring-blue-500"}`} />
                  {senhaConf && senhaNova !== senhaConf && (
                    <p className="text-red-400 text-[10px] ml-1 mt-1">As senhas não coincidem</p>
                  )}
                </div>
              </div>
            </div>
            <button onClick={salvarSenha} disabled={salvando || senhaNova.length < 6 || senhaNova !== senhaConf}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 active:scale-95 rounded-2xl font-black text-white transition-all disabled:opacity-50">
              {salvando ? "Atualizando..." : "Atualizar senha"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
