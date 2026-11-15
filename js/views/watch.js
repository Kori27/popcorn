// Sorozatnapló · Watch now tab:
//  - "Ingyen, legálisan": current films and series that are free in Hungary right now (TMDB / JustWatch data; opens on the service)
//  - "Modern, szabad": open-licence modern films, played in the app (Internet Archive)
//  - "Klasszikusok": public-domain films, played in the app (Internet Archive)
'use strict';

const IA = 'https://archive.org';

/* ---------- resume playback: remembers the position per film on this device ---------- */
const PLAYBACK_KEY = 'popcorn.playback.v1';
function playbackStore() {
  try { return JSON.parse(localStorage.getItem(PLAYBACK_KEY) || '{}'); } catch { return {}; }
}
function savePlayback(id, time, duration) {
  if (!Number.isFinite(time) || time < 5) return;
  const data = playbackStore();
  if (Number.isFinite(duration) && duration > 0 && time >= duration - 20) delete data[id];
  else data[id] = { time: Math.floor(time), updated: Date.now() };
  try { localStorage.setItem(PLAYBACK_KEY, JSON.stringify(data)); } catch {}
}
function restorePlayback(video, id) {
  const data = playbackStore(), saved = data[id];
  if (saved && Number.isFinite(saved.time) && saved.time >= 5) {
    const apply = () => {
      if (video.duration && saved.time < video.duration - 20) {
        video.currentTime = saved.time;
        toast(tr('Folytatás innen: {time}', { time: Math.floor(saved.time / 60) + ':' + String(Math.floor(saved.time % 60)).padStart(2, '0') }));
      } else {
        delete data[id];
        try { localStorage.setItem(PLAYBACK_KEY, JSON.stringify(data)); } catch {}
      }
    };
    if (video.readyState >= 1) apply(); else video.addEventListener('loadedmetadata', apply, { once: true });
  }
  let lastSaved = 0;
  video.addEventListener('timeupdate', () => {
    if (Math.abs(video.currentTime - lastSaved) >= 10) { lastSaved = video.currentTime; savePlayback(id, video.currentTime, video.duration); }
  });
  video.addEventListener('pause', () => savePlayback(id, video.currentTime, video.duration));
  video.addEventListener('ended', () => savePlayback(id, video.duration, video.duration));
  window.addEventListener('pagehide', () => savePlayback(id, video.currentTime, video.duration), { once: true });
}
const iaThumb = id => `${IA}/services/img/${encodeURIComponent(id)}`;
const WATCH_SEGS = [['free', 'Most nézhető'], ['open', 'Modern, szabad'], ['classic', 'Klasszikusok']];
let watchSeg = null, iaQ = '', iaPage = 1, freePage = 1;

/* ---------- classic public-domain films ---------- */
const IA_BASE = 'mediatype:movies AND licenseurl:*publicdomain* AND format:("h.264" OR "512Kb MPEG4")';
const IA_GENRES = [['pop', 'Népszerű', 'collection:feature_films'], ['comedy', 'Vígjáték', 'collection:Comedy_Films'], ['noir', 'Film noir', 'collection:Film_Noir'],
  ['scifi', 'Sci-fi és horror', 'collection:SciFi_Horror'], ['western', 'Western', 'collection:feature_films AND subject:western'], ['silent', 'Némafilm', 'collection:silent_films'], ['tv', 'Régi tévésorozatok', 'collection:classic_tv']];
