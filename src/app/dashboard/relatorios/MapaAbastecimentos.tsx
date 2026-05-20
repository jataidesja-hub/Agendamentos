"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  FunnelIcon,
  MapPinIcon,
  BuildingStorefrontIcon,
  BeakerIcon,
  XMarkIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { dataCache } from '@/lib/cache';

// Mapa de siglas IBGE -> UF
const IBGE_UF_MAP: Record<string, string> = {
  '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA',
  '16': 'AP', '17': 'TO', '21': 'MA', '22': 'PI', '23': 'CE',
  '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL', '28': 'SE',
  '29': 'BA', '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP',
  '41': 'PR', '42': 'SC', '43': 'RS', '50': 'MS', '51': 'MT',
  '52': 'GO', '53': 'DF',
};

const IBGE_NOME_MAP: Record<string, string> = {
  '11': 'Rondônia', '12': 'Acre', '13': 'Amazonas', '14': 'Roraima', '15': 'Pará',
  '16': 'Amapá', '17': 'Tocantins', '21': 'Maranhão', '22': 'Piauí', '23': 'Ceará',
  '24': 'Rio Grande do Norte', '25': 'Paraíba', '26': 'Pernambuco', '27': 'Alagoas',
  '28': 'Sergipe', '29': 'Bahia', '31': 'Minas Gerais', '32': 'Espírito Santo',
  '33': 'Rio de Janeiro', '35': 'São Paulo', '41': 'Paraná', '42': 'Santa Catarina',
  '43': 'Rio Grande do Sul', '50': 'Mato Grosso do Sul', '51': 'Mato Grosso',
  '52': 'Goiás', '53': 'Distrito Federal',
};

