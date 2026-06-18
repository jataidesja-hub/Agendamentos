'use client';

import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { supabase } from '@/lib/supabase';
import toast, { Toaster } from 'react-hot-toast';

const MAINTENANCE_TYPES = [
  { label: 'Preventiva', value: 'preventiva' },
  { label: 'Corretiva', value: 'corretiva' },
  { label: 'Revisão Programada', value: 'revisao_programada' },
  { label: 'Pneus', value: 'pneus' },
  { label: 'Documentação', value: 'documentacao' },
  { label: 'Outros', value: 'outros' },
];

const SERVICE_CATEGORIES = [
  { label: 'Motor', value: 'motor' },
  { label: 'Freios', value: 'freios' },
  { label: 'Pneus', value: 'pneus' },
  { label: 'Elétrica', value: 'eletrica' },
  { label: 'Suspensão', value: 'suspensao' },
  { label: 'Ar-condicionado', value: 'ar_condicionado' },
  { label: 'Documentação', value: 'documentacao' },
  { label: 'Revisão Preventiva', value: 'revisao_preventiva' },
  { label: 'Outra', value: 'outra' },
];

const PRIORIDADE_OPTIONS = [
  { label: 'Baixa', value: 'baixa', color: 'bg-blue-600', ring: 'ring-blue-500' },
  { label: 'Média', value: 'media', color: 'bg-yellow-500', ring: 'ring-yellow-400' },
  { label: 'Alta', value: 'alta', color: 'bg-orange-500', ring: 'ring-orange-400' },
  { label: 'Emergencial', value: 'emergencial', color: 'bg-red-600', ring: 'ring-red-500' },
];

interface FormState {
  projeto: string;
  nome_solicitante: string;
  funcao: string;
  instalacao_base: string;
  placa: string;
  km_atual: string;
  tipo_frota: string;
  tipo_manutencao: string[];
  tipo_manutencao_outro: string;
  pode_operar: string;
  prioridade: string;
  impacto_operacional: string;
  descricao: string;
  categoria_servico: string[];
  categoria_outro: string;
}

const initialForm: FormState = {
  projeto: '',
  nome_solicitante: '',
  funcao: '',
  instalacao_base: '',
  placa: '',
  km_atual: '',
  tipo_frota: '',
  tipo_manutencao: [],
  tipo_manutencao_outro: '',
  pode_operar: '',
  prioridade: '',
  impacto_operacional: '',
  descricao: '',
  categoria_servico: [],
  categoria_outro: '',
};

