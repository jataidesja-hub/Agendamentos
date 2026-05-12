import type { Metadata, Viewport } from "next";
import Script from "next/script";

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
  return (
    <>
      {/* Registra SW e captura beforeinstallprompt antes do React */}
      <Script id="pwa-motorista-setup" strategy="beforeInteractive">{`
        (function() {
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
              .then(function(reg) {
                if (reg.installing) {
                  reg.installing.addEventListener('statechange', function(e) {
                    if (e.target.state === 'activated' && !sessionStorage.getItem('sw-motor-ok')) {
                      sessionStorage.setItem('sw-motor-ok', '1');
                      location.reload();
                    }
                  });
                }
              })
              .catch(function() {});
          }
          function capture(e) {
            e.preventDefault();
            window.__pwaPrompt = e;
            window.dispatchEvent(new Event('pwaPromptReady'));
          }
          window.addEventListener('beforeinstallprompt', capture);
        })();
      `}</Script>
      {children}
    </>
  );
}
