'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  WrenchScrewdriverIcon, TruckIcon, ClockIcon, CheckCircleIcon,
  XCircleIcon, ExclamationTriangleIcon, XMarkIcon, PhotoIcon,
  BellAlertIcon, EyeIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { supabase } from '@/lib/supabase';

interface Solicitacao {
  id: string;
  placa: string;
  projeto: string | null;
  nome_solicitante: string | null;
  funcao: string | null;
  instalacao_base: string | null;
  km_atual: number | null;
  tipo_frota: string | null;
  tipo_manutencao: string[] | null;
  tipo_manutencao_outro: string | null;
  pode_operar: string | null;
  prioridade: string | null;
  impacto_operacional: string | null;
  descricao: string | null;
  categoria_servico: string[] | null;
  categoria_outro: string | null;
  fotos: string[] | null;
  status: string | null;
  created_at: string;
  updated_at: string | null;
}

const PRIORIDADE_LABEL: Record<string, string> = { baixa: 'Baixa', media: 'Média', alta: 'Alta', emergencial: 'Emergencial', operacional: 'Emergencial' };
const STATUS_LABEL: Record<string, string> = { aberto: 'Aberto', em_andamento: 'Em Andamento', concluido: 'Concluído', cancelado: 'Cancelado' };
const PODE_OPERAR_LABEL: Record<string, string> = { sim: 'Sim', nao: 'Não', casos_especiais: 'Em Casos Especiais' };
const IMPACTO_LABEL: Record<string, string> = { operacional: 'Veículo Operacional', restricao: 'Veículo com Restrição de Uso', indisponivel: 'Veículo Indisponível' };
const TIPO_FROTA_LABEL: Record<string, string> = { alugada: 'Alugada', propria: 'Própria' };

function prioBadge(p: string | null) {
  const base = 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-wide';
  switch (p) {
    case 'baixa': return `${base} bg-blue-500/15 text-blue-400 border-blue-500/30`;
    case 'media': return `${base} bg-yellow-500/15 text-yellow-400 border-yellow-500/30`;
    case 'alta': return `${base} bg-orange-500/15 text-orange-400 border-orange-500/30`;
    case 'emergencial': case 'operacional': return `${base} bg-red-500/15 text-red-400 border-red-500/30`;
    default: return `${base} bg-gray-500/15 text-gray-400 border-gray-500/30`;
  }
}

function statusBadge(s: string | null) {
  const base = 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-wide';
  switch (s) {
    case 'aberto': return `${base} bg-gray-500/15 text-gray-400 border-gray-500/30`;
    case 'em_andamento': return `${base} bg-amber-500/15 text-amber-400 border-amber-500/30`;
    case 'concluido': return `${base} bg-emerald-500/15 text-emerald-400 border-emerald-500/30`;
    case 'cancelado': return `${base} bg-rose-500/15 text-rose-400 border-rose-500/30`;
    default: return `${base} bg-gray-500/15 text-gray-400 border-gray-500/30`;
  }
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">{label}</span>
      <span className="text-sm font-medium text-gray-900 dark:text-white">{value || '—'}</span>
    </div>
  );
}

// Photo URL is handled async in the component now

