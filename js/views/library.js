// Sorozatnapló · My list tab: series, films, personal star ratings and statistics.
'use strict';

/* ---------- Personal ratings (stored per device; shaped so they can be shared later) ---------- */
state.ratings = state.ratings || {};
const RATE_META = {};
const STAR = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 2.8 2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/></svg>';
function rateWidget(key, meta) {
  if (meta) RATE_META[key] = meta;
  const cur = state.ratings[key]?.stars || 0;
  return `<div class="panel" data-ratepanel="${esc(key)}"><h3>${tr('Saját értékelésed')}</h3>
    <div class="stars" role="group" aria-label="${tr('Saját értékelésed')}">${[1, 2, 3, 4, 5].map(n => `<button class="star${n <= cur ? ' on' : ''}" data-rate="${esc(key)}|${n}" aria-pressed="${n === cur}" aria-label="${tr('{n} csillag', { n })}">${STAR}</button>`).join('')}</div>
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><span class="note">${cur ? tr('Értékelve: {n}/5', { n: cur }) : tr('Koppints a csillagokra az értékeléshez.')}</span>
    ${cur ? `<button class="linkbtn" data-unrate="${esc(key)}">${tr('Értékelés törlése')}</button>` : ''}</div></div>`;
}
function setRating(key, stars) {
  const meta = RATE_META[key] || state.ratings[key];
  if (!meta) return;
  if (stars) state.ratings[key] = { kind: meta.kind, ref: meta.ref, title: meta.title, img: meta.img || null, stars, at: Date.now() };
  else delete state.ratings[key];
  save();
  toast(tr(stars ? 'Értékelés elmentve' : 'Értékelés törölve'));
  document.querySelectorAll(`[data-ratepanel="${CSS.escape(key)}"]`).forEach(p => { p.outerHTML = rateWidget(key); });
  if (tab === 'library' && libSeg === 'ratings') render();
}
const starsText = n => '★'.repeat(n) + '☆'.repeat(5 - n);
/** Attribute that opens the right page for a rating or film entry. */
const openAttr = r => r.kind === 'tv' ? `data-open="${r.ref}"` : r.kind === 'ia' ? `data-film="${esc(r.ref)}"` : r.kind === 'wd' ? `data-wfilm="${esc(r.ref)}"` : `data-movie="${r.ref}"`;
let libSeg = 'shows', filmSeg = 'want';
const noMatch = text => `<div class="empty"><h3>${tr('Nincs találat')}</h3><p>${tr(text || 'Lazíts a szűrőkön.')}</p></div>`;

function renderRatings(v) {
  const kind = fget('rateKind', 'all'), minStars = +fget('rateMin', '0'), sort = fget('rateSort', 'stars');
  const list = Object.entries(state.ratings).map(([key, r]) => ({ key, ...r }))
    .filter(r => (kind === 'all' || (kind === 'tv' ? r.kind === 'tv' : r.kind !== 'tv')) && r.stars >= minStars);
  list.sort((a, b) => sort === 'stars' ? (b.stars - a.stars || b.at - a.at) : sort === 'title' ? a.title.localeCompare(b.title, LOC()) : b.at - a.at);
  const bar = filterBar('ratings', [
    { id: 'rateKind', label: 'Típus', def: 'all', options: [['all', 'Mind'], ['tv', 'Sorozatok'], ['film', 'Filmek']] },
    { id: 'rateMin', label: 'Legalább', def: '0', options: [['0', 'Mind'], ['3', '3 csillag'], ['4', '4 csillag'], ['5', '5 csillag']] },
    { id: 'rateSort', label: 'Rendezés', def: 'stars', options: [['stars', 'Értékelés'], ['new', 'Legújabb'], ['title', 'Cím (A–Z)']] }]);
  const rows = list.map((r, i) => `<div class="row" ${openAttr(r)} style="cursor:pointer">
      ${r.img ? `<img class="thumb" src="${esc(r.img)}" alt="" loading="lazy">` : '<div class="thumb"></div>'}
      <div class="body"><div class="t1"><span class="code">#${i + 1}</span> ${esc(r.title)}</div>
      <div class="t2" style="color:#E3A008;letter-spacing:2px" aria-label="${tr('{n} csillag', { n: r.stars })}">${starsText(r.stars)}</div>
      <div class="t3">${tr(r.kind === 'tv' ? 'Sorozatok' : 'Filmek')} · ${fmtDate(ymd(new Date(r.at)))}</div></div><span></span></div>`).join('');
  v.insertAdjacentHTML('beforeend', !Object.keys(state.ratings).length
    ? `<div class="empty"><h3>${tr('Még nem értékeltél semmit')}</h3><p>${tr('Nyiss meg egy sorozatot vagy filmet, és koppints a csillagokra. Itt rangsorban látod a kedvenceidet.')}</p></div>`
    : bar + (list.length ? `<div class="list">${rows}</div>` : noMatch()));
}

