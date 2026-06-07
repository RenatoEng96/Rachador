const CACHE_NAME = 'rachador-pwa-v7'; // Versão atualizada para limpar o cache antigo
const urlsToCache = [
  '/',
  '/Icone.png',
  '/Apito.wav'
];

self.addEventListener('install', event => {
  self.skipWaiting(); // Força a atualização imediata do SW
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Assume o controle imediatamente
  );
});

self.addEventListener('fetch', event => {
  // Ignora requisições que não sejam GET ou que sejam para APIs externas/Firebase
  if (
    event.request.method !== 'GET' ||
    event.request.url.includes('firestore.googleapis.com') ||
    event.request.url.includes('firebase') ||
    event.request.url.includes('googleapis.com')
  ) {
    return;
  }

  // Estratégia Network First (Cai para o cache apenas se a rede falhar)
  // Isso resolve o problema da tela de "Carregando" infinita no Capacitor
  // que ocorre quando o SW faz cache de um index.html antigo apontando para um main.js que não existe mais.
  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        // Se a requisição deu certo, clona e atualiza o cache
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Se a rede falhar (ex: offline), tenta buscar no cache
        return caches.match(event.request);
      })
  );
});