const IA_LANGS = [['all', 'Mind', ''], ['en', 'Angol', 'language:(English OR eng)'], ['hu', 'Magyar', 'language:(Hungarian OR hun OR magyar)'], ['de', 'Német', 'language:(German OR ger OR deu)'], ['fr', 'Francia', 'language:(French OR fre OR fra)']];
const IA_DECADES = [['all', 'Mind', ''], ['old', '1930 előtt', 'year:[1890 TO 1929]'], ['30s', '1930-as évek', 'year:[1930 TO 1939]'], ['40s', '1940-es évek', 'year:[1940 TO 1949]'], ['50s', '1950-es évek', 'year:[1950 TO 1959]'], ['60s', '1960 után', 'year:[1960 TO 2030]']];
const IA_SORTS = [['popular', 'Népszerűség', 'downloads desc'], ['rated', 'Legjobbra értékelt', 'avg_rating desc'], ['newest', 'Legújabb', 'year desc'], ['oldest', 'Legrégebbi', 'year asc'], ['title', 'Cím (A–Z)', 'titleSorter asc']];
const opt = (list, id) => (list.find(x => x[0] === id) || list[0])[2];
function iaSearch(text, page) {
  const parts = [IA_BASE, `(${opt(IA_GENRES, fget('iaGenre', 'pop'))})`, opt(IA_LANGS, fget('iaLang', 'all')), opt(IA_DECADES, fget('iaDecade', 'all'))].filter(Boolean);
  const clean = text.replace(/[^\p{L}\p{N} ]/gu, ' ').trim();
  if (clean) parts.push(`title:(${clean})`);
  const sort = opt(IA_SORTS, fget('iaSort', 'popular'));
  return api(`${IA}/advancedsearch.php?q=${encodeURIComponent(parts.join(' AND '))}&fl[]=identifier&fl[]=title&fl[]=year&rows=24&page=${page}&sort[]=${encodeURIComponent(sort)}&output=json`, 12 * H,
    d => ({ total: d.response?.numFound || 0, docs: (d.response?.docs || []).map(x => ({ id: x.identifier, title: Array.isArray(x.title) ? x.title[0] : x.title, year: x.year })) }));
}
const filmCard = f => `<button class="card" data-film="${esc(f.id)}" aria-label="${esc(f.title)}">
  <img class="poster" src="${iaThumb(f.id)}" alt="${esc(f.title)}" loading="lazy" onerror="this.outerHTML='<div class=&quot;poster-ph&quot;>'+this.alt.replace(/[<&]/g,'')+'</div>'">
  <span class="name">${esc(f.title)}</span><span class="meta">${esc(f.year || tr('Klasszikus'))}</span></button>`;

/* ---------- modern open-licence films (checked by hand: real releases under Creative Commons) ---------- */
const OPEN_FILMS = [
  ['sprite-fright', 'Sprite Fright', 2021, 'Animáció', 'vígjáték, horror'], ['agent327operationbarbershop', 'Agent 327: Operation Barbershop', 2017, 'Animáció', 'akció'],
  ['spring_blenderopenmovie', 'Spring', 2019, 'Animáció', 'fantasy'], ['CaminandesLlamigos', 'Caminandes 3: Llamigos', 2016, 'Animáció', 'vígjáték'],
  ['CosmosLaundromatFirstCycle', 'Cosmos Laundromat', 2015, 'Animáció', 'fantasy'], ['tearsofsteelblendervfxopenmovie800p', 'Tears of Steel', 2012, 'Élőszereplős', 'sci-fi'],
  ['Sintel', 'Sintel', 2010, 'Animáció', 'fantasy'], ['Sita_Sings_the_Blues', 'Sita Sings the Blues', 2008, 'Animáció', 'zenés'],
  ['BigBuckBunny_124', 'Big Buck Bunny', 2008, 'Animáció', 'vígjáték'], ['ElephantsDream', 'Elephants Dream', 2006, 'Animáció', 'sci-fi'],
  ['StarWreckInThePirkining', 'Star Wreck: In the Pirkinning', 2005, 'Élőszereplős', 'sci-fi, paródia']];

