// Popcorn · Favourites (series and films) and the "you might like" recommendations built from them.
'use strict';

state.favs = state.favs || {};
const FAV_META = {};
ICON.heart = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.5 8.2 3.4 4.5 7 4.5c2.1 0 3.6 1.2 5 3 1.4-1.8 2.9-3 5-3 3.6 0 5.5 3.7 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/></svg>';

/** Heart button for a detail page. key: tv:ID, mv:ID (TMDB), wd:Q… (Wikidata), ia:ID (Internet Archive). */
function favBtn(key, meta) {
  if (meta) FAV_META[key] = meta;
  const on = !!state.favs[key];
  return `<button class="btn fav-btn${on ? ' on' : ''}" data-fav="${esc(key)}" aria-pressed="${on}">${ICON.heart}${tr(on ? 'Kedvenc' : 'Kedvencnek jelölöm')}</button>`;
}
function toggleFav(key) {
  const meta = FAV_META[key] || state.favs[key];
  if (!meta) return;
  if (state.favs[key]) { delete state.favs[key]; toast(tr('{name} lekerült a kedvenceid közül', { name: meta.title })); }
  else {
    state.favs[key] = { kind: meta.kind, ref: meta.ref, title: meta.title, img: meta.img || null, year: meta.year || '',
      genres: (meta.genres || []).slice(0, 5), imdb: meta.imdb || null, at: Date.now() };
    toast(tr('{name} a kedvenceid közé került', { name: meta.title }));
  }
  save();
  document.querySelectorAll(`[data-fav="${CSS.escape(key)}"]`).forEach(b => { b.outerHTML = favBtn(key); });
  if (tab === 'home' || (tab === 'library' && libSeg === 'favs')) render();
}

/* ---------- recommendations ---------- */
const normGenre = g => String(g).toLowerCase().replace(/[\s-]*film$/, '').trim();
const favList = () => Object.entries(state.favs).map(([key, f]) => ({ key, ...f })).sort((a, b) => (b.at || 0) - (a.at || 0));
/** Titles similar to the favourites, newest favourites weigh most. Each result says which favourite it is like. */
async function favRecommendations(limit = 16) {
  const favs = favList();
  const tvFavs = favs.filter(f => f.kind === 'tv'), filmFavs = favs.filter(f => f.kind !== 'tv');
  const skip = it => it.kind === 'tv'
    ? state.favs['tv:' + it.id] || state.follows[it.id] || Object.keys(state.watched[it.id] || {}).length
    : state.favs[it.watchedKey] || state.movies[it.watchedKey];
  const rank = (pool, list) => {
    if (!list.length) return [];
    const w = {};
    list.forEach((f, i) => (f.genres || []).forEach(g => { const n = normGenre(g); w[n] = (w[n] || 0) + 1 / (1 + i * 0.2); }));
    return pool.filter(it => !skip(it)).map(it => {
      const gs = it.genres.map(normGenre);
      const s = gs.reduce((a, g) => a + (w[g] || 0), 0) / Math.sqrt(Math.max(1, gs.length)) + it.rating / 20 + Math.random() * 0.12;
      // the favourite with the most genres in common is the reason shown on the card
      const because = list.map(f => [(f.genres || []).filter(g => gs.includes(normGenre(g))).length, f]).sort((a, b) => b[0] - a[0])[0];
      return [s, { ...it, because: because[0] ? because[1].title : null }];
    }).sort((a, b) => b[0] - a[0]).map(x => x[1]);
  };
  const [tvRecs, filmRecs] = await Promise.all([
    tvFavs.length ? pickPool('tv').then(p => rank(p, tvFavs)).catch(() => []) : [],
    filmFavs.length ? Promise.all([pickPool('movie').then(p => rank(p, filmFavs)).catch(() => []), tmdbFilmRecs(filmFavs, skip)]).then(([a, b]) => [...b, ...a]) : []
  ]);
  // mix series and films, drop duplicates
  const out = [], seen = new Set();
  for (let i = 0; out.length < limit && (i < tvRecs.length || i < filmRecs.length); i++)
    [tvRecs[i], filmRecs[i]].forEach(it => { if (it && out.length < limit && !seen.has(it.open)) { seen.add(it.open); out.push(it); } });
  return out;
}
/** With a TMDB key: TMDB's own "similar" lists for the three newest favourite films. */
async function tmdbFilmRecs(filmFavs, skip) {
  if (!tmdbKey()) return [];
  try {
    const genres = new Map((await tmdbGenres('movie')).map(g => [g.id, g.name]));
    const lists = await Promise.all(filmFavs.slice(0, 3).map(async f => {
      const id = f.kind === 'mv' ? f.ref : f.imdb ? await tmdbMovieIdByImdb(f.imdb).catch(() => null) : null;
      if (!id) return [];
      const d = await tmdb(`/movie/${id}/recommendations?language=${TLANG()}`, 3 * DAY).catch(() => ({ results: [] }));
      return (d.results || []).filter(m => m.poster_path).slice(0, 8).map(m => ({ kind: 'movie', id: m.id, open: `data-movie="${m.id}"`, title: m.title,
        year: (m.release_date || '').slice(0, 4), rating: m.vote_average || 0, genres: (m.genre_ids || []).map(g => genres.get(g)).filter(Boolean),
        img: TIMG + 'w342' + m.poster_path, summary: m.overview, watchedKey: 'mv:' + m.id, because: f.title }));
    }));
    const out = [];
    for (let i = 0; i < 8; i++) lists.forEach(l => { if (l[i] && !skip(l[i])) out.push(l[i]); });
    return out;
  } catch { return []; }
}

