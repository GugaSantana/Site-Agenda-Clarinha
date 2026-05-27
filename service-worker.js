const CACHE_NAME = 'agenda-clarinha-v7';

// Instala e assume controle imediatamente (sem pré-cache que causava falha no subdiretório)
self.addEventListener('install', event => {
  self.skipWaiting();
});

// Limpa caches antigos quando atualizar
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Responde com cache quando offline, senão busca na rede
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
