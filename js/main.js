// Popcorn · App start-up.
'use strict';

/* ---------- start ---------- */
try { const t = sessionStorage.getItem('sn.tab'); if (TITLES[t]) tab = t; } catch {}
document.querySelectorAll('.tab').forEach(b => b.dataset.tab === tab ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
applyStaticI18n();
// lets the layout make room for the detail pane only while it is open (wide screens)
const syncPane = () => document.body.classList.toggle('pane-open', !$('#sheet').hidden);
new MutationObserver(syncPane).observe($('#sheet'), { attributes: true, attributeFilter: ['hidden'] });
syncPane();
// horizontal rails: fade + arrow buttons where more cards are hidden (arrows only with a mouse)
function wireRail(rail) {
  rail.dataset.rail = '1';
  const wrap = document.createElement('div');
  wrap.className = 'rail-wrap';
  rail.before(wrap);
  wrap.append(rail);
  const btn = dir => {
    const b = document.createElement('button');
    b.className = 'rail-nav ' + (dir < 0 ? 'prev' : 'next');
    b.type = 'button'; b.innerHTML = ICON.back; b.setAttribute('aria-label', tr(dir < 0 ? 'Előző' : 'Következő'));
    b.addEventListener('click', e => { e.stopPropagation(); rail.scrollBy({ left: dir * Math.max(200, rail.clientWidth * 0.8), behavior: 'smooth' }); });
    wrap.append(b);
  };
  btn(-1); btn(1);
  const update = () => {
    wrap.classList.toggle('more-l', rail.scrollLeft > 4);
    wrap.classList.toggle('more-r', rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 4);
    const img = rail.querySelector('.poster,.pw,.poster-ph');
    if (img) wrap.style.setProperty('--rail-top', (img.offsetTop + img.offsetHeight / 2) + 'px');
  };
  rail.addEventListener('scroll', update, { passive: true });
  new ResizeObserver(update).observe(rail);
  rail.addEventListener('load', update, true);
  update();
}
new MutationObserver(() => document.querySelectorAll('.rail:not([data-rail])').forEach(wireRail))
  .observe(document.body, { childList: true, subtree: true });
updateOnline();
updateBadge();
syncWorkerData();
if (wide.matches) renderPlaceholder();
render();
const m0 = location.hash.match(/^#sorozat-(\d+)$/);
if (m0) { history.replaceState(null, '', location.pathname); history.pushState({ show: +m0[1] }, '', '#sorozat-' + m0[1]); openShow(+m0[1], false); }
else if (location.hash === '#beallitasok') { history.replaceState(null, '', location.pathname); openSettings(); }
else if (/^#film-.+/.test(location.hash)) { const id = decodeURIComponent(location.hash.slice(6)); history.replaceState(null, '', location.pathname); openFilm(id); }
else if (/^#videa-[A-Za-z0-9]{16}$/.test(location.hash)) { const id = location.hash.slice(7); history.replaceState(null, '', location.pathname); playVidea(id); }
else if (location.hash === '#mit-nezzek') { history.replaceState(null, '', location.pathname); openPicker(); }
else if (/^#wfilm-Q\d+$/.test(location.hash)) { const id = location.hash.slice(7); history.replaceState(null, '', location.pathname); openWikiFilm(id); }
else if (/^#mozi-\d+$/.test(location.hash)) { const id = +location.hash.slice(6); history.replaceState(null, '', location.pathname); openMovie(id); }
else if (location.hash) history.replaceState(null, '', location.pathname);
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
