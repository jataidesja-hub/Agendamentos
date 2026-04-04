"use client";

import dynamic from 'next/dynamic';

const FazendasClient = dynamic(() => import('./FazendasClient'), {
  ssr: false,
  loading: () => (
    <div className="p-8 text-center text-gray-500 animate-pulse font-bold">
      Acessando o Mapa...
    </div>
  ),
});

export default function FazendasPage() {
  return <FazendasClient />;
}
