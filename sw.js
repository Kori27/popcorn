// Popcorn service worker: keeps the app shell available offline and,
// where the browser supports Periodic Background Sync, checks followed series for new episodes.
// Series data is cached by the page itself (localStorage), so API calls pass straight through.
const CACHE = 'popcorn-v24';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'css/app.css?v=24', 'js/core.js?v=24', 'js/i18n.js?v=24', 'js/storage.js?v=24', 'js/theme.js?v=24', 'js/services.js?v=24', 'js/api.js?v=24', 'js/helpers.js?v=24', 'js/filters.js?v=24', 'js/views/shell.js?v=24', 'js/views/home.js?v=24', 'js/views/search.js?v=24', 'js/views/upcoming.js?v=24', 'js/trailers.js?v=24', 'js/providers.js?v=24', 'js/films.js?v=24', 'js/localize.js?v=24', 'js/views/movie.js?v=24', 'js/views/watch.js?v=24', 'js/views/library.js?v=24', 'js/views/stats.js?v=24', 'js/views/picker.js?v=24', 'js/views/detail.js?v=24', 'js/views/settings.js?v=24', 'js/backup.js?v=24', 'js/firebase-config.js?v=24', 'js/account.js?v=24', 'js/events.js?v=24', 'js/main.js?v=24'];

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
  // 'no-cache' makes the browser ask the server every time (a quick 304 when nothing changed), instead of
  // reusing its own copy for up to 10 minutes as GitHub Pages allows — otherwise an update could mix old and new files.
  const fresh = e.request.mode === 'navigate'
    ? new Request(e.request.url, { cache: 'no-cache', credentials: 'same-origin' })
    : new Request(e.request, { cache: 'no-cache' });
  e.respondWith(
    fetch(fresh).then(r => {
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
