import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Motorista CYMI",
    short_name: "Motorista",
    description: "App do motorista CYMI",
    start_url: "/onibus/motorista",
    id: "/onibus/motorista",
    scope: "/",
    display: "standalone",
    background_color: "#030712",
    theme_color: "#d97706",
    orientation: "portrait",
    icons: [
      { src: "/icons/android/launchericon-48x48.png",   sizes: "48x48",   type: "image/png", purpose: "any" },
      { src: "/icons/android/launchericon-72x72.png",   sizes: "72x72",   type: "image/png", purpose: "any" },
      { src: "/icons/android/launchericon-96x96.png",   sizes: "96x96",   type: "image/png", purpose: "any" },
      { src: "/icons/android/launchericon-144x144.png", sizes: "144x144", type: "image/png", purpose: "any" },
      { src: "/icons/android/launchericon-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/android/launchericon-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/android/launchericon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
