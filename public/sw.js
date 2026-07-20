const CACHE_NAME = "blink-static-v8";
const STATIC_ASSETS = [
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/notification-badge.png",
  "/sounds/blink.wav"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(fetch(request));
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) =>
      cached || fetch(request).then((response) => {
        if (response.ok && STATIC_ASSETS.includes(url.pathname)) {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
    )
  );
});

async function updateAppBadge() {
  try {
    if (self.navigator && "setAppBadge" in self.navigator) {
      await self.navigator.setAppBadge();
    }
  } catch {
    // Badging is optional and unsupported in some browsers.
  }
}

async function clearAppBadge() {
  try {
    if (self.navigator && "clearAppBadge" in self.navigator) {
      await self.navigator.clearAppBadge();
    }
  } catch {
    // Badging is optional and unsupported in some browsers.
  }
}

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Blink", body: "You received a new message", url: "/chat" };
  }

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const focusedWindow = windows.find((client) => client.focused && client.visibilityState === "visible");

    await updateAppBadge();

    if (focusedWindow) {
      focusedWindow.postMessage({ type: "BLINK_PUSH", payload });
      return;
    }

    await self.registration.showNotification(payload.title || "Blink", {
      body: payload.body || "You received a new message",
      icon: "/icons/icon-192.png",
      badge: "/icons/notification-badge.png",
      tag: payload.tag || `blink-message-${Date.now()}`,
      renotify: true,
      silent: false,
      vibrate: [100, 60, 100],
      timestamp: Date.now(),
      data: { url: payload.url || "/chat" }
    });
  })());
});

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil((async () => {
    try {
      const configResponse = await fetch("/api/push/subscribe", {
        cache: "no-store",
        credentials: "same-origin"
      });
      if (!configResponse.ok) return;
      const config = await configResponse.json();
      if (!config.configured || !config.publicKey) return;

      const padding = "=".repeat((4 - (config.publicKey.length % 4)) % 4);
      const base64 = (config.publicKey + padding).replace(/-/g, "+").replace(/_/g, "/");
      const raw = self.atob(base64);
      const applicationServerKey = Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));

      const subscription = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(subscription.toJSON())
      });
    } catch {
      // The foreground app retries subscription repair on the next open.
    }
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/chat", self.location.origin).href;

  event.waitUntil((async () => {
    await clearAppBadge();
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find((client) => client.url.startsWith(self.location.origin));
    if (existing) {
      await existing.navigate(targetUrl);
      return existing.focus();
    }
    return self.clients.openWindow(targetUrl);
  })());
});