export default function SolicitacoesPage() {
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'solicitacoes' | 'veiculos'>('solicitacoes');
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [filterPrio, setFilterPrio] = useState<string>('todos');
  const [selected, setSelected] = useState<Solicitacao | null>(null);
  const [veiculos, setVeiculos] = useState<any[]>([]);
  const [novas, setNovas] = useState<Set<string>>(new Set());
  const [vistas, setVistas] = useState<Set<string>>(new Set());
  const seenRef = useRef<Set<string>>(new Set());
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});

  const fetchVeiculos = useCallback(async () => {
    const { data } = await supabase.from('frota_veiculos').select('placa, modelo, projeto').order('placa');
    setVeiculos(data || []);
  }, []);

  const fetchSolicitacoes = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const { data, error } = await supabase
      .from('manutencao_solicitacoes')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { toast.error('Erro ao carregar solicitações'); }
    else {
      const list = data || [];
      // detectar novas (não vistas ainda)
      const novosIds = list
        .filter(s => !seenRef.current.has(s.id))
        .map(s => s.id);
      if (novosIds.length > 0 && seenRef.current.size > 0) {
        setNovas(prev => new Set([...prev, ...novosIds]));
      }
      // na primeira carga, marca todos como "já conhecidos"
      if (seenRef.current.size === 0) {
        list.forEach(s => seenRef.current.add(s.id));
      } else {
        list.forEach(s => seenRef.current.add(s.id));
      }
      setSolicitacoes(list);
    }
    if (!silent) setLoading(false);
  }, []);

  useEffect(() => {
    fetchSolicitacoes();
    fetchVeiculos();
  }, [fetchSolicitacoes, fetchVeiculos]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('solicitacoes-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'manutencao_solicitacoes' }, (payload) => {
        const nova = payload.new as Solicitacao;
        setSolicitacoes(prev => [nova, ...prev]);
        setNovas(prev => new Set([...prev, nova.id]));
        seenRef.current.add(nova.id);
        toast.custom((t) => (
          <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} flex items-center gap-3 bg-white dark:bg-gray-900 border border-emerald-500/30 rounded-2xl shadow-lg px-4 py-3`}>
            <BellAlertIcon className="w-5 h-5 text-emerald-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-white">Nova solicitação!</p>
              <p className="text-xs text-gray-500">{nova.placa} · {nova.projeto}</p>
            </div>
          </div>
        ), { duration: 6000 });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'manutencao_solicitacoes' }, () => {
        fetchSolicitacoes(true);
      })
      .subscribe();

    // Fallback polling every 15 seconds
    const intervalId = setInterval(() => {
      fetchSolicitacoes(true);
    }, 15000);

    return () => { 
      supabase.removeChannel(channel); 
      clearInterval(intervalId);
    };
  }, [fetchSolicitacoes]);

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase
      .from('manutencao_solicitacoes')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) { toast.error('Erro ao atualizar'); return; }
    toast.success('Status atualizado');
    fetchSolicitacoes(true);
    setSelected(prev => prev ? { ...prev, status } : prev);
  }

  async function openModal(s: Solicitacao) {
    setSelected(s);
    // marca como vista
    setNovas(prev => { const n = new Set(prev); n.delete(s.id); return n; });
    setVistas(prev => new Set([...prev, s.id]));

    // Fetch signed URLs for photos
    if (s.fotos && s.fotos.length > 0) {
      const urls: Record<string, string> = {};
      for (const path of s.fotos) {
        const { data } = await supabase.storage.from('manutencao-fotos').createSignedUrl(path, 3600);
        if (data?.signedUrl) {
          urls[path] = data.signedUrl;
        } else {
          // Fallback to public URL if signed URL fails
          const { data: pubData } = supabase.storage.from('manutencao-fotos').getPublicUrl(path);
          urls[path] = pubData.publicUrl;
        }
      }
      setPhotoUrls(urls);
    } else {
      setPhotoUrls({});
    }
  }

  const filtered = solicitacoes.filter(s => {
    if (filterStatus !== 'todos' && s.status !== filterStatus) return false;
    if (filterPrio !== 'todos' && s.prioridade !== filterPrio) return false;
    return true;
  });

  const counts = {
    total: solicitacoes.length,
    aberto: solicitacoes.filter(s => s.status === 'aberto').length,
    em_andamento: solicitacoes.filter(s => s.status === 'em_andamento').length,
    concluido: solicitacoes.filter(s => s.status === 'concluido').length,
  };

  return (
    <div className="h-full flex flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-3">
            <WrenchScrewdriverIcon className="w-7 h-7 text-[#0b7336]" />
            Solicitações de Manutenção
            {novas.size > 0 && (
              <span className="animate-pulse inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500 text-white text-xs font-black">
                <BellAlertIcon className="w-3.5 h-3.5" /> {novas.size} nova{novas.size !== 1 ? 's' : ''}
              </span>
            )}
          </h1>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: counts.total, color: 'text-gray-900 dark:text-white' },
          { label: 'Abertas', value: counts.aberto, color: 'text-gray-400' },
          { label: 'Em Andamento', value: counts.em_andamento, color: 'text-amber-400' },
          { label: 'Concluídas', value: counts.concluido, color: 'text-emerald-400' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
            <p className="text-xs font-bold text-gray-500">{s.label}</p>
            <p className={`text-3xl font-black mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-800 pb-2">
        {(['solicitacoes', 'veiculos'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${activeTab === t ? 'bg-[#0b7336] text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
            {t === 'solicitacoes' ? 'Solicitações' : 'Veículos'}
          </button>
        ))}
      </div>

      {activeTab === 'veiculos' ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                {['Placa', 'Modelo', 'Projeto'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {veiculos.map((v, i) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-4 py-3 font-mono font-bold text-gray-900 dark:text-white">{v.placa}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{v.modelo || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{v.projeto || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            {['todos', 'aberto', 'em_andamento', 'concluido', 'cancelado'].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${filterStatus === s ? 'bg-[#0b7336] text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                {STATUS_LABEL[s] || 'Todos'}
              </button>
            ))}
            <div className="w-px bg-gray-200 dark:bg-gray-700 mx-1" />
            {['todos', 'baixa', 'media', 'alta', 'emergencial'].map(p => (
              <button key={p} onClick={() => setFilterPrio(p)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${filterPrio === p ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
                {p === 'todos' ? 'Todas prioridades' : PRIORIDADE_LABEL[p]}
              </button>
            ))}
          </div>

          {/* List */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-[#0b7336] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-gray-400 font-medium">Nenhuma solicitação encontrada.</div>
          ) : (
            <div className="grid gap-3">
              {filtered.map(s => {
                const isNova = novas.has(s.id);
                return (
                  <div key={s.id}
                    onClick={() => openModal(s)}
                    className={`bg-white dark:bg-gray-900 rounded-2xl border cursor-pointer transition-all hover:shadow-md hover:scale-[1.01] p-4 flex items-center gap-4 ${
                      isNova
                        ? 'border-red-500/50 animate-pulse shadow-red-500/10 shadow-lg'
                        : 'border-gray-100 dark:border-gray-800'
                    }`}>
                    {isNova && (
                      <span className="flex-shrink-0 w-2.5 h-2.5 rounded-full bg-red-500" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-gray-900 dark:text-white font-mono text-sm">{s.placa}</span>
                        <span className={prioBadge(s.prioridade)}>{PRIORIDADE_LABEL[s.prioridade || ''] || s.prioridade}</span>
                        <span className={statusBadge(s.status)}>{STATUS_LABEL[s.status || ''] || s.status}</span>
                        {isNova && <span className="text-[9px] font-black text-red-400 uppercase tracking-widest">NOVA</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                        <span>{s.projeto}</span>
                        <span>·</span>
                        <span>{s.nome_solicitante}</span>
                        <span>·</span>
                        <span>{(s.tipo_manutencao || []).join(', ')}</span>
                        <span>·</span>
                        <span>{fmtDate(s.created_at)}</span>
                      </div>
                    </div>
                    <EyeIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-[2rem] border border-gray-200 dark:border-gray-800 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-900 rounded-t-[2rem] px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-800 flex items-start justify-between z-10">
              <div>
                <h2 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                  <WrenchScrewdriverIcon className="w-5 h-5 text-[#0b7336]" />
                  Placa {selected.placa}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">Solicitado em {fmtDate(selected.created_at)}</p>
                <div className="flex gap-2 mt-2">
                  <span className={prioBadge(selected.prioridade)}>{PRIORIDADE_LABEL[selected.prioridade || ''] || selected.prioridade}</span>
                  <span className={statusBadge(selected.status)}>{STATUS_LABEL[selected.status || ''] || selected.status}</span>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-6">
              {/* Identificação */}
              <section>
                <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Identificação</h3>
                <div className="grid grid-cols-2 gap-3">
                  <InfoRow label="Projeto" value={selected.projeto} />
                  <InfoRow label="Solicitante" value={selected.nome_solicitante} />
                  <InfoRow label="Função" value={selected.funcao} />
                  <InfoRow label="Instalação / Base" value={selected.instalacao_base} />
                  <InfoRow label="Placa" value={selected.placa} />
                  <InfoRow label="KM Atual" value={selected.km_atual != null ? `${selected.km_atual.toLocaleString('pt-BR')} km` : null} />
                  <InfoRow label="Tipo de Frota" value={TIPO_FROTA_LABEL[selected.tipo_frota || ''] || selected.tipo_frota} />
                </div>
              </section>

              {/* Manutenção */}
              <section>
                <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Manutenção</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <InfoRow label="Tipo de Manutenção" value={(selected.tipo_manutencao || []).join(', ')} />
                    {selected.tipo_manutencao_outro && <p className="text-xs text-gray-500 mt-1">Outros: {selected.tipo_manutencao_outro}</p>}
                  </div>
                  <InfoRow label="Veículo pode operar?" value={PODE_OPERAR_LABEL[selected.pode_operar || ''] || selected.pode_operar} />
                  <InfoRow label="Prioridade" value={PRIORIDADE_LABEL[selected.prioridade || ''] || selected.prioridade} />
                  <div className="col-span-2">
                    <InfoRow label="Impacto Operacional" value={IMPACTO_LABEL[selected.impacto_operacional || ''] || selected.impacto_operacional} />
                  </div>
                </div>
              </section>

              {/* Descrição */}
              <section>
                <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Descrição</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap bg-gray-50 dark:bg-gray-800 rounded-xl p-3">{selected.descricao || '—'}</p>
              </section>

              {/* Categoria */}
              <section>
                <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Categoria do Serviço</h3>
                <div className="flex flex-wrap gap-2">
                  {(selected.categoria_servico || []).map(c => (
                    <span key={c} className="text-xs font-bold px-2 py-1 rounded-lg bg-[#0b7336]/10 text-[#0b7336] border border-[#0b7336]/20">{c}</span>
                  ))}
                </div>
                {selected.categoria_outro && <p className="text-xs text-gray-500 mt-2">Outra: {selected.categoria_outro}</p>}
              </section>

              {/* Fotos */}
              {selected.fotos && selected.fotos.length > 0 && (
                <section>
                  <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Fotos ({selected.fotos.length})</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {selected.fotos.map((path, i) => {
                      const url = photoUrls[path];
                      if (!url) return <div key={i} className="w-full h-28 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse"></div>;
                      return (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                          <img src={url} alt={`Foto ${i + 1}`}
                            className="w-full h-28 object-cover rounded-xl border border-gray-200 dark:border-gray-700 hover:opacity-80 transition-opacity" />
                        </a>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Status */}
              {selected.status !== 'concluido' && selected.status !== 'cancelado' && (
                <section>
                  <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Alterar Status</h3>
                  <div className="flex flex-wrap gap-2">
                    {selected.status !== 'em_andamento' && (
                      <button onClick={() => updateStatus(selected.id, 'em_andamento')}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 font-bold text-sm hover:bg-amber-500/25 transition-all">
                        <ClockIcon className="w-4 h-4" /> Marcar Em Andamento
                      </button>
                    )}
                    <button onClick={() => updateStatus(selected.id, 'concluido')}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold text-sm hover:bg-emerald-500/25 transition-all">
                      <CheckCircleIcon className="w-4 h-4" /> Marcar Concluído
                    </button>
                    <button onClick={() => updateStatus(selected.id, 'cancelado')}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/30 font-bold text-sm hover:bg-rose-500/25 transition-all">
                      <XCircleIcon className="w-4 h-4" /> Cancelar
                    </button>
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
