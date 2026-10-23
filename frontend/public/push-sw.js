/*
 * Push alerts – loaded into the app's service worker (see vite.config.js → workbox.importScripts).
 * Runs even when the app is closed and the phone is locked: shows the notification and opens
 * the right screen when it is tapped.
 */
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }

  event.waitUntil(
    (async () => {
      // App open on screen: the live connection already chimed and showed it
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      if (windows.some((w) => w.visibilityState === 'visible')) return

      await self.registration.showNotification(data.title || 'Campus Food', {
        body: data.body || '',
        tag: data.tag || data.type || 'campus-food',
        renotify: true,
        icon: '/icon-192.png',
        // Long buzz for a new order (staff) or food ready (student), short one otherwise
        vibrate: data.urgent ? [400, 150, 400, 150, 400] : [200],
        // A new order stays on screen until staff look at it
        requireInteraction: data.type === 'NEW_ORDER',
        data: { url: data.url || '/' },
      })
    })(),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const existing = windows.find((w) => w.url.startsWith(self.location.origin))
      if (existing) {
        await existing.focus()
        if (existing.url !== url && 'navigate' in existing) await existing.navigate(url)
        return
      }
      await self.clients.openWindow(url)
    })(),
  )
})
