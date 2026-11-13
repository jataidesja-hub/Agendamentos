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

interface CadastroItem {
  id: string;
  nome: string;
  documento: string;
  tipo_pessoa: "funcionario" | "terceiro" | "veiculo";
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
  const [abaAtiva, setAbaAtiva] = useState<"registro" | "historico" | "cadastros">("registro");

  // Sub-aba dentro de Cadastros
  const [subAbaCadastro, setSubAbaCadastro] = useState<"funcionario" | "terceiro" | "veiculo">("funcionario");

  // ── ESTADOS DO REGISTRO POR ETAPAS (PASSO A PASSO) ─────────────────────────
  const [tipoMovimento, setTipoMovimento] = useState<"entrada" | "saida" | null>("entrada");
  const [dataHora, setDataHora] = useState<string>(getNowLocalDatetime());
  const [tipoPessoa, setTipoPessoa] = useState<"funcionario" | "terceiro" | null>(null);
  const [buscaPessoa, setBuscaPessoa] = useState("");
  const [pessoaSelecionada, setPessoaSelecionada] = useState<CadastroItem | null>(null);

  const [tipoVeiculo, setTipoVeiculo] = useState<"empresa" | "proprio" | "sem_veiculo" | null>(null);
  const [buscaPlaca, setBuscaPlaca] = useState("");
  const [placaSelecionada, setPlacaSelecionada] = useState("");

  const [observacao, setObservacao] = useState("");
  const [salvandoMovimento, setSalvandoMovimento] = useState(false);

  // ── ESTADOS DE CADASTRO (ABA CADASTROS E MODAL RÁPIDO) ─────────────────────
  const [showModalCadastro, setShowModalCadastro] = useState(false);
  const [modalTipoCadastro, setModalTipoCadastro] = useState<"funcionario" | "terceiro" | "veiculo">("funcionario");
  const [cadNome, setCadNome] = useState("");
  const [cadDoc, setCadDoc] = useState("");
  const [cadEmpresa, setCadEmpresa] = useState("CYMI");
  const [cadPlaca, setCadPlaca] = useState("");
  const [cadTipoVeiculo, setCadTipoVeiculo] = useState<"empresa" | "proprio">("empresa");

