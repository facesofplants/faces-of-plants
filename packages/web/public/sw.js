/**
 * Service worker kill switch.
 *
 * This app no longer uses offline caching because stale HTML shells were being
 * served after deploys. Keep this file at /sw.js so existing installations
 * update to this version, delete their caches, and unregister themselves.
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
    await self.registration.unregister();

    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      client.navigate(client.url);
    }
  })());
});
