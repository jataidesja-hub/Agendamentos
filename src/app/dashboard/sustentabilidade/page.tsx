"use client";

import RelatorioMeioAmbiente from "../relatorios/RelatorioMeioAmbiente";

export default function SustentabilidadePage() {
  return (
    <div className="h-full flex flex-col p-6 gap-6">
      <RelatorioMeioAmbiente />
    </div>
  );
}
