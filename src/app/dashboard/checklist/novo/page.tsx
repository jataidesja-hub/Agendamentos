"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";
import {
  ChevronLeftIcon, ChevronRightIcon, CheckIcon,
  CameraIcon, XMarkIcon, ArrowUpTrayIcon,
} from "@heroicons/react/24/outline";

// ─── Dados do checklist ────────────────────────────────────────────────────────

const GRUPOS = [
  {
    nome: "Iluminação",
    itens: [
      { id: 1, label: "Lanternas dianteiras / traseiras" },
      { id: 2, label: "Seta direita / Esquerda" },
      { id: 3, label: "Estado Lente farol Dianteiro" },
      { id: 4, label: "Luz baixa" },
      { id: 5, label: "Luz Alta" },
      { id: 6, label: "Luz de Freio" },
      { id: 7, label: "Lanterna Traseira" },
      { id: 8, label: "Luz de Ré" },
      { id: 9, label: "Luz Interna" },
      { id: 10, label: "Luz do Painel" },
      { id: 11, label: "Alarme de Ré" },
    ],
  },
  {
    nome: "Vidros e Visibilidade",
    itens: [
      { id: 12, label: "Aspersos / Limpador pára-brisa" },
      { id: 13, label: "Palheta limpador do pára brisa" },
      { id: 14, label: "Pára-brisa" },
      { id: 15, label: "Velocímetro" },
      { id: 16, label: "Desembaçador interno" },
      { id: 17, label: "Aquecedor" },
    ],
  },
  {
    nome: "Interior",
    itens: [
      { id: 18, label: "Portas" },
      { id: 19, label: "Chaves Original e Reserva" },
      { id: 20, label: "Assentos" },
      { id: 21, label: "Manivelas e alavanca dos vidros" },
      { id: 22, label: "Espelho retrovisor" },
      { id: 23, label: "Cintos de segurança" },
      { id: 24, label: "Aberturas / Teto solar" },
      { id: 25, label: "Tapa-sol" },
    ],
  },
  {
    nome: "Exterior",
    itens: [
      { id: 26, label: "Estribos laterais" },
      { id: 27, label: "Santo Antonio" },
      { id: 28, label: "Proteção da frente" },
      { id: 52, label: "Arranhões / riscos / pintura / amassados" },
    ],
  },
  {
    nome: "Freios e Pneus",
    itens: [
      { id: 29, label: "Freio de Mão" },
      { id: 30, label: "Verificar estado dos Freios" },
      { id: 31, label: "Estado dos Pneus" },
      { id: 33, label: "Tipo / Medidas dos Pneus" },
      { id: 34, label: "Verificar estado do Pneu de Estepe" },
    ],
  },
  {
    nome: "Motor e Fluidos",
    itens: [
      { id: 35, label: "Mangueiras do Motor" },
      { id: 36, label: "Bateria / Capacidade" },
      { id: 45, label: "Troca de Óleo Km." },
      { id: 46, label: "Nível de óleo" },
      { id: 47, label: "Funcionamento Ventoinha" },
      { id: 48, label: "Vazamento óleo / água" },
      { id: 49, label: "Barulhos estranhos" },
    ],
  },
  {
    nome: "Segurança e Emergência",
    itens: [
      { id: 37, label: "Tanque Combustível" },
      { id: 38, label: "Chaves de Rodas" },
      { id: 39, label: "Macaco" },
      { id: 40, label: "Triangulo" },
      { id: 41, label: "Extintor" },
    ],
  },
  {
    nome: "Documentação",
    itens: [
      { id: 42, label: "Documento de Veiculo" },
      { id: 43, label: "Cartão Seguro" },
      { id: 44, label: "Cartão Abastecimento" },
    ],
  },
  {
    nome: "Carroceria e Acessórios",
    itens: [
      { id: 32, label: "Mala" },
      { id: 50, label: "Capota" },
      { id: 51, label: "Vigia" },
      { id: 53, label: "Radio Amador Frequencia CERON" },
      { id: 54, label: "Aparelho de Som" },
      { id: 55, label: "Veiculo é Individual" },
      { id: 56, label: "Diferencial" },
      { id: 57, label: "Dupla Tração" },
      { id: 58, label: "Tapetes" },
      { id: 59, label: "Cadeados Caixas Carroceria e Vara LV" },
      { id: 60, label: "Escadas" },
      { id: 61, label: "Grade de Carroceria para Escada" },
      { id: 62, label: "Caixas de Ferramentas" },
    ],
  },
  {
    nome: "Verificações Gerais",
    itens: [
      { id: 63, label: "Verificar Condições dos Para-choques" },
      { id: 64, label: "Verificar Fixação dos Paralamas" },
      { id: 65, label: "Verificar Existência e Fechamento da Tampa de Combustível" },
      { id: 66, label: "Verificar Existência de Placa de Ident. Dianteira e Traseira" },
      { id: 67, label: "Verificar Existência de Iluminação e Lacre na Placa traseira" },
      { id: 68, label: "Verificar se o Condutor Possue Habilitação Compatível e dentro da validade" },
      { id: 69, label: "Verificar se o Condutor Possue de direção defensiva dentro da validade" },
      { id: 70, label: "Verificar funcionamento do Ar Condicionado" },
      { id: 71, label: "Verificar estado e funcionamento da Buzina" },
    ],
  },
];

