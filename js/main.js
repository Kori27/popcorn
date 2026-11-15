// Sorozatnapló · App start-up.
'use strict';

/* ---------- start ---------- */
try { const t = sessionStorage.getItem('sn.tab'); if (TITLES[t]) tab = t; } catch {}
document.querySelectorAll('.tab').forEach(b => b.dataset.tab === tab ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
applyStaticI18n();
updateOnline();
updateBadge();
syncWorkerData();
if (wide.matches) renderPlaceholder();
render();
const m0 = location.hash.match(/^#sorozat-(\d+)$/);
if (m0) { history.replaceState(null, '', location.pathname); history.pushState({ show: +m0[1] }, '', '#sorozat-' + m0[1]); openShow(+m0[1], false); }
else if (location.hash === '#beallitasok') { history.replaceState(null, '', location.pathname); openSettings(); }
else if (/^#film-.+/.test(location.hash)) { const id = decodeURIComponent(location.hash.slice(6)); history.replaceState(null, '', location.pathname); openFilm(id); }
else if (/^#wfilm-Q\d+$/.test(location.hash)) { const id = location.hash.slice(7); history.replaceState(null, '', location.pathname); openWikiFilm(id); }
else if (/^#mozi-\d+$/.test(location.hash)) { const id = +location.hash.slice(6); history.replaceState(null, '', location.pathname); openMovie(id); }
else if (location.hash) history.replaceState(null, '', location.pathname);
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
