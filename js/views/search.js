// Sorozatnapló · Search tab.
'use strict';

/* ---------- Search ---------- */
function renderSearch(v, alive) {
  v.innerHTML = `<div class="search">${ICON.search}
    <input id="q" type="search" inputmode="search" enterkeyhint="search" autocomplete="off" placeholder="${tr('Sorozat címe, pl. Severance')}" value="${esc(searchQ)}" aria-label="${tr('Sorozat keresése')}">
    <button class="clear" id="qclear" aria-label="${tr('Keresés törlése')}" ${searchQ ? '' : 'hidden'}>${ICON.x}</button></div>
    <section id="results"></section>`;
  const q = $('#q');
  q.addEventListener('input', () => { searchQ = q.value; $('#qclear').hidden = !searchQ; clearTimeout(renderSearch.t); renderSearch.t = setTimeout(() => runSearch(alive), 320); });
  q.addEventListener('keydown', e => { if (e.key === 'Enter') { clearTimeout(renderSearch.t); runSearch(alive); q.blur(); } });
  $('#qclear').addEventListener('click', () => { searchQ = ''; q.value = ''; $('#qclear').hidden = true; runSearch(alive); q.focus(); });
  runSearch(alive);
  if (!searchQ && matchMedia('(pointer:fine)').matches) q.focus();
}
async function runSearch(alive) {
  const box = $('#results'); if (!box) return;
  const query = searchQ.trim();
  if (!query) {
    box.innerHTML = `<div class="sec-head"><h2>${tr('Népszerű sorozatok')}</h2></div><div id="pop">${skelGrid(6)}</div>`;
    try { const list = await getPopular(); if (alive() && $('#pop') && !searchQ.trim()) $('#pop').innerHTML = `<div class="grid">${list.map(s => showCard(s)).join('')}</div>`; }
    catch { if ($('#pop')) $('#pop').innerHTML = errorBox(NET_ERR); }
    return;
  }
  box.innerHTML = skelGrid(6);
  try {
    const res = await searchShows(query);
    if (!alive() || searchQ.trim() !== query) return;
    box.innerHTML = res.length
      ? `<div class="sec-head"><h2>${tr('Találatok')}</h2><span class="count">${tr('{n} sorozat', { n: res.length })}</span></div><div class="grid">${res.map(s => showCard(s)).join('')}</div>`
      : `<div class="empty"><h3>${tr('Nincs találat erre: „{q}”', { q: esc(query) })}</h3><p>${tr('Próbáld az eredeti (angol) címmel, vagy írj be csak egy részletet a címből.')}</p></div>`;
  } catch { if (alive()) box.innerHTML = errorBox(NET_ERR); }
}

