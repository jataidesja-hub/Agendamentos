import { NextResponse } from "next/server";

// Service worker dedicado ao app do motorista
// Servido de /onibus/motorista/sw.js para ter scope correto em /onibus/motorista/
const SW_CODE = `
const CACHE = "motorista-v2";

self.addEventListener("install", function(e) {
  e.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", function(e) {
  e.waitUntil(
    caches.keys()
      .then(function(keys) { return Promise.all(keys.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); })); })
      .then(function() { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function(e) {
  var url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (url.hostname.includes("supabase")) return;
  if (url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname === "/icon.png") {
    e.respondWith(
      caches.match(e.request).then(function(cached) {
        if (cached) return cached;
        return fetch(e.request).then(function(res) {
          var clone = res.clone();
          caches.open(CACHE).then(function(c) { c.put(e.request, clone); });
          return res;
        });
      })
    );
    return;
  }

  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request).catch(function() { return caches.match(e.request); })
    );
  }
});
`;

export async function GET() {
  return new NextResponse(SW_CODE, {
    headers: {
      "Content-Type": "application/javascript",
      "Service-Worker-Allowed": "/onibus/motorista",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
