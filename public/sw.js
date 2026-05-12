const CACHE = "onibus-v2";

// Não pré-cacheia nada no install — páginas com auth falham e quebram o SW
self.addEventListener("install", (e) => {
  e.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Só cacheia assets estáticos (JS, CSS, imagens, fontes)
  const isStatic =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.match(/\.(png|svg|ico|webp|woff2?|ttf)$/);

  // Nunca cacheia chamadas de API/Supabase
  const isApi =
    url.hostname.includes("supabase") ||
    url.pathname.startsWith("/api/");

  if (isApi || e.request.method !== "GET") return;

  if (isStatic) {
    // Cache-first para assets estáticos
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached;
        return fetch(e.request).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
          }
          return res;
        });
      })
    );
  }
  // Páginas HTML: network-first sem cache (evita problemas de auth)
});
