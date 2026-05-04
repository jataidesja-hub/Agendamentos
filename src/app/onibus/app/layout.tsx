import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Ônibus CYMI – Passageiro",
  manifest: "/onibus/app/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Passageiro" },
  other: { "mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#2563eb",
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