  // Dados do banco
  const [cadastros, setCadastros] = useState<CadastroItem[]>([]);
  const [frotaVeiculos, setFrotaVeiculos] = useState<{ placa: string; modelo: string; projeto: string }[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [filtroHistorico, setFiltroHistorico] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("cymi_portaria_vigilante");
    if (saved) {
      try {
        setVigilante(JSON.parse(saved));
      } catch {}
    }
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      const [resCad, resMov, resFrota] = await Promise.all([
        supabase.from("portaria_cadastros").select("*").order("nome", { ascending: true }),
        supabase.from("portaria_movimentacoes").select("*").order("data_hora", { ascending: false }).limit(200),
        supabase.from("frota_veiculos").select("placa, modelo, projeto").eq("arquivado", false),
      ]);

      if (resCad.data) setCadastros(resCad.data as CadastroItem[]);
      if (resMov.data) setMovimentacoes(resMov.data as Movimentacao[]);
      if (resFrota.data) {
        const map = new Map<string, { placa: string; modelo: string; projeto: string }>();
        resFrota.data.forEach((f: any) => {
          const p = String(f.placa || "").toUpperCase().trim();
          if (p) map.set(p, { placa: p, modelo: f.modelo || "", projeto: f.projeto || "" });
        });
        setFrotaVeiculos(Array.from(map.values()));
      }
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

  // ── HANDLERS DO PASSO A PASSO ─────────────────────────────────────────────
  const handleEscolherMovimento = (novo: "entrada" | "saida") => {
    setTipoMovimento(novo);
    setDataHora(getNowLocalDatetime());
  };

  const handleEscolherTipoPessoa = (novo: "funcionario" | "terceiro") => {
    setTipoPessoa(novo);
    setPessoaSelecionada(null);
    setBuscaPessoa("");
    setTipoVeiculo(null);
    setPlacaSelecionada("");
    setBuscaPlaca("");
    setDataHora(getNowLocalDatetime());
  };

  const handleSelecionarPessoaDaLista = (item: CadastroItem) => {
    setPessoaSelecionada(item);
    setDataHora(getNowLocalDatetime());
    // Se a pessoa já tiver placa vinculada no cadastro, pré-seleciona o tipo de veículo e a placa
    if (item.placa) {
      setTipoVeiculo(item.tipo_veiculo === "proprio" ? "proprio" : "empresa");
      setPlacaSelecionada(item.placa);
    } else {
      setTipoVeiculo(null);
      setPlacaSelecionada("");
    }
  };

  const handleEscolherTipoVeiculo = (novo: "empresa" | "proprio" | "sem_veiculo") => {
    setTipoVeiculo(novo);
    setBuscaPlaca("");
    if (novo === "sem_veiculo") {
      setPlacaSelecionada("");
    } else if (pessoaSelecionada?.placa && pessoaSelecionada.tipo_veiculo === novo) {
      setPlacaSelecionada(pessoaSelecionada.placa);
    } else {
      setPlacaSelecionada("");
    }
  };

  // Listas filtradas de acordo com os passos
  const listaPessoasPorTipo = useMemo(() => {
    if (!tipoPessoa) return [];
    const q = buscaPessoa.toLowerCase().trim();
    return cadastros
      .filter((c) => c.tipo_pessoa === tipoPessoa)
      .filter(
        (c) =>
          !q ||
          c.nome.toLowerCase().includes(q) ||
          (c.documento || "").toLowerCase().includes(q) ||
          (c.empresa || "").toLowerCase().includes(q) ||
          (c.placa || "").toLowerCase().includes(q)
      );
  }, [cadastros, tipoPessoa, buscaPessoa]);

  // Lista de veículos conforme a escolha: "empresa" ou "proprio"
  const listaVeiculosDisponiveis = useMemo(() => {
    if (!tipoVeiculo || tipoVeiculo === "sem_veiculo") return [];
    const q = buscaPlaca.toLowerCase().trim();
    const mapPlacas = new Map<string, { placa: string; descricao: string; origem: string }>();

    if (tipoVeiculo === "empresa") {
      // 1. Placas cadastradas na aba Cadastros > Veículos como 'empresa'
      cadastros
        .filter((c) => c.placa && (c.tipo_veiculo === "empresa" || c.tipo_pessoa === "funcionario"))
        .forEach((c) => {
          const p = c.placa.toUpperCase().trim();
          mapPlacas.set(p, {
            placa: p,
            descricao: c.tipo_pessoa === "veiculo" ? c.nome : `Vinc.: ${c.nome}`,
            origem: c.empresa || "CYMI",
          });
        });
      // 2. Placas da tabela frota_veiculos
      frotaVeiculos.forEach((f) => {
        if (!mapPlacas.has(f.placa)) {
          mapPlacas.set(f.placa, {
            placa: f.placa,
            descricao: f.modelo || "Frota CYMI",
            origem: f.projeto || "CYMI",
          });
        }
      });
    } else if (tipoVeiculo === "proprio") {
      // Placas cadastradas como carro próprio ou de terceiros
      cadastros
        .filter((c) => c.placa && (c.tipo_veiculo === "proprio" || c.tipo_pessoa === "terceiro"))
        .forEach((c) => {
          const p = c.placa.toUpperCase().trim();
          mapPlacas.set(p, {
            placa: p,
            descricao: c.tipo_pessoa === "veiculo" ? c.nome : `De: ${c.nome}`,
            origem: c.empresa || "Particular / Terceiro",
          });
        });
    }

    return Array.from(mapPlacas.values()).filter(
      (v) =>
        !q ||
        v.placa.toLowerCase().includes(q) ||
        v.descricao.toLowerCase().includes(q) ||
        v.origem.toLowerCase().includes(q)
    );
  }, [tipoVeiculo, cadastros, frotaVeiculos, buscaPlaca]);

  // Abrir modal de cadastro já posicionado no tipo certo
  const abrirModalNovo = (tipo: "funcionario" | "terceiro" | "veiculo", prefill = "") => {
    setModalTipoCadastro(tipo);
    if (tipo === "veiculo") {
      setCadPlaca(prefill.toUpperCase());
      setCadNome("");
      setCadDoc("");
      setCadTipoVeiculo(tipoVeiculo === "proprio" ? "proprio" : "empresa");
      setCadEmpresa(tipoVeiculo === "proprio" ? "PARTICULAR" : "CYMI");
    } else {
      setCadNome(prefill);
      setCadDoc("");
      setCadPlaca("");
      setCadEmpresa(tipo === "funcionario" ? "CYMI" : "");
      setCadTipoVeiculo(tipo === "funcionario" ? "empresa" : "proprio");
    }
    setShowModalCadastro(true);
  };

  // Salvar cadastro (Funcionário, Terceiro ou Placa/Veículo)
  const handleSalvarCadastro = async (e: React.FormEvent) => {
    e.preventDefault();

    if (modalTipoCadastro === "veiculo" && !cadPlaca.trim()) {
      toast.error("Informe a placa do veículo.");
      return;
    }
    if (modalTipoCadastro !== "veiculo" && !cadNome.trim()) {
      toast.error("Informe o nome.");
      return;
    }

    const payload = {
      nome:
        modalTipoCadastro === "veiculo"
          ? (cadNome.trim() || `VEÍCULO ${cadPlaca.trim()}`).toUpperCase()
          : cadNome.trim().toUpperCase(),
      documento: cadDoc.trim().toUpperCase(),
      tipo_pessoa: modalTipoCadastro,
      empresa: (
        cadEmpresa.trim() ||
        (modalTipoCadastro === "funcionario" ? "CYMI" : modalTipoCadastro === "veiculo" ? "FROTA" : "TERCEIRO")
      ).toUpperCase(),
      placa: cadPlaca.trim().toUpperCase(),
      tipo_veiculo: cadTipoVeiculo,
    };

    const { data, error } = await supabase.from("portaria_cadastros").insert(payload).select().single();
    if (error) {
      toast.error("Erro ao salvar cadastro: " + error.message);
      return;
    }

    toast.success("Cadastrado com sucesso!");
    const novo = data as CadastroItem;
    setCadastros((prev) => [novo, ...prev]);

    // Se estava registrando na aba principal, já seleciona automaticamente
    if (abaAtiva === "registro") {
      if (modalTipoCadastro === "veiculo") {
        setTipoVeiculo(novo.tipo_veiculo as "empresa" | "proprio");
        setPlacaSelecionada(novo.placa);
      } else {
        setTipoPessoa(modalTipoCadastro);
        handleSelecionarPessoaDaLista(novo);
      }
    }

    setCadNome("");
    setCadDoc("");
    setCadPlaca("");
    setShowModalCadastro(false);
  };

  const handleExcluirCadastro = async (id: string, nome: string) => {
    if (!confirm(`Excluir cadastro "${nome}"?`)) return;
    const { error } = await supabase.from("portaria_cadastros").delete().eq("id", id);
    if (!error) {
      toast.success("Cadastro excluído.");
      setCadastros((prev) => prev.filter((c) => c.id !== id));
    }
  };

  // Confirmar e gravar Entrada ou Saída
  const handleRegistrarMovimento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vigilante) {
      toast.error("Faça login como vigilante.");
      return;
    }
    if (!tipoMovimento || !tipoPessoa || !pessoaSelecionada) {
      toast.error("Selecione a pessoa na lista.");
      return;
    }
    if (!tipoVeiculo) {
      toast.error("Selecione a opção de veículo.");
      return;
    }
    if (tipoVeiculo !== "sem_veiculo" && !placaSelecionada.trim()) {
      toast.error("Selecione uma placa da lista ou cadastre uma nova.");
      return;
    }

