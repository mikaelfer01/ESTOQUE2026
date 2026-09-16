const CACHE_NAME = 'estoque-wms-v3';
const CORE_ASSETS = [
  '/index.html',
  '/posicao.html',
  '/admin.html',
  '/resultados.html',
  '/auditor.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Se um único asset falhar (404/rede), não deixa o install inteiro
      // falhar — cacheia o que der certo e segue em frente.
      Promise.allSettled(CORE_ASSETS.map((url) => cache.add(url)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Nunca cacheia chamadas de API — a contagem precisa sempre de dados
// atuais (produtos, sessões abertas, lançamentos). Cachear isso arriscaria
// duplicar/perder lançamentos com dados desatualizados offline.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(networkFirstWithCacheFallback(req));
});

// IMPORTANTE: essa função sempre resolve para uma Response de verdade
// (nunca undefined) — devolver undefined pro respondWith() é o que causa
// o erro ERR_FAILED no Chrome ao abrir o app instalado.
async function networkFirstWithCacheFallback(req) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const res = await fetch(req);
    if (res && res.ok) {
      cache.put(req, res.clone()).catch(() => {});
    }
    return res;
  } catch (err) {
    const cached = await cache.match(req);
    if (cached) return cached;
    return new Response('Sem conexão e sem versão em cache desta página.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}