const FOTO_SPOTS = [
  { id: "farol_esq", label: "Farol Esquerdo" },
  { id: "farol_dir", label: "Farol Direito" },
  { id: "frente", label: "Frente" },
  { id: "lanterna_esq", label: "Lanterna Esquerda" },
  { id: "lanterna_dir", label: "Lanterna Direita" },
  { id: "tras", label: "Traseira" },
  { id: "lado_esq", label: "Lado Esquerdo" },
  { id: "lado_dir", label: "Lado Direito" },
  { id: "teto", label: "Teto" },
  { id: "interna_esq", label: "Interna Esquerda" },
  { id: "interna_meio", label: "Interna Meio" },
  { id: "interna_dir", label: "Interna Direita" },
  { id: "estepe", label: "Estepe" },
  { id: "mala", label: "Mala / Carroceria / Baú" },
  { id: "chave_roda", label: "Chave de Roda" },
  { id: "documento", label: "Documento do Veículo" },
  { id: "painel_km", label: "Painel com KM" },
  { id: "som", label: "Som" },
];

const STATUS_OPTS = ["OK", "C", "F", "V", "L", "SD"] as const;
type Status = (typeof STATUS_OPTS)[number];

const STATUS_STYLE: Record<Status, string> = {
  OK: "bg-green-500 text-white border-green-500",
  C: "bg-orange-500 text-white border-orange-500",
  F: "bg-red-500 text-white border-red-500",
  V: "bg-blue-500 text-white border-blue-500",
  L: "bg-purple-500 text-white border-purple-500",
  SD: "bg-gray-400 text-white border-gray-400",
};

type Respostas = Record<number, { situacao: Status | null; obs: string }>;
type FotoState = Record<string, { url: string | null; sem_foto: boolean; uploading: boolean }>;

// ─── Componente ────────────────────────────────────────────────────────────────