/* ---------- free right now in Hungary (TMDB discover with watch_region=HU) ---------- */
const FREE_YEARS = [['', 'Bármikor'], ['2020', '2020 után'], ['2010', '2010 után'], ['2000', '2000 után'], ['old', '2000 előtt']];
const FREE_SORTS = [['popular', 'Népszerűség'], ['rated', 'Legjobbra értékelt'], ['newest', 'Legújabb']];
const HOW_OPTIONS = () => [['free|ads', 'Ingyen'], ['free', 'Ingyen, reklám nélkül'], ['ads', 'Ingyen, reklámmal'], ...(state.services.length ? [['mine', 'Az előfizetéseimen']] : [])];
const LANG_OPTIONS = [['', 'Mind'], ['hudub', 'Magyar szolgáltatónál (szinkronnal)'], ['hu', 'Magyar film']];
// Hungarian services that (almost always) offer Hungarian audio
const HU_LOCAL = /^rtl|tv2|tv 2|m[ée]diaklikk|mtva|filmio|nemzeti film/i;
const tmdbGenres = type => tmdb(`/genre/${type}/list?language=${TLANG()}`, 30 * DAY).then(d => d.genres || []).catch(() => []);
const huProviders = type => tmdb(`/watch/providers/${type}?watch_region=HU&language=${TLANG()}`, 7 * DAY).then(d => d.results || []).catch(() => []);
/** Returns the discover path, or null when the chosen filters can match nothing. */
async function freeDiscoverPath(page) {
  const type = fget('freeType', 'movie'), movie = type === 'movie', dateKey = movie ? 'primary_release_date' : 'first_air_date';
  const y = fget('freeYear', ''), sort = fget('freeSort', 'popular'), genre = fget('freeGenre', '');
  let how = fget('freeHow', 'free|ads');
  if (how === 'mine' && !state.services.length) how = 'free|ads';
  const lang = fget('freeLang', '');
  let providers = null;
  if (how === 'mine' || lang === 'hudub') {
    let list = await huProviders(type);
    if (how === 'mine') list = list.filter(p => { const k = providerService(p); return k && state.services.includes(k); });
    if (lang === 'hudub') list = list.filter(p => HU_LOCAL.test(p.provider_name));
    if (!list.length) return null;
    providers = list.map(p => p.provider_id).join('|');
  }
  const money = how === 'mine' ? 'flatrate|free|ads' : how;
  let q = `/discover/${type}?language=${TLANG()}&watch_region=HU&with_watch_monetization_types=${encodeURIComponent(money)}&include_adult=false&page=${page}`;
  if (providers) q += '&with_watch_providers=' + encodeURIComponent(providers);
  if (lang === 'hu') q += '&with_original_language=hu';
  q += '&sort_by=' + (sort === 'rated' ? 'vote_average.desc&vote_count.gte=150' : sort === 'newest' ? `${dateKey}.desc&${dateKey}.lte=${today()}` : 'popularity.desc');
  if (genre) q += '&with_genres=' + encodeURIComponent(genre);
  if (y === 'old') q += `&${dateKey}.lte=1999-12-31`; else if (y) q += `&${dateKey}.gte=${y}-01-01`;
  return q;
}
const tmdbCard = (x, type) => {
  const title = x.title || x.name, date = x.release_date || x.first_air_date || '';
  return `<button class="card" ${type === 'movie' ? `data-movie="${x.id}"` : `data-tmdbtv="${x.id}"`} aria-label="${esc(title)}">
    <span class="pw">${x.poster_path ? `<img class="poster" src="${TIMG}w342${esc(x.poster_path)}" alt="" loading="lazy">` : `<div class="poster-ph">${esc(title)}</div>`}
    ${x.vote_count > 20 ? `<span class="score">★ ${x.vote_average.toFixed(1)}</span>` : ''}</span>
    ${type === 'movie' && state.movies['mv:' + x.id] ? `<span class="flag">${ICON.check}</span>` : ''}
    <span class="name">${esc(title)}</span><span class="meta">${esc(date.slice(0, 4))}</span></button>`;
};
/** Big banner for the first result, using TMDB's wide scene image. */
const featureCard = (x, type) => {
  const title = x.title || x.name, date = x.release_date || x.first_air_date || '';
  return `<button class="feature" ${type === 'movie' ? `data-movie="${x.id}"` : `data-tmdbtv="${x.id}"`} aria-label="${esc(title)}" style="background-image:url('${TIMG}w780${esc(x.backdrop_path)}')">
    <span class="feature-text"><span class="kicker">${tr('Kiemelt')}</span><b>${esc(title)}</b>
    <span class="feature-meta">${esc([date.slice(0, 4), x.vote_count > 20 ? '★ ' + x.vote_average.toFixed(1) : ''].filter(Boolean).join(' · '))}</span>
    ${x.overview ? `<span class="feature-desc">${esc(x.overview)}</span>` : ''}</span></button>`;
};

