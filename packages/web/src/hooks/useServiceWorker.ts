'use client';

import { useEffect } from 'react';

/**
 * Remove legacy service workers and their caches.
 */
export function useServiceWorker() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker
      .getRegistrations()
      .then(async (registrations) => {
        await Promise.all(registrations.map((registration) => registration.unregister()));
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
        }
        console.log('[SW] Cleared legacy service workers and caches');
      })
      .catch((err) => {
        console.warn('[SW] Cleanup failed:', err);
      });
  }, []);
}
