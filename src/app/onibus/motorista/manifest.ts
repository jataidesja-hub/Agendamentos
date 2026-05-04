import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ônibus CYMI – Motorista",
    short_name: "Motorista",
    description: "Gerencie sua rota e navegue pelos pontos",
    start_url: "/onibus/motorista",
    display: "standalone",
    background_color: "#030712",
    theme_color: "#d97706",
    orientation: "portrait",
    icons: [
      { src: "/icon.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon-motorista.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
