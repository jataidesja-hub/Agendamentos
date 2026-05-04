"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

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
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [buscandoLoc, setBuscandoLoc] = useState(false);

  const buscarLocalizacao = () => {
    setBuscandoLoc(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setBuscandoLoc(false);
      },
      () => {
        setBuscandoLoc(false);
        setErro("Não foi possível obter sua localização. Permita o acesso ao GPS.");
      },
      { enableHighAccuracy: true }
    );
  };

  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErro("");

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password: senha,
    });

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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      <div className="w-full max-w-sm">
        <Link href="/onibus" className="text-gray-500 text-sm mb-8 block">← Voltar</Link>

        <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-blue-600/30">
          <span className="text-3xl">🧍</span>
        </div>
        <h1 className="text-2xl font-black text-white text-center mb-1">Criar Conta</h1>
        <p className="text-gray-400 text-sm text-center mb-8">Passageiro</p>

        {/* Steps */}
        <div className="flex gap-2 mb-8">
          <div className={`flex-1 h-1 rounded-full ${step >= 1 ? 'bg-blue-500' : 'bg-gray-700'}`} />
          <div className={`flex-1 h-1 rounded-full ${step >= 2 ? 'bg-blue-500' : 'bg-gray-700'}`} />
        </div>

        <form onSubmit={step === 1 ? (e) => { e.preventDefault(); setStep(2); } : handleCadastro} className="space-y-4">
          {step === 1 && <>
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
          </>}

          {step === 2 && <>
            <p className="text-gray-400 text-xs text-center">Informe seu endereço e localize sua casa no mapa para que o motorista possa te encontrar.</p>
            <input type="text" value={endereco} onChange={e => setEndereco(e.target.value)}
              placeholder="Endereço completo (rua, número, bairro)"
              className="w-full px-4 py-4 bg-gray-800 border border-gray-700 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
            <button type="button" onClick={buscarLocalizacao} disabled={buscandoLoc}
              className="w-full py-3 bg-gray-700 hover:bg-gray-600 rounded-2xl font-bold text-white text-sm transition-all flex items-center justify-center gap-2">
              {buscandoLoc ? "Buscando..." : lat ? `✅ GPS capturado (${lat.toFixed(4)}, ${lng?.toFixed(4)})` : "📍 Capturar minha localização atual"}
            </button>
            {erro && <p className="text-red-400 text-xs text-center">{erro}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={() => setStep(1)}
                className="flex-1 py-4 bg-gray-800 hover:bg-gray-700 rounded-2xl font-bold text-gray-400 text-sm transition-all">
                ← Voltar
              </button>
              <button type="submit" disabled={loading}
                className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 rounded-2xl font-black text-white transition-all active:scale-95 disabled:opacity-50">
                {loading ? "Criando..." : "Cadastrar"}
              </button>
            </div>
          </>}
        </form>

        <p className="text-center text-gray-500 text-sm mt-6">
          Já tem conta?{" "}
          <Link href="/onibus/login" className="text-blue-400 font-bold">Entrar</Link>
        </p>
      </div>
    </div>
  );
}