const FREE_HU = [
  ['https://mediaklikk.hu/', 'Médiaklikk', 'Az M1, a Duna és az M2 műsorai, filmek, sorozatok és mesék, ingyen'],
  ['https://www.rtlplusz.hu/', 'RTL+', 'Az ingyenes része regisztrációval nézhető (sorozatok, műsorok)'],
  ['https://tv2play.hu/', 'TV2 Play', 'Az ingyenes része reklámokkal nézhető'],
  ['https://filmio.hu/', 'Filmio', 'A Nemzeti Filmintézet magyar filmtára, időszakonként ingyenes akciókkal']];
const freeHuPanel = () => `<div class="panel"><h3>${tr('Ingyenes magyar források')}</h3><p>${tr('Ezek a saját oldalukon nyílnak meg.')}</p>
  <div class="where">${FREE_HU.map(([u, n, d]) => `<a href="${u}" target="_blank" rel="noopener"><b>${n}</b><small>${tr(d)}</small>${ICON.ext}</a>`).join('')}</div></div>`;

function renderWatch(v, alive) {
  if (!watchSeg) watchSeg = fget('watchSeg', tmdbKey() ? 'free' : 'open');
  v.innerHTML = `<div class="seg" role="group" aria-label="${tr('Nézd most')}">${WATCH_SEGS.map(([k, l]) => `<button data-wseg="${k}" aria-pressed="${watchSeg === k}">${tr(l)}</button>`).join('')}</div><div id="wbody"></div>`;
  const body = $('#wbody');
  if (watchSeg === 'free') renderFree(body, alive);
  else if (watchSeg === 'open') renderOpen(body, alive);
  else renderClassic(body, alive);
}

async function renderFree(body, alive) {
  if (!tmdbKey()) { body.innerHTML = noKeyPanel('Friss, ingyen nézhető filmek és sorozatok') + freeHuPanel(); return; }
  const type = fget('freeType', 'movie');
  body.innerHTML = `<p class="note">${tr('Valódi, új és népszerű filmek és sorozatok, amelyek Magyarországon most legálisan nézhetők: ingyen, reklámmal vagy az előfizetéseiden. Koppints egy címre: előzetes, és hogy melyik szolgáltatónál indíthatod.')}</p>
    ${fget('freeLang', '') === 'hudub' ? `<p class="note">${tr('Magyar hang: az RTL+, a TV2 Play, a Médiaklikk és a Filmio szinte mindent magyarul ad. Szinkron-adatot egyik nyilvános adatbázis sem tárol, ezért ez jó közelítés, nem garancia.')}</p>` : ''}
    <div id="freeFilters">${filterBar('free', freeFilterItems(type, []))}</div><div id="free">${skelGrid(6)}</div>${freeHuPanel()}`;
  FILTER_HANDLERS.free = () => { freePage = 1; renderFree(body, alive); };
  tmdbGenres(type).then(gs => { if (alive() && $('#freeFilters')) $('#freeFilters').innerHTML = filterBar('free', freeFilterItems(type, gs)); });
  freePage = 1;
  loadFree(alive, false);
}
const freeFilterItems = (type, genres) => [
  { id: 'freeType', label: 'Típus', def: 'movie', options: [['movie', 'Filmek'], ['tv', 'Sorozatok']] },
  { id: 'freeGenre', label: 'Műfaj', def: '', options: [['', 'Mind'], ...genres.map(g => [String(g.id), g.name])].concat(fget('freeGenre', '') && !genres.length ? [[fget('freeGenre', ''), '…']] : []) },
  { id: 'freeYear', label: 'Megjelenés éve', def: '', options: FREE_YEARS },
  { id: 'freeHow', label: 'Hogyan', def: 'free|ads', options: HOW_OPTIONS() },
  { id: 'freeLang', label: 'Nyelv', def: '', options: LANG_OPTIONS },
  { id: 'freeSort', label: 'Rendezés', def: 'popular', options: FREE_SORTS }];
