"use client";

import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";
import {
  ShieldCheckIcon,
  ArrowRightOnRectangleIcon,
  ArrowLeftOnRectangleIcon,
  UserPlusIcon,
  TruckIcon,
  UserIcon,
  BuildingOfficeIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  CheckCircleIcon,
  XMarkIcon,
  IdentificationIcon,
  KeyIcon,
  ListBulletIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";

interface Vigilante {
  id?: string;
  nome: string;
  usuario: string;
  ativo?: boolean;
}

interface CadastroPessoa {
  id: string;
  nome: string;
  documento: string;
  tipo_pessoa: "funcionario" | "terceiro";
  empresa: string;
  placa: string;
  tipo_veiculo: "proprio" | "empresa" | "sem_veiculo";
}

interface Movimentacao {
  id: string;
  tipo_movimento: "entrada" | "saida";
  tipo_pessoa: "funcionario" | "terceiro";
  nome: string;
  documento: string;
  empresa: string;
  placa: string;
  tipo_veiculo: string;
  data_hora: string;
  vigilante_usuario: string;
  vigilante_nome: string;
  observacao: string;
}

const getNowLocalDatetime = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 16);
};

export default function PortariaPage() {
  // Login state do vigilante
  const [vigilante, setVigilante] = useState<Vigilante | null>(null);
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Abas principais
  const [abaAtiva, setAbaAtiva] = useState<"registro" | "historico" | "cadastros" | "vigilantes">("registro");

  // Passo a passo do Registro
  const [tipoMovimento, setTipoMovimento] = useState<"entrada" | "saida">("entrada");
  const [tipoPessoa, setTipoPessoa] = useState<"funcionario" | "terceiro">("funcionario");
  const [dataHora, setDataHora] = useState<string>(getNowLocalDatetime());
  const [buscaPessoa, setBuscaPessoa] = useState("");
  const [pessoaSelecionada, setPessoaSelecionada] = useState<CadastroPessoa | null>(null);
  const [tipoVeiculo, setTipoVeiculo] = useState<"empresa" | "proprio" | "sem_veiculo">("empresa");
  const [placaMovimento, setPlacaMovimento] = useState("");
  const [empresaMovimento, setEmpresaMovimento] = useState("CYMI");
  const [documentoMovimento, setDocumentoMovimento] = useState("");
  const [observacao, setObservacao] = useState("");
  const [salvandoMovimento, setSalvandoMovimento] = useState(false);

  // Modal/Form de Novo Cadastro Rápido
  const [showModalCadastro, setShowModalCadastro] = useState(false);
  const [cadNome, setCadNome] = useState("");
  const [cadDoc, setCadDoc] = useState("");
  const [cadTipoPessoa, setCadTipoPessoa] = useState<"funcionario" | "terceiro">("funcionario");
  const [cadEmpresa, setCadEmpresa] = useState("");
  const [cadPlaca, setCadPlaca] = useState("");
  const [cadTipoVeiculo, setCadTipoVeiculo] = useState<"empresa" | "proprio" | "sem_veiculo">("empresa");

  // Novo Vigilante state
  const [vigNome, setVigNome] = useState("");
  const [vigUser, setVigUser] = useState("");
  const [vigSenha, setVigSenha] = useState("");

  // Dados carregados
  const [cadastros, setCadastros] = useState<CadastroPessoa[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [vigilantesList, setVigilantesList] = useState<any[]>([]);
  const [frotaPlacas, setFrotaPlacas] = useState<string[]>([]);
  const [filtroHistorico, setFiltroHistorico] = useState("");

  // Restaura sessão do vigilante e carrega dados
  useEffect(() => {
    const saved = localStorage.getItem("cymi_portaria_vigilante");
    if (saved) {
      try {
        setVigilante(JSON.parse(saved));
      } catch {}
    }
    carregarDados();
  }, []);

  // Atualiza data/hora automaticamente ao trocar Entrada/Saída
  const handleTrocarMovimento = (novo: "entrada" | "saida") => {
    setTipoMovimento(novo);
    setDataHora(getNowLocalDatetime());
  };

  const handleTrocarTipoPessoa = (novo: "funcionario" | "terceiro") => {
    setTipoPessoa(novo);
    setPessoaSelecionada(null);
    setBuscaPessoa("");
    if (novo === "funcionario") {
      setEmpresaMovimento("CYMI");
      setTipoVeiculo("empresa");
    } else {
      setEmpresaMovimento("");
      setTipoVeiculo("proprio");
    }
  };

  const carregarDados = async () => {
    try {
      const [resCad, resMov, resFrota, resVig] = await Promise.all([
        supabase.from("portaria_cadastros").select("*").order("nome", { ascending: true }),
        supabase.from("portaria_movimentacoes").select("*").order("data_hora", { ascending: false }).limit(200),
        supabase.from("frota_veiculos").select("placa").eq("arquivado", false),
        supabase.from("portaria_vigilantes").select("id, nome, usuario, ativo").order("nome", { ascending: true }),
      ]);

      if (resCad.data) setCadastros(resCad.data as CadastroPessoa[]);
      if (resMov.data) setMovimentacoes(resMov.data as Movimentacao[]);
      if (resFrota.data) {
        const placas = Array.from(new Set(resFrota.data.map((f: any) => String(f.placa || "").toUpperCase().trim()).filter(Boolean)));
        setFrotaPlacas(placas);
      }
      if (resVig.data) setVigilantesList(resVig.data);
    } catch (e) {
      console.error(e);
    }
  };

  // Login do vigilante
  const handleLoginVigilante = async (e: React.FormEvent) => {
    e.preventDefault();
    const u = loginUser.trim().toLowerCase();
    const p = loginPass.trim();
    if (!u || !p) {
      toast.error("Informe usuário e senha.");
      return;
    }
    setLoginLoading(true);
    try {
      const { data, error } = await supabase
        .from("portaria_vigilantes")
        .select("*")
        .ilike("usuario", u)
        .eq("senha", p)
        .single();

      if (error || !data) {
        // Fallback padrão caso a tabela ainda não tenha o usuário inicial
        if (u === "portaria" && p === "1234") {
          const fallbackVig = { nome: "Vigilante Padrão", usuario: "portaria" };
          setVigilante(fallbackVig);
          localStorage.setItem("cymi_portaria_vigilante", JSON.stringify(fallbackVig));
          toast.success("Acesso liberado!");
          return;
        }
        toast.error("Usuário ou senha inválidos.");
        return;
      }

      if (data.ativo === false) {
        toast.error("Este usuário de vigilante está desativado.");
        return;
      }

      const logged = { id: data.id, nome: data.nome, usuario: data.usuario };
      setVigilante(logged);
      localStorage.setItem("cymi_portaria_vigilante", JSON.stringify(logged));
      setLoginUser("");
      setLoginPass("");
      toast.success(`Bem-vindo, ${data.nome}!`);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogoutVigilante = () => {
    setVigilante(null);
    localStorage.removeItem("cymi_portaria_vigilante");
  };

  // Selecionar pessoa da lista
  const selecionarPessoa = (c: CadastroPessoa) => {
    setPessoaSelecionada(c);
    setBuscaPessoa(c.nome);
    setDocumentoMovimento(c.documento || "");
    setEmpresaMovimento(c.empresa || (c.tipo_pessoa === "funcionario" ? "CYMI" : ""));
    setPlacaMovimento(c.placa || "");
    setTipoVeiculo(c.tipo_veiculo || (c.tipo_pessoa === "funcionario" ? "empresa" : "proprio"));
    setDataHora(getNowLocalDatetime());
  };

  // Abrir modal de cadastro preenchido com o que foi digitado
  const abrirCadastroRapido = () => {
    setCadNome(buscaPessoa);
    setCadTipoPessoa(tipoPessoa);
    setCadEmpresa(tipoPessoa === "funcionario" ? "CYMI" : "");
    setCadTipoVeiculo(tipoPessoa === "funcionario" ? "empresa" : "proprio");
    setCadDoc("");
    setCadPlaca("");
    setShowModalCadastro(true);
  };

  // Salvar novo cadastro (funcionário ou terceiro)
  const handleSalvarCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cadNome.trim()) {
      toast.error("Informe o nome.");
      return;
    }

    const payload = {
      nome: cadNome.trim().toUpperCase(),
      documento: cadDoc.trim().toUpperCase(),
      tipo_pessoa: cadTipoPessoa,
      empresa: (cadEmpresa.trim() || (cadTipoPessoa === "funcionario" ? "CYMI" : "TERCEIRO")).toUpperCase(),
      placa: cadPlaca.trim().toUpperCase(),
      tipo_veiculo: cadTipoVeiculo,
    };

    const { data, error } = await supabase.from("portaria_cadastros").insert(payload).select().single();
    if (error) {
      toast.error("Erro ao cadastrar: " + error.message);
      return;
    }

    toast.success("Cadastro salvo!");
    const novo = data as CadastroPessoa;
    setCadastros((prev) => [novo, ...prev]);
    setTipoPessoa(novo.tipo_pessoa);
    selecionarPessoa(novo);
    setShowModalCadastro(false);
  };

  // Registrar Entrada / Saída
  const handleRegistrarMovimento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vigilante) {
      toast.error("Faça login como vigilante primeiro.");
      return;
    }
    const nomeFinal = (pessoaSelecionada?.nome || buscaPessoa).trim().toUpperCase();
    if (!nomeFinal) {
      toast.error("Selecione ou digite o nome da pessoa.");
      return;
    }

    setSalvandoMovimento(true);
    try {
      const dtIso = dataHora ? new Date(dataHora).toISOString() : new Date().toISOString();
      const payload = {
        tipo_movimento: tipoMovimento,
        tipo_pessoa: tipoPessoa,
        cadastro_id: pessoaSelecionada?.id || null,
        nome: nomeFinal,
        documento: documentoMovimento.trim().toUpperCase(),
        empresa: (empresaMovimento.trim() || (tipoPessoa === "funcionario" ? "CYMI" : "TERCEIRO")).toUpperCase(),
        placa: tipoVeiculo === "sem_veiculo" ? "" : placaMovimento.trim().toUpperCase(),
        tipo_veiculo: tipoVeiculo,
        data_hora: dtIso,
        vigilante_usuario: vigilante.usuario,
        vigilante_nome: vigilante.nome,
        observacao: observacao.trim(),
      };

      const { data, error } = await supabase.from("portaria_movimentacoes").insert(payload).select().single();
      if (error) {
        toast.error("Erro ao registrar: " + error.message);
        return;
      }

      toast.success(`${tipoMovimento === "entrada" ? "ENTRADA" : "SAÍDA"} registrada com sucesso!`);
      if (data) setMovimentacoes((prev) => [data as Movimentacao, ...prev]);

      // Limpa campos para o próximo registro mantendo tipo
      setPessoaSelecionada(null);
      setBuscaPessoa("");
      setDocumentoMovimento("");
      setPlacaMovimento("");
      setObservacao("");
      setDataHora(getNowLocalDatetime());
    } finally {
      setSalvandoMovimento(false);
    }
  };

  // Cadastrar novo vigilante
  const handleCriarVigilante = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vigNome.trim() || !vigUser.trim() || !vigSenha.trim()) {
      toast.error("Preencha nome, usuário e senha.");
      return;
    }
    const { error } = await supabase.from("portaria_vigilantes").insert({
      nome: vigNome.trim(),
      usuario: vigUser.trim().toLowerCase(),
      senha: vigSenha.trim(),
      ativo: true,
    });
    if (error) {
      toast.error("Erro ao criar vigilante: " + error.message);
      return;
    }
    toast.success("Vigilante cadastrado!");
    setVigNome("");
    setVigUser("");
    setVigSenha("");
    carregarDados();
  };

  const handleExcluirCadastro = async (id: string, nome: string) => {
    if (!confirm(`Excluir cadastro de ${nome}?`)) return;
    const { error } = await supabase.from("portaria_cadastros").delete().eq("id", id);
    if (!error) {
      toast.success("Cadastro removido.");
      setCadastros((prev) => prev.filter((c) => c.id !== id));
    }
  };

  // Filtro de cadastros conforme tipoPessoa e busca
  const cadastrosFiltrados = useMemo(() => {
    const q = buscaPessoa.toLowerCase().trim();
    return cadastros
      .filter((c) => c.tipo_pessoa === tipoPessoa)
      .filter(
        (c) =>
          !q ||
          c.nome.toLowerCase().includes(q) ||
          (c.documento || "").toLowerCase().includes(q) ||
          (c.placa || "").toLowerCase().includes(q) ||
          (c.empresa || "").toLowerCase().includes(q)
      );
  }, [cadastros, tipoPessoa, buscaPessoa]);

  const historicoFiltrado = useMemo(() => {
    const q = filtroHistorico.toLowerCase().trim();
    if (!q) return movimentacoes;
    return movimentacoes.filter(
      (m) =>
        m.nome?.toLowerCase().includes(q) ||
        m.placa?.toLowerCase().includes(q) ||
        m.empresa?.toLowerCase().includes(q) ||
        m.documento?.toLowerCase().includes(q) ||
        m.vigilante_nome?.toLowerCase().includes(q)
    );
  }, [movimentacoes, filtroHistorico]);

  // ── TELA DE LOGIN DO VIGILANTE (MOBILE-FIRST) ─────────────────────────────
  if (!vigilante) {
    return (
      <div className="w-full max-w-md mx-auto my-2 px-3 py-4">
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-xl border border-gray-100 dark:border-gray-700">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#0b7336] to-[#298d4a] flex items-center justify-center shadow-lg mb-3">
              <ShieldCheckIcon className="w-9 h-9 text-white" />
            </div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
              Controle de Portaria
            </h1>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">
              Identificação do Vigilante em Turno
            </p>
          </div>

          <form onSubmit={handleLoginVigilante} className="space-y-4">
            <div>
              <label className="text-[11px] font-black text-gray-500 uppercase tracking-wider block mb-1.5">
                Usuário do Vigilante
              </label>
              <div className="relative">
                <UserIcon className="w-5 h-5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="Ex: portaria"
                  value={loginUser}
                  onChange={(e) => setLoginUser(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#0b7336]"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-black text-gray-500 uppercase tracking-wider block mb-1.5">
                Senha
              </label>
              <div className="relative">
                <KeyIcon className="w-5 h-5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  placeholder="••••••"
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#0b7336]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-4 bg-[#0b7336] hover:bg-[#09602c] active:scale-[0.99] text-white font-black rounded-2xl shadow-lg shadow-green-600/20 text-sm uppercase tracking-widest transition-all"
            >
              {loginLoading ? "Verificando..." : "Entrar no Turno"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── TELA PRINCIPAL DA PORTARIA (OTIMIZADA PARA CELULAR SEM CORTES) ─────────
  return (
    <div className="w-full max-w-3xl mx-auto px-1 sm:px-3 pb-12 space-y-4">
      {/* Barra Superior Compacta: Vigilante Logado + Trocar Turno */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-3.5 sm:p-5 shadow-md border border-gray-100 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0b7336] to-[#298d4a] flex items-center justify-center text-white shrink-0 shadow">
            <ShieldCheckIcon className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-black text-gray-900 dark:text-white uppercase leading-tight truncate">
              Portaria CYMI
            </h1>
            <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 truncate">
              Vigilante: {vigilante.nome} (@{vigilante.usuario})
            </p>
          </div>
        </div>

        <button
          onClick={handleLogoutVigilante}
          className="px-3 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-black uppercase tracking-wider hover:bg-red-100 transition-all shrink-0"
        >
          Trocar Vigilante
        </button>
      </div>

      {/* Menu de Navegação Interno (Responsivo em Grid 2x2 no celular ou 4 col) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-gray-200/70 dark:bg-gray-800/80 p-1.5 rounded-2xl">
        {[
          { id: "registro", label: "Registrar", icon: CheckCircleIcon },
          { id: "historico", label: `Registros (${movimentacoes.length})`, icon: ListBulletIcon },
          { id: "cadastros", label: `Cadastros (${cadastros.length})`, icon: IdentificationIcon },
          { id: "vigilantes", label: "Vigilantes", icon: KeyIcon },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = abaAtiva === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setAbaAtiva(tab.id as any)}
              className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                active
                  ? "bg-white dark:bg-gray-900 text-[#0b7336] dark:text-green-400 shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── ABA 1: REGISTRO DE ENTRADA E SAÍDA ── */}
      {abaAtiva === "registro" && (
        <form
          onSubmit={handleRegistrarMovimento}
          className="bg-white dark:bg-gray-800 rounded-3xl p-4 sm:p-6 shadow-xl border border-gray-100 dark:border-gray-700 space-y-5"
        >
          {/* PASSO 1: ENTRADA OU SAÍDA */}
          <div>
            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest block mb-2">
              1. Tipo de Movimento
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleTrocarMovimento("entrada")}
                className={`flex flex-col sm:flex-row items-center justify-center gap-2 py-4 px-3 rounded-2xl border-2 font-black text-sm uppercase tracking-wider transition-all ${
                  tipoMovimento === "entrada"
                    ? "border-emerald-600 bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
                    : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300"
                }`}
              >
                <ArrowRightOnRectangleIcon className="w-6 h-6" />
                <span>Entrada</span>
              </button>

              <button
                type="button"
                onClick={() => handleTrocarMovimento("saida")}
                className={`flex flex-col sm:flex-row items-center justify-center gap-2 py-4 px-3 rounded-2xl border-2 font-black text-sm uppercase tracking-wider transition-all ${
                  tipoMovimento === "saida"
                    ? "border-amber-500 bg-amber-500 text-white shadow-lg shadow-amber-500/20"
                    : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300"
                }`}
              >
                <ArrowLeftOnRectangleIcon className="w-6 h-6" />
                <span>Saída</span>
              </button>
            </div>
          </div>

          {/* PASSO 2: FUNCIONÁRIO OU TERCEIRO */}
          <div>
            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest block mb-2">
              2. Vínculo da Pessoa
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleTrocarTipoPessoa("funcionario")}
                className={`flex items-center justify-center gap-2 py-3.5 px-3 rounded-2xl border-2 font-black text-xs sm:text-sm uppercase tracking-wider transition-all ${
                  tipoPessoa === "funcionario"
                    ? "border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                    : "border-gray-200 dark:border-gray-700 text-gray-500"
                }`}
              >
                <UserIcon className="w-5 h-5 shrink-0" />
                <span>Funcionário</span>
              </button>

              <button
                type="button"
                onClick={() => handleTrocarTipoPessoa("terceiro")}
                className={`flex items-center justify-center gap-2 py-3.5 px-3 rounded-2xl border-2 font-black text-xs sm:text-sm uppercase tracking-wider transition-all ${
                  tipoPessoa === "terceiro"
                    ? "border-purple-600 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                    : "border-gray-200 dark:border-gray-700 text-gray-500"
                }`}
              >
                <BuildingOfficeIcon className="w-5 h-5 shrink-0" />
                <span>Terceiro / Visitante</span>
              </button>
            </div>
          </div>

          {/* PASSO 3: PRÉ DATA E HORA AUTOMÁTICA (EDITÁVEL) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                <ClockIcon className="w-4 h-4 text-[#0b7336]" />
                3. Data e Hora ({tipoMovimento === "entrada" ? "Entrada" : "Saída"})
              </label>
              <button
                type="button"
                onClick={() => setDataHora(getNowLocalDatetime())}
                className="text-[11px] font-black text-[#0b7336] underline"
              >
                Usar Agora
              </button>
            </div>
            <input
              type="datetime-local"
              required
              value={dataHora}
              onChange={(e) => setDataHora(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#0b7336]"
            />
          </div>

          {/* PASSO 4: SELECIONAR DA LISTA OU CADASTRAR NOVO */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">
                4. Pessoa ({tipoPessoa === "funcionario" ? "Funcionário" : "Terceiro"})
              </label>
              <button
                type="button"
                onClick={abrirCadastroRapido}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#0b7336]/10 text-[#0b7336] dark:text-green-400 text-xs font-black uppercase tracking-wider hover:bg-[#0b7336]/20 transition-all"
              >
                <UserPlusIcon className="w-4 h-4" />
                + Cadastrar Novo
              </button>
            </div>

            <div className="relative">
              <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                placeholder="Buscar por nome, CPF/RG ou placa..."
                value={buscaPessoa}
                onChange={(e) => {
                  setBuscaPessoa(e.target.value);
                  if (pessoaSelecionada && e.target.value !== pessoaSelecionada.nome) {
                    setPessoaSelecionada(null);
                  }
                }}
                className="w-full pl-11 pr-9 py-3.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#0b7336]"
              />
              {buscaPessoa && (
                <button
                  type="button"
                  onClick={() => {
                    setBuscaPessoa("");
                    setPessoaSelecionada(null);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Lista de sugestões rápida para toque em celular */}
            {!pessoaSelecionada && (
              <div className="max-h-44 overflow-y-auto rounded-2xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 bg-gray-50/60 dark:bg-gray-900/50">
                {cadastrosFiltrados.length === 0 ? (
                  <div className="p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <span className="text-xs font-bold text-gray-500">
                      Nenhum cadastro encontrado na lista.
                    </span>
                    <button
                      type="button"
                      onClick={abrirCadastroRapido}
                      className="w-full sm:w-auto px-3 py-2 bg-[#0b7336] text-white rounded-xl text-xs font-black uppercase tracking-wider text-center"
                    >
                      Cadastrar &quot;{buscaPessoa || "Novo"}&quot;
                    </button>
                  </div>
                ) : (
                  cadastrosFiltrados.slice(0, 15).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selecionarPessoa(c)}
                      className="w-full text-left px-3.5 py-2.5 hover:bg-green-50 dark:hover:bg-gray-800 flex items-center justify-between gap-2 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-black text-gray-900 dark:text-white truncate">
                          {c.nome}
                        </p>
                        <p className="text-[10px] font-bold text-gray-500 truncate">
                          {c.documento ? `Doc: ${c.documento}` : "Sem doc"} • {c.empresa || "CYMI"}
                        </p>
                      </div>
                      {c.placa && (
                        <span className="px-2 py-1 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-black text-[10px] shrink-0">
                          {c.placa}
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Dados complementares (CPF/RG e Empresa) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">
                  CPF ou RG
                </label>
                <input
                  type="text"
                  placeholder="CPF ou RG"
                  value={documentoMovimento}
                  onChange={(e) => setDocumentoMovimento(e.target.value)}
                  className="w-full px-3.5 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#0b7336]"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">
                  Empresa
                </label>
                <input
                  type="text"
                  placeholder="Nome da empresa"
                  value={empresaMovimento}
                  onChange={(e) => setEmpresaMovimento(e.target.value)}
                  className="w-full px-3.5 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#0b7336]"
                />
              </div>
            </div>
          </div>

          {/* PASSO 5: VEÍCULO (DA EMPRESA, PRÓPRIO OU A PÉ) */}
          <div className="space-y-3">
            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest block">
              5. Veículo
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "empresa", label: "Da Empresa" },
                { id: "proprio", label: "Próprio / Terc." },
                { id: "sem_veiculo", label: "Sem Veículo" },
              ].map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setTipoVeiculo(v.id as any)}
                  className={`py-3 px-2 rounded-xl border-2 text-[11px] sm:text-xs font-black uppercase tracking-wider transition-all ${
                    tipoVeiculo === v.id
                      ? "border-[#0b7336] bg-green-50 dark:bg-green-900/20 text-[#0b7336] dark:text-green-400"
                      : "border-gray-200 dark:border-gray-700 text-gray-500"
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>

            {tipoVeiculo !== "sem_veiculo" && (
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">
                  Placa do Veículo
                </label>
                <div className="relative">
                  <TruckIcon className="w-5 h-5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    list="lista-placas-frota"
                    placeholder="ABC1D23"
                    value={placaMovimento}
                    onChange={(e) => setPlacaMovimento(e.target.value.toUpperCase())}
                    className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-black uppercase text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#0b7336]"
                  />
                  <datalist id="lista-placas-frota">
                    {frotaPlacas.map((p) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                </div>
              </div>
            )}
          </div>

          {/* OBSERVAÇÃO OPCIONAL */}
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">
              Observação / Destino (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ex: Entrega de material, visita técnica..."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              className="w-full px-3.5 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#0b7336]"
            />
          </div>

          <button
            type="submit"
            disabled={salvandoMovimento}
            className={`w-full py-4 rounded-2xl font-black text-white text-sm sm:text-base uppercase tracking-widest shadow-xl transition-all active:scale-[0.99] ${
              tipoMovimento === "entrada"
                ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/25"
                : "bg-amber-500 hover:bg-amber-600 shadow-amber-500/25"
            }`}
          >
            {salvandoMovimento
              ? "Registrando..."
              : `Confirmar ${tipoMovimento === "entrada" ? "Entrada" : "Saída"}`}
          </button>
        </form>
      )}

      {/* ── ABA 2: HISTÓRICO DE MOVIMENTAÇÕES ── */}
      {abaAtiva === "historico" && (
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-4 sm:p-6 shadow-xl border border-gray-100 dark:border-gray-700 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-base font-black text-gray-900 dark:text-white uppercase">
              Últimos Registros da Portaria
            </h2>
            <div className="relative w-full sm:w-64">
              <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filtrar nome, placa, empresa..."
                value={filtroHistorico}
                onChange={(e) => setFiltroHistorico(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white outline-none"
              />
            </div>
          </div>

          <div className="space-y-2.5">
            {historicoFiltrado.length === 0 ? (
              <p className="text-center text-xs text-gray-400 py-8 font-bold uppercase">
                Nenhuma movimentação registrada.
              </p>
            ) : (
              historicoFiltrado.map((m) => {
                const isEntrada = m.tipo_movimento === "entrada";
                return (
                  <div
                    key={m.id}
                    className="p-3.5 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                            isEntrada
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                          }`}
                        >
                          {isEntrada ? "ENTRADA" : "SAÍDA"}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                          {m.tipo_pessoa === "funcionario" ? "Funcionário" : "Terceiro"}
                        </span>
                        {m.placa && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white">
                            🚗 {m.placa} ({m.tipo_veiculo === "empresa" ? "Frota" : "Próprio"})
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-black text-gray-900 dark:text-white break-words">
                        {m.nome}
                      </p>
                      <p className="text-[11px] font-semibold text-gray-500 break-words">
                        Empresa: {m.empresa || "---"} {m.documento ? `• Doc: ${m.documento}` : ""}
                        {m.observacao ? ` • Obs: ${m.observacao}` : ""}
                      </p>
                    </div>

                    <div className="text-left sm:text-right shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-200/60 dark:border-gray-700">
                      <p className="text-xs font-black text-gray-800 dark:text-gray-200">
                        {new Date(m.data_hora).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">
                        Vig.: {m.vigilante_nome || m.vigilante_usuario}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ── ABA 3: PESSOAS CADASTRADAS ── */}
      {abaAtiva === "cadastros" && (
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-4 sm:p-6 shadow-xl border border-gray-100 dark:border-gray-700 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-black text-gray-900 dark:text-white uppercase">
              Pessoas & Veículos Cadastrados
            </h2>
            <button
              type="button"
              onClick={abrirCadastroRapido}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#0b7336] text-white rounded-xl text-xs font-black uppercase tracking-wider"
            >
              <PlusIcon className="w-4 h-4" /> Novo Cadastro
            </button>
          </div>

          <div className="space-y-2">
            {cadastros.length === 0 ? (
              <p className="text-center text-xs text-gray-400 py-8 font-bold uppercase">
                Nenhum cadastro registrado.
              </p>
            ) : (
              cadastros.map((c) => (
                <div
                  key={c.id}
                  className="p-3.5 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/50 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                      <span className="text-xs font-black text-gray-900 dark:text-white">
                        {c.nome}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-[9px] font-black uppercase text-gray-700 dark:text-gray-300">
                        {c.tipo_pessoa === "funcionario" ? "Funcionário" : "Terceiro"}
                      </span>
                      {c.placa && (
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase">
                          {c.placa}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-bold text-gray-500 truncate">
                      {c.empresa || "CYMI"} • CPF/RG: {c.documento || "Não inf."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleExcluirCadastro(c.id, c.nome)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-xl shrink-0"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── ABA 4: GERENCIAR VIGILANTES (USUÁRIO E SENHA BÁSICO) ── */}
      {abaAtiva === "vigilantes" && (
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-4 sm:p-6 shadow-xl border border-gray-100 dark:border-gray-700 space-y-5">
          <h2 className="text-base font-black text-gray-900 dark:text-white uppercase">
            Cadastrar Login de Vigilante
          </h2>
          <form onSubmit={handleCriarVigilante} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              required
              placeholder="Nome do Vigilante"
              value={vigNome}
              onChange={(e) => setVigNome(e.target.value)}
              className="px-3.5 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-900 dark:text-white outline-none"
            />
            <input
              type="text"
              required
              placeholder="Usuário (login)"
              value={vigUser}
              onChange={(e) => setVigUser(e.target.value)}
              className="px-3.5 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-900 dark:text-white outline-none"
            />
            <div className="flex gap-2">
              <input
                type="password"
                required
                placeholder="Senha"
                value={vigSenha}
                onChange={(e) => setVigSenha(e.target.value)}
                className="flex-1 min-w-0 px-3.5 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-900 dark:text-white outline-none"
              />
              <button
                type="submit"
                className="px-4 py-3 bg-[#0b7336] text-white rounded-xl text-xs font-black uppercase tracking-wider shrink-0"
              >
                Salvar
              </button>
            </div>
          </form>

          <div className="space-y-2 pt-2">
            {vigilantesList.map((v) => (
              <div
                key={v.id}
                className="p-3 rounded-xl border border-gray-100 dark:border-gray-700 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-black text-gray-900 dark:text-white">{v.nome}</p>
                  <p className="text-xs font-bold text-gray-400">Usuário: {v.usuario}</p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-700">
                  Ativo
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── MODAL DE CADASTRO RÁPIDO (NOME, CPF/RG, EMPRESA, PLACA) ── */}
      {showModalCadastro && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4 my-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase">
                Novo Cadastro Portaria
              </h3>
              <button
                type="button"
                onClick={() => setShowModalCadastro(false)}
                className="p-1.5 rounded-xl text-gray-400 hover:bg-gray-100"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSalvarCadastro} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCadTipoPessoa("funcionario");
                    if (!cadEmpresa) setCadEmpresa("CYMI");
                  }}
                  className={`py-2.5 rounded-xl text-xs font-black uppercase border-2 ${
                    cadTipoPessoa === "funcionario"
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-gray-200 text-gray-500"
                  }`}
                >
                  Funcionário
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCadTipoPessoa("terceiro");
                    if (cadEmpresa === "CYMI") setCadEmpresa("");
                  }}
                  className={`py-2.5 rounded-xl text-xs font-black uppercase border-2 ${
                    cadTipoPessoa === "terceiro"
                      ? "border-purple-600 bg-purple-50 text-purple-700"
                      : "border-gray-200 text-gray-500"
                  }`}
                >
                  Terceiro
                </button>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  value={cadNome}
                  onChange={(e) => setCadNome(e.target.value)}
                  placeholder="Nome completo"
                  className="w-full px-3.5 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-900 dark:text-white outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">
                  CPF ou RG *
                </label>
                <input
                  type="text"
                  required
                  value={cadDoc}
                  onChange={(e) => setCadDoc(e.target.value)}
                  placeholder="Digite o CPF ou RG"
                  className="w-full px-3.5 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-900 dark:text-white outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">
                  Empresa *
                </label>
                <input
                  type="text"
                  required
                  value={cadEmpresa}
                  onChange={(e) => setCadEmpresa(e.target.value)}
                  placeholder="Ex: CYMI ou empresa terceira"
                  className="w-full px-3.5 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-900 dark:text-white outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">
                    Placa (Opcional)
                  </label>
                  <input
                    type="text"
                    value={cadPlaca}
                    onChange={(e) => setCadPlaca(e.target.value.toUpperCase())}
                    placeholder="ABC1D23"
                    className="w-full px-3.5 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-black uppercase text-gray-900 dark:text-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">
                    Tipo Veículo
                  </label>
                  <select
                    value={cadTipoVeiculo}
                    onChange={(e) => setCadTipoVeiculo(e.target.value as any)}
                    className="w-full px-3 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-900 dark:text-white outline-none"
                  >
                    <option value="empresa">Da Empresa</option>
                    <option value="proprio">Próprio</option>
                    <option value="sem_veiculo">Sem Veículo</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModalCadastro(false)}
                  className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-bold text-xs uppercase"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-[#0b7336] text-white font-black text-xs uppercase shadow-lg shadow-green-600/20"
                >
                  Salvar Cadastro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
