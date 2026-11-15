// Sorozatnapló service worker: keeps the app shell available offline and,
// where the browser supports Periodic Background Sync, checks followed series for new episodes.
// Series data is cached by the page itself (localStorage), so API calls pass straight through.
const CACHE = 'sorozatnaplo-v6';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'css/app.css', 'js/core.js', 'js/i18n.js', 'js/storage.js', 'js/theme.js', 'js/services.js', 'js/api.js', 'js/helpers.js', 'js/filters.js', 'js/views/shell.js', 'js/views/home.js', 'js/views/search.js', 'js/views/upcoming.js', 'js/trailers.js', 'js/providers.js', 'js/films.js', 'js/views/movie.js', 'js/views/watch.js', 'js/views/library.js', 'js/views/stats.js', 'js/views/detail.js', 'js/views/settings.js', 'js/backup.js', 'js/events.js', 'js/main.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== 'sn-data').map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // Network first so updates arrive, cache as fallback when offline.
  e.respondWith(
    fetch(e.request).then(r => {
      const copy = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return r;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html')))
  );
});

/* ---------- background check for new episodes ---------- */
const pad = n => String(n).padStart(2, '0');
async function checkNewEpisodes() {
  const store = await caches.open('sn-data');
  const dataRes = await store.match('sn-data.json');
  if (!dataRes) return;
  const data = await dataRes.json();
  if (!data.notify || !data.follows?.length) return;
  const metaRes = await store.match('sn-check.json');
  const last = metaRes ? (await metaRes.json()).last : Date.now();
  const now = Date.now(), found = [];
  for (const show of data.follows.slice(0, 60)) {
    try {
      const r = await fetch(`https://api.tvmaze.com/shows/${show.id}/episodes`);
      if (!r.ok) continue;
      (await r.json())
        .filter(e => e.airstamp && Date.parse(e.airstamp) > last && Date.parse(e.airstamp) <= now && e.number != null)
        .forEach(e => found.push({ show, e }));
    } catch {}
  }
  for (const { show, e } of found.slice(0, 6)) {
    await self.registration.showNotification(show.name, {
      body: `Új rész jelent meg: S${pad(e.season)}E${pad(e.number)} · ${e.name}`,
      icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: `ep-${e.id}`,
      data: { url: `./#sorozat-${show.id}` }
    });
  }
  await store.put('sn-check.json', new Response(JSON.stringify({ last: now })));
}
self.addEventListener('periodicsync', e => {
  if (e.tag === 'new-episodes') e.waitUntil(checkNewEpisodes());
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(wins => {
    for (const w of wins) if ('focus' in w) return w.navigate(url).then(c => (c || w).focus());
    return self.clients.openWindow(url);
  }));
});
