import type { Metadata, Viewport } from "next";
import Script from "next/script";

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
  return (
    <>
      {/* Captura beforeinstallprompt o mais cedo possível, antes do bundle React */}
      <Script id="pwa-capture" strategy="beforeInteractive">{`
        (function() {
          function capture(e) {
            e.preventDefault();
            window.__pwaPrompt = e;
            window.dispatchEvent(new Event('pwaPromptReady'));
          }
          if (window.__pwaPrompt) {
            window.dispatchEvent(new Event('pwaPromptReady'));
          }
          window.addEventListener('beforeinstallprompt', capture);
        })();
      `}</Script>
      {children}
    </>
  );
}