/* ---------- Home section ---------- */
function favHomeSection() {
  const favs = favList();
  if (!favs.length) return '';
  return `<section><div class="sec-head"><h2>${tr('Ez is érdekelhet')}</h2><span class="count">${esc(tr('Mert kedvelted: {t}', { t: favs.slice(0, 2).map(f => f.title).join(', ') }))}</span></div>
    <div id="favrecs">${skelGrid(6)}</div></section>`;
}
async function loadFavRecs(alive) {
  if (!$('#favrecs')) return;
  try {
    const list = await favRecommendations();
    await pool(list, 4, ensureImage);
    if (!alive() || !$('#favrecs')) return;
    $('#favrecs').innerHTML = list.length
      ? `<div class="rail">${list.map(it => itemCard(it, it.because ? `<span class="meta because">♥ ${esc(it.because)}</span>` : '')).join('')}</div>`
      : `<p class="note">${tr('Jelölj meg több kedvencet, és pontosabb ajánlásokat kapsz.')}</p>`;
  } catch { if (alive() && $('#favrecs')) $('#favrecs').innerHTML = errorBox(NET_ERR); }
}

/* ---------- My list → Favourites ---------- */
function renderFavs(v) {
  const all = favList(), kind = fget('favKind', 'all'), sort = fget('favSort', 'new');
  if (!all.length) {
    v.insertAdjacentHTML('beforeend', `<div class="empty"><h3>${tr('Még nincs kedvenced')}</h3><p>${tr('Nyiss meg egy sorozatot vagy filmet, és koppints a „Kedvencnek jelölöm” gombra. A kedvenceid alapján a Kezdőlapon ajánlunk hasonlókat.')}</p></div>`);
    return;
  }
  const list = all.filter(f => kind === 'all' || (kind === 'tv' ? f.kind === 'tv' : f.kind !== 'tv'));
  if (sort === 'title') list.sort((a, b) => a.title.localeCompare(b.title, LOC()));
  const bar = filterBar('favs', [
    { id: 'favKind', label: 'Típus', def: 'all', options: [['all', 'Mind'], ['tv', 'Sorozatok'], ['film', 'Filmek']] },
    { id: 'favSort', label: 'Rendezés', def: 'new', options: [['new', 'Legújabb'], ['title', 'Cím (A–Z)']] }]);
  v.insertAdjacentHTML('beforeend', bar + (list.length ? `<div class="list">${list.map(f => `<div class="row" ${openAttr(f)} style="cursor:pointer">
      ${f.img ? `<img class="thumb" src="${esc(f.img)}" alt="" loading="lazy">` : '<div class="thumb"></div>'}
      <div class="body"><div class="t1">${esc(f.title)}</div>
      <div class="t3">${esc([tr(f.kind === 'tv' ? 'Sorozat' : 'Film'), f.year, (f.genres || []).slice(0, 2).map(f.kind === 'tv' ? genreName : g => g).join(', ')].filter(Boolean).join(' · '))}</div></div>
      <button class="check fav-x on" data-fav="${esc(f.key)}" aria-pressed="true" aria-label="${esc(f.title)}: ${tr('Eltávolítás a kedvencek közül')}">${ICON.heart}</button></div>`).join('')}</div>` : noMatch()));
}
