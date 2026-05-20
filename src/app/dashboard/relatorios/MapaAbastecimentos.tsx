"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  FunnelIcon,
  MapPinIcon,
  BuildingStorefrontIcon,
  BeakerIcon,
  XMarkIcon,
  ChevronRightIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
} from '@heroicons/react/24/outline';
import { dataCache } from '@/lib/cache';

interface FuelData { sumPrice: number; count: number; value: number; }
interface PostData { fuels: Record<string, FuelData>; totalValue: number; }
interface CityData { posts: Record<string, PostData>; totalInvested: number; fuelPrices: Record<string, { min: number; max: number }>; }
interface StateData { cities: Record<string, CityData>; totalInvested: number; }
type GroupedData = Record<string, StateData>;

const NOME_MAP: Record<string, string> = {
  AC:'Acre',AL:'Alagoas',AP:'Amapá',AM:'Amazonas',BA:'Bahia',CE:'Ceará',
  DF:'Distrito Federal',ES:'Espírito Santo',GO:'Goiás',MA:'Maranhão',
  MT:'Mato Grosso',MS:'Mato Grosso do Sul',MG:'Minas Gerais',PA:'Pará',
  PB:'Paraíba',PR:'Paraná',PE:'Pernambuco',PI:'Piauí',RJ:'Rio de Janeiro',
  RN:'Rio Grande do Norte',RS:'Rio Grande do Sul',RO:'Rondônia',RR:'Roraima',
  SC:'Santa Catarina',SP:'São Paulo',SE:'Sergipe',TO:'Tocantins',
};

