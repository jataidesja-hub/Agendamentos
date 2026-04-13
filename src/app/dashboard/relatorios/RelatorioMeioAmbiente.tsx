"use client";

import React, { useMemo, useState, useEffect } from 'react';
import { 
  GlobeAmericasIcon, 
  CloudIcon, 
  ScaleIcon,
  TruckIcon,
  CloudArrowDownIcon,
  PresentationChartLineIcon,
  FunnelIcon,
  BuildingOffice2Icon,
  ArrowTrendingUpIcon,
  TrophyIcon,
  BeakerIcon,
  WrenchScrewdriverIcon,
  DeviceTabletIcon
} from '@heroicons/react/24/outline';
import { supabase } from '@/lib/supabase';
import { dataCache } from '@/lib/cache';
import { toast } from 'react-hot-toast';

const RelatorioMeioAmbiente = () => {
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedProject, setSelectedProject] = useState('TODOS');
  const [selectedBase, setSelectedBase] = useState('TODOS');
  const [loading, setLoading] = useState(!dataCache.abastecimentos);
  const [loadingStep, setLoadingStep] = useState('Iniciando análise...');
  const [progress, setProgress] = useState(0);
  const [abastecimentos, setAbastecimentos] = useState<any[]>(dataCache.abastecimentos || []);
  const [veiculosAtivos, setVeiculosAtivos] = useState<Set<string>>(dataCache.veiculosAtivos || new Set());

  useEffect(() => {
    if (!dataCache.abastecimentos || !dataCache.veiculosAtivos) {
      loadFromSupabase();
    } else {
      // Se já existem no cache, garante que o estado local esteja sincronizado
      setAbastecimentos(dataCache.abastecimentos);
      setVeiculosAtivos(dataCache.veiculosAtivos);
      setLoading(false);
    }
  }, []);

  const loadFromSupabase = async () => {
    setLoading(true);
    try {
      // 1. Busca frota com seus respectivos projetos e bases
      setLoadingStep('Mapeando Estrutura de Projetos e Bases...');
      setProgress(10);
      const { data: frota } = await supabase.from('frota_veiculos').select('placa, projeto, subprojeto').eq('status', 'Ativo');
      const normalize = (p: string) => p?.toString().replace(/[^a-zA-Z0-9]/g, '').toUpperCase().trim() || "";
      
      const placaToProject = new Map<string, string>();
      const placaToSubproject = new Map<string, string>();
      const projectStructure: Record<string, Set<string>> = {};

      if (frota) {
        const setAtivos = new Set<string>();
        frota.forEach(v => {
          const normPlaca = normalize(v.placa);
          const proj = v.projeto?.toUpperCase().trim() || "SEM PROJETO";
          const sub = v.subprojeto?.toUpperCase().trim() || "";

          setAtivos.add(normPlaca);
          placaToProject.set(normPlaca, proj);
          if (sub) placaToSubproject.set(normPlaca, sub);

          if (!projectStructure[proj]) projectStructure[proj] = new Set();
          if (sub) projectStructure[proj].add(sub);
        });
        setVeiculosAtivos(setAtivos);
        // @ts-ignore
        dataCache.placaToProject = placaToProject;
        // @ts-ignore
        dataCache.placaToSubproject = placaToSubproject;
        // @ts-ignore
        dataCache.projectStructure = projectStructure;
        dataCache.veiculosAtivos = setAtivos;
      }
      setProgress(30);

      // 2. Busca total estimado para progresso
      setLoadingStep('Sincronizando Base de Emissões...');
      const { count } = await supabase.from('abastecimentos').select('*', { count: 'exact', head: true });
      const totalExpected = count || 1;

      // 3. Busca exaustiva de abastecimentos
      let allData: any[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const currentProgress = Math.min(30 + Math.floor((allData.length / totalExpected) * 60), 90);
        setProgress(currentProgress);
        setLoadingStep(`Sincronizando Registros... (${allData.length} detectados)`);

        const { data: chunk, error } = await supabase
          .from('abastecimentos')
          .select('*')
          .order('data_transacao', { ascending: false })
          .range(from, from + 999);

        if (error) throw error;
        if (!chunk || chunk.length === 0) {
          hasMore = false;
        } else {
          allData = [...allData, ...chunk];
          if (chunk.length < 1000) {
            hasMore = false;
          } else {
            from += 1000;
          }
        }
        if (allData.length > 50000) break;
      }
      
      setProgress(95);
      setLoadingStep('Processando Inventário de Carbono...');
      setAbastecimentos(allData);
      dataCache.abastecimentos = allData;
      setProgress(100);

    } catch (err: any) {
      console.error("Erro ao carregar dados:", err);
      toast.error("Erro ao carregar dados de sustentabilidade.");
    } finally {
      setTimeout(() => setLoading(false), 500); // Suave transição
    }
  };

  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    abastecimentos.forEach((a: any) => {
      if (a.data_transacao) {
        const dateStr = String(a.data_transacao);
        if (dateStr.includes('-')) monthsSet.add(dateStr.slice(0, 7));
      }
    });
    return Array.from(monthsSet).sort().reverse();
  }, [abastecimentos]);

  const availableProjects = useMemo(() => {
    // @ts-ignore
    const projectStructure = dataCache.projectStructure || {};
    return ['TODOS', ...Object.keys(projectStructure).sort()];
  }, [abastecimentos, veiculosAtivos]);

  const availableBases = useMemo(() => {
    if (selectedProject === 'TODOS') return [];
    // @ts-ignore
    const projectStructure = dataCache.projectStructure || {};
    const Bases = projectStructure[selectedProject];
    if (!Bases || Bases.size === 0) return [];
    return ['TODOS', ...Array.from(Bases).sort()];
  }, [selectedProject, veiculosAtivos]);

  useEffect(() => {
    setSelectedBase('TODOS');
  }, [selectedProject]);

  useEffect(() => {
    if (!selectedMonth && availableMonths.length > 0) {
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths, selectedMonth]);

  const processedData = useMemo(() => {
    const normalize = (p: string) => p?.toString().replace(/[^a-zA-Z0-9]/g, '').toUpperCase().trim() || "";
    // @ts-ignore
    const placaToProject = dataCache.placaToProject || new Map();
    // @ts-ignore
    const placaToSubproject = dataCache.placaToSubproject || new Map();

    const filtered = abastecimentos.filter((a: any) => {
      if (!a.data_transacao || !selectedMonth) return false;
      
      const normPlaca = normalize(a.placa);
      const proj = String(a.projeto || placaToProject.get(normPlaca) || "SEM PROJETO").toUpperCase().trim();
      const base = String(a.subprojeto || placaToSubproject.get(normPlaca) || "").toUpperCase().trim();

      // Filtro de Projeto
      if (selectedProject !== 'TODOS') {
        if (proj !== selectedProject) return false;
        
        // Filtro de Base (Subprojeto)
        if (selectedBase !== 'TODOS') {
          if (base !== selectedBase) return false;
        }
      }

      // Filtro de Frota Ativa
      if (veiculosAtivos.size > 0) {
        if (!veiculosAtivos.has(normPlaca)) return false;
      }

      return String(a.data_transacao).slice(0, 7) === selectedMonth;
    });

    let totalCO2 = 0;
    let totalLiters = 0;
    let totalKm = 0;
    const projectStats: any = {};
    const baseStats: any = {};
    const fuelStats: any = {};
    const assetStats: any = {
      'VEÍCULOS': { co2: 0, liters: 0, count: 0 },
      'GERADORES': { co2: 0, liters: 0, count: 0 }
    };

    filtered.forEach((a: any) => {
      const litros = Number(a.litros) || 0;
      const km = Number(a.km_rodados_horas || a.km_rodados) || 0;
      const fuelRaw = String(a.tipo_combustivel || "OUTROS").toUpperCase().trim();
      const normPlaca = normalize(a.placa);
      const project = String(a.projeto || placaToProject.get(normPlaca) || "SEM PROJETO").toUpperCase().trim();
      const base = String(a.subprojeto || placaToSubproject.get(normPlaca) || "SEM BASE").toUpperCase().trim();
      const vehicleType = String(a.tipo_frota || a.modelo_veiculo || "").toUpperCase();
      const plate = String(a.placa || "").toUpperCase();

      let recordCO2 = 0;

      // Cálculo de emissão
      if (fuelRaw.includes("GASOLINA")) {
        recordCO2 = litros * 2.27;
      } else if (fuelRaw.includes("DIESEL")) {
        recordCO2 = litros * 2.68;
      } else if (fuelRaw.includes("ETANOL")) {
        recordCO2 = litros * 0.45;
      } else if (litros === 0 && km > 0) {
        let kmFactor = 0.314;
        if (vehicleType.includes("CAMINHONETE") || vehicleType.includes("PICKUP")) {
          kmFactor = 0.461;
        } else if (vehicleType.includes("MOTO")) {
          kmFactor = 0.212;
        }
        recordCO2 = km * kmFactor;
      } else if (litros > 0) {
        recordCO2 = litros * 2.3;
      }

      totalCO2 += recordCO2;
      totalLiters += litros;
      totalKm += km;

      // Identificação VEÍCULO vs GERADOR
      const modelo = String(a.modelo_veiculo || "").toUpperCase();
      const frota = String(a.tipo_frota || "").toUpperCase();
      const placaStr = String(a.placa || "").toUpperCase();
      const servicoStr = String(a.servico || "").toUpperCase();

      const isGenerator = modelo.includes("GERADOR") || 
                          frota.includes("GERADOR") || 
                          placaStr.includes("GERADOR") || 
                          placaStr.includes("GEN") || 
                          servicoStr.includes("GERADOR");

      const assetCategory = isGenerator ? 'GERADORES' : 'VEÍCULOS';
      
      assetStats[assetCategory].co2 += recordCO2;
      assetStats[assetCategory].liters += litros;
      assetStats[assetCategory].count += 1;

      // Agrupamento por combustível
      if (!fuelStats[fuelRaw]) {
        fuelStats[fuelRaw] = { co2: 0, liters: 0 };
      }
      fuelStats[fuelRaw].co2 += recordCO2;
      fuelStats[fuelRaw].liters += litros;

      // Agrupamento por projeto
      if (!projectStats[project]) {
        projectStats[project] = { name: project, co2: 0, liters: 0, km: 0 };
      }
      projectStats[project].co2 += recordCO2;
      projectStats[project].liters += litros;
      projectStats[project].km += km;

      // Agrupamento por base
      if (!baseStats[base]) {
        baseStats[base] = { name: base, co2: 0, liters: 0, km: 0 };
      }
      baseStats[base].co2 += recordCO2;
      baseStats[base].liters += litros;
      baseStats[base].km += km;
    });

    const rankingData = selectedProject === 'TODOS' ? projectStats : baseStats;
    const rankingSorted = Object.values(rankingData)
      .sort((a: any, b: any) => b.co2 - a.co2)
      .slice(0, 10);

    const fuelRanking = Object.entries(fuelStats)
      .map(([name, stats]: [string, any]) => ({
        name,
        co2: stats.co2,
        liters: stats.liters,
        percentage: (stats.co2 / (totalCO2 || 1)) * 100
      }))
      .sort((a, b) => b.co2 - a.co2);

    const maxExp = Math.max(...rankingSorted.map((d: any) => d.co2), 1);

    return {
      totalCO2,
      totalLiters,
      totalKm,
      ranking: rankingSorted.map((d: any) => ({ ...d, barScale: (d.co2 / maxExp) * 100 })),
      fuelRanking,
      assetStats,
      totalRecords: filtered.length
    };
  }, [abastecimentos, selectedMonth, selectedProject, veiculosAtivos]);

  const treeOffset = Math.ceil(processedData.totalCO2 / 15);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-40 animate-in fade-in duration-500">
        <div className="relative group mb-12">
            {/* outer glow */}
            <div className="absolute -inset-8 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" />
            
            {/* background circle with rotating border */}
            <div className="w-32 h-32 rounded-full border-4 border-emerald-500/10 flex items-center justify-center relative">
               <div className="absolute inset-0 border-t-4 border-emerald-500 rounded-full animate-spin" />
               <GlobeAmericasIcon className="w-14 h-14 text-emerald-500 animate-pulse" />
            </div>
        </div>

        <div className="max-w-xs w-full space-y-4 text-center">
            <h3 className="font-black text-gray-900 dark:text-white uppercase italic tracking-tighter text-lg">Sincronizando Eco-Dados</h3>
            
            <div className="h-1.5 w-full bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden border border-gray-200 dark:border-white/10">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
            </div>

            <div className="flex justify-between items-center px-1">
                <p className="font-bold text-gray-400 text-[10px] uppercase tracking-widest">{loadingStep}</p>
                <p className="font-black text-emerald-500 text-[10px]">{progress}%</p>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Header Info */}
      <div className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-2xl p-8 rounded-[3.5rem] shadow-xl flex flex-col md:flex-row justify-between items-center gap-6 border border-white dark:border-white/5">
        <div className="flex items-center gap-6">
           <div className="w-16 h-16 bg-gradient-to-tr from-emerald-500 to-green-400 rounded-3xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <GlobeAmericasIcon className="w-9 h-9 text-white" />
           </div>
           <div>
              <h2 className="text-3xl font-black text-gray-900 dark:text-white italic tracking-tighter uppercase">Gestão de Carbono</h2>
              <p className="text-emerald-500 font-bold text-[10px] uppercase tracking-[0.2em] mt-1">Sustentabilidade Operacional CYMI</p>
           </div>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-4">
          {/* Project Filter */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-emerald-500 rounded-2xl blur opacity-10 group-hover:opacity-30 transition duration-1000"></div>
            <div className="relative flex items-center px-6 py-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-white/10 group-hover:border-blue-500 transition-all cursor-pointer">
              <BuildingOffice2Icon className="w-4 h-4 text-blue-500 mr-3 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Projeto</span>
                <select 
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  className="bg-transparent text-gray-900 dark:text-white font-black text-[10px] outline-none uppercase tracking-widest cursor-pointer max-w-[150px]"
                >
                  {availableProjects.map(p => (
                    <option key={p} value={p} className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Subproject (Base) Filter - Conditional */}
          {availableBases.length > 0 && (
            <div className="relative group animate-in slide-in-from-left duration-300">
              <div className="absolute -inset-1 bg-gradient-to-r from-purple-500 to-blue-500 rounded-2xl blur opacity-10 group-hover:opacity-30 transition duration-1000"></div>
              <div className="relative flex items-center px-6 py-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-white/10 group-hover:border-purple-500 transition-all cursor-pointer">
                <BuildingOffice2Icon className="w-4 h-4 text-purple-500 mr-3 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Base</span>
                  <select 
                    value={selectedBase}
                    onChange={(e) => setSelectedBase(e.target.value)}
                    className="bg-transparent text-gray-900 dark:text-white font-black text-[10px] outline-none uppercase tracking-widest cursor-pointer max-w-[150px]"
                  >
                    {availableBases.map(b => (
                      <option key={b} value={b} className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Month Filter */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-blue-500 rounded-2xl blur opacity-10 group-hover:opacity-30 transition duration-1000"></div>
            <div className="relative flex items-center px-6 py-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-white/10 group-hover:border-emerald-500 transition-all cursor-pointer">
              <FunnelIcon className="w-4 h-4 text-emerald-500 mr-3" />
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Mês Ref.</span>
                <select 
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-transparent text-gray-900 dark:text-white font-black text-[10px] outline-none uppercase tracking-widest cursor-pointer"
                >
                  {availableMonths.map(m => (
                    <option key={m} value={m} className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
                      {new Date(m + "-02").toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '')}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gray-900 p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden group border border-white/10">
           <div className="absolute -right-6 -top-6 w-32 h-32 bg-emerald-500/20 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000" />
           <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em] mb-4">Total Emitido</p>
           <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black tracking-tighter">{(processedData.totalCO2 / 1000).toFixed(2)}</span>
              <span className="text-lg font-bold text-gray-400">ton CO₂</span>
           </div>
           <div className="mt-8 flex items-center gap-2 bg-white/5 py-2 px-4 rounded-xl border border-white/5 w-fit">
              <CloudIcon className="w-4 h-4 text-emerald-500" />
              <span className="text-[10px] font-bold text-gray-400">Baseado em {processedData.totalRecords} registros</span>
           </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl transition-all">
           <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center mb-6">
              <ArrowTrendingUpIcon className="w-6 h-6 text-emerald-600" />
           </div>
           <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Neutralização</p>
           <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter">{treeOffset}</span>
              <span className="text-sm font-bold text-emerald-600 uppercase">Árvores</span>
           </div>
           <p className="text-[10px] text-gray-400 font-medium mt-4 leading-relaxed">Volume de plantio necessário para neutralizar este período.</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl transition-all">
           <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center mb-6">
              <TruckIcon className="w-6 h-6 text-blue-600" />
           </div>
           <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Pegada de Carbono</p>
           <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter">
                {(processedData.totalCO2 / (processedData.totalKm || 1)).toFixed(3)}
              </span>
              <span className="text-sm font-bold text-blue-600 uppercase">kg/km</span>
           </div>
           <p className="text-[10px] text-gray-400 font-medium mt-4 leading-relaxed">Média de emissão por quilômetro rodado pela frota.</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl transition-all">
           <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/20 rounded-2xl flex items-center justify-center mb-6">
              <CloudArrowDownIcon className="w-6 h-6 text-amber-600" />
           </div>
           <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Combustível Total</p>
           <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter">{processedData.totalLiters.toLocaleString('pt-BR')}</span>
              <span className="text-sm font-bold text-amber-600 uppercase">Litros</span>
           </div>
           <p className="text-[10px] text-gray-400 font-medium mt-4 leading-relaxed">Soma de todos os abastecimentos do período selecionado.</p>
        </div>
      </div>

      {/* Asset Type Distribution - NEW SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-10 rounded-[3.5rem] text-white shadow-2xl relative overflow-hidden flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-6 border border-white/10">
              <TruckIcon className="w-10 h-10 text-emerald-400" />
            </div>
            <h3 className="text-xl font-black uppercase italic tracking-widest mb-2">Emissões de Veículos</h3>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-4xl font-black tracking-tighter text-emerald-400">{(processedData.assetStats['VEÍCULOS'].co2 / 1000).toFixed(2)}</span>
              <span className="text-sm font-bold text-gray-400">ton CO₂</span>
            </div>
            <div className="flex gap-6 mt-4">
               <div className="bg-white/5 px-4 py-2 rounded-2xl border border-white/5">
                  <p className="text-[9px] font-black text-gray-500 uppercase">Litros</p>
                  <p className="text-sm font-black">{processedData.assetStats['VEÍCULOS'].liters.toLocaleString('pt-BR')} L</p>
               </div>
               <div className="bg-white/5 px-4 py-2 rounded-2xl border border-white/5">
                  <p className="text-[9px] font-black text-gray-500 uppercase">Ativos</p>
                  <p className="text-sm font-black">{processedData.assetStats['VEÍCULOS'].count}</p>
               </div>
            </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-10 rounded-[3.5rem] border border-gray-100 dark:border-gray-700 shadow-xl flex flex-col items-center justify-center text-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center mb-6 border border-blue-100 dark:border-blue-500/10">
              <WrenchScrewdriverIcon className="w-10 h-10 text-blue-600" />
            </div>
            <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase italic tracking-widest mb-2">Emissões de Geradores</h3>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-4xl font-black tracking-tighter text-blue-600">{(processedData.assetStats['GERADORES'].co2 / 1000).toFixed(2)}</span>
              <span className="text-sm font-bold text-gray-400">ton CO₂</span>
            </div>
            <div className="flex gap-6 mt-4">
               <div className="bg-gray-50 dark:bg-gray-900 px-4 py-2 rounded-2xl border border-gray-100 dark:border-white/5">
                  <p className="text-[9px] font-black text-gray-400 uppercase">Litros</p>
                  <p className="text-sm font-black text-gray-700 dark:text-gray-200">{processedData.assetStats['GERADORES'].liters.toLocaleString('pt-BR')} L</p>
               </div>
               <div className="bg-gray-50 dark:bg-gray-900 px-4 py-2 rounded-2xl border border-gray-100 dark:border-white/5">
                  <p className="text-[9px] font-black text-gray-400 uppercase">Ativos</p>
                  <p className="text-sm font-black text-gray-700 dark:text-gray-200">{processedData.assetStats['GERADORES'].count}</p>
               </div>
            </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Project Impact Ranking */}
         <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-10 rounded-[3.5rem] border border-gray-100 dark:border-gray-700 shadow-xl">
            <div className="flex justify-between items-center mb-10">
               <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center">
                     <TrophyIcon className="w-5 h-5 text-yellow-500" />
                  </div>
                  <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase italic tracking-tighter">
                    Impacto por {selectedProject === 'TODOS' ? 'Projeto' : 'Base'}
                  </h3>
               </div>
               <span className="text-[9px] font-black bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 px-4 py-1.5 rounded-full border border-gray-200 dark:border-white/10 uppercase tracking-widest">kg CO₂</span>
            </div>

            <div className="space-y-6">
               {processedData.ranking.length === 0 ? (
                 <div className="text-center py-20 text-gray-400 italic font-medium">Nenhum dado encontrado para o período.</div>
               ) : (
                 processedData.ranking.map((item: any, idx: number) => (
                   <div 
                     key={item.name} 
                     className="relative group cursor-pointer"
                     onClick={() => {
                       if (selectedProject === 'TODOS' && item.name !== 'SEM PROJETO') {
                         setSelectedProject(item.name);
                       } else if (selectedProject !== 'TODOS' && item.name !== 'SEM BASE') {
                         setSelectedBase(item.name);
                       }
                     }}
                   >
                     <div className="flex justify-between items-center mb-2 px-1">
                        <span className="text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-tight truncate max-w-[75%] group-hover:text-emerald-500 transition-colors">
                          {idx + 1}. {item.name}
                        </span>
                        <span className="text-xs font-black text-gray-900 dark:text-white">{item.co2.toFixed(1)}</span>
                     </div>
                     <div className="h-4 bg-gray-50 dark:bg-gray-900/50 rounded-full overflow-hidden border border-gray-100 dark:border-white/5">
                         <div 
                           className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-1000 ease-out group-hover:from-emerald-600 group-hover:to-emerald-500"
                           style={{ width: `${item.barScale}%` }}
                         />
                     </div>
                   </div>
                 ))
               )}
            </div>
         </div>

        {/* Emissions by Fuel Type */}
        <div className="bg-white dark:bg-gray-800 p-10 rounded-[3.5rem] border border-gray-100 dark:border-gray-700 shadow-xl flex flex-col">
           <div className="flex items-center gap-3 mb-10 border-b border-gray-50 dark:border-white/5 pb-6">
              <BeakerIcon className="w-6 h-6 text-emerald-500" />
              <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase italic tracking-tighter">Emissões por Combustível</h3>
           </div>
           
           <div className="flex-1 space-y-8">
              {processedData.fuelRanking.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 italic">
                   <p className="text-sm font-medium">Dados indisponíveis</p>
                </div>
              ) : (
                processedData.fuelRanking.map((item: any) => (
                  <div key={item.name} className="relative">
                    <div className="flex justify-between items-center mb-3">
                       <div>
                          <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">{item.name}</p>
                          <p className="text-xl font-black text-gray-900 dark:text-white">{(item.co2 / 1000).toFixed(2)} <span className="text-xs text-gray-400 font-bold">t CO₂</span></p>
                          <p className="text-[10px] font-bold text-emerald-600/60 uppercase">{item.liters?.toLocaleString('pt-BR')} <span className="text-[8px]">Litros</span></p>
                       </div>
                       <div className="text-right">
                          <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Participação</p>
                          <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">{item.percentage.toFixed(1)}%</p>
                       </div>
                    </div>
                    <div className="h-2 bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden">
                       <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${item.percentage}%` }} />
                    </div>
                  </div>
                ))
              )}
           </div>

           <div className="mt-10 p-6 bg-emerald-50 dark:bg-emerald-900/10 rounded-3xl border border-emerald-100 dark:border-emerald-500/10">
              <div className="flex items-center gap-3 text-emerald-700 dark:text-emerald-400 font-black text-[10px] uppercase tracking-widest">
                 <ScaleIcon className="w-4 h-4" />
                 Distribuição Baseada em Fatores IPCC
              </div>
           </div>
        </div>
      </div>

      {/* Methodology Section */}
      <div className="bg-gradient-to-br from-emerald-500 to-green-600 p-10 rounded-[4rem] text-white shadow-2xl flex flex-col md:flex-row items-center gap-10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl" />
          <div className="w-24 h-24 bg-white/10 rounded-[2.5rem] flex items-center justify-center shrink-0 border border-white/20 backdrop-blur-md">
            <PresentationChartLineIcon className="w-12 h-12" />
          </div>
          <div className="flex-1 relative z-10 text-center md:text-left">
             <h4 className="text-2xl font-black tracking-tighter uppercase italic mb-4">Metodologia e Fatores de Emissão</h4>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-white/5 p-6 rounded-3xl border border-white/10 backdrop-blur-sm">
                   <p className="text-[10px] font-black text-emerald-200 uppercase tracking-widest mb-2">GASOLINA (BR)</p>
                   <p className="text-xs text-emerald-50 leading-relaxed font-medium">Cálculo: <code className="bg-black/20 px-1.5 py-0.5 rounded font-black italic">Litros × 2,27</code>. Considera densidade de 0,75kg/L e 82% de pureza (IPCC).</p>
                </div>
                <div className="bg-white/5 p-6 rounded-3xl border border-white/10 backdrop-blur-sm">
                   <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest mb-2">DIESEL / OUTROS</p>
                   <p className="text-xs text-blue-50 leading-relaxed font-medium">Diesel: <code className="bg-black/20 px-1.5 py-0.5 rounded font-black italic">2,68 kg/L</code>. Etanol: <code className="bg-black/20 px-1.5 py-0.5 rounded font-black italic">0,45 kg/L</code> (Ciclo RenovaBio).</p>
                </div>
                <div className="bg-white/5 p-6 rounded-3xl border border-white/10 backdrop-blur-sm">
                   <p className="text-[10px] font-black text-amber-200 uppercase tracking-widest mb-2">TRANSPORTE (KM)</p>
                   <p className="text-xs text-amber-50 leading-relaxed font-medium">Utilizado na ausência de litros. Fatores: <code className="bg-black/20 px-1.5 py-0.5 rounded font-black italic">0,314</code> (Carro) a <code className="bg-black/20 px-1.5 py-0.5 rounded font-black italic">0,461</code> (Pickup).</p>
                </div>
             </div>
          </div>
      </div>

    </div>
  );
};

export default RelatorioMeioAmbiente;
