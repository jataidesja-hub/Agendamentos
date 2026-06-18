'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  WrenchScrewdriverIcon,
  TruckIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  XMarkIcon,
  ChevronDownIcon,
  PhotoIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { supabase } from '@/lib/supabase';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Solicitacao {
  id: string;
  placa: string;
  tipo_manutencao: string | null;
  prioridade: string | null;
  status: string | null;
  projeto: string | null;
  nome_solicitante: string | null;
  descricao: string | null;
  km_atual: string | null;
  data_ultima_manutencao: string | null;
  oficina_sugerida: string | null;
  orcamento_estimado: string | null;
  observacoes: string | null;
  fotos: string[] | null;
  created_at: string;
  updated_at: string | null;
}

interface Veiculo {
  id: string;
  placa: string;
  modelo: string | null;
  projeto: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PRIORIDADE_LABELS: Record<string, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  operacional: 'Operacional',
};

const STATUS_LABELS: Record<string, string> = {
  aberto: 'Aberto',
  em_andamento: 'Em Andamento',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

function prioridadeBadge(p: string | null) {
  switch (p) {
    case 'baixa':
      return 'bg-blue-500/15 text-blue-400 border border-blue-500/30';
    case 'media':
      return 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30';
    case 'alta':
      return 'bg-orange-500/15 text-orange-400 border border-orange-500/30';
    case 'operacional':
      return 'bg-red-500/15 text-red-400 border border-red-500/30 animate-pulse';
    default:
      return 'bg-gray-500/15 text-gray-400 border border-gray-500/30';
  }
}

function statusBadge(s: string | null) {
  switch (s) {
    case 'aberto':
      return 'bg-gray-500/15 text-gray-400 border border-gray-500/30';
    case 'em_andamento':
      return 'bg-amber-500/15 text-amber-400 border border-amber-500/30';
    case 'concluido':
      return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
    case 'cancelado':
      return 'bg-rose-500/15 text-rose-400 border border-rose-500/30';
    default:
      return 'bg-gray-500/15 text-gray-400 border border-gray-500/30';
  }
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateShort(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800/60 rounded-2xl border border-gray-200/60 dark:border-gray-700/40 p-5 flex items-center gap-4 shadow-sm">
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

// ─── Modal ───────────────────────────────────────────────────────────────────

function DetailModal({
  sol,
  onClose,
  onStatusChange,
}: {
  sol: Solicitacao;
  onClose: () => void;
  onStatusChange: (id: string, status: string) => Promise<void>;
}) {
  const [updating, setUpdating] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const getFotoUrl = (path: string) =>
    supabase.storage.from('manutencao-fotos').getPublicUrl(path).data.publicUrl;

  const handleStatus = async (status: string) => {
    setUpdating(true);
    await onStatusChange(sol.id, status);
    setUpdating(false);
    onClose();
  };

  return (
    <>
      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <img
            src={lightboxUrl}
            alt="Foto ampliada"
            className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
          />
          <button
            className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
            onClick={() => setLightboxUrl(null)}
          >
            <XMarkIcon className="w-6 h-6 text-white" />
          </button>
        </div>
      )}

      {/* Modal backdrop */}
      <div
        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div className="bg-white dark:bg-gray-900 rounded-[1.5rem] w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200/60 dark:border-gray-700/40">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 flex items-center justify-between px-6 py-4 border-b border-gray-200/60 dark:border-gray-700/40 rounded-t-[1.5rem]">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-500/10 p-2 rounded-xl">
                <WrenchScrewdriverIcon className="w-5 h-5 text-indigo-500" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  Placa {sol.placa}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Solicitado em {formatDate(sol.created_at)}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <XMarkIcon className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Badges row */}
            <div className="flex flex-wrap gap-2">
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${prioridadeBadge(sol.prioridade)}`}>
                Prioridade: {PRIORIDADE_LABELS[sol.prioridade ?? ''] ?? sol.prioridade ?? '—'}
              </span>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusBadge(sol.status)}`}>
                {STATUS_LABELS[sol.status ?? ''] ?? sol.status ?? '—'}
              </span>
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Tipo de Manutenção', value: sol.tipo_manutencao },
                { label: 'Projeto', value: sol.projeto },
                { label: 'Solicitante', value: sol.nome_solicitante },
                { label: 'KM Atual', value: sol.km_atual },
                { label: 'Última Manutenção', value: formatDateShort(sol.data_ultima_manutencao) },
                { label: 'Oficina Sugerida', value: sol.oficina_sugerida },
                { label: 'Orçamento Estimado', value: sol.orcamento_estimado },
                { label: 'Atualizado em', value: formatDate(sol.updated_at) },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3">
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">
                    {label}
                  </p>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {value || '—'}
                  </p>
                </div>
              ))}
            </div>

            {/* Descrição */}
            {sol.descricao && (
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
                  Descrição
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 leading-relaxed">
                  {sol.descricao}
                </p>
              </div>
            )}

            {/* Observações */}
            {sol.observacoes && (
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
                  Observações
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 leading-relaxed">
                  {sol.observacoes}
                </p>
              </div>
            )}

            {/* Fotos */}
            {sol.fotos && sol.fotos.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3 flex items-center gap-1.5">
                  <PhotoIcon className="w-4 h-4" />
                  Fotos ({sol.fotos.length})
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {sol.fotos.map((path, i) => {
                    const url = getFotoUrl(path);
                    return (
                      <button
                        key={i}
                        onClick={() => setLightboxUrl(url)}
                        className="relative group rounded-xl overflow-hidden aspect-square bg-gray-100 dark:bg-gray-800 border border-gray-200/60 dark:border-gray-700/40 hover:border-indigo-500/50 transition-all"
                      >
                        <img
                          src={url}
                          alt={`Foto ${i + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                          <ArrowTopRightOnSquareIcon className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Status change actions */}
            <div className="border-t border-gray-200/60 dark:border-gray-700/40 pt-4">
              <p className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
                Alterar Status
              </p>
              <div className="flex flex-wrap gap-2">
                {sol.status !== 'em_andamento' && sol.status !== 'concluido' && sol.status !== 'cancelado' && (
                  <button
                    onClick={() => handleStatus('em_andamento')}
                    disabled={updating}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/30 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                  >
                    <ClockIcon className="w-4 h-4" />
                    Marcar Em Andamento
                  </button>
                )}
                {sol.status !== 'concluido' && sol.status !== 'cancelado' && (
                  <button
                    onClick={() => handleStatus('concluido')}
                    disabled={updating}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                  >
                    <CheckCircleIcon className="w-4 h-4" />
                    Marcar Concluído
                  </button>
                )}
                {sol.status !== 'cancelado' && sol.status !== 'concluido' && (
                  <button
                    onClick={() => handleStatus('cancelado')}
                    disabled={updating}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/30 hover:bg-rose-500/20 transition-colors disabled:opacity-50"
                  >
                    <XCircleIcon className="w-4 h-4" />
                    Cancelar
                  </button>
                )}
                {(sol.status === 'concluido' || sol.status === 'cancelado') && (
                  <button
                    onClick={() => handleStatus('aberto')}
                    disabled={updating}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-gray-500/10 text-gray-500 border border-gray-500/30 hover:bg-gray-500/20 transition-colors disabled:opacity-50"
                  >
                    <ArrowPathIcon className="w-4 h-4" />
                    Reabrir
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type TabType = 'solicitacoes' | 'veiculos';
type StatusFilter = 'todos' | 'aberto' | 'em_andamento' | 'concluido' | 'cancelado';
type PrioridadeFilter = 'todas' | 'baixa' | 'media' | 'alta' | 'operacional';

export default function SolicitacoesPage() {
  const [tab, setTab] = useState<TabType>('solicitacoes');
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingVeiculos, setLoadingVeiculos] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos');
  const [prioridadeFilter, setPrioridadeFilter] = useState<PrioridadeFilter>('todas');
  const [selected, setSelected] = useState<Solicitacao | null>(null);
  const [showPrioridadeDropdown, setShowPrioridadeDropdown] = useState(false);
  const [search, setSearch] = useState('');

  // Fetch solicitacoes
  const fetchSolicitacoes = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('manutencao_solicitacoes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Erro ao carregar solicitações');
    } else {
      setSolicitacoes(data ?? []);
    }
    setLoading(false);
  }, []);

  // Fetch veiculos
  const fetchVeiculos = useCallback(async () => {
    setLoadingVeiculos(true);
    const { data, error } = await supabase
      .from('frota_veiculos')
      .select('id, placa, modelo, projeto')
      .order('placa', { ascending: true });

    if (error) {
      toast.error('Erro ao carregar veículos');
    } else {
      setVeiculos(data ?? []);
    }
    setLoadingVeiculos(false);
  }, []);

  useEffect(() => {
    fetchSolicitacoes();
  }, [fetchSolicitacoes]);

  useEffect(() => {
    if (tab === 'veiculos') fetchVeiculos();
  }, [tab, fetchVeiculos]);

  // Status update
  const handleStatusChange = async (id: string, status: string) => {
    const { error } = await supabase
      .from('manutencao_solicitacoes')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      toast.error('Erro ao atualizar status');
    } else {
      toast.success(`Status atualizado: ${STATUS_LABELS[status] ?? status}`);
      await fetchSolicitacoes();
    }
  };

  // Filtered list
  const filtered = solicitacoes.filter((s) => {
    const matchStatus = statusFilter === 'todos' || s.status === statusFilter;
    const matchPrioridade = prioridadeFilter === 'todas' || s.prioridade === prioridadeFilter;
    const matchSearch =
      !search ||
      s.placa?.toLowerCase().includes(search.toLowerCase()) ||
      s.nome_solicitante?.toLowerCase().includes(search.toLowerCase()) ||
      s.projeto?.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchPrioridade && matchSearch;
  });

  // Stats
  const stats = {
    total: solicitacoes.length,
    abertas: solicitacoes.filter((s) => s.status === 'aberto').length,
    em_andamento: solicitacoes.filter((s) => s.status === 'em_andamento').length,
    concluidas: solicitacoes.filter((s) => s.status === 'concluido').length,
  };

  const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
    { key: 'todos', label: 'Todos' },
    { key: 'aberto', label: 'Aberto' },
    { key: 'em_andamento', label: 'Em Andamento' },
    { key: 'concluido', label: 'Concluído' },
    { key: 'cancelado', label: 'Cancelado' },
  ];

  const PRIORIDADE_FILTERS: { key: PrioridadeFilter; label: string }[] = [
    { key: 'todas', label: 'Todas Prioridades' },
    { key: 'baixa', label: 'Baixa' },
    { key: 'media', label: 'Média' },
    { key: 'alta', label: 'Alta' },
    { key: 'operacional', label: 'Operacional' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6 lg:p-8">
      {/* Modal */}
      {selected && (
        <DetailModal
          sol={selected}
          onClose={() => setSelected(null)}
          onStatusChange={handleStatusChange}
        />
      )}

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2.5">
              <div className="bg-indigo-500/10 p-2 rounded-xl">
                <WrenchScrewdriverIcon className="w-5 h-5 text-indigo-500" />
              </div>
              Solicitações de Manutenção
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Gestão e acompanhamento das solicitações da frota
            </p>
          </div>
          <button
            onClick={fetchSolicitacoes}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl bg-white dark:bg-gray-800 border border-gray-200/60 dark:border-gray-700/40 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors shadow-sm"
          >
            <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800/60 p-1 rounded-xl w-fit">
          {(
            [
              { key: 'solicitacoes', label: 'Solicitações', icon: WrenchScrewdriverIcon },
              { key: 'veiculos', label: 'Veículos', icon: TruckIcon },
            ] as { key: TabType; label: string; icon: React.ElementType }[]
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                tab === key
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* ── SOLICITAÇÕES TAB ── */}
        {tab === 'solicitacoes' && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                icon={WrenchScrewdriverIcon}
                label="Total Solicitações"
                value={stats.total}
                color="bg-indigo-500/10 text-indigo-500"
              />
              <StatCard
                icon={ExclamationTriangleIcon}
                label="Abertas"
                value={stats.abertas}
                color="bg-gray-500/10 text-gray-500"
              />
              <StatCard
                icon={ClockIcon}
                label="Em Andamento"
                value={stats.em_andamento}
                color="bg-amber-500/10 text-amber-500"
              />
              <StatCard
                icon={CheckCircleIcon}
                label="Concluídas"
                value={stats.concluidas}
                color="bg-emerald-500/10 text-emerald-500"
              />
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-gray-800/60 rounded-2xl border border-gray-200/60 dark:border-gray-700/40 p-4 shadow-sm">
              <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
                {/* Search */}
                <div className="relative flex-1 min-w-0">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar por placa, solicitante, projeto..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-sm rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200/60 dark:border-gray-600/40 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
                  />
                </div>

                {/* Status filter buttons */}
                <div className="flex flex-wrap gap-1.5">
                  {STATUS_FILTERS.map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setStatusFilter(key)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all border ${
                        statusFilter === key
                          ? 'bg-indigo-500 text-white border-indigo-500 shadow-sm'
                          : 'bg-transparent text-gray-500 dark:text-gray-400 border-gray-200/60 dark:border-gray-600/40 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Prioridade dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowPrioridadeDropdown((v) => !v)}
                    className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200/60 dark:border-gray-600/40 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    {PRIORIDADE_FILTERS.find((f) => f.key === prioridadeFilter)?.label}
                    <ChevronDownIcon
                      className={`w-4 h-4 text-gray-400 transition-transform ${showPrioridadeDropdown ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {showPrioridadeDropdown && (
                    <div className="absolute right-0 top-full mt-1 z-30 w-48 bg-white dark:bg-gray-800 border border-gray-200/60 dark:border-gray-700/40 rounded-xl shadow-xl overflow-hidden">
                      {PRIORIDADE_FILTERS.map(({ key, label }) => (
                        <button
                          key={key}
                          onClick={() => {
                            setPrioridadeFilter(key);
                            setShowPrioridadeDropdown(false);
                          }}
                          className={`w-full text-left px-4 py-2.5 text-xs font-medium transition-colors ${
                            prioridadeFilter === key
                              ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* List */}
            <div className="bg-white dark:bg-gray-800/60 rounded-2xl border border-gray-200/60 dark:border-gray-700/40 shadow-sm overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center py-20 gap-3">
                  <ArrowPathIcon className="w-5 h-5 text-indigo-500 animate-spin" />
                  <span className="text-sm text-gray-500 dark:text-gray-400">Carregando...</span>
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <WrenchScrewdriverIcon className="w-10 h-10 text-gray-300 dark:text-gray-600" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Nenhuma solicitação encontrada
                  </p>
                </div>
              ) : (
                <>
                  {/* Table header (md+) */}
                  <div className="hidden md:grid grid-cols-[1fr_1.5fr_auto_auto_1fr_1fr_auto] gap-3 px-5 py-3 border-b border-gray-100 dark:border-gray-700/40 bg-gray-50/80 dark:bg-gray-700/20 text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-medium">
                    <span>Placa</span>
                    <span>Tipo Manutenção</span>
                    <span>Prioridade</span>
                    <span>Status</span>
                    <span>Projeto</span>
                    <span>Solicitante</span>
                    <span>Data</span>
                  </div>

                  {/* Rows */}
                  <div className="divide-y divide-gray-100 dark:divide-gray-700/40">
                    {filtered.map((sol) => (
                      <button
                        key={sol.id}
                        onClick={() => setSelected(sol)}
                        className="w-full text-left hover:bg-gray-50/80 dark:hover:bg-gray-700/30 transition-colors"
                      >
                        {/* Desktop row */}
                        <div className="hidden md:grid grid-cols-[1fr_1.5fr_auto_auto_1fr_1fr_auto] gap-3 items-center px-5 py-3.5">
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">
                            {sol.placa}
                          </span>
                          <span className="text-sm text-gray-600 dark:text-gray-300 truncate">
                            {sol.tipo_manutencao || '—'}
                          </span>
                          <span
                            className={`text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${prioridadeBadge(sol.prioridade)}`}
                          >
                            {PRIORIDADE_LABELS[sol.prioridade ?? ''] ?? sol.prioridade ?? '—'}
                          </span>
                          <span
                            className={`text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${statusBadge(sol.status)}`}
                          >
                            {STATUS_LABELS[sol.status ?? ''] ?? sol.status ?? '—'}
                          </span>
                          <span className="text-sm text-gray-600 dark:text-gray-300 truncate">
                            {sol.projeto || '—'}
                          </span>
                          <span className="text-sm text-gray-600 dark:text-gray-300 truncate">
                            {sol.nome_solicitante || '—'}
                          </span>
                          <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                            {formatDateShort(sol.created_at)}
                          </span>
                        </div>

                        {/* Mobile card */}
                        <div className="md:hidden p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {sol.placa}
                            </span>
                            <span className="text-xs text-gray-400">{formatDateShort(sol.created_at)}</span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            {sol.tipo_manutencao || '—'}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${prioridadeBadge(sol.prioridade)}`}>
                              {PRIORIDADE_LABELS[sol.prioridade ?? ''] ?? sol.prioridade ?? '—'}
                            </span>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadge(sol.status)}`}>
                              {STATUS_LABELS[sol.status ?? ''] ?? sol.status ?? '—'}
                            </span>
                          </div>
                          <div className="flex gap-2 text-xs text-gray-500 dark:text-gray-400">
                            <span>{sol.projeto}</span>
                            {sol.nome_solicitante && <span>· {sol.nome_solicitante}</span>}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Footer count */}
                  <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700/40 bg-gray-50/50 dark:bg-gray-700/10">
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      Mostrando {filtered.length} de {solicitacoes.length} solicitações
                    </p>
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {/* ── VEÍCULOS TAB ── */}
        {tab === 'veiculos' && (
          <div className="bg-white dark:bg-gray-800/60 rounded-2xl border border-gray-200/60 dark:border-gray-700/40 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700/40">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <TruckIcon className="w-4 h-4 text-indigo-500" />
                Frota de Veículos
              </h2>
              <button
                onClick={fetchVeiculos}
                disabled={loadingVeiculos}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200/60 dark:border-gray-600/40 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <ArrowPathIcon className={`w-3.5 h-3.5 ${loadingVeiculos ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
            </div>

            {loadingVeiculos ? (
              <div className="flex items-center justify-center py-20 gap-3">
                <ArrowPathIcon className="w-5 h-5 text-indigo-500 animate-spin" />
                <span className="text-sm text-gray-500 dark:text-gray-400">Carregando veículos...</span>
              </div>
            ) : veiculos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <TruckIcon className="w-10 h-10 text-gray-300 dark:text-gray-600" />
                <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum veículo cadastrado</p>
              </div>
            ) : (
              <>
                {/* Table header */}
                <div className="grid grid-cols-[1.5fr_2fr_1.5fr] gap-4 px-5 py-3 bg-gray-50/80 dark:bg-gray-700/20 text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-medium border-b border-gray-100 dark:border-gray-700/40">
                  <span>Placa</span>
                  <span>Modelo</span>
                  <span>Projeto</span>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-700/40">
                  {veiculos.map((v) => (
                    <div
                      key={v.id}
                      className="grid grid-cols-[1.5fr_2fr_1.5fr] gap-4 items-center px-5 py-3.5 hover:bg-gray-50/80 dark:hover:bg-gray-700/20 transition-colors"
                    >
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {v.placa}
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        {v.modelo || '—'}
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        {v.projeto || '—'}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700/40 bg-gray-50/50 dark:bg-gray-700/10">
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {veiculos.length} veículo{veiculos.length !== 1 ? 's' : ''} cadastrado{veiculos.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
