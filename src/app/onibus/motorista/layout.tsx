import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Ônibus CYMI – Motorista",
  manifest: "/onibus/motorista/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Motorista" },
  other: { "mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#d97706",
};

export default function MotoristaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