export default function NovoChecklist() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [dados, setDados] = useState({
    placa: "",
    condutor: "",
    cpf: "",
    projeto: "",
    ano_fab: "",
    km: "",
    tipo_marca: "",
    modelo: "",
    centro_custo: "",
    funcao: "",
    local_inspecao: "",
    data_inspecao: new Date().toISOString().split("T")[0],
    km_inspecao: "",
  });

  const [respostas, setRespostas] = useState<Respostas>({});
  const [fotos, setFotos] = useState<FotoState>({});
  const [expandedObs, setExpandedObs] = useState<number | null>(null);
  const [observacaoGeral, setObservacaoGeral] = useState("");

  // ── handlers ──────────────────────────────────────────────────────────────

  const setStatus = (id: number, status: Status) => {
    setRespostas(prev => ({
      ...prev,
      [id]: { situacao: status, obs: prev[id]?.obs || "" },
    }));
  };

  const setObs = (id: number, obs: string) => {
    setRespostas(prev => ({
      ...prev,
      [id]: { situacao: prev[id]?.situacao || null, obs },
    }));
  };

  const handleFotoUpload = async (spotId: string, file: File) => {
    setFotos(prev => ({ ...prev, [spotId]: { url: null, sem_foto: false, uploading: true } }));
    try {
      const ext = file.name.split(".").pop();
      const path = `checklist/${Date.now()}_${spotId}.${ext}`;
      const { error } = await supabase.storage.from("checklist-fotos").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("checklist-fotos").getPublicUrl(path);
      setFotos(prev => ({ ...prev, [spotId]: { url: publicUrl, sem_foto: false, uploading: false } }));
    } catch (e: any) {
      toast.error("Erro ao enviar foto: " + e.message);
      setFotos(prev => ({ ...prev, [spotId]: { url: null, sem_foto: false, uploading: false } }));
    }
  };

  const toggleSemFoto = (spotId: string) => {
    setFotos(prev => {
      const atual = prev[spotId];
      if (atual?.sem_foto) {
        const { [spotId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [spotId]: { url: null, sem_foto: true, uploading: false } };
    });
  };

  const removeFoto = (spotId: string) => {
    setFotos(prev => { const { [spotId]: _, ...rest } = prev; return rest; });
  };

  const handleSalvar = async () => {
    if (!dados.placa.trim()) { toast.error("Informe a placa"); return; }
    setSaving(true);
    try {
      const fotosJson: Record<string, { url: string | null; sem_foto: boolean }> = {};
      for (const [k, v] of Object.entries(fotos)) {
        fotosJson[k] = { url: v.url, sem_foto: v.sem_foto };
      }
      const { error } = await supabase.from("informe_checklist").insert({
        ...dados,
        respostas,
        fotos: fotosJson,
        observacao_geral: observacaoGeral.trim() || null,
      });
      if (error) throw error;
      toast.success("Checklist salvo!");
      router.push("/dashboard/checklist");
    } catch (e: any) {
      toast.error("Erro ao salvar: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  // ── totais ─────────────────────────────────────────────────────────────────

  const totalItens = GRUPOS.reduce((s, g) => s + g.itens.length, 0);
  const respondidos = Object.values(respostas).filter(r => r.situacao).length;
  const fotosPendentes = FOTO_SPOTS.filter(s => !fotos[s.id]).length;

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => step > 1 ? setStep(s => s - 1) : router.push("/dashboard/checklist")}
          className="p-2 rounded-xl bg-white/70 dark:bg-gray-800/70 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300"
        >
          <ChevronLeftIcon className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-black text-gray-900 dark:text-white">Novo Checklist</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">Passo {step} de 3</p>
        </div>
        {dados.placa && (
          <span className="text-sm font-black text-[#0b7336] bg-green-50 dark:bg-green-900/20 px-3 py-1 rounded-xl">
            {dados.placa.toUpperCase()}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-[#0b7336] rounded-full transition-all duration-500"
          style={{ width: `${(step / 3) * 100}%` }}
        />
      </div>

      {/* ── STEP 1: Dados do Veículo ── */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-4 space-y-3">
            <p className="font-black text-gray-800 dark:text-white text-sm uppercase tracking-wider">Dados do Veículo</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Placa *</label>
                <input
                  value={dados.placa}
                  onChange={e => setDados(p => ({ ...p, placa: e.target.value.toUpperCase() }))}
                  placeholder="ABC1D23"
                  className="mt-1 w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white font-bold text-sm focus:outline-none focus:ring-2 focus:ring-[#0b7336]"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">KM Atual</label>
                <input
                  value={dados.km}
                  onChange={e => setDados(p => ({ ...p, km: e.target.value }))}
                  placeholder="00000"
                  type="number"
                  className="mt-1 w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0b7336]"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Condutor</label>
              <input
                value={dados.condutor}
                onChange={e => setDados(p => ({ ...p, condutor: e.target.value }))}
                placeholder="Nome completo"
                className="mt-1 w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0b7336]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">CPF</label>
                <input
                  value={dados.cpf}
                  onChange={e => setDados(p => ({ ...p, cpf: e.target.value }))}
                  placeholder="000.000.000-00"
                  className="mt-1 w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0b7336]"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Projeto</label>
                <input
                  value={dados.projeto}
                  onChange={e => setDados(p => ({ ...p, projeto: e.target.value }))}
                  placeholder="Ex: JMM"
                  className="mt-1 w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0b7336]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Tipo / Marca</label>
                <input
                  value={dados.tipo_marca}
                  onChange={e => setDados(p => ({ ...p, tipo_marca: e.target.value }))}
                  placeholder="Ex: CHEVROLETE"
                  className="mt-1 w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0b7336]"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Modelo</label>
                <input
                  value={dados.modelo}
                  onChange={e => setDados(p => ({ ...p, modelo: e.target.value }))}
                  placeholder="Ex: S10"
                  className="mt-1 w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0b7336]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Ano Fab.</label>
                <input
                  value={dados.ano_fab}
                  onChange={e => setDados(p => ({ ...p, ano_fab: e.target.value }))}
                  placeholder="2024"
                  className="mt-1 w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0b7336]"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Função</label>
                <input
                  value={dados.funcao}
                  onChange={e => setDados(p => ({ ...p, funcao: e.target.value }))}
                  placeholder="Ex: MOTORISTA"
                  className="mt-1 w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0b7336]"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Centro de Custo</label>
              <input
                value={dados.centro_custo}
                onChange={e => setDados(p => ({ ...p, centro_custo: e.target.value }))}
                placeholder="Ex: 55220BS/001"
                className="mt-1 w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0b7336]"
              />
            </div>
          </div>

          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-4 space-y-3">
            <p className="font-black text-gray-800 dark:text-white text-sm uppercase tracking-wider">Dados da Inspeção</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Data</label>
                <input
                  type="date"
                  value={dados.data_inspecao}
                  onChange={e => setDados(p => ({ ...p, data_inspecao: e.target.value }))}
                  className="mt-1 w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0b7336]"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">KM da Inspeção</label>
                <input
                  value={dados.km_inspecao}
                  onChange={e => setDados(p => ({ ...p, km_inspecao: e.target.value }))}
                  placeholder="00000"
                  type="number"
                  className="mt-1 w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0b7336]"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Local da Inspeção</label>
              <input
                value={dados.local_inspecao}
                onChange={e => setDados(p => ({ ...p, local_inspecao: e.target.value }))}
                placeholder="Ex: CYMI O&M JUAZEIRO"
                className="mt-1 w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0b7336]"
              />
            </div>
          </div>

          <button
            onClick={() => { if (!dados.placa.trim()) { toast.error("Informe a placa"); return; } setStep(2); }}
            className="w-full py-4 bg-[#0b7336] hover:bg-[#09602c] text-white font-black rounded-2xl flex items-center justify-center gap-2 text-base shadow-lg transition-all active:scale-95"
          >
            Próximo: Checklist
            <ChevronRightIcon className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* ── STEP 2: Checklist de itens ── */}
      {step === 2 && (
        <div className="space-y-3">
          {/* Legenda */}
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-3">
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">LEGENDA</p>
            <div className="flex flex-wrap gap-2">
              {(["OK", "C", "F", "V", "L", "SD"] as Status[]).map(s => (
                <div key={s} className="flex items-center gap-1.5">
                  <span className={`w-7 h-6 rounded-lg flex items-center justify-center text-[10px] font-black ${STATUS_STYLE[s]}`}>{s}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {s === "OK" ? "Normal" : s === "C" ? "Consertar" : s === "F" ? "Faltante" : s === "V" ? "Verificar" : s === "L" ? "Limpar" : "Sem Dados"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            {respondidos}/{totalItens} itens respondidos
          </p>

          {/* Grupos */}
          {GRUPOS.map(grupo => (
            <div key={grupo.nome} className="bg-white/70 dark:bg-gray-800/70 backdrop-blur border border-gray-200/50 dark:border-gray-700/50 rounded-2xl overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50/80 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700/50">
                <p className="text-xs font-black text-gray-600 dark:text-gray-300 uppercase tracking-wider">{grupo.nome}</p>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700/30">
                {grupo.itens.map(item => {
                  const resp = respostas[item.id];
                  const isExpanded = expandedObs === item.id;
                  return (
                    <div key={item.id} className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-gray-400 dark:text-gray-600 w-5 shrink-0">{item.id}</span>
                        <span
                          className="flex-1 text-xs text-gray-700 dark:text-gray-300 font-medium leading-tight cursor-pointer"
                          onClick={() => setExpandedObs(isExpanded ? null : item.id)}
                        >
                          {item.label}
                        </span>
                        <div className="flex gap-1 shrink-0">
                          {(["OK", "C", "F", "V", "L", "SD"] as Status[]).map(s => (
                            <button
                              key={s}
                              onClick={() => setStatus(item.id, s)}
                              className={`w-7 h-6 rounded-lg text-[10px] font-black border transition-all ${
                                resp?.situacao === s
                                  ? STATUS_STYLE[s]
                                  : "bg-transparent border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-600 hover:border-gray-400"
                              }`}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                      {isExpanded && (
                        <input
                          autoFocus
                          value={resp?.obs || ""}
                          onChange={e => setObs(item.id, e.target.value)}
                          placeholder="Observação (opcional)..."
                          className="mt-2 w-full px-3 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#0b7336]"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="flex-1 py-4 bg-white/70 dark:bg-gray-800/70 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-2xl flex items-center justify-center gap-2 text-sm"
            >
              <ChevronLeftIcon className="w-4 h-4" /> Voltar
            </button>
            <button
              onClick={() => setStep(3)}
              className="flex-[2] py-4 bg-[#0b7336] hover:bg-[#09602c] text-white font-black rounded-2xl flex items-center justify-center gap-2 text-base shadow-lg transition-all active:scale-95"
            >
              Próximo: Fotos
              <ChevronRightIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Fotos ── */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-3 text-xs text-amber-700 dark:text-amber-400 font-medium">
            As fotos são opcionais. Marque "NÃO CONTEM" quando o item não existir no veículo.
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            {FOTO_SPOTS.length - fotosPendentes}/{FOTO_SPOTS.length} fotos preenchidas
          </p>

          <div className="grid grid-cols-2 gap-3">
            {FOTO_SPOTS.map(spot => {
              const estado = fotos[spot.id];
              return (
                <div
                  key={spot.id}
                  className="bg-white/70 dark:bg-gray-800/70 backdrop-blur border border-gray-200/50 dark:border-gray-700/50 rounded-2xl overflow-hidden"
                >
                  <p className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wide px-3 pt-2.5 pb-1">
                    {spot.label}
                  </p>

                  {estado?.sem_foto ? (
                    <div className="mx-3 mb-3 rounded-xl bg-gray-100 dark:bg-gray-700/50 h-20 flex flex-col items-center justify-center gap-1">
                      <span className="text-xs font-black text-gray-400 dark:text-gray-500">NÃO CONTEM</span>
                      <button
                        onClick={() => toggleSemFoto(spot.id)}
                        className="text-[10px] text-blue-500 underline"
                      >
                        desfazer
                      </button>
                    </div>
                  ) : estado?.url ? (
                    <div className="mx-3 mb-3 relative rounded-xl overflow-hidden h-20">
                      <img src={estado.url} alt={spot.label} className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeFoto(spot.id)}
                        className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center"
                      >
                        <XMarkIcon className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  ) : estado?.uploading ? (
                    <div className="mx-3 mb-3 rounded-xl bg-gray-100 dark:bg-gray-700/50 h-20 flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-[#0b7336] border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : (
                    <div className="mx-3 mb-3 grid grid-cols-2 gap-1.5">
                      <button
                        onClick={() => fileRefs.current[spot.id]?.click()}
                        className="h-9 rounded-xl bg-[#0b7336]/10 dark:bg-[#0b7336]/20 border border-[#0b7336]/30 text-[#0b7336] flex items-center justify-center gap-1 text-[10px] font-bold"
                      >
                        <CameraIcon className="w-3.5 h-3.5" />
                        Foto
                      </button>
                      <button
                        onClick={() => toggleSemFoto(spot.id)}
                        className="h-9 rounded-xl bg-gray-100 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 flex items-center justify-center text-[9px] font-bold leading-tight text-center px-1"
                      >
                        NÃO CONTEM
                      </button>
                    </div>
                  )}

                  <input
                    ref={el => { fileRefs.current[spot.id] = el; }}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleFotoUpload(spot.id, file);
                      e.target.value = "";
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* Resumo final */}
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-4 space-y-2">
            <p className="font-black text-gray-800 dark:text-white text-sm">Resumo</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl py-2">
                <p className="text-xl font-black text-green-600 dark:text-green-400">
                  {Object.values(respostas).filter(r => r.situacao === "OK").length}
                </p>
                <p className="text-[10px] font-bold text-green-600 dark:text-green-400">OK</p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-xl py-2">
                <p className="text-xl font-black text-red-500 dark:text-red-400">
                  {Object.values(respostas).filter(r => r.situacao === "F" || r.situacao === "C").length}
                </p>
                <p className="text-[10px] font-bold text-red-500 dark:text-red-400">Problemas</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl py-2">
                <p className="text-xl font-black text-gray-500 dark:text-gray-400">
                  {totalItens - respondidos}
                </p>
                <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400">Sem resp.</p>
              </div>
            </div>
          </div>

          {/* Observação Geral */}
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-4">
            <label className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-2">
              Observações Gerais (opcional)
            </label>
            <textarea
              value={observacaoGeral}
              onChange={e => setObservacaoGeral(e.target.value)}
              placeholder="Descreva aqui qualquer observação adicional sobre o veículo ou inspeção..."
              rows={4}
              className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-800 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-[#0b7336] outline-none resize-none"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="flex-1 py-4 bg-white/70 dark:bg-gray-800/70 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-2xl flex items-center justify-center gap-2 text-sm"
            >
              <ChevronLeftIcon className="w-4 h-4" /> Voltar
            </button>
            <button
              onClick={handleSalvar}
              disabled={saving}
              className="flex-[2] py-4 bg-[#0b7336] hover:bg-[#09602c] disabled:opacity-60 text-white font-black rounded-2xl flex items-center justify-center gap-2 text-base shadow-lg transition-all active:scale-95"
            >
              {saving ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <CheckIcon className="w-5 h-5" />
                  Salvar Checklist
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