// GeoJSON de fallback (retângulos aproximados, usado se CDN falhar)
const FALLBACK_GEOJSON: any = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { uf: 'AC', nome: 'Acre' }, geometry: { type: 'Polygon', coordinates: [[[-73.9,-7.2],[-73.9,-11.1],[-66.6,-11.1],[-66.6,-7.2],[-73.9,-7.2]]] } },
    { type: 'Feature', properties: { uf: 'AL', nome: 'Alagoas' }, geometry: { type: 'Polygon', coordinates: [[[-38.2,-8.8],[-38.2,-10.5],[-35.1,-10.5],[-35.1,-8.8],[-38.2,-8.8]]] } },
    { type: 'Feature', properties: { uf: 'AP', nome: 'Amapá' }, geometry: { type: 'Polygon', coordinates: [[[-54.0,4.4],[-54.0,1.2],[-50.0,1.2],[-50.0,4.4],[-54.0,4.4]]] } },
    { type: 'Feature', properties: { uf: 'AM', nome: 'Amazonas' }, geometry: { type: 'Polygon', coordinates: [[[-73.9,-4.2],[-73.9,-9.8],[-56.0,-9.8],[-56.0,-4.2],[-73.9,-4.2]]] } },
    { type: 'Feature', properties: { uf: 'BA', nome: 'Bahia' }, geometry: { type: 'Polygon', coordinates: [[[-46.6,-8.5],[-46.6,-18.3],[-37.3,-18.3],[-37.3,-8.5],[-46.6,-8.5]]] } },
    { type: 'Feature', properties: { uf: 'CE', nome: 'Ceará' }, geometry: { type: 'Polygon', coordinates: [[[-41.4,-2.7],[-41.4,-7.8],[-37.2,-7.8],[-37.2,-2.7],[-41.4,-2.7]]] } },
    { type: 'Feature', properties: { uf: 'DF', nome: 'Distrito Federal' }, geometry: { type: 'Polygon', coordinates: [[[-48.3,-15.5],[-48.3,-16.1],[-47.3,-16.1],[-47.3,-15.5],[-48.3,-15.5]]] } },
    { type: 'Feature', properties: { uf: 'ES', nome: 'Espírito Santo' }, geometry: { type: 'Polygon', coordinates: [[[-41.9,-17.9],[-41.9,-21.3],[-39.6,-21.3],[-39.6,-17.9],[-41.9,-17.9]]] } },
    { type: 'Feature', properties: { uf: 'GO', nome: 'Goiás' }, geometry: { type: 'Polygon', coordinates: [[[-53.3,-12.4],[-53.3,-19.4],[-45.9,-19.4],[-45.9,-12.4],[-53.3,-12.4]]] } },
    { type: 'Feature', properties: { uf: 'MA', nome: 'Maranhão' }, geometry: { type: 'Polygon', coordinates: [[[-48.7,-1.0],[-48.7,-10.2],[-41.8,-10.2],[-41.8,-1.0],[-48.7,-1.0]]] } },
    { type: 'Feature', properties: { uf: 'MT', nome: 'Mato Grosso' }, geometry: { type: 'Polygon', coordinates: [[[-61.6,-7.4],[-61.6,-18.0],[-50.2,-18.0],[-50.2,-7.4],[-61.6,-7.4]]] } },
    { type: 'Feature', properties: { uf: 'MS', nome: 'Mato Grosso do Sul' }, geometry: { type: 'Polygon', coordinates: [[[-57.7,-17.2],[-57.7,-24.0],[-51.0,-24.0],[-51.0,-17.2],[-57.7,-17.2]]] } },
    { type: 'Feature', properties: { uf: 'MG', nome: 'Minas Gerais' }, geometry: { type: 'Polygon', coordinates: [[[-51.0,-14.2],[-51.0,-22.9],[-39.8,-22.9],[-39.8,-14.2],[-51.0,-14.2]]] } },
    { type: 'Feature', properties: { uf: 'PA', nome: 'Pará' }, geometry: { type: 'Polygon', coordinates: [[[-58.5,-1.2],[-58.5,-9.8],[-46.0,-9.8],[-46.0,-1.2],[-58.5,-1.2]]] } },
    { type: 'Feature', properties: { uf: 'PB', nome: 'Paraíba' }, geometry: { type: 'Polygon', coordinates: [[[-38.8,-6.0],[-38.8,-8.3],[-34.8,-8.3],[-34.8,-6.0],[-38.8,-6.0]]] } },
    { type: 'Feature', properties: { uf: 'PR', nome: 'Paraná' }, geometry: { type: 'Polygon', coordinates: [[[-54.6,-22.5],[-54.6,-26.7],[-48.0,-26.7],[-48.0,-22.5],[-54.6,-22.5]]] } },
    { type: 'Feature', properties: { uf: 'PE', nome: 'Pernambuco' }, geometry: { type: 'Polygon', coordinates: [[[-41.4,-7.2],[-41.4,-9.5],[-34.9,-9.5],[-34.9,-7.2],[-41.4,-7.2]]] } },
    { type: 'Feature', properties: { uf: 'PI', nome: 'Piauí' }, geometry: { type: 'Polygon', coordinates: [[[-45.9,-2.7],[-45.9,-10.9],[-40.4,-10.9],[-40.4,-2.7],[-45.9,-2.7]]] } },
    { type: 'Feature', properties: { uf: 'RJ', nome: 'Rio de Janeiro' }, geometry: { type: 'Polygon', coordinates: [[[-44.9,-20.7],[-44.9,-23.4],[-40.9,-23.4],[-40.9,-20.7],[-44.9,-20.7]]] } },
    { type: 'Feature', properties: { uf: 'RN', nome: 'Rio Grande do Norte' }, geometry: { type: 'Polygon', coordinates: [[[-38.6,-4.8],[-38.6,-6.9],[-34.9,-6.9],[-34.9,-4.8],[-38.6,-4.8]]] } },
    { type: 'Feature', properties: { uf: 'RS', nome: 'Rio Grande do Sul' }, geometry: { type: 'Polygon', coordinates: [[[-57.7,-27.1],[-57.7,-33.8],[-49.7,-33.8],[-49.7,-27.1],[-57.7,-27.1]]] } },
    { type: 'Feature', properties: { uf: 'RO', nome: 'Rondônia' }, geometry: { type: 'Polygon', coordinates: [[[-66.6,-7.9],[-66.6,-13.7],[-59.8,-13.7],[-59.8,-7.9],[-66.6,-7.9]]] } },
    { type: 'Feature', properties: { uf: 'RR', nome: 'Roraima' }, geometry: { type: 'Polygon', coordinates: [[[-64.4,5.2],[-64.4,-1.5],[-58.9,-1.5],[-58.9,5.2],[-64.4,5.2]]] } },
    { type: 'Feature', properties: { uf: 'SC', nome: 'Santa Catarina' }, geometry: { type: 'Polygon', coordinates: [[[-53.9,-25.9],[-53.9,-29.4],[-48.4,-29.4],[-48.4,-25.9],[-53.9,-25.9]]] } },
    { type: 'Feature', properties: { uf: 'SP', nome: 'São Paulo' }, geometry: { type: 'Polygon', coordinates: [[[-53.1,-19.8],[-53.1,-25.3],[-44.1,-25.3],[-44.1,-19.8],[-53.1,-19.8]]] } },
    { type: 'Feature', properties: { uf: 'SE', nome: 'Sergipe' }, geometry: { type: 'Polygon', coordinates: [[[-38.2,-9.5],[-38.2,-11.6],[-36.4,-11.6],[-36.4,-9.5],[-38.2,-9.5]]] } },
    { type: 'Feature', properties: { uf: 'TO', nome: 'Tocantins' }, geometry: { type: 'Polygon', coordinates: [[[-50.7,-5.2],[-50.7,-13.4],[-45.9,-13.4],[-45.9,-5.2],[-50.7,-5.2]]] } },
  ],
};

