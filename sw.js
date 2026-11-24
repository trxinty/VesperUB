importScripts('https://cdn.jsdelivr.net/npm/@titaniumnetwork-dev/ultraviolet@3.2.10/dist/uv.bundle.js');
importScripts('./uv/uv.config.js');
importScripts('https://cdn.jsdelivr.net/npm/@titaniumnetwork-dev/ultraviolet@3.2.10/dist/uv.sw.js');

const uv = new UVServiceWorker();

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const isUvRoute = typeof uv.route === 'function'
    ? uv.route(event)
    : event.request.url.startsWith(self.location.origin + self.__uv$config.prefix);

  if (isUvRoute) {
    event.respondWith(uv.fetch(event));
  }
});