async function renderFilms(v, alive) {
  const all = Object.values(state.movies), count = s => all.filter(m => m.status === s).length;
  const where = fget('filmWhere', 'all'), sort = fget('filmSort', 'added');
  const canFilter = !!tmdbKey() && state.services.length > 0;
  let list = all.filter(m => m.status === filmSeg);
  list.sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title, LOC()) : sort === 'year' ? String(b.year || '').localeCompare(String(a.year || ''))
    : filmSeg === 'seen' ? (b.seenAt || 0) - (a.seenAt || 0) : b.added - a.added);
  v.insertAdjacentHTML('beforeend', `<div class="seg" role="group">${[['want', 'Megnézendő'], ['seen', 'Megnézve']].map(([k, l]) => `<button data-filmseg="${k}" aria-pressed="${filmSeg === k}">${tr(l)} (${count(k)})</button>`).join('')}</div>
    ${list.length ? filterBar('films', [
      ...(canFilter ? [{ id: 'filmWhere', label: 'Hol', def: 'all', options: [['all', 'Mindenhol'], ['mine', 'Az előfizetéseimen']] }] : []),
      { id: 'filmSort', label: 'Rendezés', def: 'added', options: [['added', filmSeg === 'seen' ? 'Legutóbb megnézett' : 'Legutóbb hozzáadott'], ['title', 'Cím (A–Z)'], ['year', 'Legújabb film']] }]) : ''}
    <div id="films"></div>`);
  const box = $('#films');
  if (!list.length) {
    box.innerHTML = `<div class="empty"><h3>${tr(filmSeg === 'want' ? 'Még nincs megnézendő filmed' : 'Még nem jelöltél megnézettnek filmet')}</h3>
      <p>${tr('Keress rá egy filmre a Keresés fülön, és nyomd meg a „Megnézendő” vagy a „Megnéztem” gombot. Ehhez nem kell kulcs.')}</p>
      <button class="btn primary" data-tab="search" data-skindgo="film">${ICON.search}${tr('Film keresése')}</button></div>`;
    return;
  }
  let avail = null;
  if (canFilter) {
    if (where === 'mine') box.innerHTML = skelRows(Math.min(list.length, 4));
    const job = pool(list, 4, async m => {
      try { const id = m.kind === 'mv' ? m.ref : await tmdbMovieIdByImdb(m.imdb); return myProviders(await providersFor('movie', id)); } catch { return []; }
    });
    if (where === 'mine') {
      const a = await job;
      if (!alive()) return;
      list = list.filter((_, i) => a[i].length); avail = a.filter(x => x.length);
    } else {
      job.then(a => {
        if (!alive() || !$('#films')) return;
        a.forEach((p, i) => { const el = document.querySelector(`#films [data-avail="${i}"]`); if (el && p.length) el.innerHTML = ` · <span class="mine">✓ ${esc(p.map(x => x.name).join(', '))}</span>`; });
      });
    }
  }
  box.innerHTML = list.length ? `<div class="list">${list.map((m, i) => `<div class="row" ${openAttr(m)} style="cursor:pointer">
      ${m.img ? `<img class="thumb" src="${esc(m.img)}" alt="" loading="lazy">` : '<div class="thumb"></div>'}
      <div class="body"><div class="t1">${esc(m.title)}</div>
      <div class="t3">${esc(filmMeta(m) || tr('Film'))}${m.seenAt ? ' · ' + tr('megnézve: {d}', { d: fmtDate(ymd(new Date(m.seenAt))) }) : ''}<span data-avail="${i}">${avail?.[i]?.length ? ` · <span class="mine">✓ ${esc(avail[i].map(x => x.name).join(', '))}</span>` : ''}</span></div></div>
      <button class="check" data-mvquick="${esc(m.key)}" aria-pressed="${m.status === 'seen'}" aria-label="${esc(m.title)}: ${tr(m.status === 'seen' ? 'megnézve' : 'megjelölése megnézettként')}">${ICON.check}</button></div>`).join('')}</div>`
    : noMatch('A megnézendő filmjeid közül most egyik sem érhető el az előfizetéseiden.');
}

