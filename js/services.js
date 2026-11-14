// Sorozatnapló · Streaming services and data shared with the service worker.
'use strict';

/* ---------- streaming services (matched by the show's original channel) ---------- */
const SERVICES = [
  { id: 'netflix', name: 'Netflix', match: ['netflix'] },
  { id: 'hbo', name: 'HBO Max', match: ['hbo', 'hbo max', 'max', 'cinemax'] },
  { id: 'disney', name: 'Disney+', match: ['disney+', 'hulu', 'fx', 'fx on hulu', 'abc', 'national geographic', 'disney channel'] },
  { id: 'apple', name: 'Apple TV+', match: ['apple tv+', 'apple tv'] },
  { id: 'prime', name: 'Prime Video', match: ['prime video', 'amazon', 'amazon freevee'] },
  { id: 'sky', name: 'SkyShowtime', match: ['skyshowtime', 'peacock', 'paramount+', 'showtime', 'nbc', 'cbs', 'paramount network'] },
  { id: 'rtl', name: 'RTL+', match: ['rtl', 'rtl klub', 'rtl+', 'rtl kettő', 'rtl ii', 'rtl gold'], free: true, url: 'https://www.rtlplusz.hu/kereses' },
  { id: 'tv2', name: 'TV2 Play', match: ['tv2', 'super tv2', 'tv2 play', 'tv2 comedy', 'tv2 kids'], free: true, url: 'https://tv2play.hu/kereses' },
  { id: 'mtva', name: 'Médiaklikk', match: ['m1', 'm2', 'm4 sport', 'm5', 'duna', 'duna tv', 'duna world', 'mtva', 'médiaklikk'], free: true }
];
const serviceOf = s => { const n = (s?.network || '').toLowerCase().trim(); return n ? SERVICES.find(sv => sv.match.includes(n)) || null : null; };
const mine = s => { const sv = serviceOf(s); return sv && state.services.includes(sv.id) ? sv : null; };

/* ---------- data shared with the service worker (background new-episode check) ---------- */
function syncWorkerData() {
  if (!('caches' in window)) return;
  const body = JSON.stringify({ notify: state.notify, follows: Object.values(state.follows).map(f => ({ id: f.id, name: f.name })) });
  caches.open('sn-data').then(c => c.put('sn-data.json', new Response(body, { headers: { 'Content-Type': 'application/json' } }))).catch(() => {});
}

