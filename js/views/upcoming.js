// Popcorn · Coming soon tab: followed shows, premieres, cinema, today.
'use strict';

/* ---------- Calendar ---------- */
async function renderUpcoming(v, alive) {
  const segs = [['mine', 'Követett sorozataim'], ['series', 'Új sorozatok és évadok'], ['movies', 'Mozifilmek'], ['web', 'Ma: streaming'], ['hu', 'Ma: magyar TV']];
  v.innerHTML = `<div class="seg" role="group" aria-label="${tr('Érkezik')}">${segs.map(([k, l]) => `<button data-seg="${k}" aria-pressed="${calSeg === k}">${tr(l)}</button>`).join('')}</div><div id="cal">${skelRows(4)}</div>`;
  const box = $('#cal');
  try {
    if (calSeg === 'series') {
      const all = await premieres();
      if (!alive()) return;
      if (!all.length) { box.innerHTML = `<div class="empty"><h3>${tr('Nincs bejelentett premier')}</h3><p>${tr('A következő 7 napra most nincs adat.')}</p></div>`; return; }
      const where = fget('upWhere', 'all'), genre = fget('upGenre', '');
      const genres = [...new Set(all.flatMap(x => x.show.genres || []))].sort((a, b) => a.localeCompare(b));
      const items = all.filter(x => (where === 'all' || (where === 'mine' ? !!mine(x.show) : x.src === where)) && (!genre || (x.show.genres || []).includes(genre)));
      const bar = filterBar('upcoming', [
        { id: 'upWhere', label: 'Hol', def: 'all', options: [['all', 'Mindenhol'], ['web', 'Streaming'], ['US', 'Amerikai TV'], ['HU', 'Magyar TV'], ...(state.services.length ? [['mine', 'Az előfizetéseimen']] : [])] },
        { id: 'upGenre', label: 'Műfaj', def: '', options: [['', 'Mind'], ...genres.map(g => [g, genreName(g)])] }]);
      box.innerHTML = bar + (items.length
        ? `<p class="note">${tr('Új sorozatok és új évadok első részei a következő 7 napban: streaming, amerikai és magyar csatornák. {n} cím.', { n: items.length })}</p>` + groupByDay(items, false, true)
        : noMatch());
      return;
    }
    if (calSeg === 'movies') { await renderMovies(box, alive); return; }
    if (calSeg === 'mine') {
      const ids = Object.keys(state.follows);
      if (!ids.length) { box.innerHTML = `<div class="empty"><h3>${tr('Még nem követsz sorozatot')}</h3><p>${tr('A követett sorozataid következő részei itt jelennek meg napokra bontva.')}</p><button class="btn primary" data-tab="search">${ICON.search}${tr('Sorozat keresése')}</button></div>`; return; }
      const data = await pool(ids, 4, async id => ({ show: state.follows[id], eps: await getEps(id) || [] }));
      if (!alive()) return;
      const end = addDays(today(), 45), items = [];
      data.forEach(({ show, eps }) => regular(eps).filter(e => e.date && e.date >= today() && e.date <= end).forEach(ep => items.push({ show, ep })));
      items.sort((a, b) => (a.ep.stamp || a.ep.date).localeCompare(b.ep.stamp || b.ep.date));
      box.innerHTML = items.length ? groupByDay(items) : `<div class="empty"><h3>${tr('Nincs bejelentett új rész')}</h3><p>${tr('A követett sorozataidnak a következő 45 napban nem jelenik meg új epizódja. Ha bejelentenek egyet, itt látod.')}</p></div>`;
    } else {
      const path = calSeg === 'web' ? `/schedule/web?date=${today()}` : `/schedule?country=HU&date=${today()}`;
      const raw = await api(path, 3 * H, a => a.map(x => ({ show: slimShow(x._embedded?.show || x.show), ep: slimEp(x) })));
      if (!alive()) return;
      const seen = new Set();
      const items = (raw || []).filter(x => x.show && x.ep.n != null && !seen.has(x.show.id) && seen.add(x.show.id))
        .sort((a, b) => calSeg === 'hu'
          ? (a.ep.stamp || '').localeCompare(b.ep.stamp || '')
          : (b.show.weight || 0) - (a.show.weight || 0) || (b.show.img ? 1 : 0) - (a.show.img ? 1 : 0));
      box.innerHTML = items.length
        ? `<p class="note">${tr(calSeg === 'web' ? 'Ma megjelenő részek a streamingszolgáltatóknál, népszerűség szerint.' : 'Ma a magyar tévécsatornákon, időrendben.')} ${tr('{n} sorozat', { n: items.length })}.</p>` + groupByDay(items, calSeg === 'hu')
        : `<div class="empty"><h3>${tr('Mára nincs adat')}</h3><p>${tr('Erre a napra az adatbázisban nincs műsor ebben a nézetben.')}</p></div>`;
    }
  } catch { if (alive()) box.innerHTML = errorBox(NET_ERR); }
}