interface FuelData {
  sumPrice: number;
  count: number;
  value: number;
}

interface PostData {
  fuels: Record<string, FuelData>;
  totalValue: number;
}

interface CityData {
  posts: Record<string, PostData>;
  totalInvested: number;
  fuelPrices: Record<string, { min: number; max: number }>;
}

interface StateData {
  cities: Record<string, CityData>;
  totalInvested: number;
}

type GroupedData = Record<string, StateData>;

const MapaAbastecimentos = () => {
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [panelVisible, setPanelVisible] = useState(false);
  const [geoJsonData, setGeoJsonData] = useState<any>(FALLBACK_GEOJSON);


  const abastecimentos = dataCache.abastecimentos || [];

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

  useEffect(() => {
    if (!selectedMonth && availableMonths.length > 0) {
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths, selectedMonth]);

  // Carrega GeoJSON real dos estados do IBGE via CDN
  useEffect(() => {
    fetch('https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=UF')
      .then(res => res.json())
      .then(rawGeo => {
        // API do IBGE retorna features com propriedades diferentes; normaliza para uf/nome
        const features = (rawGeo.features || []).map((f: any) => {
          const codId = String(f.properties?.codarea || f.properties?.id || '');
          const uf = IBGE_UF_MAP[codId] || f.properties?.sigla || codId;
          const nome = IBGE_NOME_MAP[codId] || f.properties?.nome || uf;
          return { ...f, properties: { ...f.properties, uf, nome } };
        });
        setGeoJsonData({ ...rawGeo, features });
      })
      .catch(() => {
        // fallback silencioso
        setGeoJsonData(FALLBACK_GEOJSON);
      });
  }, []);

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
      if (!data[uf].cities[city].posts[post].fuels[fuel]) {
        data[uf].cities[city].posts[post].fuels[fuel] = { sumPrice: 0, count: 0, value: 0 };
      }

      const fuelData = data[uf].cities[city].posts[post].fuels[fuel];
      fuelData.sumPrice += (Number(a.valor_litro) || 0);
      fuelData.count += 1;
      fuelData.value += (Number(a.valor_emissao) || 0);

      data[uf].cities[city].posts[post].totalValue += (Number(a.valor_emissao) || 0);
      data[uf].cities[city].totalInvested += (Number(a.valor_emissao) || 0);
      data[uf].totalInvested += (Number(a.valor_emissao) || 0);
    });

    // Calcula min/max de preços por combustível em cada cidade
    Object.values(data).forEach((ufData: any) => {
      Object.values(ufData.cities).forEach((cityData: any) => {
        Object.values(cityData.posts).forEach((postData: any) => {
          Object.entries(postData.fuels).forEach(([fuel, fuelData]: [string, any]) => {
            const avg = fuelData.sumPrice / fuelData.count;
            if (!cityData.fuelPrices[fuel]) {
              cityData.fuelPrices[fuel] = { min: avg, max: avg };
            } else {
              if (avg > 0 && avg < cityData.fuelPrices[fuel].min) cityData.fuelPrices[fuel].min = avg;
              if (avg > cityData.fuelPrices[fuel].max) cityData.fuelPrices[fuel].max = avg;
            }
          });
        });
      });
    });

    return data;
  }, [abastecimentos, selectedMonth]);

  const maxInvestment = useMemo(() => {
    return Math.max(...Object.values(groupedData).map((s: any) => s.totalInvested), 1);
  }, [groupedData]);

  const getStateColor = (uf: string) => {
    const stateData = groupedData[uf];
    if (!stateData) return '#1e293b';
    const intensity = stateData.totalInvested / maxInvestment;
    if (intensity > 0.7) return '#0b7336';
    if (intensity > 0.4) return '#16a34a';
    if (intensity > 0.2) return '#22c55e';
    if (intensity > 0.05) return '#4ade80';
    return '#bbf7d0';
  };

  const styleFeature = (feature: any) => {
    const uf = feature?.properties?.uf;
    const isSelected = uf === selectedState;
    return {
      fillColor: getStateColor(uf),
      weight: isSelected ? 3 : 1,
      opacity: 1,
      color: isSelected ? '#f59e0b' : '#0f172a',
      fillOpacity: isSelected ? 0.95 : 0.8,
    };
  };

  const onEachFeature = (feature: any, layer: any) => {
    const uf = feature?.properties?.uf;
    const stateData = groupedData[uf];
    const nome = feature?.properties?.nome;

    layer.on({
      click: () => {
        if (stateData) {
          setSelectedState(uf);
          setSelectedCity(null);
          setPanelVisible(true);
        }
      },
      mouseover: (e: any) => {
        const l = e.target;
        l.setStyle({ weight: 2, color: '#f59e0b', fillOpacity: 0.9 });
        l.bringToFront();
      },
      mouseout: (e: any) => {
        const l = e.target;
        l.setStyle(styleFeature(feature));
      },
    });
  };

  const cityData = selectedState && selectedCity ? groupedData[selectedState]?.cities[selectedCity] : null;
  const stateData = selectedState ? groupedData[selectedState] : null;

  const statesWithData = Object.keys(groupedData);
  const totalInvestedAll = Object.values(groupedData).reduce((acc: number, s: any) => acc + s.totalInvested, 0);

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="bg-gray-900 p-8 rounded-[3rem] shadow-2xl flex flex-col md:flex-row justify-between items-center gap-6 border border-white/5">
        <div>
          <h2 className="text-2xl font-black text-white italic tracking-tighter">Mapa de Abastecimentos</h2>
          <p className="text-emerald-500 font-bold text-[10px] uppercase tracking-widest mt-1">
            Distribuição geográfica por estado e cidade
          </p>
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
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-white font-black text-sm outline-none uppercase tracking-widest"
            >
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
          {[
            { color: '#bbf7d0', label: 'Baixo' },
            { color: '#4ade80', label: '' },
            { color: '#22c55e', label: '' },
            { color: '#16a34a', label: '' },
            { color: '#0b7336', label: 'Alto' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className="w-5 h-3 rounded" style={{ backgroundColor: item.color }} />
              {item.label && <span className="text-[9px] font-black text-gray-400 uppercase">{item.label}</span>}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1.5 ml-4">
          <div className="w-5 h-3 rounded bg-[#1e293b]" />
          <span className="text-[9px] font-black text-gray-400 uppercase">Sem dados</span>
        </div>
      </div>

      {/* Área do Mapa + Painel */}
      <div className="flex gap-4" style={{ minHeight: 580 }}>
        {/* Mapa */}
        <div className={`relative rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl transition-all duration-500 ${panelVisible ? 'flex-1' : 'w-full'}`}>
          <MapContainer
            center={[-14.2, -51.9]}
            zoom={4}
            style={{ height: '580px', width: '100%', background: '#0f172a' }}
            zoomControl={true}
            scrollWheelZoom={true}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            <GeoJSON
              key={`${selectedState}-${selectedMonth}-${geoJsonData?.features?.length}`}
              data={geoJsonData}
              style={styleFeature}
              onEachFeature={onEachFeature}
            />
          </MapContainer>

          {/* Overlay de instrução */}
          {!panelVisible && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-gray-900/90 backdrop-blur-sm text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full border border-white/10 pointer-events-none">
              Clique em um estado para ver os detalhes
            </div>
          )}
        </div>

        {/* Painel lateral */}
        {panelVisible && selectedState && stateData && (
          <div className="w-[400px] flex-shrink-0 bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 overflow-hidden flex flex-col">
            {/* Header do painel */}
            <div className="bg-gray-900 px-6 py-5 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-black text-sm">
                  {selectedState}
                </div>
                <div>
                  <h3 className="text-white font-black text-sm">
                    {geoJsonData.features.find((f: any) => f.properties.uf === selectedState)?.properties.nome || selectedState}
                  </h3>
                  <p className="text-emerald-400 text-[10px] font-black uppercase tracking-widest">
                    {stateData.totalInvested.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setPanelVisible(false); setSelectedState(null); setSelectedCity(null); }}
                className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                <XMarkIcon className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Navegação breadcrumb */}
            {selectedCity && (
              <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => setSelectedCity(null)}
                  className="text-[10px] font-black text-emerald-600 uppercase tracking-widest hover:underline"
                >
                  {selectedState}
                </button>
                <ChevronRightIcon className="w-3 h-3 text-gray-400" />
                <span className="text-[10px] font-black text-gray-700 uppercase tracking-widest">{selectedCity}</span>
              </div>
            )}

            {/* Conteúdo rolável */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {!selectedCity ? (
                /* Lista de cidades */
                <>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1 mb-3">
                    {Object.keys(stateData.cities).length} cidade(s) com abastecimento
                  </p>
                  {Object.keys(stateData.cities).sort().map(city => {
                    const cd = stateData.cities[city];
                    const postsCount = Object.keys(cd.posts).length;
                    return (
                      <button
                        key={city}
                        onClick={() => setSelectedCity(city)}
                        className="w-full bg-gray-50 hover:bg-gray-100 rounded-2xl p-4 text-left transition-all border border-gray-100 hover:border-emerald-200 group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <MapPinIcon className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                            <div>
                              <p className="font-black text-gray-900 text-[11px] uppercase tracking-tight">{city}</p>
                              <p className="text-[9px] font-bold text-gray-400 mt-0.5">{postsCount} posto(s)</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                              {cd.totalInvested.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                            <ChevronRightIcon className="w-3 h-3 text-gray-400 group-hover:text-emerald-600 transition-colors" />
                          </div>
                        </div>

                        {/* Preview de combustíveis */}
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
              ) : (
                /* Detalhes da cidade */
                cityData && (
                  <>
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1 mb-3">
                      {Object.keys(cityData.posts).length} posto(s) nesta cidade
                    </p>

                    {/* Resumo preços da cidade */}
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
                              <span className="text-[9px] font-black text-emerald-400">
                                {prices.min.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/L
                              </span>
                              {prices.min !== prices.max && (
                                <>
                                  <span className="text-[8px] text-gray-500">→</span>
                                  <span className="text-[9px] font-black text-red-400">
                                    {prices.max.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/L
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Lista de postos */}
                    {Object.keys(cityData.posts)
                      .sort((a, b) => cityData.posts[a].totalValue - cityData.posts[b].totalValue)
                      .map(post => {
                        const postData = cityData.posts[post];
                        return (
                          <div key={post} className="bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden">
                            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                              <BuildingStorefrontIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              <p className="font-black text-gray-900 text-[10px] uppercase tracking-tight flex-1">{post}</p>
                              <span className="text-[9px] font-black text-blue-600">
                                {postData.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </span>
                            </div>
                            <div className="p-3 space-y-2">
                              {Object.entries(postData.fuels).map(([fuel, fuelData]: [string, any]) => {
                                const avgPrice = fuelData.sumPrice / fuelData.count;
                                const cityMin = cityData.fuelPrices[fuel]?.min;
                                const cityMax = cityData.fuelPrices[fuel]?.max;
                                const isMin = cityMin !== undefined && cityMax !== undefined && Math.abs(avgPrice - cityMin) < 0.01 && cityMin !== cityMax;
                                const isMax = cityMin !== undefined && cityMax !== undefined && Math.abs(avgPrice - cityMax) < 0.01 && cityMin !== cityMax;

                                return (
                                  <div
                                    key={fuel}
                                    className={`flex justify-between items-center p-2.5 rounded-xl border ${
                                      isMin ? 'bg-emerald-50 border-emerald-200' :
                                      isMax ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <BeakerIcon className={`w-3 h-3 ${isMin ? 'text-emerald-600' : isMax ? 'text-red-600' : 'text-blue-500'}`} />
                                      <div>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{fuel}</p>
                                          {isMin && <span className="bg-emerald-600 text-[5px] text-white px-1.5 py-0.5 rounded-full font-black uppercase">Melhor</span>}
                                          {isMax && <span className="bg-red-600 text-[5px] text-white px-1.5 py-0.5 rounded-full font-black uppercase">Maior</span>}
                                        </div>
                                        <p className={`text-[10px] font-black ${isMin ? 'text-emerald-900' : isMax ? 'text-red-900' : 'text-gray-700'}`}>
                                          {avgPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} / L
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
                )
              )}
            </div>

            {/* Footer do painel */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex-shrink-0">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">
                {selectedCity
                  ? `Total da cidade: ${cityData?.totalInvested.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
                  : `Total do estado: ${stateData?.totalInvested.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
                }
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Tabela de resumo por estado */}
      {statesWithData.length > 0 && (
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
                      <tr
                        key={uf}
                        className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                        onClick={() => { setSelectedState(uf); setSelectedCity(null); setPanelVisible(true); }}
                      >
                        <td className="py-3 px-8 font-black text-gray-300">{idx + 1}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-black text-[9px]" style={{ backgroundColor: getStateColor(uf) }}>
                              {uf}
                            </div>
                            <span className="font-black text-gray-700 uppercase">
                              {geoJsonData.features.find((f: any) => f.properties.uf === uf)?.properties.nome || uf}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-bold text-gray-500">{Object.keys(sd.cities).length}</td>
                        <td className="py-3 px-4 font-bold text-gray-500">{totalPostos}</td>
                        <td className="py-3 px-4 text-right font-black text-emerald-600">
                          {sd.totalInvested.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
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
