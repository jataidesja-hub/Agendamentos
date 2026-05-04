import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ônibus CYMI – Passageiro",
    short_name: "Passageiro",
    description: "Acompanhe o ônibus em tempo real",
    start_url: "/onibus/app",
    display: "standalone",
    background_color: "#030712",
    theme_color: "#2563eb",
    orientation: "portrait",
    icons: [
      { src: "/icon-passageiro.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" },
    ],
  };
}
