import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ônibus CYMI – Passageiro",
  manifest: "/onibus/app/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Passageiro" },
  other: { "mobile-web-app-capable": "yes" },
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
