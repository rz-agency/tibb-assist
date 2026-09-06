import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n/config'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

/**
 * Register the service worker and attempt a push subscription.
 *
 * Degrades gracefully at every step:
 *   - SW not supported      → skip silently
 *   - Push not supported     → skip silently
 *   - Permission denied      → log and skip (user can enable later)
 *   - VAPID key unavailable  → skip (server has push disabled)
 *   - Network/API failure    → log and skip
 *
 * The server-side sendToUser() also handles the case where no
 * subscription row exists (it just skips).
 */
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    })

    // Wait until the SW is active before subscribing.
    if (registration.installing) {
      await new Promise((resolve) => {
        registration.installing.addEventListener('statechange', function handler() {
          if (this.state === 'activated' || this.state === 'redundant') {
            this.removeEventListener('statechange', handler)
            resolve()
          }
        })
      })
    }

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      console.log('[sw] Push permission not granted — skipping subscription.')
      return
    }

    await subscribeToPush(registration)
  } catch (error) {
    console.error('[sw] Registration failed:', error.message)
  }
}

async function subscribeToPush(registration) {
  try {
    const response = await fetch('/api/push/vapid-public-key')
    if (!response.ok) {
      console.log('[sw] VAPID key unavailable — push not configured on server.')
      return
    }
    const { publicKey } = await response.json()

    const existing = await registration.pushManager.getSubscription()
    if (existing) {
      // Already subscribed from a previous session — persist the existing
      // subscription in case the server lost it (e.g. after a DB reset).
      await persistSubscription(existing)
      return
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })

    await persistSubscription(subscription)
  } catch (error) {
    console.error('[sw] Push subscription failed:', error.message)
  }
}

async function persistSubscription(subscription) {
  const json = subscription.toJSON()
  await fetch('/api/push/subscribe', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: json.keys,
    }),
  })
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

// Fire and forget — never blocks app render.
registerServiceWorker()
