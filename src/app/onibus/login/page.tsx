"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { Suspense } from "react";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const tipo = params.get("tipo") || "passageiro";

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErro("");

    const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) {
      setErro("E-mail ou senha incorretos.");
      setLoading(false);
      return;
    }

    const { data: perfil } = await supabase
      .from("onibus_perfis")
      .select("tipo")
      .eq("id", data.user.id)
      .single();

    if (!perfil) {
      setErro("Usuário não encontrado no sistema de ônibus.");
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    if (perfil.tipo === "motorista") router.push("/onibus/motorista");
    else router.push("/onibus/app");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      <div className="w-full max-w-sm">
        <Link href="/onibus" className="text-gray-500 text-sm mb-8 block">← Voltar</Link>

        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl ${tipo === 'motorista' ? 'bg-amber-500 shadow-amber-500/30' : 'bg-blue-600 shadow-blue-600/30'}`}>
          <span className="text-3xl">{tipo === 'motorista' ? '🚌' : '🧍'}</span>
        </div>
        <h1 className="text-2xl font-black text-white text-center mb-1">Entrar</h1>
        <p className="text-gray-400 text-sm text-center mb-8">
          {tipo === 'motorista' ? 'Área do Motorista' : 'Área do Passageiro'}
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email" required value={email} onChange={e => setEmail(e.target.value)}
            placeholder="E-mail"
            className="w-full px-4 py-4 bg-gray-800 border border-gray-700 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
          <input
            type="password" required value={senha} onChange={e => setSenha(e.target.value)}
            placeholder="Senha"
            className="w-full px-4 py-4 bg-gray-800 border border-gray-700 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
          {erro && <p className="text-red-400 text-sm text-center">{erro}</p>}
          <button type="submit" disabled={loading}
            className={`w-full py-4 rounded-2xl font-black text-white transition-all active:scale-95 ${tipo === 'motorista' ? 'bg-amber-500 hover:bg-amber-400' : 'bg-blue-600 hover:bg-blue-500'} disabled:opacity-50`}>
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        {tipo !== 'motorista' && (
          <p className="text-center text-gray-500 text-sm mt-6">
            Não tem conta?{" "}
            <Link href="/onibus/cadastro" className="text-blue-400 font-bold">Cadastrar</Link>
          </p>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
