"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import { PhoneIcon, EnvelopeIcon, BellAlertIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { toast } from "react-hot-toast";

export default function Configuracoes() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const [telefone, setTelefone] = useState("");
  const [emailNotificacao, setEmailNotificacao] = useState("");
  const [notificarAgendamentos, setNotificarAgendamentos] = useState(true);
  const [notificarTarefas, setNotificarTarefas] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        carregarPerfil(session.user.id);
      } else {
        window.location.href = "/";
      }
    });
  }, []);

  const carregarPerfil = async (userId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("perfis")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (data && !error) {
      setTelefone(data.telefone || "");
      setEmailNotificacao(data.email_notificacao || "");
      setNotificarAgendamentos(data.notificar_agendamentos ?? true);
      setNotificarTarefas(data.notificar_tarefas ?? true);
    }
    setLoading(false);
  };

  const salvarPerfil = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setSuccessMsg("");

    const perfilData = {
      user_id: user.id,
      telefone,
      email_notificacao: emailNotificacao,
      notificar_agendamentos: notificarAgendamentos,
      notificar_tarefas: notificarTarefas,
      updated_at: new Date().toISOString()
    };

    // Upsert (Insere se não existe, atualiza se existe) - baseado no user_id como primary key
    const { error } = await supabase
      .from("perfis")
      .upsert(perfilData, { onConflict: 'user_id' });

    if (error) {
      toast.error("Erro ao salvar! Erro: " + error.message);
    } else {
      toast.success("Configurações salvas com sucesso!");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0b7336]"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col max-w-3xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Configurações de Alertas</h1>
        <p className="mt-2 text-gray-500 dark:text-gray-400 font-medium">
          Configure para onde devemos enviar os alertas de agendamentos e tarefas próximas.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700">
        <form onSubmit={salvarPerfil} className="p-8 space-y-6">
          
          <div className="opacity-60">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
              Telefone (WhatsApp) <span className="text-orange-500 text-xs ml-2 uppercase bg-orange-100 dark:bg-orange-900/30 px-2 py-0.5 rounded-full">Em Desenvolvimento</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <PhoneIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                disabled
                type="tel"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                className="w-full pl-11 pr-5 py-4 border-0 bg-gray-100 dark:bg-gray-800 rounded-2xl text-gray-500 dark:text-gray-500 cursor-not-allowed transition-all font-medium"
                placeholder="(Em breve...)"
              />
            </div>
            <p className="mt-2 text-xs text-gray-500">O envio automatizado via WhatsApp será liberado em atualizações futuras.</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">E-mails de Notificação</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <EnvelopeIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={emailNotificacao}
                onChange={(e) => setEmailNotificacao(e.target.value)}
                className="w-full pl-11 pr-5 py-4 border-0 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:ring-2 focus:ring-[#0b7336] text-gray-900 dark:text-white transition-all font-medium"
                placeholder="email1@empresa.com, email2@empresa.com"
              />
            </div>
            <p className="mt-2 text-xs text-gray-500">Para notificar várias pessoas, separe os e-mails por vírgula (ex: email1@a.com, email2@b.com).</p>
          </div>

          <div className="border-t border-gray-100 dark:border-gray-700 pt-6 mt-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
              <BellAlertIcon className="w-5 h-5 mr-2 text-[#0b7336]" />
              Preferências de Notificação
            </h3>
            
            <div className="space-y-4">
              <label className="flex items-center cursor-pointer bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                <div className="relative">
                  <input type="checkbox" className="sr-only" checked={notificarAgendamentos} onChange={(e) => setNotificarAgendamentos(e.target.checked)} />
                  <div className={`block w-14 h-8 rounded-full transition-colors ${notificarAgendamentos ? 'bg-[#0b7336]' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                  <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${notificarAgendamentos ? 'transform translate-x-6' : ''}`}></div>
                </div>
                <div className="ml-4">
                  <span className="block text-sm font-bold text-gray-900 dark:text-white">Agendamentos Próximos</span>
                  <span className="block text-xs font-medium text-gray-500">Avisar quando um agendamento estiver perto de começar.</span>
                </div>
              </label>

              <label className="flex items-center cursor-pointer bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                <div className="relative">
                  <input type="checkbox" className="sr-only" checked={notificarTarefas} onChange={(e) => setNotificarTarefas(e.target.checked)} />
                  <div className={`block w-14 h-8 rounded-full transition-colors ${notificarTarefas ? 'bg-[#0b7336]' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                  <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${notificarTarefas ? 'transform translate-x-6' : ''}`}></div>
                </div>
                <div className="ml-4">
                  <span className="block text-sm font-bold text-gray-900 dark:text-white">Lista de Tarefas em Atraso/Próximas</span>
                  <span className="block text-xs font-medium text-gray-500">Avisar quando houverem tarefas pendentes críticas.</span>
                </div>
              </label>
            </div>
          </div>

          <div className="pt-6">
            {successMsg && (
              <div className="mb-4 flex items-center p-4 bg-green-50 text-green-700 rounded-2xl text-sm font-bold border border-green-100">
                <CheckCircleIcon className="w-5 h-5 mr-2" />
                {successMsg}
              </div>
            )}
            <button
              type="submit"
              disabled={saving}
              className="w-full flex items-center justify-center py-4 bg-[#0b7336] hover:bg-[#09602c] text-white font-bold rounded-2xl shadow-lg shadow-green-500/30 transition-all hover:shadow-green-500/50 hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {saving ? "Salvando..." : "Salvar Alterações"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
