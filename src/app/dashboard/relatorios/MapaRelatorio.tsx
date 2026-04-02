"use client";

import dynamic from 'next/dynamic';

const MapaProjetos = dynamic(() => import('./MapaProjetos'), {
  ssr: false,
  loading: () => (
    <div className="h-[600px] w-full animate-pulse bg-gray-100 rounded-3xl flex items-center justify-center">
      <span className="text-gray-400 font-medium">Iniciando Mapa...</span>
    </div>
  ),
});

export default function MapaRelatorio() {
  return <MapaProjetos />;
}
