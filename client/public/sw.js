/* eslint-disable no-restricted-globals */
/**
 * Tibb Assist service worker.
 *
 * Handles the `push` event (browser receives a web-push message) by
 * showing a notification with the title, body, icon, and click URL from
 * the payload.  The `notificationclick` handler focuses an existing
 * window on the target URL or opens a new one.
 *
 * The SW is intentionally minimal — no fetch caching or offline strategy.
 * It exists solely to receive push notifications.
 */

self.addEventListener('install', (event) => {
  // Activate immediately without waiting for existing tabs to close.
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  // Take control of all open tabs right away.
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'Tibb Assist', body: event.data ? event.data.text() : 'New notification' }
  }

  const title = data.title || 'Tibb Assist'
  const options = {
    body: data.body || '',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    data: { url: data.data?.url || '/' },
    vibrate: [200, 100, 200],
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const url = event.notification.data?.url || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      const focused = windowClients.find((client) => client.url.includes(url) && 'focus' in client)
      if (focused) return focused.focus()
      if (clients.openWindow) return clients.openWindow(url)
      return null
    }),
  )
})
