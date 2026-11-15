// Popcorn · Search tab: series (TVmaze) and films (Wikipedia + Wikidata, no key needed), with filters.
'use strict';

let searchKind = 'tv';
let videaCurrentPage = 1;
let videaLoadingMore = false;
const SEARCH_DECADES = [['', 'Bármikor'], ['2020', '2020 után'], ['2010', '2010-es évek'], ['2000', '2000-es évek'], ['1990', '1990-es évek'], ['old', '1990 előtt']];
const inDecade = (year, dec) => {
  const y = +String(year || '').slice(0, 4);
  if (!dec) return true;
  if (!y) return false;
  if (dec === 'old') return y < 1990;
  if (dec === '2020') return y >= 2020;
  return y >= +dec && y < +dec + 10;
};

function renderSearch(v, alive) {
  const film = searchKind === 'film';
  const isVideaSearch = typeof videa !== 'undefined' && !!videa;
  v.innerHTML = `<div class="seg" role="group" aria-label="${tr('Keresés')}">${[['tv', 'Sorozatok'], ['film', 'Filmek']].map(([k, l]) => `<button data-skind="${k}" aria-pressed="${searchKind === k}">${tr(l)}</button>`).join('')}</div>
    <div class="search">${ICON.search}
    <input id="q" type="search" inputmode="search" enterkeyhint="search" autocomplete="off" placeholder="${tr(film ? 'Film címe, pl. Eredet' : isVideaSearch ? 'Videa-videó keresése' : 'Sorozat címe, pl. Severance')}" value="${esc(searchQ)}" aria-label="${tr(film ? 'Film keresése' : 'Sorozat keresése')}">
    <button class="clear" id="qclear" aria-label="${tr('Keresés törlése')}" ${searchQ ? '' : 'hidden'}>${ICON.x}</button></div>
    ${isVideaSearch ? '' : film ? filterBar('search', [
        { id: 'sfDecade', label: 'Megjelenés éve', def: '', options: SEARCH_DECADES },
        { id: 'sfFilmSort', label: 'Rendezés', def: 'rel', options: [['rel', 'Relevancia'], ['new', 'Legújabb'], ['old', 'Legrégebbi']] }])
      : filterBar('search', [
        { id: 'stStatus', label: 'Állapot', def: '', options: [['', 'Mind'], ['Running', 'Fut'], ['Ended', 'Befejeződött']] },
        { id: 'stDecade', label: 'Indult', def: '', options: SEARCH_DECADES },
        ...(state.services.length ? [{ id: 'stWhere', label: 'Hol', def: 'all', options: [['all', 'Mindenhol'], ['mine', 'Az előfizetéseimen']] }] : []),
        { id: 'stSort', label: 'Rendezés', def: 'rel', options: [['rel', 'Relevancia'], ['rating', 'Értékelés'], ['new', 'Legújabb']] }])}
    <section id="results"></section>`;
  FILTER_HANDLERS.search = () => runSearch(alive);
  const q = $('#q');
  q.addEventListener('input', () => { searchQ = q.value; $('#qclear').hidden = !searchQ; clearTimeout(renderSearch.t); renderSearch.t = setTimeout(() => runSearch(alive), 320); });
  q.addEventListener('keydown', e => { if (e.key === 'Enter') { clearTimeout(renderSearch.t); runSearch(alive); q.blur(); } });
  $('#qclear').addEventListener('click', () => { searchQ = ''; q.value = ''; $('#qclear').hidden = true; runSearch(alive); q.focus(); });
  runSearch(alive);
  if (!searchQ && matchMedia('(pointer:fine)').matches) q.focus();
}

function filterShows(list) {
  const st = fget('stStatus', ''), dec = fget('stDecade', ''), where = fget('stWhere', 'all'), sort = fget('stSort', 'rel');
  const out = list.filter(s => (!st || s.status === st) && inDecade(s.premiered, dec) && (where === 'all' || !state.services.length || mine(s)));
  if (sort === 'rating') out.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  if (sort === 'new') out.sort((a, b) => String(b.premiered || '').localeCompare(String(a.premiered || '')));
  return out;
}
function filterFilms(list) {
  const dec = fget('sfDecade', ''), sort = fget('sfFilmSort', 'rel');
  const out = list.filter(f => inDecade(f.year, dec));
  if (sort === 'new') out.sort((a, b) => String(b.year || '').localeCompare(String(a.year || '')));
  if (sort === 'old') out.sort((a, b) => String(a.year || '9999').localeCompare(String(b.year || '9999')));
  return out;
}