    setSalvandoMovimento(true);
    try {
      const dtIso = dataHora ? new Date(dataHora).toISOString() : new Date().toISOString();
      const payload = {
        tipo_movimento: tipoMovimento,
        tipo_pessoa: tipoPessoa,
        cadastro_id: pessoaSelecionada.id,
        nome: pessoaSelecionada.nome,
        documento: pessoaSelecionada.documento || "",
        empresa: pessoaSelecionada.empresa || (tipoPessoa === "funcionario" ? "CYMI" : "TERCEIRO"),
        placa: tipoVeiculo === "sem_veiculo" ? "" : placaSelecionada.trim().toUpperCase(),
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

      toast.success(`${tipoMovimento === "entrada" ? "ENTRADA" : "SAÍDA"} registrada!`);
      if (data) setMovimentacoes((prev) => [data as Movimentacao, ...prev]);

      // Reseta para próximo registro
      setPessoaSelecionada(null);
      setBuscaPessoa("");
      setTipoVeiculo(null);
      setPlacaSelecionada("");
      setBuscaPlaca("");
      setObservacao("");
      setDataHora(getNowLocalDatetime());
    } finally {
      setSalvandoMovimento(false);
    }
  };

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

  const contadoresCadastro = useMemo(() => {
    return {
      funcionario: cadastros.filter((c) => c.tipo_pessoa === "funcionario").length,
      terceiro: cadastros.filter((c) => c.tipo_pessoa === "terceiro").length,
      veiculo: cadastros.filter((c) => c.tipo_pessoa === "veiculo" || Boolean(c.placa)).length,
    };
  }, [cadastros]);