async function loadFree(alive, append) {
  const box = $('#free'); if (!box) return;
  const type = fget('freeType', 'movie');
  try {
    const path = await freeDiscoverPath(freePage);
    const d = path ? await tmdb(path, 12 * H) : { results: [], page: 1, total_pages: 1 };
    if (!alive() || !$('#free')) return;
    const cards = (d.results || []).map(x => tmdbCard(x, type)).join('');
    const grid = box.querySelector('.grid');
    if (append && grid) grid.insertAdjacentHTML('beforeend', cards);
    else if (d.results?.length) {
      const top = d.results.find(x => x.backdrop_path);
      box.innerHTML = (top ? featureCard(top, type) : '')
        + `<div class="sec-head"><span class="count">${tr('{n} találat', { n: (d.total_results || 0).toLocaleString(LOC()) })}</span></div>
           <div class="grid">${d.results.filter(x => x !== top).map(x => tmdbCard(x, type)).join('')}</div>`;
    } else box.innerHTML = `<div class="empty"><h3>${tr('Nincs találat')}</h3><p>${tr('Ezekkel a szűrőkkel most nincs nézhető cím. Lazíts a szűrőkön.')}</p></div>`;
    box.querySelector('.more')?.remove();
    if (d.page < Math.min(d.total_pages || 1, 20)) box.insertAdjacentHTML('beforeend', `<button class="btn ghost more" data-freemore style="margin-top:14px">${tr('Továbbiak')}</button>`);
  } catch (e) { if (alive()) box.innerHTML = keyError(e); }
}
async function openTmdbTv(id) {
  toast(tr('Sorozat megnyitása…'));
  try {
    const ext = await tmdb(`/tv/${id}/external_ids`, 7 * DAY);
    const look = ext.imdb_id ? `imdb=${ext.imdb_id}` : ext.tvdb_id ? `thetvdb=${ext.tvdb_id}` : null;
    const show = look ? await api(`/lookup/shows?${look}`, 7 * DAY, slimShow) : null;
    if (show) { openShow(show.id); return; }
  } catch {}
  window.open(`https://www.themoviedb.org/tv/${id}/watch?locale=HU`, '_blank', 'noopener');
}

function renderOpen(body) {
  const kind = fget('openKind', 'all');
  const list = OPEN_FILMS.filter(f => kind === 'all' || (kind === 'anim' ? f[3] === 'Animáció' : f[3] !== 'Animáció'));
  body.innerHTML = `<p class="note">${tr('Modern, színes filmek, amelyeket az alkotóik szabad (Creative Commons) licenccel tettek közzé. Az appban indulnak, reklám nélkül. Angol nyelvűek; több közülük párbeszéd nélküli.')}</p>
    ${filterBar('open', [{ id: 'openKind', label: 'Fajta', def: 'all', options: [['all', 'Mind'], ['anim', 'Animáció'], ['live', 'Élőszereplős']] }])}
    <div class="grid">${list.map(([id, title, year, , genre]) => `<button class="card" data-film="${esc(id)}" aria-label="${esc(title)}">
      <img class="poster" src="${iaThumb(id)}" alt="${esc(title)}" loading="lazy" style="aspect-ratio:2/3;object-fit:cover" onerror="this.outerHTML='<div class=&quot;poster-ph&quot;>'+this.alt.replace(/[<&]/g,'')+'</div>'">
      <span class="name">${esc(title)}</span><span class="meta">${year} · ${esc(tr(genre))}</span></button>`).join('')}</div>
    ${freeHuPanel()}`;
}

