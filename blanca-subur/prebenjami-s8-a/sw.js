// Guarda la app en el móvil para que abra sin conexión.
// Estrategia: intenta la red primero (así los cambios llegan solos) y, si no hay cobertura, usa la copia guardada.
const CACHE = 'blanca-subur-prebenjami-s8-a-202610222136';
const ARCHIVOS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './iconos/app-192.png',
  './iconos/app-512.png',
  './iconos/app-apple-180.png',
  './iconos/app-favicon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(claves => Promise.all(claves.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Notificaciones push (entrenos, partidos y cambios de calendario)
self.addEventListener('push', e => {
  let a = {};
  try { a = e.data ? e.data.json() : {}; } catch { a = { texto: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(a.titulo || 'BS Prebenjamí S8 A', {
    body: a.texto || '',
    icon: './iconos/app-192.png',
    badge: './iconos/app-badge-96.png',
    tag: a.etiqueta || undefined,
    data: { url: a.url || './' },
    vibrate: [120, 60, 120],
  }));
});

// Al tocar la notificación se abre la app (o se trae al frente si ya está abierta)
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const destino = new URL(e.notification.data?.url || './', self.registration.scope).href;
  e.waitUntil((async () => {
    const ventanas = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const v of ventanas) {
      if (v.url.startsWith(self.registration.scope)) { await v.focus(); return v.navigate(destino); }
    }
    return clients.openWindow(destino);
  })());
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const ruta = new URL(e.request.url).pathname;
  // Los avisos y el contador de visitas nunca se guardan en el móvil
  if (ruta === '/api/avisos' || ruta === '/api/visita' || ruta === '/api/estadisticas') return;
  e.respondWith(
    fetch(e.request)
      .then(resp => {
        if (resp.ok && new URL(e.request.url).origin === location.origin) {
          const copia = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, copia));
        }
        return resp;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
