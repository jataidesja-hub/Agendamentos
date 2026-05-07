"use client";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { ChevronDownIcon, ChevronRightIcon, TruckIcon } from "@heroicons/react/24/outline";

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface Abastecimento {
  placa: string;
  data_transacao: string;
  km_rodados: number;
  km_litro: number;
  litros: number;
  hodometro_horimetro: number;
}

interface Veiculo {
  placa: string;
  projeto: string;
  modelo_veiculo?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function mesAno(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function mesLabel(key: string) {
  const [y, m] = key.split("-");
  return `${MESES[parseInt(m) - 1]}/${y.slice(2)}`;
}

function fmt(n: number, dec = 0) {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

// ── Componente de linha de placa ───────────────────────────────────────────────

function PlacaRow({ placa, abasts, modelo }: { placa: string; abasts: Abastecimento[]; modelo?: string }) {
  const [expandido, setExpandido] = useState(false);

  const kmAtual = useMemo(() => {
    const ordenados = [...abasts].sort((a, b) =>
      new Date(b.data_transacao).getTime() - new Date(a.data_transacao).getTime()
    );
    return ordenados[0]?.hodometro_horimetro ?? 0;
  }, [abasts]);

  const hoje = new Date();
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;

  const kmMesAtual = useMemo(() =>
    abasts.filter(a => mesAno(a.data_transacao) === mesAtual).reduce((s, a) => s + (a.km_rodados || 0), 0),
    [abasts, mesAtual]
  );

  const mediaKmL = useMemo(() => {
    const validos = abasts.filter(a => a.km_litro > 0);
    if (!validos.length) return 0;
    return validos.reduce((s, a) => s + a.km_litro, 0) / validos.length;
  }, [abasts]);

  // Últimos 6 meses com dados
  const historicoMeses = useMemo(() => {
    const porMes: Record<string, { km: number; litros: number; abasts: number }> = {};
    abasts.forEach(a => {
      const key = mesAno(a.data_transacao);
      if (!porMes[key]) porMes[key] = { km: 0, litros: 0, abasts: 0 };
      porMes[key].km += a.km_rodados || 0;
      porMes[key].litros += a.litros || 0;
      porMes[key].abasts += 1;
    });
    return Object.entries(porMes)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 6)
      .reverse();
  }, [abasts]);

  const maxKm = useMemo(() => Math.max(...historicoMeses.map(([, v]) => v.km), 1), [historicoMeses]);

  return (
    <div className="border border-gray-100 dark:border-gray-700/50 rounded-2xl overflow-hidden">
      {/* Header da placa */}
      <button
        onClick={() => setExpandido(e => !e)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-white/60 dark:bg-gray-800/60 hover:bg-white/90 dark:hover:bg-gray-800/90 transition-colors text-left"
      >
        <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-700/80 flex items-center justify-center shrink-0">
          <TruckIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-black text-gray-900 dark:text-white text-sm tracking-widest">{placa}</span>
            {modelo && <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium truncate">{modelo}</span>}
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              KM atual: <span className="font-bold text-gray-700 dark:text-gray-300">{fmt(kmAtual)}</span>
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Este mês: <span className="font-bold text-[#0b7336] dark:text-green-400">{fmt(kmMesAtual)} km</span>
            </span>
          </div>
        </div>
        <div className="shrink-0 text-gray-400">
          {expandido ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />}
        </div>
      </button>

      {/* Detalhes expandidos */}
      {expandido && (
        <div className="px-4 pb-4 pt-3 bg-gray-50/80 dark:bg-gray-900/40 space-y-4 border-t border-gray-100 dark:border-gray-700/50">

          {/* Cards de resumo */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white dark:bg-gray-800/80 rounded-xl p-2.5 text-center border border-gray-100 dark:border-gray-700/50">
              <p className="text-[10px] font-bold text-gray-400 uppercase">KM Atual</p>
              <p className="text-base font-black text-gray-800 dark:text-white mt-0.5">{fmt(kmAtual)}</p>
            </div>
            <div className="bg-white dark:bg-gray-800/80 rounded-xl p-2.5 text-center border border-gray-100 dark:border-gray-700/50">
              <p className="text-[10px] font-bold text-gray-400 uppercase">Este Mês</p>
              <p className="text-base font-black text-[#0b7336] dark:text-green-400 mt-0.5">{fmt(kmMesAtual)}</p>
            </div>
            <div className="bg-white dark:bg-gray-800/80 rounded-xl p-2.5 text-center border border-gray-100 dark:border-gray-700/50">
              <p className="text-[10px] font-bold text-gray-400 uppercase">Média KM/L</p>
              <p className="text-base font-black text-blue-600 dark:text-blue-400 mt-0.5">{fmt(mediaKmL, 1)}</p>
            </div>
          </div>

          {/* Histórico mensal */}
          {historicoMeses.length > 0 && (
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2">KM por Mês</p>
              <div className="space-y-2">
                {historicoMeses.map(([key, val]) => (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-gray-600 dark:text-gray-400">{mesLabel(key)}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-gray-800 dark:text-white">{fmt(val.km)} km</span>
                        <span className="text-[10px] text-gray-400">{fmt(val.litros, 1)} L</span>
                        <span className="text-[10px] text-blue-500">
                          {val.litros > 0 ? fmt(val.km / val.litros, 1) : "—"} km/L
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#0b7336] rounded-full transition-all duration-500"
                        style={{ width: `${(val.km / maxKm) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {abasts.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-2">Sem registros de abastecimento</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Componente de projeto ──────────────────────────────────────────────────────

function ProjetoCard({
  projeto,
  veiculos,
  abastPorPlaca,
}: {
  projeto: string;
  veiculos: Veiculo[];
  abastPorPlaca: Record<string, Abastecimento[]>;
}) {
  const [expandido, setExpandido] = useState(false);

  const hoje = new Date();
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;

  const stats = useMemo(() => {
    let kmMes = 0, kmTotal = 0, litrosMes = 0, kmLSoma = 0, kmLCount = 0;
    veiculos.forEach(v => {
      const abasts = abastPorPlaca[v.placa] || [];
      abasts.forEach(a => {
        if (mesAno(a.data_transacao) === mesAtual) {
          kmMes += a.km_rodados || 0;
          litrosMes += a.litros || 0;
        }
        kmTotal += a.km_rodados || 0;
        if (a.km_litro > 0) { kmLSoma += a.km_litro; kmLCount++; }
      });
    });
    return {
      kmMes,
      litrosMes,
      mediaKmL: kmLCount > 0 ? kmLSoma / kmLCount : 0,
      totalVeiculos: veiculos.length,
      veiculosAtivosNoMes: veiculos.filter(v => (abastPorPlaca[v.placa] || []).some(a => mesAno(a.data_transacao) === mesAtual)).length,
    };
  }, [veiculos, abastPorPlaca, mesAtual]);

  return (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur border border-gray-200/50 dark:border-gray-700/50 rounded-2xl overflow-hidden shadow-sm">
      {/* Header do projeto */}
      <button
        onClick={() => setExpandido(e => !e)}
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/90 dark:hover:bg-gray-800/90 transition-colors text-left"
      >
        <div className="w-10 h-10 rounded-xl bg-[#0b7336]/10 dark:bg-[#0b7336]/20 flex items-center justify-center shrink-0">
          <span className="text-lg">🏗️</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-gray-900 dark:text-white text-base truncate">{projeto || "Sem Projeto"}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {stats.totalVeiculos} veículo{stats.totalVeiculos !== 1 ? "s" : ""}
            {stats.veiculosAtivosNoMes > 0 && ` · ${stats.veiculosAtivosNoMes} com abast. este mês`}
          </p>
        </div>
        {expandido ? (
          <ChevronDownIcon className="w-5 h-5 text-gray-400 shrink-0" />
        ) : (
          <ChevronRightIcon className="w-5 h-5 text-gray-400 shrink-0" />
        )}
      </button>

      {/* Resumo rápido (sempre visível) */}
      <div className="px-5 pb-4 grid grid-cols-3 gap-2 border-t border-gray-100 dark:border-gray-700/30 pt-3">
        <div className="text-center">
          <p className="text-[10px] font-bold text-gray-400 uppercase">KM este mês</p>
          <p className="text-lg font-black text-[#0b7336] dark:text-green-400 mt-0.5">{fmt(stats.kmMes)}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-bold text-gray-400 uppercase">Litros/mês</p>
          <p className="text-lg font-black text-amber-600 dark:text-amber-400 mt-0.5">{fmt(stats.litrosMes, 0)}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-bold text-gray-400 uppercase">Média KM/L</p>
          <p className="text-lg font-black text-blue-600 dark:text-blue-400 mt-0.5">{fmt(stats.mediaKmL, 1)}</p>
        </div>
      </div>

      {/* Lista de placas */}
      {expandido && (
        <div className="px-4 pb-4 space-y-2 border-t border-gray-100 dark:border-gray-700/30 pt-3">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider px-1 mb-3">
            Veículos — toque para expandir
          </p>
          {veiculos
            .sort((a, b) => a.placa.localeCompare(b.placa))
            .map(v => (
              <PlacaRow
                key={v.placa}
                placa={v.placa}
                abasts={abastPorPlaca[v.placa] || []}
                modelo={v.modelo_veiculo}
              />
            ))}
        </div>
      )}
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────────

export default function KmPage() {
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [abastecimentos, setAbastecimentos] = useState<Abastecimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [mesFiltro, setMesFiltro] = useState("todos");

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);

    // Busca frota para enriquecimento (projeto/modelo)
    const { data: frota } = await supabase
      .from("frota_veiculos")
      .select("placa, projeto, modelo_veiculo");

    const frotaMap: Record<string, { projeto: string; modelo_veiculo?: string }> = {};
    (frota || []).forEach((v: any) => {
      const p = v.placa?.toString().replace(/[^a-zA-Z0-9]/g, "").toUpperCase().trim();
      if (p) frotaMap[p] = { projeto: v.projeto || "", modelo_veiculo: v.modelo_veiculo };
    });

    // Busca todos os abastecimentos com paginação
    const allAbasts: Abastecimento[] = [];
    const PAGE = 1000;
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("abastecimentos")
        .select("placa, data_transacao, km_rodados, km_litro, litros, hodometro_horimetro")
        .order("data_transacao", { ascending: false })
        .range(from, from + PAGE - 1);
      if (error || !data || data.length === 0) break;
      allAbasts.push(...(data as Abastecimento[]));
      if (data.length < PAGE) break;
      from += PAGE;
    }

    // Deriva lista de veículos a partir das placas presentes nos abastecimentos
    const placasVistas = new Set<string>();
    const veiculosDerived: Veiculo[] = [];
    allAbasts.forEach(a => {
      const p = a.placa?.toString().replace(/[^a-zA-Z0-9]/g, "").toUpperCase().trim();
      if (!p || placasVistas.has(p)) return;
      placasVistas.add(p);
      const enrich = frotaMap[p];
      veiculosDerived.push({
        placa: p,
        projeto: enrich?.projeto || "",
        modelo_veiculo: enrich?.modelo_veiculo,
      });
    });
    veiculosDerived.sort((a, b) => a.placa.localeCompare(b.placa));

    setVeiculos(veiculosDerived);
    setAbastecimentos(allAbasts);
    setLoading(false);
  };

  // Abastecimentos indexados por placa
  const abastPorPlaca = useMemo(() => {
    const map: Record<string, Abastecimento[]> = {};
    abastecimentos.forEach(a => {
      const p = a.placa?.toString().replace(/[^a-zA-Z0-9]/g, "").toUpperCase().trim();
      if (!p) return;
      if (!map[p]) map[p] = [];
      map[p].push(a);
    });
    return map;
  }, [abastecimentos]);

  // Veículos normalizando placa
  const veiculosNorm = useMemo(() =>
    veiculos.map(v => ({
      ...v,
      placa: v.placa?.toString().replace(/[^a-zA-Z0-9]/g, "").toUpperCase().trim() || v.placa,
    })),
    [veiculos]
  );

  // Projetos únicos
  const projetos = useMemo(() => {
    const set = new Set(veiculosNorm.map(v => v.projeto || "Sem Projeto"));
    return Array.from(set).sort();
  }, [veiculosNorm]);

  // Meses disponíveis para filtro
  const mesesDisponiveis = useMemo(() => {
    const set = new Set(abastecimentos.map(a => mesAno(a.data_transacao)));
    return Array.from(set).sort((a, b) => b.localeCompare(a)).slice(0, 12);
  }, [abastecimentos]);

  // Filtra abastecimentos por mês
  const abastFiltrado = useMemo(() => {
    if (mesFiltro === "todos") return abastPorPlaca;
    const map: Record<string, Abastecimento[]> = {};
    Object.entries(abastPorPlaca).forEach(([placa, list]) => {
      const filtrado = list.filter(a => mesAno(a.data_transacao) === mesFiltro);
      if (filtrado.length) map[placa] = filtrado;
    });
    return map;
  }, [abastPorPlaca, mesFiltro]);

  // Filtra projetos por search
  const projetosFiltrados = useMemo(() => {
    const q = search.toLowerCase();
    return projetos.filter(p => {
      if (p.toLowerCase().includes(q)) return true;
      const veics = veiculosNorm.filter(v => (v.projeto || "Sem Projeto") === p);
      return veics.some(v => v.placa.toLowerCase().includes(q));
    });
  }, [projetos, search, veiculosNorm]);

  // Totais globais
  const totais = useMemo(() => {
    const hoje = new Date();
    const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
    let kmMes = 0, veiculosComAbast = 0;
    veiculosNorm.forEach(v => {
      const abasts = abastPorPlaca[v.placa] || [];
      const kmV = abasts.filter(a => mesAno(a.data_transacao) === mesAtual).reduce((s, a) => s + (a.km_rodados || 0), 0);
      if (kmV > 0) veiculosComAbast++;
      kmMes += kmV;
    });
    return { kmMes, veiculosComAbast, totalVeiculos: veiculos.length, totalProjetos: projetos.length };
  }, [veiculosNorm, abastPorPlaca, projetos]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white">Relatório de KM</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Desempenho por projeto e veículo</p>
      </div>

      {/* Cards de totais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "KM este mês", value: fmt(totais.kmMes), color: "text-[#0b7336] dark:text-green-400", bg: "bg-green-50 dark:bg-green-900/20" },
          { label: "Projetos", value: String(totais.totalProjetos), color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/20" },
          { label: "Total Veículos", value: String(totais.totalVeiculos), color: "text-gray-700 dark:text-gray-300", bg: "bg-gray-50 dark:bg-gray-800/50" },
          { label: "Com abast./mês", value: String(totais.veiculosComAbast), color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20" },
        ].map(c => (
          <div key={c.label} className={`${c.bg} rounded-2xl p-4 border border-transparent`}>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{c.label}</p>
            <p className={`text-2xl font-black mt-1 ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Buscar por projeto ou placa..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 px-4 py-3 bg-white/70 dark:bg-gray-800/70 backdrop-blur border border-gray-200 dark:border-gray-700 rounded-2xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0b7336] text-sm"
        />
        <select
          value={mesFiltro}
          onChange={e => setMesFiltro(e.target.value)}
          className="px-4 py-3 bg-white/70 dark:bg-gray-800/70 backdrop-blur border border-gray-200 dark:border-gray-700 rounded-2xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0b7336] text-sm min-w-[160px]"
        >
          <option value="todos">Todos os meses</option>
          {mesesDisponiveis.map(m => (
            <option key={m} value={m}>{mesLabel(m)}</option>
          ))}
        </select>
      </div>

      {/* Lista de projetos */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#0b7336] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : projetosFiltrados.length === 0 ? (
        <div className="text-center py-16 text-gray-400">Nenhum projeto encontrado</div>
      ) : (
        <div className="space-y-4">
          {projetosFiltrados.map(projeto => {
            const veicsDoProj = veiculosNorm.filter(v => (v.projeto || "Sem Projeto") === projeto);
            return (
              <ProjetoCard
                key={projeto}
                projeto={projeto}
                veiculos={veicsDoProj}
                abastPorPlaca={mesFiltro === "todos" ? abastPorPlaca : abastFiltrado}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