function renderClassic(body, alive) {
  body.innerHTML = `<p class="note">${tr('Közkincs (public domain) filmek és régi sorozatok az Internet Archive-ból. Az appban indulnak, reklám nélkül. Többnyire angol nyelvűek, felirat nélkül; a némafilmekhez nem kell nyelvtudás.')}</p>
    <div class="search">${ICON.search}<input id="iaq" type="search" enterkeyhint="search" autocomplete="off" placeholder="${tr('Film címe, pl. Chaplin')}" value="${esc(iaQ)}" aria-label="${tr('Klasszikus film keresése')}"></div>
    ${filterBar('classic', [
      { id: 'iaGenre', label: 'Műfaj', def: 'pop', options: IA_GENRES.map(([k, l]) => [k, l]) },
      { id: 'iaLang', label: 'Nyelv', def: 'all', options: IA_LANGS.map(([k, l]) => [k, l]) },
      { id: 'iaDecade', label: 'Évtized', def: 'all', options: IA_DECADES.map(([k, l]) => [k, l]) },
      { id: 'iaSort', label: 'Rendezés', def: 'popular', options: IA_SORTS.map(([k, l]) => [k, l]) }])}
    <div id="ia">${skelGrid(6)}</div>`;
  FILTER_HANDLERS.classic = () => renderClassic(body, alive);
  const q = $('#iaq');
  q.addEventListener('input', () => { clearTimeout(renderWatch.t); renderWatch.t = setTimeout(() => { iaQ = q.value; iaPage = 1; loadIA(alive, false); }, 400); });
  q.addEventListener('keydown', e => { if (e.key === 'Enter') { clearTimeout(renderWatch.t); iaQ = q.value; iaPage = 1; loadIA(alive, false); q.blur(); } });
  iaPage = 1; loadIA(alive, false);
}
async function loadIA(alive, append) {
  const box = $('#ia'); if (!box) return;
  const want = `${JSON.stringify(FILTERS)}|${iaQ}|${iaPage}`;
  if (!append) box.innerHTML = skelGrid(6);
  try {
    const res = await iaSearch(iaQ, iaPage);
    if (!alive() || `${JSON.stringify(FILTERS)}|${iaQ}|${iaPage}` !== want || !$('#ia')) return;
    const grid = box.querySelector('.grid');
    const cards = res.docs.map(filmCard).join('');
    if (append && grid) grid.insertAdjacentHTML('beforeend', cards);
    else box.innerHTML = res.docs.length
      ? `<div class="sec-head"><span class="count">${tr('{n} találat', { n: res.total.toLocaleString(LOC()) })}</span></div><div class="grid">${cards}</div>`
      : `<div class="empty"><h3>${tr('Nincs találat')}</h3><p>${tr(fget('iaLang', 'all') === 'hu' ? 'Magyar nyelvű közkincs film alig van az archívumban. Nézd meg a „Most nézhető” fület vagy a lenti magyar forrásokat.' : 'Próbáld angol címmel, vagy lazíts a szűrőkön.')}</p></div>`;
    box.querySelector('.more')?.remove();
    if (res.total > iaPage * 24) box.insertAdjacentHTML('beforeend', `<button class="btn ghost more" data-iamore style="margin-top:14px">${tr('Továbbiak')} (${(res.total - iaPage * 24).toLocaleString(LOC())})</button>`);
  } catch { if (alive()) box.innerHTML = errorBox('Nem sikerült elérni az Internet Archive-ot. Próbáld újra kicsit később.'); }
}

