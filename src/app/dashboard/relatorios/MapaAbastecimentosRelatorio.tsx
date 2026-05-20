"use client";

import dynamic from 'next/dynamic';

const MapaAbastecimentos = dynamic(() => import('./MapaAbastecimentos'), {
  ssr: false,
  loading: () => (
    <div className="h-[600px] w-full animate-pulse bg-gray-900 rounded-[3rem] flex flex-col items-center justify-center gap-4">
      <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      <span className="text-gray-400 font-black text-xs uppercase tracking-widest">Carregando Mapa...</span>
    </div>
  ),
});

export default function MapaAbastecimentosRelatorio() {
  return <MapaAbastecimentos />;
}
