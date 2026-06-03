// 简易离线缓存：stale-while-revalidate（同源 GET）。
// Vite 产物带 hash，新版本会换文件名，旧缓存在 activate 时清掉。
const CACHE = 'holdings-tracker-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== location.origin) return

  event.respondWith((async () => {
    const cache = await caches.open(CACHE)
    const cached = await cache.match(req)
    const network = fetch(req)
      .then((res) => {
        if (res && res.status === 200) cache.put(req, res.clone())
        return res
      })
      .catch(() => cached)
    return cached || network
  })())
})
