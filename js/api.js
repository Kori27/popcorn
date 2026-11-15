// Popcorn · Cached fetch layer and TVmaze data access.
'use strict';

/* ---------- API with cache ---------- */
const inflight = new Map();
async function api(path, ttl, map = x => x) {
  const key = 'sn.c.' + path;
  const cached = ls.get(key, null);
  if (cached && Date.now() - cached.t < ttl) return cached.d;
  if (inflight.has(path)) return inflight.get(path);
  const p = (async () => {
    try {
      const url = path.startsWith('http') ? path : API + path;
      let r = await fetch(url);
      if (r.status === 429) { await new Promise(res => setTimeout(res, 1500)); r = await fetch(url); }
      if (r.status === 404) return null;
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = map(await r.json());
      ls.set(key, { t: Date.now(), d });
      return d;
    } catch (e) {
      if (cached) return cached.d;
      throw e;
    } finally { inflight.delete(path); }
  })();
  inflight.set(path, p);
  return p;
}
const strip = h => (h || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
const slimShow = s => s && ({
  id: s.id, name: s.name, img: s.image?.medium || null,
  network: s.network?.name || s.webChannel?.name || '', status: s.status,
  premiered: s.premiered, ended: s.ended, genres: s.genres || [], rating: s.rating?.average ?? null,
  summary: strip(s.summary), runtime: s.runtime || s.averageRuntime || null, url: s.url, lang: s.language, weight: s.weight || 0, imdb: s.externals?.imdb || null
});
const slimEp = e => ({ id: e.id, s: e.season, n: e.number, name: e.name, date: e.airdate, stamp: e.airstamp, rt: e.runtime, sum: strip(e.summary) || '' });
const getShow = id => api(`/shows/${id}`, DAY, slimShow);
// "?specials=0" also gives the cache a new key, so episodes stored before plot summaries existed are fetched again
const getEps = id => api(`/shows/${id}/episodes?specials=0`, 6 * H, a => a.map(slimEp));
const getHuName = id => {
  const cc = { hu: ['HU'], de: ['DE', 'AT'], en: [] }[state.lang] || [];
  if (!cc.length) return Promise.resolve(null);
  return api(`/shows/${id}/akas`, 7 * DAY, a => a).then(a => { for (const c of cc) { const x = (a || []).find(y => y.country?.code === c); if (x) return x.name; } return null; }).catch(() => null);
};
const searchShows = q => api(`/search/shows?q=${encodeURIComponent(q)}`, H, a => a.map(x => slimShow(x.show)));
const POPULAR = ['Severance', 'The Last of Us', 'Stranger Things', 'The Bear', 'Wednesday', 'Shōgun', 'Breaking Bad', 'Dark', 'Succession', 'Fallout'];
const getPopular = () => pool(POPULAR, 4, q => api(`/singlesearch/shows?q=${encodeURIComponent(q)}`, 7 * DAY, slimShow).catch(() => null))
  .then(a => a.filter(Boolean));

async function pool(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