async function loadMoreVidea(query, stale) {
  if (videaLoadingMore) return;
  const button = $('#videaMore'), grid = $('#videaGrid'), status = $('#videaMoreStatus');
  if (!button || !grid) return;
  videaLoadingMore = true;
  button.disabled = true;
  button.textContent = 'Betöltés…';
  try {
    const nextPage = videaCurrentPage + 1;
    const response = await searchVideaVideos(query, nextPage);
    if (stale()) return;
    const videos = Array.isArray(response?.videos) ? response.videos : [];
    const existing = new Set([...grid.querySelectorAll('[data-videa]')].map(el => el.dataset.videa));
    const fresh = videos.filter(item => item?.vcode && !existing.has(item.vcode));
    if (!fresh.length) {
      if (status) status.textContent = videos.length
        ? 'A Videa ismételte az előző oldal videóit; további különálló találatot nem adott.'
        : 'A Videa nem adott több videót ezen az oldalon.';
      button.remove();
      return;
    }
    const html = fresh.map(item => `<button class="card" data-videa="${esc(item.vcode)}" aria-label="${esc(item.title || 'Videa-videó')}">
      ${item.thumbnail ? `<img class="poster" src="${esc(item.thumbnail)}" alt="" loading="lazy">` : '<div class="poster-ph">Videa</div>'}
      <span class="name">${esc(item.title || 'Névtelen videó')}</span>
      <span class="meta">${esc([item.duration, item.channel?.name].filter(Boolean).join(' · '))}</span></button>`).join('');
    grid.insertAdjacentHTML('beforeend', html);
    videaCurrentPage = nextPage;
    const shown = grid.querySelectorAll('[data-videa]').length;
    const total = Number(response?.totalhits || $('#videaCount')?.textContent.match(/\\d+/)?.[0] || 0);
    const count = $('#videaCount');
    if (count) count.textContent = `${total || 'Több'} találat · ${shown} betöltve`;
    if (status) status.textContent = `${shown} / ${total || 'ismeretlen számú'} videó betöltve`;
    if ((total && shown >= total) || fresh.length < videos.length) button.remove();
    else { button.disabled = false; button.textContent = 'További találatok betöltése'; }
  } catch (error) {
    if (status) status.textContent = `Nem sikerült betölteni: ${error?.message || error}`;
    button.disabled = false;
    button.textContent = 'Újrapróbálás';
  } finally { videaLoadingMore = false; }
}

async function runSearch(alive) {
  const box = $('#results'); if (!box) return;
  const query = searchQ.trim(), kind = searchKind;
  const stale = () => !alive() || searchQ.trim() !== query || searchKind !== kind;

  if (kind === 'film') {
    if (!query) {
      const mineList = Object.values(state.movies).sort((a, b) => b.added - a.added).slice(0, 12);
      box.innerHTML = `<div class="empty"><h3>${tr('Keress filmet, kulcs nélkül')}</h3><p>${tr('Írd be egy film címét magyarul vagy eredetiben. A találatokat a Wikipédiából hozzuk; a filmeket megnézendőnek vagy megnézettnek jelölheted, és értékelheted.')}</p></div>
        ${mineList.length ? `<div class="sec-head"><h2>${tr('Filmjeim')}</h2></div><div class="list">${mineList.map(m => `<div class="row" ${openAttr(m)} style="cursor:pointer">${m.img ? `<img class="thumb" src="${esc(m.img)}" alt="" loading="lazy">` : '<div class="thumb"></div>'}<div class="body"><div class="t1">${esc(m.title)}</div><div class="t3">${esc(filmMeta(m))} · ${tr(m.status === 'seen' ? 'Megnézve' : 'Megnézendő')}</div></div><span></span></div>`).join('')}</div>` : ''}`;
      return;
    }
    box.innerHTML = skelGrid(6);
    try {
      const res = filterFilms(await searchFilms(query));
      if (stale()) return;
      box.innerHTML = res.length
        ? `<div class="sec-head"><h2>${tr('Találatok')}</h2><span class="count">${tr('{n} film', { n: res.length })}</span></div><div class="grid">${res.map(filmCardW).join('')}</div>`
        : `<div class="empty"><h3>${tr('Nincs találat erre: „{q}”', { q: esc(query) })}</h3><p>${tr('Próbáld a pontos címmel (magyarul vagy eredetiben), vagy lazíts a szűrőkön.')}</p></div>`;
    } catch { if (!stale()) box.innerHTML = errorBox(FILM_ERR); }
    return;
  }
  if (!query) {
    box.innerHTML = `<div class="sec-head"><h2>${tr('Népszerű sorozatok')}</h2></div><div id="pop">${skelGrid(6)}</div>`;
    try { const list = filterShows(await getPopular()); if (!stale() && $('#pop')) $('#pop').innerHTML = list.length ? `<div class="grid">${list.map(s => showCard(s)).join('')}</div>` : `<p class="note">${tr('Lazíts a szűrőkön.')}</p>`; }
    catch { if ($('#pop')) $('#pop').innerHTML = errorBox(NET_ERR); }
    return;
  }
  box.innerHTML = skelGrid(6);
  try {
    // TVmaze knows original (mostly English) titles; Wikipedia + Wikidata add matches by the local title
    const [direct, local] = await Promise.all([searchShows(query).catch(() => []), searchShowsLocal(query).catch(() => [])]);
    if (!direct.length && !local.length && !navigator.onLine) throw new Error('offline');
    const ids = new Set(), all = [...local, ...direct].filter(s => s && !ids.has(s.id) && ids.add(s.id));
    const res = filterShows(all);
    if (stale()) return;
    box.innerHTML = res.length
      ? `<div class="sec-head"><h2>${tr('Találatok')}</h2><span class="count">${tr('{n} sorozat', { n: res.length })}</span></div><div class="grid">${res.map(s => showCard(s)).join('')}</div>`
      : `<div class="empty"><h3>${tr('Nincs találat erre: „{q}”', { q: esc(query) })}</h3><p>${tr(all.length ? 'Lazíts a szűrőkön.' : 'Próbáld az eredeti (angol) címmel, vagy írj be csak egy részletet a címből.')}</p></div>`;
  } catch { if (!stale()) box.innerHTML = errorBox(NET_ERR); }
}
