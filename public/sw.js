const CACHE_NAME = 'reliefgrid-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

// Background Sync (Simplified for demo)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-field-reports') {
    console.log('Syncing field reports...');
    // In a real app, you'd fetch from IndexedDB and push to Firebase
  }
});
