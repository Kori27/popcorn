// Popcorn · Tab switching, rendering shell and shared UI fragments.
'use strict';

/* ---------- render shell ---------- */
let tab = 'home', calSeg = Object.keys(state.follows).length ? 'mine' : 'series', renderId = 0, searchQ = '';
const TITLES = { home: 'Kezdőlap', watch: 'Nézd most', upcoming: 'Érkezik', search: 'Keresés', library: 'Listám' };
function setTab(t) {
  tab = t;
  document.querySelectorAll('.tab').forEach(b => b.dataset.tab === t ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  try { sessionStorage.setItem('sn.tab', t); } catch {}
  window.scrollTo(0, 0);
  render();
}
function render() {
  const id = ++renderId;
  $('#title').textContent = tr(TITLES[tab]);
  $('#sub').textContent = tab === 'home' ? new Date().toLocaleDateString(LOC(), { month: 'long', day: 'numeric', weekday: 'long' }) : '';
  const v = $('#view');
  ({ home: renderHome, watch: renderWatch, upcoming: renderUpcoming, search: renderSearch, library: renderLibrary })[tab](v, () => id === renderId);
}
const skelRows = n => `<div class="list">${Array.from({ length: n }, () => `<div class="row"><div class="skel" style="width:52px;aspect-ratio:2/3"></div><div style="display:flex;flex-direction:column;gap:6px"><div class="skel" style="height:14px;width:60%"></div><div class="skel" style="height:12px;width:80%"></div></div><span></span></div>`).join('')}</div>`;
const skelGrid = n => `<div class="grid">${Array.from({ length: n }, () => `<div><div class="skel" style="aspect-ratio:2/3"></div></div>`).join('')}</div>`;
const posterImg = s => s.img ? `<img class="poster" src="${esc(s.img)}" alt="" loading="lazy">` : `<div class="poster-ph">${esc(s.name)}</div>`;
const showCard = (s, extra = '') => {
  const sv = mine(s);
  const meta = sv ? `<span class="meta mine">✓ ${esc(sv.name)}</span>` : `<span class="meta">${esc([year(s), s.network].filter(Boolean).join(' · '))}</span>`;
  return `<button class="card${wide.matches && sheetShow?.id === s.id ? ' active' : ''}" data-open="${s.id}" aria-label="${esc(s.name)}">
  ${posterImg(s)}${state.follows[s.id] ? `<span class="flag" title="${tr('A listádon')}">${ICON.check}</span>` : ''}
  <span class="name">${esc(s.name)}</span>${extra}${extra && !sv ? '' : meta}</button>`;
};
/** Soft image behind the top of a detail page: a wide scene image, or a blurred poster. */
const backdrop = (url, wide = false) => url ? `<div class="backdrop${wide ? ' wide' : ''}" style="background-image:url('${esc(url)}')" aria-hidden="true"></div>` : '';
const errorBox = msg => `<div class="error">${esc(tr(msg))}</div>`;
const NET_ERR = 'Nem sikerült elérni a sorozat-adatbázist. Ellenőrizd az internetkapcsolatot, és próbáld újra.';

