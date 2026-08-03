"use client";

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  TruckIcon, PlusIcon, DocumentArrowUpIcon,
  ChevronDownIcon, ChevronUpIcon, ArchiveBoxIcon,
  CreditCardIcon, BuildingOfficeIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

// ─── helpers ────────────────────────────────────────────────────────────────
const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function LimitBar({ limite, usado }: { limite: number; usado: number }) {
  if (!limite || limite <= 0) return null;
  const pct = Math.min((usado / limite) * 100, 100);
  const color =
    pct >= 100 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-400' : 'bg-emerald-500';
  const textColor =
    pct >= 100 ? 'text-red-600 dark:text-red-400' :
    pct >= 70  ? 'text-amber-600 dark:text-amber-400' :
                 'text-emerald-600 dark:text-emerald-400';
  const label =
    pct >= 100 ? '🔴 Estourado' : pct >= 70 ? '🟡 Atenção' : '🟢 OK';
  const disponivel = Math.max(limite - usado, 0);

  return (
    <div className="mt-3 flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-[10px] font-black uppercase">
        <span className="text-gray-400">Limite do Cartão</span>
        <span className={textColor}>{label}</span>
      </div>
      <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
        <div className={`${color} h-2 rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-[10px] font-bold text-gray-400">
        <span>Usado: <span className={textColor}>{fmt(usado)}</span></span>
        <span>Limite: {fmt(limite)}</span>
      </div>
      {disponivel > 0 && (
        <div className="text-[10px] font-bold text-gray-400 text-right">
          Disponível: <span className="text-gray-600 dark:text-gray-300">{fmt(disponivel)}</span>
        </div>
      )}
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────────
export default function FrotasPage() {
  const [veiculos, setVeiculos] = useState<any[]>([]);
  const [usoPorPlaca, setUsoPorPlaca] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [busca, setBusca] = useState('');
  const [projetosPermitidos, setProjetosPermitidos] = useState<string[] | null>(null);
  const [isMaster, setIsMaster] = useState(false);
  const [gruposExpandidos, setGruposExpandidos] = useState<Record<string, boolean>>({});

  // Form states
  const [placa, setPlaca] = useState('');
  const [modelo, setModelo] = useState('');
  const [status, setStatus] = useState('Ativo');
  const [projeto, setProjeto] = useState('');
  const [base, setBase] = useState('');
  const [propriedade, setPropriedade] = useState('');

  useEffect(() => {
    fetchPerfil();
    fetchVeiculos();
    fetchUsoMensal();
  }, []);

  // ── fetch perfil ───────────────────────────────────────────────────────────
  async function fetchPerfil() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase
      .from('perfis_acesso')
      .select('master, projetos_acesso')
      .eq('email', session.user.email)
      .single();
    if (data?.master) setIsMaster(true);
    else if (data) setProjetosPermitidos(data.projetos_acesso || []);
  }

  // ── fetch veículos (excluindo arquivados) ──────────────────────────────────
  async function fetchVeiculos() {
    try {
      const { data, error } = await supabase
        .from('frota_veiculos')
        .select('*')
        .eq('arquivado', false)
        .order('projeto', { ascending: true })
        .order('placa', { ascending: true });
      if (error) { console.warn(error); setVeiculos([]); }
      else setVeiculos(data || []);
    } catch { toast.error('Erro ao carregar frotas'); }
    finally { setLoading(false); }
  }

  // ── uso do mês atual por placa (soma valor_total em abastecimentos) ─────────
  async function fetchUsoMensal() {
    const agora = new Date();
    const inicio = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-01`;
    const { data } = await supabase
      .from('abastecimentos')
      .select('placa, valor_total')
      .gte('data_transacao', inicio);
    if (data) {
      const agg: Record<string, number> = {};
      data.forEach((r: any) => {
        const p = String(r.placa || '').toUpperCase().trim();
        agg[p] = (agg[p] || 0) + Number(r.valor_total || 0);
      });
      setUsoPorPlaca(agg);
    }
  }

  // ── salvar novo veículo ────────────────────────────────────────────────────
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('frota_veiculos').insert({
        placa, modelo, status, projeto, subprojeto: base, propriedade, arquivado: false,
      });
      if (!error) toast.success('Veículo registrado!');
      setShowForm(false);
      fetchVeiculos();
      setPlaca(''); setModelo(''); setStatus('Ativo'); setProjeto(''); setBase(''); setPropriedade('');
    } catch { toast.error('Erro ao salvar'); }
  };

  // ── update status ──────────────────────────────────────────────────────────
  const handleUpdateStatus = async (id: string, newStatus: string) => {
    const original = [...veiculos];
    setVeiculos(prev => prev.map(v => v.id === id ? { ...v, status: newStatus } : v));
    const { error } = await supabase.from('frota_veiculos').update({ status: newStatus }).eq('id', id);
    if (error) { setVeiculos(original); toast.error(error.message); }
    else toast.success('Status atualizado!');
  };

  // ── arquivar ───────────────────────────────────────────────────────────────
  const handleArchivar = async (id: string, placaV: string) => {
    if (!confirm(`Arquivar veículo ${placaV}? Ele não aparecerá mais na listagem ativa.`)) return;
    const { error } = await supabase.from('frota_veiculos').update({ arquivado: true }).eq('id', id);
    if (!error) { toast.success(`${placaV} arquivado!`); fetchVeiculos(); }
    else toast.error(error.message);
  };

  // ── toggle grupo ───────────────────────────────────────────────────────────
  const toggleGrupo = (k: string) =>
    setGruposExpandidos(prev => ({ ...prev, [k]: !prev[k] }));

  // ── importar FROTA_PROJETOS ────────────────────────────────────────────────
  const importarFrota = async (file: File) => {
    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (evt: any) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary' });
        const rawData: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        const getV = (row: any, names: string[]) => {
          for (const name of names) {
            const found = Object.keys(row).find(k => k.toUpperCase().trim().includes(name.toUpperCase()));
            if (found && row[found] != null) return row[found];
          }
          return '';
        };
        const getExact = (row: any, names: string[]) => {
          for (const name of names) {
            const found = Object.keys(row).find(k => k.toUpperCase().trim() === name.toUpperCase());
            if (found && row[found] != null) return row[found];
          }
          return '';
        };
        const normStatus = (s: string) =>
          s.toUpperCase().includes('DEMOB') || s.toUpperCase().includes('DESMOB') ? 'Desmobilizado' : 'Ativo';

        const rows = rawData.map(row => {
          const p = String(getExact(row, ['PLACA', 'VEICULO']) || '').trim().toUpperCase();
          return {
            placa: p, identificacao: p,
            projeto: String(getExact(row, ['PROJETO']) || '').trim(),
            subprojeto: String(getExact(row, ['BASE', 'SUBPROJETO']) || '').trim(),
            email_gerente: String(getV(row, ['EMAIL_GERENTE', 'EMAIL GERENTE']) || '').trim(),
            email_administrativo: String(getV(row, ['EMAIL_ADM', 'EMAIL ADM']) || '').trim(),
            status: normStatus(String(getExact(row, ['STATUS']) || 'Ativo')),
            propriedade: String(getExact(row, ['PROPRIEDADE']) || '').trim(),
          };
        }).filter(x => x.placa);

        const uniqueMap = new Map<string, any>();
        rows.forEach(r => uniqueMap.set(r.placa, r));
        const formatted = Array.from(uniqueMap.values());

        if (confirm(`Importar ${formatted.length} veículos (FROTA)?`)) {
          const { error } = await supabase.from('frota_veiculos').upsert(formatted, { onConflict: 'placa' });
          if (error) throw error;
          toast.success('Frota atualizada!');
          fetchVeiculos();
        }
      } catch (err: any) { toast.error('Erro: ' + (err.message || err)); }
      finally { setLoading(false); }
    };
    reader.readAsBinaryString(file);
  };

  // ── importar LIMITES DO CARTÃO ─────────────────────────────────────────────
  const importarLimites = async (file: File) => {
    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (evt: any) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary' });
        // Tenta a aba "Página1" ou a primeira aba
        const sheetName = wb.SheetNames.find(n =>
          n.toUpperCase().includes('PÁGINA') || n.toUpperCase().includes('PAGINA') || n === wb.SheetNames[0]
        ) || wb.SheetNames[0];
        const rawData: any[] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);

        const getExact = (row: any, names: string[]) => {
          for (const name of names) {
            const found = Object.keys(row).find(k => k.toUpperCase().trim() === name.toUpperCase());
            if (found && row[found] != null) return row[found];
          }
          return null;
        };
        const getContains = (row: any, names: string[]) => {
          for (const name of names) {
            const found = Object.keys(row).find(k => k.toUpperCase().includes(name.toUpperCase()));
            if (found && row[found] != null) return row[found];
          }
          return null;
        };

        let ok = 0;
        for (const row of rawData) {
          const placa = String(getExact(row, ['PLACA', 'PLACA ']) || '').trim().toUpperCase();
          if (!placa) continue;
          // Tenta "Limite Próximo Período" primeiro, depois "Limite"
          const limiteRaw = getContains(row, ['LIMITE PRÓXIMO', 'LIMITE PROXIMO', 'LIMITE PRX'])
            ?? getExact(row, ['LIMITE', 'LIMIT']);
          const limite = Number(String(limiteRaw || '0').replace(',', '.')) || 0;
          if (limite <= 0) continue;
          const { error } = await supabase
            .from('frota_veiculos')
            .update({ limite_cartao: limite })
            .eq('placa', placa);
          if (!error) ok++;
        }
        toast.success(`Limites atualizados: ${ok} veículo(s)!`);
        fetchVeiculos();
      } catch (err: any) { toast.error('Erro: ' + (err.message || err)); }
      finally { setLoading(false); }
    };
    reader.readAsBinaryString(file);
  };

  // ── importar ORÇAMENTO POR PROJETO ──────────────────────────────────────────
  const importarOrcamento = async (file: File) => {
    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (evt: any) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary' });
        const rawData: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

        const getExact = (row: any, names: string[]) => {
          for (const name of names) {
            const found = Object.keys(row).find(k => k.toUpperCase().trim() === name.toUpperCase().trim());
            if (found && row[found] != null) return row[found];
          }
          return null;
        };
        const getContains = (row: any, names: string[]) => {
          for (const name of names) {
            const found = Object.keys(row).find(k => k.toUpperCase().includes(name.toUpperCase()));
            if (found && row[found] != null) return row[found];
          }
          return null;
        };

        const rows = rawData.map(row => {
          const projeto = String(getExact(row, ['PROJETO']) || '').trim().toUpperCase();
          if (!projeto) return null;
          const locacao = Number(String(getContains(row, ['LOCAÇÃO', 'LOCACAO']) ?? 0).toString().replace(',', '.')) || 0;
          const combustivel = Number(String(getContains(row, ['COMBUSTÍVEL', 'COMBUSTIVEL']) ?? 0).toString().replace(',', '.')) || 0;
          return { projeto, valor_locacao: locacao, valor_combustivel: combustivel, updated_at: new Date().toISOString() };
        }).filter(Boolean) as any[];

        if (!rows.length) { toast.error('Nenhum projeto encontrado na planilha.'); return; }

        if (confirm(`Importar orçamento de ${rows.length} projeto(s)?`)) {
          const { error } = await supabase
            .from('orcamento_projetos')
            .upsert(rows, { onConflict: 'projeto' });
          if (error) throw error;
          toast.success(`Orçamento atualizado: ${rows.length} projeto(s)!`);
        }
      } catch (err: any) { toast.error('Erro: ' + (err.message || err)); }
      finally { setLoading(false); }
    };
    reader.readAsBinaryString(file);
  };
 // ── filtros e agrupamento ──────────────────────────────────────────────────
  const veiculosFiltrados = useMemo(() => {
    return veiculos.filter(v => {
      const proj = String(v.projeto || '').toUpperCase();
      if (projetosPermitidos !== null &&
          !projetosPermitidos.some(p => p.toUpperCase() === proj)) return false;
      const t = busca.toUpperCase();
      return (
        !t ||
        v.placa?.toUpperCase().includes(t) ||
        proj.includes(t) ||
        String(v.subprojeto || '').toUpperCase().includes(t) ||
        String(v.propriedade || '').toUpperCase().includes(t) ||
        String(v.modelo || '').toUpperCase().includes(t)
      );
    });
  }, [veiculos, projetosPermitidos, busca]);

  // Agrupa: projeto → proprietário → veículos
  const grupos = useMemo(() => {
    const g: Record<string, Record<string, any[]>> = {};
    veiculosFiltrados.forEach(v => {
      const proj = String(v.projeto || 'SEM PROJETO').trim().toUpperCase();
      const prop = String(v.propriedade || 'SEM PROPRIETÁRIO').trim().toUpperCase();
      if (!g[proj]) g[proj] = {};
      if (!g[proj][prop]) g[proj][prop] = [];
      g[proj][prop].push(v);
    });
    return g;
  }, [veiculosFiltrados]);

  const projetosOrdenados = Object.keys(grupos).sort();

  // Stats globais
  const totalVeics = veiculosFiltrados.length;
  const totalOK = veiculosFiltrados.filter(v => {
    if (!v.limite_cartao) return true;
    return (usoPorPlaca[v.placa] || 0) / v.limite_cartao < 0.7;
  }).length;
  const totalAtencao = veiculosFiltrados.filter(v => {
    if (!v.limite_cartao) return false;
    const pct = (usoPorPlaca[v.placa] || 0) / v.limite_cartao;
    return pct >= 0.7 && pct < 1;
  }).length;
  const totalEstourado = veiculosFiltrados.filter(v => {
    if (!v.limite_cartao) return false;
    return (usoPorPlaca[v.placa] || 0) >= v.limite_cartao;
  }).length;

  if (loading) return (
    <div className="p-8 text-center text-gray-500 animate-pulse font-bold">Carregando frotas...</div>
  );

  return (
    <div className="p-4 md:p-8 w-full max-w-7xl mx-auto flex flex-col gap-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl shadow-lg">
            <TruckIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
              Frota / Gestão de Frotas
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">
              Cadastro de placas, projetos e controle de limites de cartão
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Search */}
          <input
            type="text"
            placeholder="Buscar placa, projeto, proprietário..."
            value={busca}
            onChange={e => setBusca(e.target.value.toUpperCase())}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-56"
          />

          {/* Importar Frota — só master */}
          {isMaster && (
            <>
              <label className="flex items-center gap-2 bg-gray-800 hover:bg-black text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg cursor-pointer whitespace-nowrap">
                <DocumentArrowUpIcon className="w-4 h-4" /> Importar Frota
                <input type="file" accept=".xlsx,.xls" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) importarFrota(f); e.target.value = ''; }} />
              </label>
              <label className="flex items-center gap-2 bg-indigo-700 hover:bg-indigo-800 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg cursor-pointer whitespace-nowrap">
                <CreditCardIcon className="w-4 h-4" /> Importar Limites
                <input type="file" accept=".xlsx,.xls" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) importarLimites(f); e.target.value = ''; }} />
              </label>
              <label className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg cursor-pointer whitespace-nowrap">
                <DocumentArrowUpIcon className="w-4 h-4" /> Importar Orçamento
                <input type="file" accept=".xlsx,.xls" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) importarOrcamento(f); e.target.value = ''; }} />
              </label>
            </>
          )}

          {/* Novo Veículo */}
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg hover:scale-105 active:scale-95 whitespace-nowrap"
          >
            {showForm ? 'Cancelar' : <><PlusIcon className="w-5 h-5" /> Novo Veículo</>}
          </button>
        </div>
      </div>

      {/* ── Stats ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Veículos', value: totalVeics, color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' },
          { label: '🟢 Dentro do Limite', value: totalOK, color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300' },
          { label: '🟡 Atenção', value: totalAtencao, color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300' },
          { label: '🔴 Estourado', value: totalEstourado, color: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' },
        ].map(s => (
          <div key={s.label} className={`${s.color} rounded-2xl p-4 flex flex-col gap-1`}>
            <span className="text-2xl font-black">{s.value}</span>
            <span className="text-xs font-bold uppercase tracking-wider opacity-80">{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── Form ───────────────────────────────────────────────────────────── */}
      {showForm && (
        <form onSubmit={handleSave}
          className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border border-gray-100 dark:border-gray-700/50 rounded-3xl p-6 shadow-xl animate-in slide-in-from-top-4 duration-300">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            {[
              { label: 'Placa', val: placa, set: (v: string) => setPlaca(v.toUpperCase()), ph: 'ABC-1234', req: true },
              { label: 'Modelo', val: modelo, set: setModelo, ph: 'Toyota Hilux' },
              { label: 'Projeto', val: projeto, set: (v: string) => setProjeto(v.toUpperCase()), ph: 'MANTIQUEIRA' },
              { label: 'Base / Subprojeto', val: base, set: (v: string) => setBase(v.toUpperCase()), ph: 'SE ABDON' },
              { label: 'Proprietário', val: propriedade, set: (v: string) => setPropriedade(v.toUpperCase()), ph: 'CYMI, LOCALIZA...' },
            ].map(f => (
              <div key={f.label} className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-400 uppercase ml-1">{f.label}</label>
                <input required={f.req} placeholder={f.ph} value={f.val}
                  onChange={e => f.set(e.target.value)}
                  className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white" />
              </div>
            ))}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-400 uppercase ml-1">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)}
                className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white font-bold">
                <option value="Ativo">✅ Ativo</option>
                <option value="Em Manutenção">🛠 Manutenção</option>
                <option value="Fora de Serviço">🚫 Inativo</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit"
              className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg active:scale-95">
              Salvar Veículo
            </button>
          </div>
        </form>
      )}

      {/* ── Contador ───────────────────────────────────────────────────────── */}
      <p className="text-sm text-gray-400 font-medium">
        {totalVeics} veículo(s) · {projetosOrdenados.length} projeto(s)
      </p>

      {/* ── Grupos: PROJETO → PROPRIETÁRIO ──────────────────────────────────── */}
      <div className="flex flex-col gap-6 pb-20">
        {projetosOrdenados.length === 0 && (
          <div className="py-24 text-center border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-[3rem]">
            <TruckIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-bold italic">Nenhum veículo cadastrado.</p>
          </div>
        )}

        {projetosOrdenados.map(proj => {
          const isProjOpen = gruposExpandidos[proj] !== false;
          const proprietariosNoProjeto = Object.keys(grupos[proj]).sort();
          const todosVeicsProjeto = proprietariosNoProjeto.flatMap(p => grupos[proj][p]);

          const projEstourado = todosVeicsProjeto.filter(v =>
            v.limite_cartao > 0 && (usoPorPlaca[v.placa] || 0) >= v.limite_cartao).length;
          const projAtencao = todosVeicsProjeto.filter(v => {
            if (!v.limite_cartao) return false;
            const pct = (usoPorPlaca[v.placa] || 0) / v.limite_cartao;
            return pct >= 0.7 && pct < 1;
          }).length;

          return (
            <div key={proj} className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/40 dark:border-gray-700/50 rounded-3xl overflow-hidden shadow-lg">

              {/* ── Header PROJETO (nível 1) ── */}
              <button
                onClick={() => toggleGrupo(proj)}
                className="w-full flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-700/20 to-transparent hover:from-blue-700/30 transition-all border-b border-blue-200/20 dark:border-blue-800/30"
              >
                <div className="flex items-center gap-3 flex-wrap">
                  <TruckIcon className="w-5 h-5 text-blue-500 shrink-0" />
                  <span className="text-base font-black text-gray-900 dark:text-white uppercase tracking-widest">{proj}</span>
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-2.5 py-0.5 rounded-full">
                    {todosVeicsProjeto.length} veíc.
                  </span>
                  <span className="text-xs font-bold text-gray-500 bg-gray-100 dark:bg-gray-700 px-2.5 py-0.5 rounded-full">
                    {proprietariosNoProjeto.length} proprietário(s)
                  </span>
                  {projEstourado > 0 && (
                    <span className="text-[10px] font-black text-red-600 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded-full">
                      🔴 {projEstourado} estourado(s)
                    </span>
                  )}
                  {projAtencao > 0 && (
                    <span className="text-[10px] font-black text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
                      🟡 {projAtencao} em atenção
                    </span>
                  )}
                </div>
                {isProjOpen
                  ? <ChevronUpIcon className="w-5 h-5 text-gray-400 shrink-0" />
                  : <ChevronDownIcon className="w-5 h-5 text-gray-400 shrink-0" />}
              </button>

              {/* ── Sub-grupos por PROPRIETÁRIO (nível 2) ── */}
              {isProjOpen && (
                <div className="flex flex-col gap-0">
                  {proprietariosNoProjeto.map(prop => {
                    const keyProp = `${proj}__${prop}`;
                    const isPropOpen = gruposExpandidos[keyProp] !== false;
                    const veicsProp = grupos[proj][prop];

                    const pEstourado = veicsProp.filter(v =>
                      v.limite_cartao > 0 && (usoPorPlaca[v.placa] || 0) >= v.limite_cartao).length;
                    const pAtencao = veicsProp.filter(v => {
                      if (!v.limite_cartao) return false;
                      const pct = (usoPorPlaca[v.placa] || 0) / v.limite_cartao;
                      return pct >= 0.7 && pct < 1;
                    }).length;

                    const subHeaderBg =
                      pEstourado > 0 ? 'bg-red-50/60 dark:bg-red-900/10 border-b border-red-100 dark:border-red-800/20' :
                      pAtencao > 0  ? 'bg-amber-50/60 dark:bg-amber-900/10 border-b border-amber-100 dark:border-amber-800/20' :
                                      'bg-gray-50/60 dark:bg-gray-900/20 border-b border-gray-100 dark:border-gray-800/30';

                    return (
                      <div key={keyProp}>
                        {/* Sub-header proprietário */}
                        <button
                          onClick={() => toggleGrupo(keyProp)}
                          className={`w-full flex items-center justify-between px-8 py-3 ${subHeaderBg} hover:brightness-95 transition-all`}
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <BuildingOfficeIcon className="w-4 h-4 text-indigo-400 shrink-0" />
                            <span className="text-sm font-black text-gray-700 dark:text-gray-200 uppercase tracking-wider">{prop}</span>
                            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full">
                              {veicsProp.length} veíc.
                            </span>
                            {pEstourado > 0 && (
                              <span className="text-[9px] font-black text-red-600 bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded-full">
                                🔴 {pEstourado}
                              </span>
                            )}
                            {pAtencao > 0 && (
                              <span className="text-[9px] font-black text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-full">
                                🟡 {pAtencao}
                              </span>
                            )}
                          </div>
                          {isPropOpen
                            ? <ChevronUpIcon className="w-4 h-4 text-gray-400 shrink-0" />
                            : <ChevronDownIcon className="w-4 h-4 text-gray-400 shrink-0" />}
                        </button>

                        {/* Cards dos veículos */}
                        {isPropOpen && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4 bg-white/20 dark:bg-gray-900/10">
                            {veicsProp.map(v => {
                              const usado = usoPorPlaca[String(v.placa || '').toUpperCase()] || 0;
                              const limite = Number(v.limite_cartao) || 0;
                              const pct = limite > 0 ? (usado / limite) * 100 : -1;
                              const cardBorder =
                                pct >= 100 ? 'border-red-300 dark:border-red-700/50' :
                                pct >= 70  ? 'border-amber-300 dark:border-amber-700/50' :
                                             'border-gray-100 dark:border-gray-700/50';

                              return (
                                <div key={v.id}
                                  className={`bg-white dark:bg-gray-900 border ${cardBorder} rounded-2xl p-5 flex flex-col justify-between transition-all duration-300 hover:shadow-lg`}>

                                  <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1 min-w-0">
                                      <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-widest leading-none mb-1">
                                        {v.placa}
                                      </h3>
                                      <p className="text-[11px] font-bold text-gray-400 uppercase truncate">
                                        {v.subprojeto || 'SEM BASE'}
                                      </p>
                                    </div>
                                    <button
                                      onClick={() => handleArchivar(v.id, v.placa)}
                                      className="p-2 text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-xl transition-all"
                                      title="Arquivar veículo"
                                    >
                                      <ArchiveBoxIcon className="w-4 h-4" />
                                    </button>
                                  </div>

                                  <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-tighter ml-1">Status</label>
                                    <select
                                      value={v.status || 'Ativo'}
                                      onChange={e => handleUpdateStatus(v.id, e.target.value)}
                                      className={`w-full px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest border-0 focus:ring-2 focus:ring-blue-500 cursor-pointer ${
                                        v.status === 'Ativo' ? 'bg-green-100 text-green-700' :
                                        v.status === 'Em Manutenção' ? 'bg-amber-100 text-amber-700' :
                                        v.status === 'Desmobilizado' ? 'bg-gray-200 text-gray-500' :
                                        'bg-red-100 text-red-700'
                                      }`}
                                    >
                                      <option value="Ativo" className="bg-white">✅ Ativo / Em Serviço</option>
                                      <option value="Em Manutenção" className="bg-white">🛠 Em Manutenção</option>
                                      <option value="Desmobilizado" className="bg-white">⬛ Desmobilizado</option>
                                      <option value="Fora de Serviço" className="bg-white">🚫 Fora de Serviço</option>
                                    </select>
                                  </div>

                                  <LimitBar limite={limite} usado={usado} />
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
