// Sorozatnapló · Date helpers, episode progress, follow/watched actions.
'use strict';

/* ---------- dates & helpers ---------- */
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => ymd(new Date());
const addDays = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return ymd(d); };
const fmtDate = s => s ? new Date(s + 'T12:00:00').toLocaleDateString(LOC(), { year: 'numeric', month: 'short', day: 'numeric' }) : tr('Ismeretlen dátum');
function dayLabel(s) {
  const t = today();
  if (s === t) return tr('Ma');
  if (s === addDays(t, 1)) return tr('Holnap');
  if (s === addDays(t, -1)) return tr('Tegnap');
  const d = new Date(s + 'T12:00:00');
  const wd = d.toLocaleDateString(LOC(), { weekday: 'long' });
  return wd.charAt(0).toUpperCase() + wd.slice(1);
}
const relDays = s => {
  const diff = Math.round((new Date(s + 'T12:00:00') - new Date(today() + 'T12:00:00')) / DAY);
  if (diff === 0) return tr('ma'); if (diff === 1) return tr('holnap'); if (diff > 1) return tr('{n} nap múlva', { n: diff });
  return fmtDate(s);
};
const code = e => `S${pad(e.s)}E${pad(e.n ?? 0)}`;
const aired = e => e.stamp ? new Date(e.stamp) <= new Date() : (e.date && e.date <= today());
const regular = eps => eps.filter(e => e.n != null && e.s > 0);
const isWatched = (sid, eid) => !!state.watched[sid]?.[eid];
const STATUS = { 'Running': ['Fut', 'ok'], 'Ended': ['Befejeződött', 'neutral'], 'To Be Determined': ['Bizonytalan', 'warn'], 'In Development': ['Készül', 'accent'] };
const statusPill = s => { const [t, c] = STATUS[s] || [s || 'Ismeretlen', 'neutral']; return `<span class="pill ${c}">${esc(tr(t))}</span>`; };
const year = s => s.premiered ? s.premiered.slice(0, 4) : '';
function progressOf(sid, eps) {
  const a = regular(eps).filter(aired);
  const w = a.filter(e => isWatched(sid, e.id)).length;
  const next = a.find(e => !isWatched(sid, e.id)) || null;
  const upcoming = regular(eps).find(e => !aired(e) && e.date) || null;
  return { aired: a.length, watched: w, next, upcoming, total: regular(eps).length };
}

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.h); toast.h = setTimeout(() => t.hidden = true, 2200);
}
function updateBadge() {
  const n = Object.keys(state.follows).length, b = $('#libBadge');
  b.hidden = !n; b.textContent = n;
}

/* ---------- follow / watched ---------- */
function follow(show) {
  state.follows[show.id] = { id: show.id, name: show.name, img: show.img, network: show.network, status: show.status, added: Date.now() };
  save();
}
function toggleFollow(show) {
  if (state.follows[show.id]) { delete state.follows[show.id]; save(); toast(tr('{name} lekerült a listádról', { name: show.name })); }
  else { follow(show); toast(tr('{name} felkerült a listádra', { name: show.name })); }
}
async function setWatched(sid, eids, on) {
  const m = state.watched[sid] || (state.watched[sid] = {});
  eids.forEach(id => on ? (m[id] = 1) : delete m[id]);
  if (!Object.keys(m).length) delete state.watched[sid];
  if (on && !state.follows[sid]) {
    const s = await getShow(sid).catch(() => null);
    if (s) { follow(s); toast(tr('Megjelölve · {name} felkerült a listádra', { name: s.name })); return; }
  }
  save();
}