async function renderShows(v, alive) {
  const shows = Object.values(state.follows);
  if (!shows.length) {
    v.insertAdjacentHTML('beforeend', `<div class="empty"><h3>${tr('A listád még üres')}</h3><p>${tr('Nyisd meg egy sorozat adatlapját, és koppints a „Listára teszem” gombra. Ha kipipálsz egy részt, a sorozat magától felkerül ide.')}</p><button class="btn primary" data-tab="search">${ICON.search}${tr('Sorozat keresése')}</button></div>`);
    return;
  }
  const status = fget('libStatus', 'all'), sort = fget('libSort', 'name'), where = fget('libWhere', 'all');
  v.insertAdjacentHTML('beforeend', filterBar('shows', [
      { id: 'libStatus', label: 'Állapot', def: 'all', options: [['all', 'Mind'], ['going', 'Folyamatban'], ['new', 'Még nem kezdted el'], ['done', 'Naprakész'], ['ended', 'Befejezett sorozat']] },
      ...(state.services.length ? [{ id: 'libWhere', label: 'Hol', def: 'all', options: [['all', 'Mindenhol'], ['mine', 'Az előfizetéseimen']] }] : []),
      { id: 'libSort', label: 'Rendezés', def: 'name', options: [['name', 'Cím (A–Z)'], ['progress', 'Haladás'], ['left', 'Legtöbb hátralévő rész'], ['added', 'Legutóbb hozzáadott']] }])
    + `<div id="shows"><section>${skelGrid(Math.min(shows.length, 9))}</section></div>`);
  const box = $('#shows');
  let data;
  try { data = await pool(shows, 4, async s => ({ s, p: progressOf(s.id, await getEps(s.id) || []) })); }
  catch { if (alive()) box.innerHTML = errorBox(NET_ERR); return; }
  if (!alive()) return;
  const pctOf = p => p.aired ? p.watched / p.aired : 0;
  data = data.filter(({ s, p }) => (where === 'all' || mine(s)) && (status === 'all'
    || (status === 'going' && p.next && p.watched > 0) || (status === 'new' && p.next && p.watched === 0)
    || (status === 'done' && !p.next) || (status === 'ended' && s.status === 'Ended')));
  const sorter = { name: (a, b) => a.s.name.localeCompare(b.s.name, 'hu'), progress: (a, b) => pctOf(b.p) - pctOf(a.p),
    left: (a, b) => (b.p.aired - b.p.watched) - (a.p.aired - a.p.watched), added: (a, b) => (b.s.added || 0) - (a.s.added || 0) }[sort] || ((a, b) => a.s.name.localeCompare(b.s.name, 'hu'));
  const card = ({ s, p }) => {
    const pct = p.aired ? Math.round(p.watched / p.aired * 100) : 0;
    const meta = !p.next && p.upcoming ? tr('új rész {when}', { when: relDays(p.upcoming.date) }) : !p.next && s.status === 'Ended' ? tr('befejezett sorozat') : tr('{a}/{b} rész', { a: p.watched, b: p.aired });
    return showCard(s, `<div class="progress ${pct === 100 ? 'done' : ''}"><i style="width:${pct}%"></i></div><span class="meta">${esc(meta)}</span>`);
  };
  if (!data.length) { box.innerHTML = noMatch(); return; }
  if (status !== 'all' || sort !== 'name') {
    box.innerHTML = `<section><div class="sec-head"><h2>${tr('{n} sorozat', { n: data.length })}</h2></div><div class="grid">${data.sort(sorter).map(card).join('')}</div></section>`;
    return;
  }
  const groups = [
    ['Folyamatban', data.filter(x => x.p.next && x.p.watched > 0)],
    ['Még nem kezdted el', data.filter(x => x.p.next && x.p.watched === 0)],
    ['Naprakész', data.filter(x => !x.p.next)]
  ].filter(g => g[1].length);
  box.innerHTML = groups.map(([title, arr]) => `<section><div class="sec-head"><h2>${tr(title)}</h2><span class="count">${arr.length}</span></div>
    <div class="grid">${arr.sort(sorter).map(card).join('')}</div></section>`).join('');
}

function renderLibrary(v, alive) {
  const nShows = Object.keys(state.follows).length, nFilms = Object.keys(state.movies).length, nRates = Object.keys(state.ratings).length;
  v.innerHTML = `<div class="seg" role="group">${[['shows', 'Sorozataim', nShows], ['films', 'Filmjeim', nFilms], ['ratings', 'Értékeléseim', nRates], ['stats', 'Statisztika', 0]]
    .map(([k, l, n]) => `<button data-libseg="${k}" aria-pressed="${libSeg === k}">${tr(l)}${n ? ` (${n})` : ''}</button>`).join('')}</div>`;
  if (libSeg === 'ratings') renderRatings(v);
  else if (libSeg === 'films') renderFilms(v, alive);
  else if (libSeg === 'stats') renderStats(v, alive);
  else renderShows(v, alive);
}
