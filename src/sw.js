import { precacheAndRoute } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'

self.skipWaiting()
clientsClaim()

precacheAndRoute(self.__WB_MANIFEST || [])

// Push notification listener
self.addEventListener('push', function (event) {
  if (!event.data) return

  try {
    const data = event.data.json()
    const options = {
      body: data.body || 'You have a new notification',
      icon: data.icon || '/fav.png',
      badge: data.badge || '/fav.png',
      data: {
        url: data.url || '/'
      },
      vibrate: [200, 100, 200]
    }

    event.waitUntil(
      self.registration.showNotification(data.title || 'OptiSmart Portal', options)
    )
  } catch (e) {
    console.error('Error parsing push payload', e)
    event.waitUntil(
      self.registration.showNotification('OptiSmart Portal', {
        body: event.data.text() || 'You have a new notification',
        icon: '/fav.png',
        badge: '/fav.png'
      })
    )
  }
})

// Notification click listener
self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  const urlToOpen = event.notification.data?.url || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window/tab open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i]
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus()
        }
      }
      // If not, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen)
      }
    })
  )
})