const MapaAbastecimentos = () => {
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [panelVisible, setPanelVisible] = useState(false);
  const [geoJsonData, setGeoJsonData] = useState<any>(null);
  const [geoLoading, setGeoLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fullscreenRef = useRef<HTMLDivElement>(null);

  const abastecimentos = dataCache.abastecimentos || [];

  const availableMonths = useMemo(() => {
    const s = new Set<string>();
    abastecimentos.forEach((a: any) => {
      if (a.data_transacao) { const d = String(a.data_transacao); if (d.includes('-')) s.add(d.slice(0, 7)); }
    });
    return Array.from(s).sort().reverse();
  }, [abastecimentos]);

  useEffect(() => {
    if (!selectedMonth && availableMonths.length > 0) setSelectedMonth(availableMonths[0]);
  }, [availableMonths, selectedMonth]);

  // Carrega GeoJSON real
  useEffect(() => {
    setGeoLoading(true);
    fetch('https://cdn.jsdelivr.net/gh/codeforamerica/click_that_hood@master/public/data/brazil-states.geojson')
      .then(r => r.json())
      .then(raw => {
        const features = (raw.features || []).map((f: any) => {
          const uf = f.properties?.sigla || f.properties?.uf || '';
          const nome = f.properties?.name || NOME_MAP[uf] || uf;
          return { ...f, properties: { ...f.properties, uf, nome } };
        });
        setGeoJsonData({ ...raw, features });
      })
      .catch(() => {
        fetch('https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=UF')
          .then(r => r.json())
          .then(raw => {
            const IBGE: Record<string, string> = {
              '11':'RO','12':'AC','13':'AM','14':'RR','15':'PA','16':'AP','17':'TO',
              '21':'MA','22':'PI','23':'CE','24':'RN','25':'PB','26':'PE','27':'AL',
              '28':'SE','29':'BA','31':'MG','32':'ES','33':'RJ','35':'SP','41':'PR',
              '42':'SC','43':'RS','50':'MS','51':'MT','52':'GO','53':'DF',
            };
            const features = (raw.features || []).map((f: any) => {
              const cod = String(f.properties?.codarea || '');
              const uf = IBGE[cod] || cod;
              return { ...f, properties: { ...f.properties, uf, nome: NOME_MAP[uf] || uf } };
            });
            setGeoJsonData({ ...raw, features });
          })
          .catch(() => setGeoJsonData(null));
      })
      .finally(() => setGeoLoading(false));
  }, []);

  // Sincroniza estado do botão com eventos nativos de fullscreen (ESC, F11)
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      // Entra em fullscreen nativo (como F11) usando o elemento raiz da div do mapa
      await (fullscreenRef.current as any)?.requestFullscreen?.();
    } else {
      await document.exitFullscreen();
    }
  };

  const groupedData: GroupedData = useMemo(() => {
    const data: any = {};
    const filtered = abastecimentos.filter((a: any) => {
      if (!a.data_transacao || !selectedMonth) return false;
      return String(a.data_transacao).slice(0, 7) === selectedMonth;
    });
    filtered.forEach((a: any) => {
      const uf = String(a.uf || a.estado || 'UF').toUpperCase().trim();
      const city = String(a.cidade || a.municipio || 'NÃO INFORMADA').toUpperCase().trim();
      const post = String(a.estabelecimento || 'POSTO DESCONHECIDO').toUpperCase().trim();
      const fuel = String(a.tipo_combustivel || 'OUTROS').toUpperCase().trim();
      if (!data[uf]) data[uf] = { cities: {}, totalInvested: 0 };
      if (!data[uf].cities[city]) data[uf].cities[city] = { posts: {}, totalInvested: 0, fuelPrices: {} };
      if (!data[uf].cities[city].posts[post]) data[uf].cities[city].posts[post] = { fuels: {}, totalValue: 0 };
      if (!data[uf].cities[city].posts[post].fuels[fuel]) data[uf].cities[city].posts[post].fuels[fuel] = { sumPrice: 0, count: 0, value: 0 };
      const fd = data[uf].cities[city].posts[post].fuels[fuel];
      fd.sumPrice += (Number(a.valor_litro) || 0);
      fd.count += 1;
      fd.value += (Number(a.valor_emissao) || 0);
      data[uf].cities[city].posts[post].totalValue += (Number(a.valor_emissao) || 0);
      data[uf].cities[city].totalInvested += (Number(a.valor_emissao) || 0);
      data[uf].totalInvested += (Number(a.valor_emissao) || 0);
    });
    Object.values(data).forEach((ufData: any) => {
      Object.values(ufData.cities).forEach((cityData: any) => {
        Object.values(cityData.posts).forEach((postData: any) => {
          Object.entries(postData.fuels).forEach(([fuel, fuelData]: [string, any]) => {
            const avg = fuelData.sumPrice / fuelData.count;
            if (!cityData.fuelPrices[fuel]) cityData.fuelPrices[fuel] = { min: avg, max: avg };
            else {
              if (avg > 0 && avg < cityData.fuelPrices[fuel].min) cityData.fuelPrices[fuel].min = avg;
              if (avg > cityData.fuelPrices[fuel].max) cityData.fuelPrices[fuel].max = avg;
            }
          });
        });
      });
    });
    return data;
  }, [abastecimentos, selectedMonth]);

  const maxInvestment = useMemo(() =>
    Math.max(...Object.values(groupedData).map((s: any) => s.totalInvested), 1),
  [groupedData]);

  const getStateColor = useCallback((uf: string) => {
    const sd = groupedData[uf];
    if (!sd) return '#1e293b';
    const i = sd.totalInvested / maxInvestment;
    if (i > 0.7) return '#0b7336';
    if (i > 0.4) return '#16a34a';
    if (i > 0.2) return '#22c55e';
    if (i > 0.05) return '#4ade80';
    return '#bbf7d0';
  }, [groupedData, maxInvestment]);

  const styleFeature = useCallback((feature: any) => {
    const uf = feature?.properties?.uf;
    const sel = uf === selectedState;
    return { fillColor: getStateColor(uf), weight: sel ? 3 : 1, opacity: 1, color: sel ? '#f59e0b' : '#0f172a', fillOpacity: sel ? 0.95 : 0.8 };
  }, [getStateColor, selectedState]);

  const onEachFeature = useCallback((feature: any, layer: any) => {
    const uf = feature?.properties?.uf;
    const nome = feature?.properties?.nome || uf;
    const sd = groupedData[uf];
    layer.bindTooltip(`
      <div style="background:#111827;color:#fff;border-radius:12px;padding:10px 14px;font-family:sans-serif;border:1px solid rgba(255,255,255,0.1)">
        <div style="font-weight:900;font-size:12px;letter-spacing:0.1em;text-transform:uppercase">${nome}</div>
        ${sd
          ? `<div style="color:#4ade80;font-weight:700;font-size:11px;margin-top:4px">${sd.totalInvested.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div><div style="color:#6b7280;font-size:10px">${Object.keys(sd.cities).length} cidade(s)</div>`
          : `<div style="color:#4b5563;font-size:10px;margin-top:4px">Sem dados neste período</div>`}
      </div>`, { permanent: false, sticky: true, opacity: 1 });
    layer.on({
      click: () => { if (sd) { setSelectedState(uf); setSelectedCity(null); setPanelVisible(true); } },
      mouseover: (e: any) => { e.target.setStyle({ weight: 2, color: '#f59e0b', fillOpacity: 0.9 }); e.target.bringToFront(); },
      mouseout: (e: any) => { e.target.setStyle(styleFeature(feature)); },
    });
  }, [groupedData, styleFeature]);

  const stateData = selectedState ? groupedData[selectedState] : null;
  const cityData = selectedState && selectedCity ? groupedData[selectedState]?.cities[selectedCity] : null;
  const statesWithData = Object.keys(groupedData);
  const totalInvestedAll = Object.values(groupedData).reduce((acc: number, s: any) => acc + s.totalInvested, 0);

  // Painel lateral — igual nos dois modos
  const PainelLateral = panelVisible && selectedState && stateData ? (
    <div className={`bg-white border-l border-gray-200 overflow-hidden flex flex-col shadow-2xl flex-shrink-0 ${isFullscreen ? 'w-[400px]' : 'w-[380px] rounded-[2.5rem] border border-gray-100'}`}>
      <div className="bg-gray-900 px-6 py-5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-black text-sm">{selectedState}</div>
          <div>
            <h3 className="text-white font-black text-sm">{NOME_MAP[selectedState] || selectedState}</h3>
            <p className="text-emerald-400 text-[10px] font-black uppercase tracking-widest">
              {stateData.totalInvested.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
          </div>
        </div>
        <button onClick={() => { setPanelVisible(false); setSelectedState(null); setSelectedCity(null); }}
          className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center hover:bg-white/20 transition-colors">
          <XMarkIcon className="w-4 h-4 text-white" />
        </button>
      </div>

      {selectedCity && (
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2 flex-shrink-0">
          <button onClick={() => setSelectedCity(null)} className="text-[10px] font-black text-emerald-600 uppercase tracking-widest hover:underline">{selectedState}</button>
          <ChevronRightIcon className="w-3 h-3 text-gray-400" />
          <span className="text-[10px] font-black text-gray-700 uppercase tracking-widest">{selectedCity}</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {!selectedCity ? (
          <>
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1 mb-3">
              {Object.keys(stateData.cities).length} cidade(s) com abastecimento
            </p>
            {Object.keys(stateData.cities).sort().map(city => {
              const cd = stateData.cities[city];
              return (
                <button key={city} onClick={() => setSelectedCity(city)}
                  className="w-full bg-gray-50 hover:bg-gray-100 rounded-2xl p-4 text-left transition-all border border-gray-100 hover:border-emerald-200 group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <MapPinIcon className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <div>
                        <p className="font-black text-gray-900 text-[11px] uppercase tracking-tight">{city}</p>
                        <p className="text-[9px] font-bold text-gray-400 mt-0.5">{Object.keys(cd.posts).length} posto(s)</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                        {cd.totalInvested.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                      <ChevronRightIcon className="w-3 h-3 text-gray-400 group-hover:text-emerald-600 transition-colors" />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {Object.entries(cd.fuelPrices).map(([fuel, prices]: [string, any]) => (
                      <span key={fuel} className="text-[8px] font-black bg-white text-gray-600 px-2 py-0.5 rounded-full border border-gray-200 uppercase">
                        {fuel}: {prices.min.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/L
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </>
        ) : cityData ? (
          <>
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1 mb-3">
              {Object.keys(cityData.posts).length} posto(s) nesta cidade
            </p>
            <div className="bg-gray-900 rounded-2xl p-4 mb-2">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-3">Faixa de preços</p>
              <div className="space-y-2">
                {Object.entries(cityData.fuelPrices).map(([fuel, prices]: [string, any]) => (
                  <div key={fuel} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BeakerIcon className="w-3 h-3 text-emerald-400" />
                      <span className="text-[9px] font-black text-gray-300 uppercase">{fuel}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black text-emerald-400">{prices.min.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/L</span>
                      {prices.min !== prices.max && (<>
                        <span className="text-[8px] text-gray-500">→</span>
                        <span className="text-[9px] font-black text-red-400">{prices.max.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/L</span>
                      </>)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {Object.keys(cityData.posts).sort((a, b) => cityData.posts[a].totalValue - cityData.posts[b].totalValue).map(post => {
              const postData = cityData.posts[post];
              return (
                <div key={post} className="bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                    <BuildingStorefrontIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <p className="font-black text-gray-900 text-[10px] uppercase tracking-tight flex-1">{post}</p>
                    <span className="text-[9px] font-black text-blue-600">{postData.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>
                  <div className="p-3 space-y-2">
                    {Object.entries(postData.fuels).map(([fuel, fuelData]: [string, any]) => {
                      const avg = fuelData.sumPrice / fuelData.count;
                      const cMin = cityData.fuelPrices[fuel]?.min;
                      const cMax = cityData.fuelPrices[fuel]?.max;
                      const isMin = cMin !== undefined && cMax !== undefined && Math.abs(avg - cMin) < 0.01 && cMin !== cMax;
                      const isMax = cMin !== undefined && cMax !== undefined && Math.abs(avg - cMax) < 0.01 && cMin !== cMax;
                      return (
                        <div key={fuel} className={`flex justify-between items-center p-2.5 rounded-xl border ${isMin ? 'bg-emerald-50 border-emerald-200' : isMax ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
                          <div className="flex items-center gap-2">
                            <BeakerIcon className={`w-3 h-3 ${isMin ? 'text-emerald-600' : isMax ? 'text-red-600' : 'text-blue-500'}`} />
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{fuel}</p>
                                {isMin && <span className="bg-emerald-600 text-[5px] text-white px-1.5 py-0.5 rounded-full font-black uppercase">Melhor</span>}
                                {isMax && <span className="bg-red-600 text-[5px] text-white px-1.5 py-0.5 rounded-full font-black uppercase">Maior</span>}
                              </div>
                              <p className={`text-[10px] font-black ${isMin ? 'text-emerald-900' : isMax ? 'text-red-900' : 'text-gray-700'}`}>
                                {avg.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} / L
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[8px] font-black text-gray-400 uppercase">Investido</p>
                            <p className={`text-[10px] font-black ${isMin ? 'text-emerald-600' : isMax ? 'text-red-600' : 'text-blue-600'}`}>
                              {fuelData.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </>
        ) : null}
      </div>

      <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex-shrink-0">
        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">
          {selectedCity
            ? `Total da cidade: ${cityData?.totalInvested.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
            : `Total do estado: ${stateData?.totalInvested.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}
        </p>
      </div>
    </div>
  ) : null;

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="bg-gray-900 p-8 rounded-[3rem] shadow-2xl flex flex-col md:flex-row justify-between items-center gap-6 border border-white/5">
        <div>
          <h2 className="text-2xl font-black text-white italic tracking-tighter">Mapa de Abastecimentos</h2>
          <p className="text-emerald-500 font-bold text-[10px] uppercase tracking-widest mt-1">Distribuição geográfica por estado e cidade</p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="text-center">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Estados Ativos</p>
            <p className="text-2xl font-black text-white">{statesWithData.length}</p>
          </div>
          <div className="w-px h-10 bg-white/10" />
          <div className="text-center">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Investido</p>
            <p className="text-lg font-black text-emerald-400">{totalInvestedAll.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
          </div>
          <div className="w-px h-10 bg-white/10" />
          <div className="flex items-center px-6 py-4 bg-white/5 rounded-2xl border border-white/10 hover:border-emerald-500 transition-all cursor-pointer">
            <FunnelIcon className="w-4 h-4 text-emerald-500 mr-3" />
            <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
              className="bg-transparent text-white font-black text-sm outline-none uppercase tracking-widest">
              {availableMonths.map(m => (
                <option key={m} value={m} className="bg-gray-900">
                  {new Date(m + '-02').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Legenda */}
      <div className="flex items-center gap-3 px-2">
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Investimento:</span>
        <div className="flex items-center gap-1.5">
          {[{ c: '#bbf7d0', l: 'Baixo' }, { c: '#4ade80', l: '' }, { c: '#22c55e', l: '' }, { c: '#16a34a', l: '' }, { c: '#0b7336', l: 'Alto' }].map((it, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className="w-5 h-3 rounded" style={{ backgroundColor: it.c }} />
              {it.l && <span className="text-[9px] font-black text-gray-400 uppercase">{it.l}</span>}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1.5 ml-4">
          <div className="w-5 h-3 rounded bg-[#1e293b]" />
          <span className="text-[9px] font-black text-gray-400 uppercase">Sem dados</span>
        </div>
      </div>

      {/* Área do Mapa — este div vai para fullscreen nativo */}
      <div
        ref={fullscreenRef}
        className="flex gap-0"
        style={{
          background: isFullscreen ? '#030712' : 'transparent',
          height: isFullscreen ? '100vh' : 'auto',
          width: isFullscreen ? '100vw' : 'auto',
        }}
      >
        {/* Mapa */}
        <div className={`relative ${isFullscreen ? 'flex-1' : panelVisible ? 'flex-1' : 'w-full'} transition-all duration-300`}>
          {/* Botão tela cheia */}
          <button
            onClick={toggleFullscreen}
            className="absolute top-3 right-3 z-[1000] bg-gray-900/90 backdrop-blur-sm text-white w-9 h-9 rounded-xl border border-white/10 flex items-center justify-center hover:bg-gray-800 transition-all shadow-lg"
            title={isFullscreen ? 'Sair da tela cheia (ESC)' : 'Tela cheia'}
          >
            {isFullscreen ? <ArrowsPointingInIcon className="w-4 h-4" /> : <ArrowsPointingOutIcon className="w-4 h-4" />}
          </button>

          {/* Filtro de mês visível apenas no fullscreen */}
          {isFullscreen && (
            <div className="absolute top-3 left-3 z-[1000] flex items-center px-4 py-2 bg-gray-900/90 backdrop-blur-sm rounded-xl border border-white/10 shadow-lg gap-2">
              <FunnelIcon className="w-3 h-3 text-emerald-500" />
              <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
                className="bg-transparent text-white font-black text-xs outline-none uppercase tracking-widest">
                {availableMonths.map(m => (
                  <option key={m} value={m} className="bg-gray-900">
                    {new Date(m + '-02').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                  </option>
                ))}
              </select>
            </div>
          )}

          {geoLoading ? (
            <div className="rounded-[2.5rem] bg-gray-900 border border-white/10 flex flex-col items-center justify-center gap-4" style={{ height: isFullscreen ? '100vh' : '560px' }}>
              <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-400 font-black text-xs uppercase tracking-widest">Carregando mapa do Brasil...</p>
            </div>
          ) : (
            <div className={isFullscreen ? '' : 'rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl'}
              style={{ height: isFullscreen ? '100vh' : '560px' }}>
              {geoJsonData && (
                <MapContainer
                  center={[-14.2, -51.9]}
                  zoom={4}
                  style={{ height: '100%', width: '100%', background: '#0f172a' }}
                  zoomControl={true}
                  scrollWheelZoom={true}
                >
                  <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    attribution='&copy; OpenStreetMap'
                  />
                  <GeoJSON
                    key={`${selectedState}-${selectedMonth}-${geoJsonData?.features?.length}`}
                    data={geoJsonData}
                    style={styleFeature}
                    onEachFeature={onEachFeature}
                  />
                </MapContainer>
              )}
            </div>
          )}

          {!geoLoading && !panelVisible && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-gray-900/90 backdrop-blur-sm text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full border border-white/10 pointer-events-none z-[999]">
              Clique em um estado para ver os detalhes
            </div>
          )}
        </div>

        {/* Painel lateral */}
        {PainelLateral}
      </div>

      {/* Ranking — só no modo normal */}
      {!isFullscreen && statesWithData.length > 0 && (
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-8 py-5 border-b border-gray-100">
            <h3 className="font-black text-gray-900 text-sm uppercase tracking-widest">Ranking de Estados</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[10px]">
              <thead>
                <tr className="text-gray-400 uppercase font-black tracking-widest border-b border-gray-50 bg-gray-50/50">
                  <th className="py-3 px-8">#</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4">Cidades</th>
                  <th className="py-3 px-4">Postos</th>
                  <th className="py-3 px-4 text-right">Total Investido</th>
                  <th className="py-3 px-8 text-right">% do Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {Object.entries(groupedData)
                  .sort(([, a], [, b]) => (b as StateData).totalInvested - (a as StateData).totalInvested)
                  .map(([uf, data], idx) => {
                    const sd = data as StateData;
                    const totalPostos = Object.values(sd.cities).reduce((acc, c) => acc + Object.keys(c.posts).length, 0);
                    const pct = totalInvestedAll > 0 ? (sd.totalInvested / totalInvestedAll) * 100 : 0;
                    return (
                      <tr key={uf} className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                        onClick={() => { setSelectedState(uf); setSelectedCity(null); setPanelVisible(true); }}>
                        <td className="py-3 px-8 font-black text-gray-300">{idx + 1}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-black text-[9px]" style={{ backgroundColor: getStateColor(uf) }}>{uf}</div>
                            <span className="font-black text-gray-700 uppercase">{NOME_MAP[uf] || uf}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-bold text-gray-500">{Object.keys(sd.cities).length}</td>
                        <td className="py-3 px-4 font-bold text-gray-500">{totalPostos}</td>
                        <td className="py-3 px-4 text-right font-black text-emerald-600">{sd.totalInvested.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                        <td className="py-3 px-8 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="font-black text-gray-500 w-10 text-right">{pct.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapaAbastecimentos;
