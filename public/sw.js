// 缓存策略（避免「刷新看不到更新」）：
//  - 带 hash 的静态资源(JS/CSS/字体/图标)：cache-first（内容不可变，命中即用）
//  - 其它（HTML 导航 + public/data/*.json 等）：network-first
//      在线 → 总是取最新并回填缓存；离线 → 回落到缓存。
// 升级缓存版本号会在 activate 时清掉旧缓存。
const CACHE = 'holdings-tracker-v2'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    await self.clients.claim()
  })())
})

// Vite 产物：/assets/xxx-<hash>.js|css 等，内容随 hash 变化，可永久缓存
function isImmutableAsset(pathname) {
  return /\/assets\/.+\.[0-9a-zA-Z_-]{8,}\.(?:js|css|woff2?|ttf|png|svg|jpg|jpeg|webp)$/.test(pathname)
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== location.origin) return

  // 不可变资源：cache-first
  if (isImmutableAsset(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE)
      const cached = await cache.match(req)
      if (cached) return cached
      const res = await fetch(req)
      if (res && res.status === 200) cache.put(req, res.clone())
      return res
    })())
    return
  }

  // HTML / 数据 / 其它：network-first，离线回落缓存
  event.respondWith((async () => {
    const cache = await caches.open(CACHE)
    try {
      const res = await fetch(req)
      if (res && res.status === 200) cache.put(req, res.clone())
      return res
    } catch {
      const cached = await cache.match(req)
      return cached || Response.error()
    }
  })())
})