export default function SolicitacaoManutencaoPage() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [projetos, setProjetos] = useState<string[]>([]);
  const [placas, setPlacas] = useState<string[]>([]);
  const [fotos, setFotos] = useState<File[]>([]);
  const [fotosPreviews, setFotosPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/frota-publica')
      .then(r => r.json())
      .then(d => setProjetos(d.projetos || []))
      .catch(() => toast.error('Erro ao carregar projetos'));
  }, []);

  useEffect(() => {
    if (!form.projeto) {
      setPlacas([]);
      setForm(f => ({ ...f, placa: '' }));
      return;
    }
    fetch(`/api/frota-publica?projeto=${encodeURIComponent(form.projeto)}`)
      .then(r => r.json())
      .then(d => {
        setPlacas(d.placas || []);
        setForm(f => ({ ...f, placa: '' }));
      })
      .catch(() => toast.error('Erro ao carregar placas'));
  }, [form.projeto]);

  function handleFotoChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (fotos.length + files.length > 5) {
      toast.error('Máximo de 5 fotos permitido.');
      return;
    }
    const newFiles = [...fotos, ...files].slice(0, 5);
    setFotos(newFiles);
    setFotosPreviews(newFiles.map(f => URL.createObjectURL(f)));
  }

  function removePhoto(idx: number) {
    const newFiles = fotos.filter((_, i) => i !== idx);
    setFotos(newFiles);
    setFotosPreviews(newFiles.map(f => URL.createObjectURL(f)));
  }

  function toggleArray(arr: string[], val: string): string[] {
    return arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];
  }

  function handleCheckbox(field: 'tipo_manutencao' | 'categoria_servico', val: string) {
    setForm(f => ({ ...f, [field]: toggleArray(f[field], val) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validation
    const required: [string, string][] = [
      [form.projeto, 'Projeto'],
      [form.nome_solicitante, 'Nome do Solicitante'],
      [form.funcao, 'Função'],
      [form.instalacao_base, 'Instalação/Base Operacional'],
      [form.placa, 'Placa'],
      [form.km_atual, 'KM Atual'],
      [form.tipo_frota, 'Tipo de Frota'],
      [form.pode_operar, 'Veículo pode continuar operando?'],
      [form.prioridade, 'Prioridade'],
      [form.impacto_operacional, 'Impacto Operacional'],
      [form.descricao, 'Descrição detalhada'],
    ];
    for (const [val, label] of required) {
      if (!val || !val.trim()) {
        toast.error(`Campo obrigatório: ${label}`);
        return;
      }
    }
    if (form.tipo_manutencao.length === 0) {
      toast.error('Campo obrigatório: Tipo de Manutenção');
      return;
    }
    if (form.categoria_servico.length === 0) {
      toast.error('Campo obrigatório: Categoria do Serviço');
      return;
    }
    if (form.tipo_manutencao.includes('outros') && !form.tipo_manutencao_outro.trim()) {
      toast.error('Descreva o tipo de manutenção "Outros"');
      return;
    }
    if (form.categoria_servico.includes('outra') && !form.categoria_outro.trim()) {
      toast.error('Descreva a categoria "Outra"');
      return;
    }

    setSubmitting(true);

    try {
      // Upload fotos (ignora se bucket não existir)
      const fotoPaths: string[] = [];
      for (const file of fotos) {
        const ext = file.name.split('.').pop();
        const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('manutencao-fotos')
          .upload(path, file, { upsert: false });
        if (!upErr) fotoPaths.push(path);
      }

      // Insert row
      const { error: insErr } = await supabase.from('manutencao_solicitacoes').insert({
        projeto: form.projeto,
        nome_solicitante: form.nome_solicitante,
        funcao: form.funcao,
        instalacao_base: form.instalacao_base,
        placa: form.placa,
        km_atual: Number(form.km_atual),
        tipo_frota: form.tipo_frota,
        tipo_manutencao: form.tipo_manutencao,
        tipo_manutencao_outro: form.tipo_manutencao_outro || null,
        pode_operar: form.pode_operar,
        prioridade: form.prioridade,
        impacto_operacional: form.impacto_operacional,
        descricao: form.descricao,
        categoria_servico: form.categoria_servico,
        categoria_outro: form.categoria_outro || null,
        fotos: fotoPaths,
      });

      if (insErr) throw insErr;

      setSuccess(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao enviar solicitação';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  function handleSuccessOk() {
    setSuccess(false);
    setForm(initialForm);
    setFotos([]);
    setFotosPreviews([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div className="min-h-screen bg-[#0a0f0d] text-white">
      <Toaster position="top-right" toastOptions={{ style: { background: '#1a2a1f', color: '#fff', border: '1px solid #0b7336' } }} />

      {/* Success Overlay */}
      {success && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0f1f15] border border-[#0b7336] rounded-2xl p-10 flex flex-col items-center gap-6 max-w-md mx-4 shadow-2xl">
            <div className="w-20 h-20 rounded-full bg-[#0b7336]/20 flex items-center justify-center border-2 border-[#0b7336]">
              <svg className="w-10 h-10 text-[#22c55e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white text-center">Solicitação Enviada com Sucesso!</h2>
            <p className="text-gray-400 text-center text-sm leading-relaxed">
              Sua solicitação foi registrada. Nossa equipe entrará em contato em breve.
            </p>
            <button
              onClick={handleSuccessOk}
              className="w-full py-3 rounded-xl bg-[#0b7336] hover:bg-[#09612d] text-white font-semibold transition-colors"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-[#0b7336] via-[#0d8a40] to-[#0b7336] px-4 py-8 text-center shadow-lg">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <span className="text-white/80 text-sm font-medium tracking-widest uppercase">CYMI</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Solicitação de Manutenção</h1>
          <p className="text-white/70 text-sm mt-1">Preencha todos os campos para registrar sua solicitação</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* Card wrapper component inline */}
        {/* --- Projeto --- */}
        <div className="bg-[#0f1f15]/80 border border-[#1e3a28] rounded-2xl p-5 space-y-4 backdrop-blur-sm">
          <h2 className="text-[#22c55e] font-semibold text-sm uppercase tracking-wider flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-[#0b7336] flex items-center justify-center text-white text-xs">1</span>
            Identificação
          </h2>

          <div>
            <label className="block text-gray-300 text-sm mb-1.5 font-medium">Projeto <span className="text-red-400">*</span></label>
            <select
              value={form.projeto}
              onChange={e => setForm(f => ({ ...f, projeto: e.target.value }))}
              className="w-full bg-[#1a2a1f] border border-[#2a4a35] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#0b7336] focus:ring-1 focus:ring-[#0b7336] transition-colors"
            >
              <option value="">Selecione o projeto</option>
              {projetos.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-gray-300 text-sm mb-1.5 font-medium">Nome do Solicitante <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={form.nome_solicitante}
              onChange={e => setForm(f => ({ ...f, nome_solicitante: e.target.value }))}
              placeholder="Seu nome completo"
              className="w-full bg-[#1a2a1f] border border-[#2a4a35] rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#0b7336] focus:ring-1 focus:ring-[#0b7336] transition-colors"
            />
          </div>

          <div>
            <label className="block text-gray-300 text-sm mb-1.5 font-medium">Função <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={form.funcao}
              onChange={e => setForm(f => ({ ...f, funcao: e.target.value }))}
              placeholder="Ex: Motorista, Supervisor..."
              className="w-full bg-[#1a2a1f] border border-[#2a4a35] rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#0b7336] focus:ring-1 focus:ring-[#0b7336] transition-colors"
            />
          </div>

          <div>
            <label className="block text-gray-300 text-sm mb-1.5 font-medium">Instalação / Base Operacional <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={form.instalacao_base}
              onChange={e => setForm(f => ({ ...f, instalacao_base: e.target.value }))}
              placeholder="Ex: Base Norte, Instalação X..."
              className="w-full bg-[#1a2a1f] border border-[#2a4a35] rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#0b7336] focus:ring-1 focus:ring-[#0b7336] transition-colors"
            />
          </div>
        </div>

        {/* --- Veículo --- */}
        <div className="bg-[#0f1f15]/80 border border-[#1e3a28] rounded-2xl p-5 space-y-4 backdrop-blur-sm">
          <h2 className="text-[#22c55e] font-semibold text-sm uppercase tracking-wider flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-[#0b7336] flex items-center justify-center text-white text-xs">2</span>
            Veículo
          </h2>

          <div>
            <label className="block text-gray-300 text-sm mb-1.5 font-medium">Placa <span className="text-red-400">*</span></label>
            <select
              value={form.placa}
              onChange={e => setForm(f => ({ ...f, placa: e.target.value }))}
              disabled={!form.projeto}
              className="w-full bg-[#1a2a1f] border border-[#2a4a35] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#0b7336] focus:ring-1 focus:ring-[#0b7336] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <option value="">{form.projeto ? 'Selecione a placa' : 'Selecione um projeto primeiro'}</option>
              {placas.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-gray-300 text-sm mb-1.5 font-medium">KM Atual <span className="text-red-400">*</span></label>
            <input
              type="number"
              value={form.km_atual}
              onChange={e => setForm(f => ({ ...f, km_atual: e.target.value }))}
              placeholder="Ex: 125000"
              min={0}
              className="w-full bg-[#1a2a1f] border border-[#2a4a35] rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#0b7336] focus:ring-1 focus:ring-[#0b7336] transition-colors"
            />
          </div>

          <div>
            <label className="block text-gray-300 text-sm mb-1.5 font-medium">Tipo de Frota <span className="text-red-400">*</span></label>
            <div className="flex gap-4 mt-1">
              {[{ label: 'Alugada', value: 'alugada' }, { label: 'Própria', value: 'propria' }].map(opt => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer group">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${form.tipo_frota === opt.value ? 'border-[#0b7336] bg-[#0b7336]' : 'border-gray-600 group-hover:border-[#0b7336]'}`}>
                    {form.tipo_frota === opt.value && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <input type="radio" name="tipo_frota" value={opt.value} checked={form.tipo_frota === opt.value} onChange={e => setForm(f => ({ ...f, tipo_frota: e.target.value }))} className="hidden" />
                  <span className="text-gray-300 text-sm">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* --- Tipo de Manutenção --- */}
        <div className="bg-[#0f1f15]/80 border border-[#1e3a28] rounded-2xl p-5 space-y-4 backdrop-blur-sm">
          <h2 className="text-[#22c55e] font-semibold text-sm uppercase tracking-wider flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-[#0b7336] flex items-center justify-center text-white text-xs">3</span>
            Tipo de Manutenção <span className="text-red-400">*</span>
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {MAINTENANCE_TYPES.map(opt => (
              <label key={opt.value} className="flex items-center gap-2 cursor-pointer group">
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${form.tipo_manutencao.includes(opt.value) ? 'border-[#0b7336] bg-[#0b7336]' : 'border-gray-600 group-hover:border-[#0b7336]'}`}>
                  {form.tipo_manutencao.includes(opt.value) && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <input type="checkbox" className="hidden" checked={form.tipo_manutencao.includes(opt.value)} onChange={() => handleCheckbox('tipo_manutencao', opt.value)} />
                <span className="text-gray-300 text-sm">{opt.label}</span>
              </label>
            ))}
          </div>
          {form.tipo_manutencao.includes('outros') && (
            <div>
              <label className="block text-gray-400 text-xs mb-1">Descreva o tipo de manutenção</label>
              <input
                type="text"
                value={form.tipo_manutencao_outro}
                onChange={e => setForm(f => ({ ...f, tipo_manutencao_outro: e.target.value }))}
                placeholder="Descreva..."
                className="w-full bg-[#1a2a1f] border border-[#2a4a35] rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#0b7336] focus:ring-1 focus:ring-[#0b7336] transition-colors"
              />
            </div>
          )}
        </div>

        {/* --- Operação --- */}
        <div className="bg-[#0f1f15]/80 border border-[#1e3a28] rounded-2xl p-5 space-y-4 backdrop-blur-sm">
          <h2 className="text-[#22c55e] font-semibold text-sm uppercase tracking-wider flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-[#0b7336] flex items-center justify-center text-white text-xs">4</span>
            Operação e Prioridade
          </h2>

          <div>
            <label className="block text-gray-300 text-sm mb-2 font-medium">Veículo pode continuar operando? <span className="text-red-400">*</span></label>
            <div className="flex flex-col gap-2">
              {[
                { label: 'Sim', value: 'sim' },
                { label: 'Não', value: 'nao' },
                { label: 'Em Casos Especiais', value: 'casos_especiais' },
              ].map(opt => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer group">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${form.pode_operar === opt.value ? 'border-[#0b7336] bg-[#0b7336]' : 'border-gray-600 group-hover:border-[#0b7336]'}`}>
                    {form.pode_operar === opt.value && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <input type="radio" name="pode_operar" value={opt.value} checked={form.pode_operar === opt.value} onChange={e => setForm(f => ({ ...f, pode_operar: e.target.value }))} className="hidden" />
                  <span className="text-gray-300 text-sm">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-gray-300 text-sm mb-2 font-medium">Prioridade <span className="text-red-400">*</span></label>
            <div className="grid grid-cols-2 gap-2">
              {PRIORIDADE_OPTIONS.map(opt => (
                <label key={opt.value} className="cursor-pointer">
                  <input type="radio" name="prioridade" value={opt.value} checked={form.prioridade === opt.value} onChange={e => setForm(f => ({ ...f, prioridade: e.target.value }))} className="hidden" />
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all ${form.prioridade === opt.value ? `border-transparent ${opt.color} text-white shadow-lg` : 'border-[#2a4a35] text-gray-400 hover:border-gray-500'}`}>
                    <div className={`w-2.5 h-2.5 rounded-full ${opt.color} flex-shrink-0`} />
                    <span className="text-sm font-medium">{opt.label}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-gray-300 text-sm mb-2 font-medium">Impacto Operacional <span className="text-red-400">*</span></label>
            <div className="flex flex-col gap-2">
              {[
                { label: 'Veículo Operacional', value: 'operacional' },
                { label: 'Veículo com Restrição de Uso', value: 'restricao' },
                { label: 'Veículo Indisponível', value: 'indisponivel' },
              ].map(opt => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer group">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${form.impacto_operacional === opt.value ? 'border-[#0b7336] bg-[#0b7336]' : 'border-gray-600 group-hover:border-[#0b7336]'}`}>
                    {form.impacto_operacional === opt.value && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <input type="radio" name="impacto_operacional" value={opt.value} checked={form.impacto_operacional === opt.value} onChange={e => setForm(f => ({ ...f, impacto_operacional: e.target.value }))} className="hidden" />
                  <span className="text-gray-300 text-sm">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* --- Descrição --- */}
        <div className="bg-[#0f1f15]/80 border border-[#1e3a28] rounded-2xl p-5 space-y-4 backdrop-blur-sm">
          <h2 className="text-[#22c55e] font-semibold text-sm uppercase tracking-wider flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-[#0b7336] flex items-center justify-center text-white text-xs">5</span>
            Descrição e Categoria
          </h2>

          <div>
            <label className="block text-gray-300 text-sm mb-1.5 font-medium">Descrição Detalhada <span className="text-red-400">*</span></label>
            <textarea
              value={form.descricao}
              onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              rows={4}
              placeholder="Descreva detalhadamente o problema ou necessidade de manutenção..."
              className="w-full bg-[#1a2a1f] border border-[#2a4a35] rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#0b7336] focus:ring-1 focus:ring-[#0b7336] transition-colors resize-none"
            />
          </div>

          <div>
            <label className="block text-gray-300 text-sm mb-2 font-medium">Categoria do Serviço <span className="text-red-400">*</span></label>
            <div className="grid grid-cols-2 gap-2">
              {SERVICE_CATEGORIES.map(opt => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer group">
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${form.categoria_servico.includes(opt.value) ? 'border-[#0b7336] bg-[#0b7336]' : 'border-gray-600 group-hover:border-[#0b7336]'}`}>
                    {form.categoria_servico.includes(opt.value) && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <input type="checkbox" className="hidden" checked={form.categoria_servico.includes(opt.value)} onChange={() => handleCheckbox('categoria_servico', opt.value)} />
                  <span className="text-gray-300 text-sm">{opt.label}</span>
                </label>
              ))}
            </div>
            {form.categoria_servico.includes('outra') && (
              <div className="mt-3">
                <label className="block text-gray-400 text-xs mb-1">Descreva a categoria</label>
                <input
                  type="text"
                  value={form.categoria_outro}
                  onChange={e => setForm(f => ({ ...f, categoria_outro: e.target.value }))}
                  placeholder="Descreva..."
                  className="w-full bg-[#1a2a1f] border border-[#2a4a35] rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#0b7336] focus:ring-1 focus:ring-[#0b7336] transition-colors"
                />
              </div>
            )}
          </div>
        </div>

        {/* --- Fotos --- */}
        <div className="bg-[#0f1f15]/80 border border-[#1e3a28] rounded-2xl p-5 space-y-4 backdrop-blur-sm">
          <h2 className="text-[#22c55e] font-semibold text-sm uppercase tracking-wider flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-[#0b7336] flex items-center justify-center text-white text-xs">6</span>
            Fotos <span className="text-gray-500 text-xs font-normal ml-1">(opcional, máx. 5)</span>
          </h2>

          <div
            className="border-2 border-dashed border-[#2a4a35] rounded-xl p-6 text-center cursor-pointer hover:border-[#0b7336] transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <svg className="w-8 h-8 text-gray-600 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <p className="text-gray-500 text-sm">Clique para adicionar fotos</p>
            <p className="text-gray-600 text-xs mt-1">{fotos.length}/5 fotos selecionadas</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFotoChange}
            />
          </div>

          {fotosPreviews.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {fotosPreviews.map((src, idx) => (
                <div key={idx} className="relative group rounded-xl overflow-hidden aspect-square">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(idx)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs hover:bg-red-600"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#0b7336] to-[#0d8a40] hover:from-[#09612d] hover:to-[#0b7336] text-white font-bold text-base tracking-wide transition-all shadow-lg shadow-[#0b7336]/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Enviando...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              Enviar Solicitação
            </>
          )}
        </button>

        <p className="text-center text-gray-600 text-xs pb-4">CYMI © {new Date().getFullYear()} — Sistema de Gestão de Manutenção</p>
      </form>
    </div>
  );
}