/* ---------- Upcoming: series premieres (TVmaze) and cinema releases (TMDB) ---------- */
async function premieres() {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today(), i));
  const paths = days.flatMap(d => [`/schedule/web?date=${d}`, `/schedule?country=US&date=${d}`, `/schedule?country=HU&date=${d}`]);
  const lists = await pool(paths, 4, p => api(p, 6 * H, a => a.filter(x => x.number === 1)
    .map(x => ({ show: slimShow(x._embedded?.show || x.show), ep: slimEp(x) })))
    .then(l => (l || []).map(x => ({ ...x, src: p.includes('/web') ? 'web' : p.includes('=HU') ? 'HU' : 'US' }))).catch(() => []));
  const best = new Map();
  lists.flat().forEach(it => {
    if (!it.show || !it.ep.date) return;
    const hu = /^(rtl|tv2|m1|duna|super tv2)/i.test(it.show.network || '');
    if (!hu && (it.show.weight || 0) < 85) return;
    const cur = best.get(it.show.id);
    if (!cur || it.ep.date < cur.ep.date) best.set(it.show.id, it);
  });
  return [...best.values()].sort((a, b) => a.ep.date.localeCompare(b.ep.date) || (b.show.weight || 0) - (a.show.weight || 0));
}

const TMDB = 'https://api.themoviedb.org/3', TIMG = 'https://image.tmdb.org/t/p/';
const tmdbKey = () => (state.tmdb || '').trim();
async function tmdb(path, ttl = DAY) {
  const k = tmdbKey();
  if (!k) throw new Error('nokey');
  const bearer = k.length > 40;
  const cacheKey = 'sn.c.tmdb' + path, c = ls.get(cacheKey, null);
  if (c && Date.now() - c.t < ttl) return c.d;
  const url = TMDB + path + (bearer ? '' : (path.includes('?') ? '&' : '?') + 'api_key=' + encodeURIComponent(k));
  const r = await fetch(url, { headers: bearer ? { Authorization: 'Bearer ' + k } : {} });
  if (r.status === 401) throw new Error('badkey');
  if (!r.ok) { if (c) return c.d; throw new Error('HTTP ' + r.status); }
  const d = await r.json();
  ls.set(cacheKey, { t: Date.now(), d });
  return d;
}
const tmdbHelpHtml = () => `<ol class="steps">
  <li>${tr('Regisztrálj ingyen a {link} oldalon.', { link: '<a href="https://www.themoviedb.org/signup" target="_blank" rel="noopener">themoviedb.org</a>' })}</li>
  <li>${tr('A profilodban nyisd meg: Beállítások → API, és kérj egy ingyenes kulcsot (Developer / személyes használat).')}</li>
  <li>${tr('Másold ki az „API Read Access Token” vagy az „API Key” értéket, és illeszd be ide az app Beállításaiba.')}</li></ol>`;
