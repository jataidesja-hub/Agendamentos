"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";

export default function PerfilMotorista() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [aba, setAba] = useState<"dados" | "senha">("dados");

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [veiculo, setVeiculo] = useState("");
  const [senhaNova, setSenhaNova] = useState("");
  const [senhaConf, setSenhaConf] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push("/onibus/login?tipo=motorista"); return; }
      const uid = session.user.id;
      const [{ data: perfil }, { data: motorista }] = await Promise.all([
        supabase.from("onibus_perfis").select("*").eq("id", uid).single(),
        supabase.from("onibus_motoristas").select("*").eq("id", uid).single(),
      ]);
      if (!perfil || perfil.tipo !== "motorista") { router.push("/onibus/login?tipo=motorista"); return; }
      setUser({ ...session.user, ...perfil });
      setNome(perfil.nome || "");
      setTelefone(perfil.telefone || "");
      setVeiculo(motorista?.veiculo || "");
      setLoading(false);
    });
  }, []);

  const salvarDados = async () => {
    if (!user || !nome.trim()) return;
    setSalvando(true);
    const [r1, r2] = await Promise.all([
      supabase.from("onibus_perfis").update({ nome: nome.trim(), telefone }).eq("id", user.id),
      supabase.from("onibus_motoristas").update({ veiculo }).eq("id", user.id),
    ]);
    setSalvando(false);
    if (r1.error || r2.error) { toast.error("Erro ao salvar."); return; }
    toast.success("Dados atualizados!");
  };

  const salvarSenha = async () => {
    if (senhaNova !== senhaConf) { toast.error("As senhas não coincidem."); return; }
    if (senhaNova.length < 6) { toast.error("Senha mínima de 6 caracteres."); return; }
    setSalvando(true);
    const { error } = await supabase.auth.updateUser({ password: senhaNova });
    setSalvando(false);
    if (error) { toast.error("Erro ao atualizar senha."); return; }
    toast.success("Senha atualizada!");
    setSenhaNova(""); setSenhaConf("");
  };

  if (loading) return (
    <div className="h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
    </div>
  );

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
        <div className="w-10 h-10 rounded-2xl bg-amber-500 flex items-center justify-center text-xl">🚌</div>
      </div>

      {/* Tabs */}
      <div className="flex mx-4 mt-4 mb-2 bg-gray-800 rounded-2xl p-1 gap-1">
        {[["dados","👤","Dados"],["senha","🔑","Senha"]].map(([id, emoji, label]) => (
          <button key={id} onClick={() => setAba(id as any)}
            className={`flex-1 py-2 rounded-xl text-[12px] font-black transition-all ${aba === id ? "bg-amber-500 text-white" : "text-gray-500"}`}>
            {emoji} {label}
          </button>
        ))}
      </div>

      <div className="flex-1 px-4 py-4 space-y-4">
        {aba === "dados" && (
          <>
            <div className="bg-gray-800 rounded-3xl p-4 space-y-3">
              <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Informações</p>
              <div className="space-y-3">
                <div>
                  <label className="text-gray-500 text-[11px] ml-1">Nome completo</label>
                  <input value={nome} onChange={e => setNome(e.target.value)}
                    className="w-full mt-1 px-4 py-3.5 bg-gray-900 border border-gray-700 rounded-2xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
                </div>
                <div>
                  <label className="text-gray-500 text-[11px] ml-1">Telefone / WhatsApp</label>
                  <input type="tel" value={telefone} onChange={e => setTelefone(e.target.value)}
                    placeholder="(00) 00000-0000"
                    className="w-full mt-1 px-4 py-3.5 bg-gray-900 border border-gray-700 rounded-2xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
                </div>
                <div>
                  <label className="text-gray-500 text-[11px] ml-1">Veículo (modelo / placa)</label>
                  <input value={veiculo} onChange={e => setVeiculo(e.target.value)}
                    placeholder="Ex: Mercedes Sprinter · ABC-1234"
                    className="w-full mt-1 px-4 py-3.5 bg-gray-900 border border-gray-700 rounded-2xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
                </div>
                <div>
                  <label className="text-gray-500 text-[11px] ml-1">E-mail</label>
                  <input value={user?.email || ""} disabled
                    className="w-full mt-1 px-4 py-3.5 bg-gray-900/50 border border-gray-800 rounded-2xl text-gray-500 text-sm cursor-not-allowed" />
                </div>
              </div>
            </div>
            <button onClick={salvarDados} disabled={salvando || !nome.trim()}
              className="w-full py-4 bg-amber-500 hover:bg-amber-400 active:scale-95 rounded-2xl font-black text-white transition-all disabled:opacity-50">
              {salvando ? "Salvando..." : "Salvar alterações"}
            </button>
          </>
        )}

        {aba === "senha" && (
          <>
            <div className="bg-gray-800 rounded-3xl p-4 space-y-3">
              <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Alterar senha</p>
              <div className="space-y-3">
                <div>
                  <label className="text-gray-500 text-[11px] ml-1">Nova senha</label>
                  <input type="password" value={senhaNova} onChange={e => setSenhaNova(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full mt-1 px-4 py-3.5 bg-gray-900 border border-gray-700 rounded-2xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
                </div>
                <div>
                  <label className="text-gray-500 text-[11px] ml-1">Confirmar nova senha</label>
                  <input type="password" value={senhaConf} onChange={e => setSenhaConf(e.target.value)}
                    placeholder="Repita a senha"
                    className={`w-full mt-1 px-4 py-3.5 bg-gray-900 border rounded-2xl text-white text-sm focus:outline-none focus:ring-2 ${senhaConf && senhaNova !== senhaConf ? "border-red-500 focus:ring-red-500" : "border-gray-700 focus:ring-amber-500"}`} />
                  {senhaConf && senhaNova !== senhaConf && (
                    <p className="text-red-400 text-[10px] ml-1 mt-1">As senhas não coincidem</p>
                  )}
                </div>
              </div>
            </div>
            <button onClick={salvarSenha} disabled={salvando || senhaNova.length < 6 || senhaNova !== senhaConf}
              className="w-full py-4 bg-amber-500 hover:bg-amber-400 active:scale-95 rounded-2xl font-black text-white transition-all disabled:opacity-50">
              {salvando ? "Atualizando..." : "Atualizar senha"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
