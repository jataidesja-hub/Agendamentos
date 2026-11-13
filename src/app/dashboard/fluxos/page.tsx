"use client";

import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";
import {
  ClipboardDocumentListIcon,
  PlusIcon,
  CheckCircleIcon,
  ClockIcon,
  TruckIcon,
  CreditCardIcon,
  CurrencyDollarIcon,
  UserIcon,
  CheckBadgeIcon,
  XCircleIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

interface FluxoAbastecimento {
  id: string;
  placa: string | null;
  cartao: string | null;
  projeto: string | null;
  justificativa: string;
  valor: number;
  status: "solicitado" | "aprovado" | "feito" | "rejeitado";
  solicitado_por: string;
  solicitado_em: string;
  aprovado_por: string | null;
  aprovado_em: string | null;
  feito_por: string | null;
  feito_em: string | null;
  observacao_fluxo: string | null;
  created_at: string;
}

const fmtCurrency = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDateTime = (d: string | null) => {
  if (!d) return "---";
  return new Date(d).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function FluxosAbastecimentoPage() {
  const [userEmail, setUserEmail] = useState("");
  const [isMaster, setIsMaster] = useState(false);
  const [papelFluxo, setPapelFluxo] = useState<"adm" | "gerente" | "master">("adm");
  const [projetosPermitidos, setProjetosPermitidos] = useState<string[] | null>(null);

  const [fluxos, setFluxos] = useState<FluxoAbastecimento[]>([]);
  const [frotaMap, setFrotaMap] = useState<Map<string, string>>(new Map());
  const [placasGerenteSet, setPlacasGerenteSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Modal Nova Solicitação
  const [showModal, setShowModal] = useState(false);
  const [placa, setPlaca] = useState("");
  const [cartao, setCartao] = useState("");
  const [projeto, setProjeto] = useState("");
  const [valor, setValor] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [salvando, setSalvando] = useState(false);

  // Filtros
  const [busca, setBusca] = useState("");
  const [filtroEtapa, setFiltroEtapa] = useState<"todos" | "solicitado" | "aprovado" | "feito">("todos");

  useEffect(() => {
    carregarContexto();
  }, []);

  const carregarContexto = async () => {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const email = (session?.user?.email || "").toLowerCase().trim();
      setUserEmail(email);

      // 1. Carrega perfil do usuário logado
      if (email) {
        const { data: perfil } = await supabase
          .from("perfis_acesso")
          .select("*")
          .ilike("email", email)
          .single();

        if (perfil) {
          const masterFlag = Boolean(perfil.master) || email === "logistica@cymi.com.br";
          setIsMaster(masterFlag);
          if (masterFlag) {
            setPapelFluxo("master");
          } else if (perfil.papel_fluxo === "gerente") {
            setPapelFluxo("gerente");
            setProjetosPermitidos(perfil.projetos_acesso || []);
          } else {
            setPapelFluxo("adm");
            setProjetosPermitidos(perfil.projetos_acesso || []);
          }
        } else if (email === "logistica@cymi.com.br") {
          setIsMaster(true);
          setPapelFluxo("master");
        }
      }

      // 2. Carrega frota para vincular Placa -> Projeto e identificar gerentes por e-mail
      const { data: frota } = await supabase
        .from("frota_veiculos")
        .select("placa, projeto, email_gerente")
        .eq("arquivado", false);

      if (frota) {
        const mapP = new Map<string, string>();
        const setGer = new Set<string>();
        frota.forEach((f: any) => {
          const p = String(f.placa || "").toUpperCase().trim();
          if (p) {
            if (f.projeto) mapP.set(p, String(f.projeto).toUpperCase().trim());
            if (
              email &&
              f.email_gerente &&
              String(f.email_gerente).toLowerCase().includes(email)
            ) {
              setGer.add(p);
            }
          }
        });
        setFrotaMap(mapP);
        setPlacasGerenteSet(setGer);
        if (setGer.size > 0 && !isMaster) {
          setPapelFluxo("gerente");
        }
      }

      await fetchFluxos();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchFluxos = async () => {
    const { data, error } = await supabase
      .from("fluxos_abastecimento")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) {
      setFluxos(data as FluxoAbastecimento[]);
    }
  };

  // Auto-preenche o projeto quando digita uma placa conhecida
  const handlePlacaChange = (val: string) => {
    const up = val.toUpperCase();
    setPlaca(up);
    const clean = up.replace(/[^A-Z0-9]/g, "");
    if (frotaMap.has(up)) {
      setProjeto(frotaMap.get(up) || "");
    } else if (frotaMap.has(clean)) {
      setProjeto(frotaMap.get(clean) || "");
    }
  };

  // 1. ADM (ou qualquer usuário com acesso) cria a Solicitação
  const handleCriarSolicitacao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!placa.trim() && !cartao.trim()) {
      toast.error("Informe a Placa ou o Cartão.");
      return;
    }
    const valorNum = Number(String(valor).replace(",", "."));
    if (!valorNum || valorNum <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }
    if (!justificativa.trim()) {
      toast.error("Informe a justificativa da solicitação.");
      return;
    }

    setSalvando(true);
    try {
      const projFinal =
        projeto.trim().toUpperCase() ||
        frotaMap.get(placa.trim().toUpperCase()) ||
        null;

      const payload = {
        placa: placa.trim().toUpperCase() || null,
        cartao: cartao.trim().toUpperCase() || null,
        projeto: projFinal,
        justificativa: justificativa.trim(),
        valor: valorNum,
        status: "solicitado",
        solicitado_por: userEmail || "usuário@cymi.com.br",
        solicitado_em: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("fluxos_abastecimento")
        .insert(payload)
        .select()
        .single();

      if (error) {
        toast.error("Erro ao criar solicitação: " + error.message);
        return;
      }

      toast.success("Solicitação registrada!");
      if (data) setFluxos((prev) => [data as FluxoAbastecimento, ...prev]);
      setPlaca("");
      setCartao("");
      setProjeto("");
      setValor("");
      setJustificativa("");
      setShowModal(false);
    } finally {
      setSalvando(false);
    }
  };

  // 2. Gerente (ou Master) Aprova a Solicitação
  const handleAprovar = async (item: FluxoAbastecimento) => {
    if (!podeAprovar) {
      toast.error("Apenas Gerente ou Master pode aprovar solicitações.");
      return;
    }
    const { error } = await supabase
      .from("fluxos_abastecimento")
      .update({
        status: "aprovado",
        aprovado_por: userEmail,
        aprovado_em: new Date().toISOString(),
      })
      .eq("id", item.id);

    if (error) {
      toast.error("Erro ao aprovar: " + error.message);
      return;
    }
    toast.success("Solicitação aprovada!");
    fetchFluxos();
  };

  // 3. Master (Você) Marca como FEITO (Confirmação Final)
  const handleMarcarFeito = async (item: FluxoAbastecimento) => {
    if (!isMaster && papelFluxo !== "master") {
      toast.error("Apenas o administrador principal (Master) pode marcar como Feito.");
      return;
    }
    const { error } = await supabase
      .from("fluxos_abastecimento")
      .update({
        status: "feito",
        feito_por: userEmail,
        feito_em: new Date().toISOString(),
      })
      .eq("id", item.id);

    if (error) {
      toast.error("Erro ao confirmar: " + error.message);
      return;
    }
    toast.success("Fluxo confirmado como FEITO!");
    fetchFluxos();
  };

  const handleExcluir = async (id: string) => {
    if (!confirm("Deseja excluir esta solicitação?")) return;
    const { error } = await supabase.from("fluxos_abastecimento").delete().eq("id", id);
    if (!error) {
      toast.success("Solicitação excluída.");
      setFluxos((prev) => prev.filter((f) => f.id !== id));
    }
  };

  const podeAprovar = isMaster || papelFluxo === "gerente" || papelFluxo === "master" || placasGerenteSet.size > 0;
  const podeMarcarFeito = isMaster || papelFluxo === "master";

  // Filtra de acordo com projetos permitidos do perfil (se não for Master) e busca
  const fluxosFiltrados = useMemo(() => {
    const q = busca.toLowerCase().trim();
    return fluxos.filter((f) => {
      // Filtro de permissão de projeto (usuário sempre vê o que ele mesmo solicitou ou dos projetos dele)
      if (!isMaster && projetosPermitidos && projetosPermitidos.length > 0) {
        const isOwner = f.solicitado_por?.toLowerCase() === userEmail;
        const projMatch =
          !f.projeto ||
          projetosPermitidos.some((p) => p.toUpperCase() === f.projeto?.toUpperCase());
        if (!isOwner && !projMatch) return false;
      }

      if (filtroEtapa !== "todos" && f.status !== filtroEtapa) return false;

      if (!q) return true;
      return (
        (f.placa || "").toLowerCase().includes(q) ||
        (f.cartao || "").toLowerCase().includes(q) ||
        (f.projeto || "").toLowerCase().includes(q) ||
        (f.justificativa || "").toLowerCase().includes(q) ||
        (f.solicitado_por || "").toLowerCase().includes(q) ||
        (f.aprovado_por || "").toLowerCase().includes(q) ||
        (f.feito_por || "").toLowerCase().includes(q)
      );
    });
  }, [fluxos, isMaster, projetosPermitidos, userEmail, filtroEtapa, busca]);

  const colunas = useMemo(() => {
    return {
      solicitado: fluxosFiltrados.filter((f) => f.status === "solicitado"),
      aprovado: fluxosFiltrados.filter((f) => f.status === "aprovado"),
      feito: fluxosFiltrados.filter((f) => f.status === "feito"),
    };
  }, [fluxosFiltrados]);

  if (loading) {
    return (
      <div className="p-12 text-center text-gray-400 font-black uppercase tracking-widest animate-pulse">
        Carregando Fluxos de Abastecimento...
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto p-3 sm:p-6 space-y-6 pb-20">
      {/* Cabeçalho */}
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-3xl p-5 sm:p-8 border border-gray-100 dark:border-gray-700 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0b7336] to-[#298d4a] flex items-center justify-center text-white shadow-lg shrink-0">
            <ClipboardDocumentListIcon className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight uppercase">
              Fluxos • Solicitação de Abastecimento
            </h1>
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mt-0.5">
              Logado como: <span className="text-[#0b7336] dark:text-green-400">{userEmail}</span> • Papel no Fluxo:{" "}
              <span className="uppercase font-black text-gray-800 dark:text-gray-200">
                {podeMarcarFeito
                  ? "Master (Solicita / Aprova / Marca Feito)"
                  : podeAprovar
                  ? "Gerente (Solicita / Aprova)"
                  : "ADM (Solicita)"}
              </span>
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center justify-center gap-2 px-6 py-3.5 bg-[#0b7336] hover:bg-[#09602c] text-white rounded-2xl font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg shadow-green-600/20 transition-all active:scale-95"
        >
          <PlusIcon className="w-5 h-5" />
          Nova Solicitação
        </button>
      </div>

      {/* Barra de Busca e Filtro Rápido */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar placa, cartão, e-mail, projeto..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#0b7336]"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: "todos", label: `Todos (${fluxosFiltrados.length})` },
            { id: "solicitado", label: `1. Solicitados (${colunas.solicitado.length})` },
            { id: "aprovado", label: `2. Aprovados (${colunas.aprovado.length})` },
            { id: "feito", label: `3. Feitos (${colunas.feito.length})` },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFiltroEtapa(f.id as any)}
              className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all ${
                filtroEtapa === f.id
                  ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900 shadow"
                  : "bg-white dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-700"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quadro das 3 Etapas do Fluxo: 1. SOLICITAÇÃO -> 2. APROVAÇÃO -> 3. FEITO */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* COLUNA 1: SOLICITAÇÃO (ADM solicita -> aguarda Gerente aprovar) */}
        <div className="bg-amber-50/60 dark:bg-gray-800/50 border border-amber-200/70 dark:border-gray-700 rounded-3xl p-4 sm:p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-amber-200/60 dark:border-gray-700 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <h2 className="text-sm font-black uppercase tracking-wider text-amber-800 dark:text-amber-400">
                1. Solicitação (Aguardando Gerente)
              </h2>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-800">
              {colunas.solicitado.length}
            </span>
          </div>

          <div className="space-y-3">
            {colunas.solicitado.length === 0 ? (
              <p className="text-center text-xs font-bold text-gray-400 py-10 uppercase">
                Nenhuma solicitação pendente
              </p>
            ) : (
              colunas.solicitado.map((item) => (
                <CardFluxo
                  key={item.id}
                  item={item}
                  podeAprovar={podeAprovar}
                  podeMarcarFeito={podeMarcarFeito}
                  isMaster={isMaster}
                  userEmail={userEmail}
                  onAprovar={() => handleAprovar(item)}
                  onFeito={() => handleMarcarFeito(item)}
                  onDelete={() => handleExcluir(item.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* COLUNA 2: APROVAÇÃO (Gerente aprovou -> aguarda Master marcar Feito) */}
        <div className="bg-blue-50/60 dark:bg-gray-800/50 border border-blue-200/70 dark:border-gray-700 rounded-3xl p-4 sm:p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-blue-200/60 dark:border-gray-700 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-3 h-3 rounded-full bg-blue-600" />
              <h2 className="text-sm font-black uppercase tracking-wider text-blue-800 dark:text-blue-400">
                2. Aprovado (Aguardando Liberação)
              </h2>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-100 text-blue-800">
              {colunas.aprovado.length}
            </span>
          </div>

          <div className="space-y-3">
            {colunas.aprovado.length === 0 ? (
              <p className="text-center text-xs font-bold text-gray-400 py-10 uppercase">
                Nenhum item aguardando liberação
              </p>
            ) : (
              colunas.aprovado.map((item) => (
                <CardFluxo
                  key={item.id}
                  item={item}
                  podeAprovar={podeAprovar}
                  podeMarcarFeito={podeMarcarFeito}
                  isMaster={isMaster}
                  userEmail={userEmail}
                  onAprovar={() => handleAprovar(item)}
                  onFeito={() => handleMarcarFeito(item)}
                  onDelete={() => handleExcluir(item.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* COLUNA 3: FEITO (Confirmado pelo Master) */}
        <div className="bg-emerald-50/60 dark:bg-gray-800/50 border border-emerald-200/70 dark:border-gray-700 rounded-3xl p-4 sm:p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-emerald-200/60 dark:border-gray-700 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-3 h-3 rounded-full bg-emerald-600" />
              <h2 className="text-sm font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
                3. Feito / Concluído
              </h2>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800">
              {colunas.feito.length}
            </span>
          </div>

          <div className="space-y-3">
            {colunas.feito.length === 0 ? (
              <p className="text-center text-xs font-bold text-gray-400 py-10 uppercase">
                Nenhum fluxo finalizado
              </p>
            ) : (
              colunas.feito.map((item) => (
                <CardFluxo
                  key={item.id}
                  item={item}
                  podeAprovar={podeAprovar}
                  podeMarcarFeito={podeMarcarFeito}
                  isMaster={isMaster}
                  userEmail={userEmail}
                  onAprovar={() => handleAprovar(item)}
                  onFeito={() => handleMarcarFeito(item)}
                  onDelete={() => handleExcluir(item.id)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* MODAL NOVA SOLICITAÇÃO DE ABASTECIMENTO */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4 my-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase">
                Solicitar Abastecimento / Saldo
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-xl text-gray-400 hover:bg-gray-100"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-600 dark:text-gray-300">
              Solicitante (ADM): <span className="font-black text-[#0b7336]">{userEmail}</span>
            </div>

            <form onSubmit={handleCriarSolicitacao} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">
                    Placa do Veículo
                  </label>
                  <input
                    type="text"
                    list="placas-frota-fluxo"
                    placeholder="Ex: ABC1D23"
                    value={placa}
                    onChange={(e) => handlePlacaChange(e.target.value)}
                    className="w-full px-3.5 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-black uppercase text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#0b7336]"
                  />
                  <datalist id="placas-frota-fluxo">
                    {Array.from(frotaMap.keys()).map((p) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">
                    Nº do Cartão (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Cartão ou final"
                    value={cartao}
                    onChange={(e) => setCartao(e.target.value)}
                    className="w-full px-3.5 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#0b7336]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">
                    Valor Solicitado (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0,00"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    className="w-full px-3.5 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-black text-emerald-700 dark:text-emerald-400 outline-none focus:ring-2 focus:ring-[#0b7336]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">
                    Projeto
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: EVOLTZ"
                    value={projeto}
                    onChange={(e) => setProjeto(e.target.value.toUpperCase())}
                    className="w-full px-3.5 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold uppercase text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#0b7336]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">
                  Justificativa da Solicitação *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Descreva o motivo da solicitação de saldo/abastecimento..."
                  value={justificativa}
                  onChange={(e) => setJustificativa(e.target.value)}
                  className="w-full px-3.5 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#0b7336]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-bold text-xs uppercase"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="flex-1 py-3 rounded-xl bg-[#0b7336] hover:bg-[#09602c] text-white font-black text-xs uppercase shadow-lg shadow-green-600/20"
                >
                  {salvando ? "Enviando..." : "Enviar Solicitação"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function CardFluxo({
  item,
  podeAprovar,
  podeMarcarFeito,
  isMaster,
  userEmail,
  onAprovar,
  onFeito,
  onDelete,
}: {
  item: FluxoAbastecimento;
  podeAprovar: boolean;
  podeMarcarFeito: boolean;
  isMaster: boolean;
  userEmail: string;
  onAprovar: () => void;
  onFeito: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm space-y-3">
      {/* Topo: Placa / Cartão / Valor */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {item.placa && (
            <span className="px-2.5 py-1 rounded-lg bg-gray-900 text-white font-black text-xs uppercase flex items-center gap-1">
              <TruckIcon className="w-3.5 h-3.5" /> {item.placa}
            </span>
          )}
          {item.cartao && (
            <span className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-black text-xs uppercase flex items-center gap-1">
              <CreditCardIcon className="w-3.5 h-3.5" /> {item.cartao}
            </span>
          )}
          {item.projeto && (
            <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-black text-[10px] uppercase">
              {item.projeto}
            </span>
          )}
        </div>

        <div className="text-right shrink-0">
          <span className="text-base font-black text-[#0b7336] dark:text-green-400">
            {fmtCurrency(item.valor)}
          </span>
        </div>
      </div>

      {/* Justificativa */}
      <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/70 text-xs font-semibold text-gray-700 dark:text-gray-200 break-words">
        {item.justificativa}
      </div>

      {/* Linha do Tempo de Auditoria: Quem fez cada etapa */}
      <div className="space-y-1.5 pt-1 border-t border-gray-100 dark:border-gray-800 text-[11px]">
        <div className="flex items-center justify-between gap-2">
          <span className="font-black uppercase text-amber-600">1. Solicitado por:</span>
          <span className="font-bold text-gray-800 dark:text-gray-200 truncate">
            {item.solicitado_por}
          </span>
        </div>
        <div className="text-[10px] text-gray-400 text-right">{fmtDateTime(item.solicitado_em)}</div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="font-black uppercase text-blue-600">2. Aprovado por:</span>
          <span className="font-bold text-gray-800 dark:text-gray-200 truncate">
            {item.aprovado_por || "Aguardando aprovação"}
          </span>
        </div>
        {item.aprovado_em && (
          <div className="text-[10px] text-gray-400 text-right">{fmtDateTime(item.aprovado_em)}</div>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="font-black uppercase text-emerald-600">3. Feito por:</span>
          <span className="font-bold text-gray-800 dark:text-gray-200 truncate">
            {item.feito_por || "Aguardando confirmação"}
          </span>
        </div>
        {item.feito_em && (
          <div className="text-[10px] text-gray-400 text-right">{fmtDateTime(item.feito_em)}</div>
        )}
      </div>

      {/* Botões de Ação de acordo com a Etapa e Permissão */}
      <div className="flex items-center justify-between gap-2 pt-2">
        {item.status === "solicitado" && podeAprovar && (
          <button
            type="button"
            onClick={onAprovar}
            className="flex-1 py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm transition-all"
          >
            <CheckCircleIcon className="w-4 h-4" />
            Aprovar Solicitação
          </button>
        )}

        {item.status === "aprovado" && podeMarcarFeito && (
          <button
            type="button"
            onClick={onFeito}
            className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm transition-all"
          >
            <CheckBadgeIcon className="w-4 h-4" />
            Marcar como Feito
          </button>
        )}

        {(isMaster || (item.status === "solicitado" && item.solicitado_por === userEmail)) && (
          <button
            type="button"
            onClick={onDelete}
            className="p-2 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 shrink-0 ml-auto"
            title="Excluir solicitação"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