const noKeyPanel = what => `<div class="panel"><h3>${tr('{what} egy ingyenes kulccsal', { what: tr(what) })}</h3>
  <p>${tr('Ehhez a TMDB filmadatbázist használjuk, amihez egy saját, ingyenes kulcs kell. Egyszer kell beállítani, pár perc.')}</p>${tmdbHelpHtml()}
  <div><button class="btn primary" data-settings>${tr('Kulcs megadása')}</button></div></div>`;
const keyError = e => e.message === 'badkey' ? errorBox('A megadott TMDB-kulcs nem érvényes. Ellenőrizd a Beállításokban.') : errorBox(NET_ERR);

async function renderMovies(box, alive) {
  if (!tmdbKey()) { box.innerHTML = noKeyPanel('Mozifilmek és előzetesek'); return; }
  try {
    const pages = await Promise.all([1, 2, 3].map(p => tmdb(`/movie/upcoming?language=${TLANG()}&region=HU&page=${p}`, 12 * H).catch(() => ({ results: [] }))));
    if (!alive()) return;
    const t = today(), seen = new Set();
    const genreList = await tmdbGenres('movie');
    if (!alive()) return;
    const genre = fget('cinGenre', ''), sort = fget('cinSort', 'date');
    const allMovies = pages.flatMap(p => p.results || []).filter(m => m.release_date >= t && !seen.has(m.id) && seen.add(m.id));
    const movies = allMovies.filter(m => !genre || (m.genre_ids || []).includes(+genre))
      .sort((a, b) => a.release_date.localeCompare(b.release_date) || b.popularity - a.popularity);
    const bar = filterBar('upcoming', [
      { id: 'cinGenre', label: 'Műfaj', def: '', options: [['', 'Mind'], ...genreList.filter(g => allMovies.some(m => (m.genre_ids || []).includes(g.id))).map(g => [String(g.id), g.name])] },
      { id: 'cinSort', label: 'Rendezés', def: 'date', options: [['date', 'Bemutató szerint'], ['popular', 'Népszerűség']] }]);
    if (allMovies.length && !movies.length) { box.innerHTML = bar + noMatch(); return; }
    if (movies.length && sort === 'popular') {
      box.innerHTML = bar + `<div class="grid">${movies.slice().sort((a, b) => b.popularity - a.popularity)
        .map(m => tmdbCard(m, 'movie').replace(/<span class="meta">[^<]*<\/span><\/button>$/, `<span class="meta">${esc(tr('Mozi'))} · ${esc(relDays(m.release_date))}</span></button>`)).join('')}</div>`;
      return;
    }
    if (!movies.length) { box.innerHTML = `<div class="empty"><h3>${tr('Nincs bejelentett bemutató')}</h3><p>${tr('A következő hetekre most nincs adat a magyar mozibemutatókról.')}</p></div>`; return; }
    const days = new Map();
    movies.forEach(m => { if (!days.has(m.release_date)) days.set(m.release_date, []); days.get(m.release_date).push(m); });
    box.innerHTML = bar + `<p class="note">${tr('Magyarországi mozibemutatók. Koppints egy filmre az előzetesért.')}</p>` + [...days].map(([d, arr]) => `<div class="day"><h3><b>${dayLabel(d)}</b> · ${fmtDate(d)}</h3><div class="list">
      ${arr.map(m => `<div class="row" data-movie="${m.id}">
        ${m.poster_path ? `<img class="thumb" src="${TIMG}w154${esc(m.poster_path)}" alt="" loading="lazy">` : '<div class="thumb"></div>'}
        <div class="body"><div class="t1">${esc(m.title)}</div>
        <div class="t2">${m.original_title !== m.title ? esc(m.original_title) : '&nbsp;'}</div>
        <div class="t3">${tr('Mozibemutató')} · ${relDays(d)}${m.vote_count > 20 ? ` · ★ ${m.vote_average.toFixed(1)}` : ''}</div></div><span class="pill accent">${tr('Mozi')}</span></div>`).join('')}
      </div></div>`).join('');
  } catch (e) { if (alive()) box.innerHTML = keyError(e); }
}