  // ── TELA DE LOGIN DO VIGILANTE ─────────────────────────────────────────────
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

  return (
    <div className="w-full max-w-3xl mx-auto px-1 sm:px-3 pb-12 space-y-4">
      {/* Cabeçalho Compacto */}
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

      {/* Abas Principais */}
      <div className="grid grid-cols-3 gap-2 bg-gray-200/70 dark:bg-gray-800/80 p-1.5 rounded-2xl">
        {[
          { id: "registro", label: "Registrar", icon: CheckCircleIcon },
          { id: "historico", label: `Registros (${movimentacoes.length})`, icon: ListBulletIcon },
          { id: "cadastros", label: `Cadastros (${cadastros.length})`, icon: IdentificationIcon },
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

      {/* ══════════════════════════════════════════════════════════════════════
          ABA 1: REGISTRAR ENTRADA / SAÍDA (EM PARTES / ETAPAS)
         ══════════════════════════════════════════════════════════════════════ */}
      {abaAtiva === "registro" && (
        <form
          onSubmit={handleRegistrarMovimento}
          className="bg-white dark:bg-gray-800 rounded-3xl p-4 sm:p-6 shadow-xl border border-gray-100 dark:border-gray-700 space-y-5"
        >
          {/* ETAPA 1: ENTRADA OU SAÍDA + DATA/HORA */}
          <div className="space-y-3">
            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest block">
              Etapa 1 • Movimento e Horário
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleEscolherMovimento("entrada")}
                className={`flex items-center justify-center gap-2 py-4 px-3 rounded-2xl border-2 font-black text-sm uppercase tracking-wider transition-all ${
                  tipoMovimento === "entrada"
                    ? "border-emerald-600 bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
                    : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300"
                }`}
              >
                <ArrowRightOnRectangleIcon className="w-6 h-6 shrink-0" />
                <span>Entrada</span>
              </button>

              <button
                type="button"
                onClick={() => handleEscolherMovimento("saida")}
                className={`flex items-center justify-center gap-2 py-4 px-3 rounded-2xl border-2 font-black text-sm uppercase tracking-wider transition-all ${
                  tipoMovimento === "saida"
                    ? "border-amber-500 bg-amber-500 text-white shadow-lg shadow-amber-500/20"
                    : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300"
                }`}
              >
                <ArrowLeftOnRectangleIcon className="w-6 h-6 shrink-0" />
                <span>Saída</span>
              </button>
            </div>

            <div className="pt-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                  <ClockIcon className="w-3.5 h-3.5 text-[#0b7336]" />
                  Data e Hora Pré-definida ({tipoMovimento === "entrada" ? "Entrada" : "Saída"})
                </span>
                <button
                  type="button"
                  onClick={() => setDataHora(getNowLocalDatetime())}
                  className="text-[10px] font-black text-[#0b7336] underline"
                >
                  Atualizar Agora
                </button>
              </div>
              <input
                type="datetime-local"
                required
                value={dataHora}
                onChange={(e) => setDataHora(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-900 dark:text-white outline-none"
              />
            </div>
          </div>

          {/* ETAPA 2: ESCOLHER SE É FUNCIONÁRIO OU TERCEIRO */}
          <div className="space-y-3 border-t border-gray-100 dark:border-gray-700 pt-4">
            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest block">
              Etapa 2 • Quem está passando?
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleEscolherTipoPessoa("funcionario")}
                className={`flex items-center justify-center gap-2 py-4 px-3 rounded-2xl border-2 font-black text-xs sm:text-sm uppercase tracking-wider transition-all ${
                  tipoPessoa === "funcionario"
                    ? "border-blue-600 bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                    : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300"
                }`}
              >
                <UserIcon className="w-5 h-5 shrink-0" />
                <span>Funcionário</span>
              </button>

              <button
                type="button"
                onClick={() => handleEscolherTipoPessoa("terceiro")}
                className={`flex items-center justify-center gap-2 py-4 px-3 rounded-2xl border-2 font-black text-xs sm:text-sm uppercase tracking-wider transition-all ${
                  tipoPessoa === "terceiro"
                    ? "border-purple-600 bg-purple-600 text-white shadow-lg shadow-purple-600/20"
                    : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300"
                }`}
              >
                <BuildingOfficeIcon className="w-5 h-5 shrink-0" />
                <span>Terceiro</span>
              </button>
            </div>
          </div>

          {/* ETAPA 3: APARECE IMEDIATAMENTE A LISTA DE FUNCIONÁRIOS OU DE TERCEIROS */}
          {tipoPessoa && (
            <div className="space-y-3 border-t border-gray-100 dark:border-gray-700 pt-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between gap-2">
                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">
                  Etapa 3 • Selecione na Lista de {tipoPessoa === "funcionario" ? "Funcionários" : "Terceiros"}
                </label>
                <button
                  type="button"
                  onClick={() => abrirModalNovo(tipoPessoa, buscaPessoa)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#0b7336] text-white text-[11px] font-black uppercase tracking-wider shadow-sm"
                >
                  <UserPlusIcon className="w-4 h-4" />
                  + Cadastrar {tipoPessoa === "funcionario" ? "Funcionário" : "Terceiro"}
                </button>
              </div>

              {/* Pessoa já selecionada */}
              {pessoaSelecionada ? (
                <div className="p-3.5 rounded-2xl border-2 border-[#0b7336] bg-green-50/60 dark:bg-green-900/20 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase text-[#0b7336] dark:text-green-400">
                      Selecionado:
                    </p>
                    <p className="text-sm sm:text-base font-black text-gray-900 dark:text-white truncate">
                      {pessoaSelecionada.nome}
                    </p>
                    <p className="text-xs font-bold text-gray-500 truncate">
                      CPF/RG: {pessoaSelecionada.documento || "Não inf."} • Empresa: {pessoaSelecionada.empresa || "CYMI"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPessoaSelecionada(null);
                      setTipoVeiculo(null);
                      setPlacaSelecionada("");
                    }}
                    className="px-3 py-1.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-black text-gray-600 dark:text-gray-300 shrink-0"
                  >
                    Trocar
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder={`Filtrar ${tipoPessoa === "funcionario" ? "funcionário" : "terceiro"} por nome, CPF/RG ou empresa...`}
                      value={buscaPessoa}
                      onChange={(e) => setBuscaPessoa(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#0b7336]"
                    />
                  </div>

                  <div className="max-h-56 overflow-y-auto rounded-2xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 bg-gray-50/60 dark:bg-gray-900/50">
                    {listaPessoasPorTipo.length === 0 ? (
                      <div className="p-4 text-center space-y-2">
                        <p className="text-xs font-bold text-gray-500">
                          Nenhum {tipoPessoa === "funcionario" ? "funcionário" : "terceiro"} encontrado.
                        </p>
                        <button
                          type="button"
                          onClick={() => abrirModalNovo(tipoPessoa, buscaPessoa)}
                          className="px-4 py-2.5 bg-[#0b7336] text-white rounded-xl text-xs font-black uppercase tracking-wider"
                        >
                          + Cadastrar Agora
                        </button>
                      </div>
                    ) : (
                      listaPessoasPorTipo.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelecionarPessoaDaLista(item)}
                          className="w-full text-left px-4 py-3 hover:bg-green-50 dark:hover:bg-gray-800 flex items-center justify-between gap-2 transition-colors"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-black text-gray-900 dark:text-white truncate">
                              {item.nome}
                            </p>
                            <p className="text-[11px] font-bold text-gray-500 truncate">
                              CPF/RG: {item.documento || "---"} • Empresa: {item.empresa || "CYMI"}
                            </p>
                          </div>
                          {item.placa && (
                            <span className="px-2.5 py-1 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-black text-xs shrink-0">
                              🚗 {item.placa}
                            </span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ETAPA 4: ESCOLHE SE É CARRO DA EMPRESA, CARRO PRÓPRIO OU SEM VEÍCULO */}
          {pessoaSelecionada && (
            <div className="space-y-3 border-t border-gray-100 dark:border-gray-700 pt-4 animate-in fade-in duration-200">
              <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest block">
                Etapa 4 • Tipo de Veículo
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "empresa", label: "Carro da Empresa" },
                  { id: "proprio", label: "Carro Próprio" },
                  { id: "sem_veiculo", label: "Sem Veículo (A pé)" },
                ].map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => handleEscolherTipoVeiculo(v.id as any)}
                    className={`py-3.5 px-2 rounded-2xl border-2 text-[11px] sm:text-xs font-black uppercase tracking-wider transition-all ${
                      tipoVeiculo === v.id
                        ? "border-[#0b7336] bg-[#0b7336] text-white shadow-md"
                        : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300"
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>

              {/* LISTA DE PLACAS DE ACORDO COM O TIPO DE VEÍCULO ESCOLHIDO */}
              {tipoVeiculo && tipoVeiculo !== "sem_veiculo" && (
                <div className="space-y-2.5 pt-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">
                      Selecione a Placa ({tipoVeiculo === "empresa" ? "Veículos da Empresa" : "Veículos Próprios / Terceiros"})
                    </label>
                    <button
                      type="button"
                      onClick={() => abrirModalNovo("veiculo", buscaPlaca)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#0b7336] text-white text-[11px] font-black uppercase tracking-wider"
                    >
                      <PlusIcon className="w-3.5 h-3.5" />
                      + Cadastrar Placa
                    </button>
                  </div>

                  {placaSelecionada ? (
                    <div className="p-3.5 rounded-2xl border-2 border-[#0b7336] bg-green-50/60 dark:bg-green-900/20 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <TruckIcon className="w-6 h-6 text-[#0b7336]" />
                        <div>
                          <p className="text-[10px] font-black uppercase text-[#0b7336]">Placa Selecionada</p>
                          <p className="text-base font-black text-gray-900 dark:text-white">{placaSelecionada}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPlacaSelecionada("")}
                        className="px-3 py-1.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-black text-gray-600 dark:text-gray-300"
                      >
                        Trocar Placa
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Buscar placa na lista..."
                          value={buscaPlaca}
                          onChange={(e) => setBuscaPlaca(e.target.value.toUpperCase())}
                          className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm font-black uppercase text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#0b7336]"
                        />
                      </div>

                      <div className="max-h-48 overflow-y-auto rounded-2xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 bg-gray-50/60 dark:bg-gray-900/50">
                        {listaVeiculosDisponiveis.length === 0 ? (
                          <div className="p-4 text-center space-y-2">
                            <p className="text-xs font-bold text-gray-500">
                              Nenhuma placa cadastrada para esta categoria.
                            </p>
                            <button
                              type="button"
                              onClick={() => abrirModalNovo("veiculo", buscaPlaca)}
                              className="px-4 py-2 bg-[#0b7336] text-white rounded-xl text-xs font-black uppercase tracking-wider"
                            >
                              + Cadastrar Placa {buscaPlaca}
                            </button>
                          </div>
                        ) : (
                          listaVeiculosDisponiveis.map((v) => (
                            <button
                              key={v.placa}
                              type="button"
                              onClick={() => setPlacaSelecionada(v.placa)}
                              className="w-full text-left px-4 py-3 hover:bg-green-50 dark:hover:bg-gray-800 flex items-center justify-between gap-2 transition-colors"
                            >
                              <div>
                                <span className="text-sm font-black text-gray-900 dark:text-white">
                                  🚗 {v.placa}
                                </span>
                                <p className="text-[11px] font-bold text-gray-500">
                                  {v.descricao} • {v.origem}
                                </p>
                              </div>
                              <span className="text-[10px] font-black uppercase text-[#0b7336]">
                                Selecionar
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Observação e Botão Final */}
              {tipoVeiculo && (tipoVeiculo === "sem_veiculo" || placaSelecionada) && (
                <div className="space-y-3 pt-2 animate-in fade-in duration-200">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">
                      Observação (Opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Entrega de material, visita..."
                      value={observacao}
                      onChange={(e) => setObservacao(e.target.value)}
                      className="w-full px-3.5 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-900 dark:text-white outline-none"
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
                </div>
              )}
            </div>
          )}
        </form>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ABA 2: HISTÓRICO DE REGISTROS
         ══════════════════════════════════════════════════════════════════════ */}
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
                            🚗 {m.placa} ({m.tipo_veiculo === "empresa" ? "Empresa" : "Próprio"})
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-black text-gray-900 dark:text-white break-words">
                        {m.nome}
                      </p>
                      <p className="text-[11px] font-semibold text-gray-500 break-words">
                        Empresa: {m.empresa || "---"} {m.documento ? `• CPF/RG: ${m.documento}` : ""}
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

      {/* ══════════════════════════════════════════════════════════════════════
          ABA 3: CADASTROS SEPARADOS (FUNCIONÁRIOS | TERCEIROS | PLACAS/VEÍCULOS)
         ══════════════════════════════════════════════════════════════════════ */}
      {abaAtiva === "cadastros" && (
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-4 sm:p-6 shadow-xl border border-gray-100 dark:border-gray-700 space-y-5">
          {/* Sub-abas de Categorias de Cadastro */}
          <div className="grid grid-cols-3 gap-2 bg-gray-100 dark:bg-gray-900 p-1.5 rounded-2xl">
            <button
              type="button"
              onClick={() => setSubAbaCadastro("funcionario")}
              className={`py-2.5 px-2 rounded-xl text-[11px] sm:text-xs font-black uppercase tracking-wider transition-all ${
                subAbaCadastro === "funcionario"
                  ? "bg-blue-600 text-white shadow"
                  : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
              }`}
            >
              Funcionários ({contadoresCadastro.funcionario})
            </button>
            <button
              type="button"
              onClick={() => setSubAbaCadastro("terceiro")}
              className={`py-2.5 px-2 rounded-xl text-[11px] sm:text-xs font-black uppercase tracking-wider transition-all ${
                subAbaCadastro === "terceiro"
                  ? "bg-purple-600 text-white shadow"
                  : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
              }`}
            >
              Terceiros ({contadoresCadastro.terceiro})
            </button>
            <button
              type="button"
              onClick={() => setSubAbaCadastro("veiculo")}
              className={`py-2.5 px-2 rounded-xl text-[11px] sm:text-xs font-black uppercase tracking-wider transition-all ${
                subAbaCadastro === "veiculo"
                  ? "bg-[#0b7336] text-white shadow"
                  : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
              }`}
            >
              Placas / Veículos ({contadoresCadastro.veiculo})
            </button>
          </div>

          {/* Cabeçalho + Botão de Novo Cadastro da Categoria Selecionada */}
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm sm:text-base font-black text-gray-900 dark:text-white uppercase">
              {subAbaCadastro === "funcionario" && "Cadastro de Funcionários"}
              {subAbaCadastro === "terceiro" && "Cadastro de Terceiros / Visitantes"}
              {subAbaCadastro === "veiculo" && "Cadastro de Placas & Veículos"}
            </h2>
            <button
              type="button"
              onClick={() => abrirModalNovo(subAbaCadastro)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-[#0b7336] hover:bg-[#09602c] text-white rounded-xl text-xs font-black uppercase tracking-wider shrink-0 shadow"
            >
              <PlusIcon className="w-4 h-4" />
              {subAbaCadastro === "funcionario" && "+ Novo Funcionário"}
              {subAbaCadastro === "terceiro" && "+ Novo Terceiro"}
              {subAbaCadastro === "veiculo" && "+ Nova Placa"}
            </button>
          </div>

          {/* Listagem da sub-aba */}
          <div className="space-y-2">
            {subAbaCadastro !== "veiculo" ? (
              cadastros.filter((c) => c.tipo_pessoa === subAbaCadastro).length === 0 ? (
                <p className="text-center text-xs text-gray-400 py-8 font-bold uppercase">
                  Nenhum {subAbaCadastro === "funcionario" ? "funcionário" : "terceiro"} cadastrado.
                </p>
              ) : (
                cadastros
                  .filter((c) => c.tipo_pessoa === subAbaCadastro)
                  .map((c) => (
                    <div
                      key={c.id}
                      className="p-3.5 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/50 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                          <span className="text-sm font-black text-gray-900 dark:text-white">
                            {c.nome}
                          </span>
                          {c.placa && (
                            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase">
                              🚗 {c.placa} ({c.tipo_veiculo === "empresa" ? "Empresa" : "Próprio"})
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-bold text-gray-500 truncate">
                          CPF/RG: {c.documento || "Não inf."} • Empresa: {c.empresa || "CYMI"}
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
              )
            ) : (
              // Listagem de Placas / Veículos
              cadastros.filter((c) => c.tipo_pessoa === "veiculo" || Boolean(c.placa)).length === 0 ? (
                <p className="text-center text-xs text-gray-400 py-8 font-bold uppercase">
                  Nenhuma placa cadastrada na portaria.
                </p>
              ) : (
                cadastros
                  .filter((c) => c.tipo_pessoa === "veiculo" || Boolean(c.placa))
                  .map((c) => (
                    <div
                      key={c.id}
                      className="p-3.5 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/50 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-0.5">
                          <span className="px-2.5 py-1 rounded-lg bg-gray-900 text-white text-xs font-black uppercase">
                            🚗 {c.placa}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                              c.tipo_veiculo === "empresa"
                                ? "bg-green-100 text-green-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {c.tipo_veiculo === "empresa" ? "Carro da Empresa" : "Carro Próprio / Terceiro"}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-gray-500 truncate">
                          Modelo/Responsável: {c.nome} • Empresa: {c.empresa || "---"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleExcluirCadastro(c.id, c.placa || c.nome)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-xl shrink-0"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))
              )
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL DE NOVO CADASTRO (FUNCIONÁRIO | TERCEIRO | PLACA/VEÍCULO)
         ══════════════════════════════════════════════════════════════════════ */}
      {showModalCadastro && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4 my-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base sm:text-lg font-black text-gray-900 dark:text-white uppercase">
                {modalTipoCadastro === "funcionario" && "Cadastrar Funcionário"}
                {modalTipoCadastro === "terceiro" && "Cadastrar Terceiro"}
                {modalTipoCadastro === "veiculo" && "Cadastrar Placa / Veículo"}
              </h3>
              <button
                type="button"
                onClick={() => setShowModalCadastro(false)}
                className="p-1.5 rounded-xl text-gray-400 hover:bg-gray-100"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            {/* Seletor de tipo no topo do modal */}
            <div className="grid grid-cols-3 gap-1.5 bg-gray-100 dark:bg-gray-900 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setModalTipoCadastro("funcionario");
                  setCadEmpresa("CYMI");
                  setCadTipoVeiculo("empresa");
                }}
                className={`py-2 rounded-lg text-[10px] font-black uppercase ${
                  modalTipoCadastro === "funcionario" ? "bg-blue-600 text-white" : "text-gray-500"
                }`}
              >
                Funcionário
              </button>
              <button
                type="button"
                onClick={() => {
                  setModalTipoCadastro("terceiro");
                  if (cadEmpresa === "CYMI") setCadEmpresa("");
                  setCadTipoVeiculo("proprio");
                }}
                className={`py-2 rounded-lg text-[10px] font-black uppercase ${
                  modalTipoCadastro === "terceiro" ? "bg-purple-600 text-white" : "text-gray-500"
                }`}
              >
                Terceiro
              </button>
              <button
                type="button"
                onClick={() => setModalTipoCadastro("veiculo")}
                className={`py-2 rounded-lg text-[10px] font-black uppercase ${
                  modalTipoCadastro === "veiculo" ? "bg-[#0b7336] text-white" : "text-gray-500"
                }`}
              >
                Só Veículo/Placa
              </button>
            </div>

            <form onSubmit={handleSalvarCadastro} className="space-y-3.5">
              {modalTipoCadastro === "veiculo" ? (
                <>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">
                      Placa do Veículo *
                    </label>
                    <input
                      type="text"
                      required
                      value={cadPlaca}
                      onChange={(e) => setCadPlaca(e.target.value.toUpperCase())}
                      placeholder="ABC1D23"
                      className="w-full px-3.5 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-black uppercase text-gray-900 dark:text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">
                      Vínculo do Veículo *
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setCadTipoVeiculo("empresa");
                          setCadEmpresa("CYMI");
                        }}
                        className={`py-3 rounded-xl text-xs font-black uppercase border-2 ${
                          cadTipoVeiculo === "empresa"
                            ? "border-[#0b7336] bg-green-50 text-[#0b7336]"
                            : "border-gray-200 text-gray-500"
                        }`}
                      >
                        Carro da Empresa
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCadTipoVeiculo("proprio");
                          if (cadEmpresa === "CYMI") setCadEmpresa("PARTICULAR");
                        }}
                        className={`py-3 rounded-xl text-xs font-black uppercase border-2 ${
                          cadTipoVeiculo === "proprio"
                            ? "border-amber-500 bg-amber-50 text-amber-700"
                            : "border-gray-200 text-gray-500"
                        }`}
                      >
                        Carro Próprio / Terc.
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">
                      Modelo / Descrição (Opcional)
                    </label>
                    <input
                      type="text"
                      value={cadNome}
                      onChange={(e) => setCadNome(e.target.value)}
                      placeholder="Ex: Ranger Branca / Gol Prata"
                      className="w-full px-3.5 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-900 dark:text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">
                      Empresa
                    </label>
                    <input
                      type="text"
                      value={cadEmpresa}
                      onChange={(e) => setCadEmpresa(e.target.value)}
                      placeholder="Ex: CYMI ou nome da empresa"
                      className="w-full px-3.5 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-900 dark:text-white outline-none"
                    />
                  </div>
                </>
              ) : (
                <>
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
                        Tipo do Carro
                      </label>
                      <select
                        value={cadTipoVeiculo}
                        onChange={(e) => setCadTipoVeiculo(e.target.value as any)}
                        className="w-full px-3 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-900 dark:text-white outline-none"
                      >
                        <option value="empresa">Da Empresa</option>
                        <option value="proprio">Carro Próprio</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

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