/* ---------- in-app player page (Internet Archive) ---------- */
async function openFilm(id, push = true) {
  const hash = '#film-' + encodeURIComponent(id);
  if (push) pushSheet({ film: id }, hash);
  showSheet();
  const sh = $('#sheet');
  sh.innerHTML = `<div class="sheet-bar">${closeBtnHtml()}</div><div class="sheet-body"><div class="skel" style="aspect-ratio:16/9"></div>${skelRows(2)}</div>`;
  try {
    const m = await api(`${IA}/metadata/${encodeURIComponent(id)}`, 7 * DAY, d => ({
      title: [].concat(d.metadata?.title || id)[0], year: d.metadata?.year || (d.metadata?.date || '').slice(0, 4), runtime: d.metadata?.runtime,
      license: d.metadata?.licenseurl || '',
      desc: strip([].concat(d.metadata?.description || '').join(' ')).slice(0, 1500), server: d.d1,
      files: (d.files || []).filter(f => /\.(mp4|ogv|srt|vtt)$/i.test(f.name)).map(f => ({ name: f.name, format: f.format, source: f.source || '', language: f.language || '' }))
    }));
    if (location.hash !== hash) return;
    const open = OPEN_FILMS.find(f => f[0] === id);
    const pd = !open && (!m.license || /publicdomain/i.test(m.license));
    const pick = fmt => m.files.find(f => f.format === fmt);
    const video = pick('512Kb MPEG4') || pick('h.264') || m.files.find(f => /\.mp4$/i.test(f.name)) || pick('Ogg Video');
    const subtitles = m.files.filter(f => /\.vtt$/i.test(f.name));
    const src = f => `${IA}/download/${encodeURIComponent(id)}/${f.name.split('/').map(encodeURIComponent).join('/')}`;
    const title = open ? open[1] : m.title, year = open ? open[2] : m.year;
    const key = 'ia:' + id;
    sh.innerHTML = `<div class="sheet-bar">${closeBtnHtml()}<a class="iconbtn" href="${IA}/details/${encodeURIComponent(id)}" target="_blank" rel="noopener" aria-label="${tr('Megnyitás az Internet Archive-on')}">${ICON.ext}</a></div>
      <div class="sheet-body">
        ${video ? `<div class="player"><video id="film" controls playsinline preload="metadata" poster="${iaThumb(id)}"><source src="${src(video)}" type="${/\.ogv$/i.test(video.name) ? 'video/ogg' : 'video/mp4'}">${subtitles.map((f, i) => `<track kind="subtitles" src="${src(f)}" srclang="${esc((f.language || f.name.match(/\.([a-z]{2,3})\.vtt$/i)?.[1] || 'en').slice(0, 3))}" label="${esc(f.language || f.name)}" ${i === 0 ? 'default' : ''}>`).join('')}</video></div>`
          : errorBox('Ennek a filmnek már nincs lejátszható változata. Válassz egy másikat.')}
        <div><h2 style="font:800 24px/1.15 var(--font-display);margin:0 0 6px">${esc(title)}</h2>
          <div class="facts">${year ? `<span class="pill neutral">${esc(year)}</span>` : ''}${m.runtime ? `<span class="pill neutral">${esc(m.runtime)}</span>` : ''}<span class="pill ok">${tr(pd ? 'Közkincs' : 'Szabad licenc (CC)')}</span></div></div>
        ${movieActions(key, { kind: 'ia', ref: id, title, img: iaThumb(id), year: String(year || '') })}
        ${rateWidget(key, { kind: 'ia', ref: id, title, img: iaThumb(id) })}
        ${m.desc ? `<p class="summary" lang="en">${esc(m.desc)}</p>` : ''}
        <p class="note">${tr(pd ? 'Forrás: Internet Archive. Szerzői jog alól felszabadult (public domain) mű.' : 'Forrás: Internet Archive. Az alkotók Creative Commons licenccel, szabadon terjeszthetően tették közzé.')}</p></div>`;
    const player = $('#film');
    if (player) restorePlayback(player, id);
  } catch { sh.querySelector('.sheet-body').innerHTML = errorBox('Nem sikerült betölteni a filmet. Ellenőrizd az internetkapcsolatot.'); }
}
