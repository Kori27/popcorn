// Popcorn · Watch now tab:
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
const WATCH_SEGS = [['free', 'Most nézhető'], ['open', 'Modern, szabad'], ['classic', 'Klasszikusok'], ['videa', 'Videa']];
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
    <span class="name">${esc(title)}</span><span class="meta">${esc(date.slice(0, 4))}</span>${x._offers?.length ? `<span class="meta offer">${esc(offerText(x))}</span>` : ''}</button>`;
};
/** Big banner for the first result, using TMDB's wide scene image. */
const featureCard = (x, type) => {
  const title = x.title || x.name, date = x.release_date || x.first_air_date || '';
  return `<button class="feature" ${type === 'movie' ? `data-movie="${x.id}"` : `data-tmdbtv="${x.id}"`} aria-label="${esc(title)}" style="background-image:url('${TIMG}w780${esc(x.backdrop_path)}')">
    <span class="feature-text"><span class="kicker">${tr('Kiemelt')}</span><b>${esc(title)}</b>
    <span class="feature-meta">${esc([date.slice(0, 4), x.vote_count > 20 ? '★ ' + x.vote_average.toFixed(1) : '', offerText(x)].filter(Boolean).join(' · '))}</span>
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
  v.innerHTML = `${pickerCta()}<div class="seg" role="group" aria-label="${tr('Nézd most')}">${WATCH_SEGS.map(([k, l]) => `<button data-wseg="${k}" aria-pressed="${watchSeg === k}">${tr(l)}</button>`).join('')}</div><div id="wbody"></div>`;
  const body = $('#wbody');
  if (watchSeg === 'free') renderFree(body, alive);
  else if (watchSeg === 'open') renderOpen(body, alive);
  else if (watchSeg === 'classic') renderClassic(body, alive);
  else renderVideaWatch(body, alive);
}

let videaWatchPage = 1;
let videaWatchBusy = false;
function videaDurationSeconds(value) {
  if (Number.isFinite(Number(value)) && String(value).trim() !== '') return Number(value);
  const parts = String(value || '').trim().split(':').map(Number);
  if (!parts.length || parts.some(n => !Number.isFinite(n))) return 0;
  return parts.reduce((total, part) => total * 60 + part, 0);
}
function videaDurationLabel(seconds) {
  const n = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(n / 3600), m = Math.floor((n % 3600) / 60);
  return h ? `${h}ó ${m}p` : `${m}p`;
}
function videaWatchCard(item) {
  const sec = videaDurationSeconds(item.duration);
  return `<button class="card" data-videa="${esc(item.vcode)}" data-videa-duration="${sec}" aria-label="${esc(item.title || 'Videa-videó')}">
    ${item.thumbnail ? `<img class="poster" src="${esc(item.thumbnail)}" alt="" loading="lazy">` : '<div class="poster-ph">Videa</div>'}
    <span class="name">${esc(item.title || 'Névtelen videó')}</span>
    <span class="meta">${sec ? videaDurationLabel(sec) : esc(item.duration || 'Hossz nem ismert')}${item.channel?.name ? ' · ' + esc(item.channel.name) : ''}</span></button>`;
}
function applyVideaWatchFilter() {
  const min = 20 * 60;
  let visible = 0;
  document.querySelectorAll('#videaGrid [data-videa]').forEach(card => {
    const duration = Number(card.dataset.videaDuration || 0);
    // Ismeretlen hosszúságú videót sem mutatunk: csak legalább 20 perces tartalom jelenhet meg.
    const show = duration >= min;
    card.hidden = !show;
    if (show) visible++;
  });
  const count = $('#videaVisibleCount');
  if (count) count.textContent = `${visible} releváns videó`;
}
async function loadVideaWatchPage(query, alive, append = false) {
  if (videaWatchBusy || !query.trim()) return;
  videaWatchBusy = true;
  const status = $('#videaMoreStatus');
  const more = $('#videaMore');
  if (more) { more.disabled = true; more.textContent = 'Betöltés…'; }
  try {
    const page = append ? videaWatchPage + 1 : 1;
    const response = await searchVideaVideos(query, page);
    if (!alive() || query !== searchQ.trim()) return;
    const items = Array.isArray(response?.videos) ? response.videos : [];
    const grid = $('#videaGrid');
    if (!grid) return;
    const seen = new Set([...grid.querySelectorAll('[data-videa]')].map(x => x.dataset.videa));
    const fresh = items.filter(x => x?.vcode && !seen.has(x.vcode));
    if (!append) grid.innerHTML = '';
    if (fresh.length) grid.insertAdjacentHTML('beforeend', fresh.map(videaWatchCard).join(''));
    videaWatchPage = page;
    if (status) status.textContent = fresh.length ? `${grid.querySelectorAll('[data-videa]').length} videó betöltve` : 'Nincs több különálló találat ezen az oldalon.';
    if (more) {
      if (!fresh.length) more.hidden = true;
      else { more.hidden = false; more.disabled = false; more.textContent = 'További találatok betöltése'; }
    }
    applyVideaWatchFilter();
  } catch (error) {
    if (status) status.textContent = `A keresés nem sikerült: ${error?.message || error}`;
    if (more) { more.hidden = false; more.disabled = false; more.textContent = 'Újrapróbálás'; }
  } finally { videaWatchBusy = false; }
}
function renderVideaWatch(body, alive) {
  searchKind = 'videa';
  body.innerHTML = `<p class="note">${tr('Keress a Videa nyilvános videói között, és nyisd meg őket a Popcorn beágyazott lejátszójában.')}</p>
    <div class="search">${ICON.search}<input id="q" type="search" inputmode="search" enterkeyhint="search" autocomplete="off" placeholder="${tr('Videa-videó keresése')}" value="${esc(searchQ)}" aria-label="${tr('Videa-videó keresése')}">
    <button class="clear" id="qclear" aria-label="${tr('Keresés törlése')}" ${searchQ ? '' : 'hidden'}>${ICON.x}</button></div>
    <div class="filter-row" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:12px 0">
      <span class="note">${tr('Csak a legalább 20 perces videók jelennek meg.')}</span>
      <span class="note" id="videaVisibleCount"></span>
    </div>
    <div class="sec-head"><h2>${tr('Videa-találatok')}</h2></div>
    <section id="videaGrid" class="grid"></section><p class="note" id="videaMoreStatus" aria-live="polite"></p>
    <button class="btn ghost" id="videaMore" hidden>${tr('További találatok betöltése')}</button>`;
  const q = $('#q');
  q.addEventListener('input', () => {
    searchQ = q.value; $('#qclear').hidden = !searchQ; videaWatchPage = 1;
    clearTimeout(renderVideaWatch.timer);
    renderVideaWatch.timer = setTimeout(() => loadVideaWatchPage(searchQ, alive, false), 350);
  });
  q.addEventListener('keydown', e => {
    if (e.key === 'Enter') { clearTimeout(renderVideaWatch.timer); loadVideaWatchPage(searchQ, alive, false); q.blur(); }
  });
  $('#qclear').addEventListener('click', () => {
    searchQ = ''; q.value = ''; $('#qclear').hidden = true; $('#videaGrid').innerHTML = '';
    $('#videaMore').hidden = true; q.focus();
  });
  $('#videaMore').addEventListener('click', () => loadVideaWatchPage(searchQ, alive, true));
  if (searchQ.trim()) loadVideaWatchPage(searchQ, alive, false);
}

async function renderFree(body, alive) {
  if (!tmdbKey()) { body.innerHTML = noKeyPanel('Friss, ingyen nézhető filmek és sorozatok') + freeHuPanel(); return; }
  const type = fget('freeType', 'movie');
  body.innerHTML = `<p class="note">${tr('Valódi, új és népszerű filmek és sorozatok, amelyek Magyarországon most legálisan nézhetők: ingyen, reklámmal vagy az előfizetéseiden. Koppints egy címre: előzetes, és hogy melyik szolgáltatónál indíthatod.')}</p>
    <p class="note">${tr('A filmek a szolgáltató saját oldalán vagy appjában indulnak (↗). Minden címet a friss magyarországi szolgáltató-adattal ellenőrzünk, de a kínálat gyorsan változhat.')}</p>
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
/** Offers that match the chosen filters, taken from TMDB's live Hungarian provider data. */
function matchingOffers(hu) {
  if (!hu || typeof hu !== 'object') return [];
  const how = fget('freeHow', 'free|ads'), lang = fget('freeLang', '');
  const mineOnly = how === 'mine' && state.services.length;
  const groups = mineOnly ? ['flatrate', 'free', 'ads'] : (how === 'mine' ? 'free|ads' : how).split('|');
  let list = groups.flatMap(g => (hu[g] || []).map(p => ({ name: p.provider_name, g })));
  if (mineOnly) list = list.filter(p => { const k = providerService({ provider_name: p.name }); return k && state.services.includes(k); });
  if (lang === 'hudub') list = list.filter(p => HU_LOCAL.test(p.name));
  const seen = new Set();
  return list.filter(p => !seen.has(p.name) && seen.add(p.name));
}
/** The discover index can be out of date, so every title is checked against its current provider list. */
async function verifyFree(results, type) {
  const checked = await pool(results, 5, async x => {
    try { return { ...x, _offers: matchingOffers(await providersFor(type, x.id)) }; } catch { return { ...x, _offers: [] }; }
  });
  return checked.filter(x => x._offers.length);
}
let freeShown = 0;
async function loadFree(alive, append) {
  const box = $('#free'); if (!box) return;
  const type = fget('freeType', 'movie');
  if (!append) freeShown = 0;
  try {
    let d, items = [], tries = 0;
    for (;;) {
      const path = await freeDiscoverPath(freePage);
      d = path ? await tmdb(path, 12 * H) : { results: [], page: 1, total_pages: 1 };
      items = await verifyFree(d.results || [], type);
      if (!alive() || !$('#free')) return;
      const last = d.page >= Math.min(d.total_pages || 1, 20);
      if (items.length || last || ++tries >= 3) break;
      freePage++;   // nothing on this page survived the check: look at the next one
    }
    freeShown += items.length;
    const grid = box.querySelector('.grid');
    if (append && grid) grid.insertAdjacentHTML('beforeend', items.map(x => tmdbCard(x, type)).join(''));
    else if (items.length) {
      const top = items.find(x => x.backdrop_path);
      box.innerHTML = (top ? featureCard(top, type) : '')
        + `<div class="sec-head"><span class="count"></span></div>
           <div class="grid">${items.filter(x => x !== top).map(x => tmdbCard(x, type)).join('')}</div>`;
    } else box.innerHTML = `<div class="empty"><h3>${tr('Nincs találat')}</h3><p>${tr('Ezekkel a szűrőkkel most nincs nézhető cím. Lazíts a szűrőkön.')}</p></div>`;
    const count = box.querySelector('.count');
    if (count) count.textContent = tr('{n} ellenőrzött cím', { n: freeShown });
    box.querySelector('.more')?.remove();
    if (d.page < Math.min(d.total_pages || 1, 20)) box.insertAdjacentHTML('beforeend', `<button class="btn ghost more" data-freemore style="margin-top:14px">${tr('Továbbiak')}</button>`);
  } catch (e) { if (alive()) box.innerHTML = keyError(e); }
}
const OFFER_LABEL = { free: 'ingyen', ads: 'reklámmal', flatrate: 'előfizetéssel' };
const offerText = x => x._offers?.length ? `↗ ${x._offers.slice(0, 2).map(o => o.name).join(', ')} · ${tr(OFFER_LABEL[x._offers[0].g])}` : '';
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
      desc: strip([].concat(d.metadata?.description || '').join(' ')).slice(0, 1500),
      imdb: d.metadata?.identifier?.find?.(x => /^tt\d+$/.test(x)) || (typeof d.metadata?.identifier === 'string' && /^tt\d+$/.test(d.metadata.identifier) ? d.metadata.identifier : ''),
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
    let matched = null, poster = iaThumb(id), overview = '', trailer = null;
    // Csak ellenőrzött azonosító vagy egyező cím + év alapján veszünk át TMDB-adatot.
    if (tmdbKey()) {
      try {
        const lang = TLANG();
        let candidates = [];
        if (m.imdb) {
          const found = await tmdb(`/find/${encodeURIComponent(m.imdb)}?external_source=imdb_id`, 12 * H);
          candidates = [...(found.movie_results || [])];
        }
        if (!candidates.length) {
          const found = await tmdb(`/search/movie?query=${encodeURIComponent(title)}&year=${encodeURIComponent(year || '')}&language=${lang}&include_adult=false`, 12 * H);
          const norm = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
          const wanted = norm(title);
          candidates = (found.results || []).filter(x => {
            const names = [x.title, x.original_title].map(norm);
            const sameTitle = names.includes(wanted) || names.some(n => n && wanted && (n.startsWith(wanted + ' ') || wanted.startsWith(n + ' ')));
            const candidateYear = Number((x.release_date || '').slice(0,4)), wantedYear = Number(year);
            return sameTitle && (!wantedYear || !candidateYear || Math.abs(candidateYear - wantedYear) <= 1);
          });
        }
        if (candidates.length) {
          const candidate = candidates[0];
          const details = await tmdb(`/movie/${candidate.id}?language=${lang}&append_to_response=videos&include_video_language=${state.lang},en,null`, 12 * H);
          matched = details;
          poster = details.poster_path ? `${TIMG}w500${details.poster_path}` : poster;
          overview = details.overview || '';
          trailer = await pickTrailer(details.videos?.results || []);
          if (!overview && state.lang !== 'en') {
            const en = await tmdb(`/movie/${candidate.id}?language=en-US`, 12 * H).catch(() => null);
            overview = en?.overview || '';
          }
        }
      } catch {}
    }
    const key = 'ia:' + id;
    const posterBlock = `<div class="media-title-row"><img class="media-poster-mini" src="${esc(poster)}" alt="${esc(title)}" loading="lazy" onerror="this.style.display='none'"><div class="media-title-copy"><h2>${esc(title)}</h2><div class="facts">${year ? `<span class="pill neutral">${esc(year)}</span>` : ''}${m.runtime ? `<span class="pill neutral">${esc(m.runtime)}</span>` : ''}<span class="pill ok">${tr(pd ? 'Közkincs' : 'Szabad licenc (CC)')}</span></div></div></div>`;
    sh.innerHTML = `<div class="sheet-bar">${closeBtnHtml()}<a class="iconbtn" href="${IA}/details/${encodeURIComponent(id)}" target="_blank" rel="noopener" aria-label="${tr('Megnyitás az Internet Archive-on')}">${ICON.ext}</a></div>
      <div class="sheet-body media-detail">
        ${posterBlock}
        ${video ? `<div class="player media-main-player"><video id="film" controls playsinline preload="metadata" poster="${esc(poster)}"><source src="${src(video)}" type="${/\.ogv$/i.test(video.name) ? 'video/ogg' : 'video/mp4'}">${subtitles.map((f, i) => `<track kind="subtitles" src="${src(f)}" srclang="${esc((f.language || f.name.match(/\.([a-z]{2,3})\.vtt$/i)?.[1] || 'en').slice(0, 3))}" label="${esc(f.language || f.name)}" ${i === 0 ? 'default' : ''}>`).join('')}</video></div>`
          : errorBox('Ennek a filmnek már nincs lejátszható változata. Válassz egy másikat.')}
        ${movieActions(key, { kind: 'ia', ref: id, title, img: poster, year: String(year || '') })}
        ${rateWidget(key, { kind: 'ia', ref: id, title, img: poster })}
        ${overview ? `<p class="summary" lang="${state.lang === 'en' ? 'en' : 'hu'}">${esc(overview)}</p>` : (state.lang === 'en' && m.desc ? `<p class="summary" lang="en">${esc(m.desc)}</p>` : `<p class="note">${tr('Ehhez a filmhez nem találtunk megbízható magyar nyelvű leírást.')}</p>`)}
        ${trailer ? `<div class="panel"><h3>${tr('Előzetes')}</h3><button class="yt" data-yt="${esc(trailer.key)}" aria-label="${tr('Előzetes lejátszása')}" style="background-image:url('https://i.ytimg.com/vi/${esc(trailer.key)}/hqdefault.jpg')"><span class="play">${ICON.play}</span></button><p class="note">${esc(trailer.name)}${trailerLangNote(trailer)}</p></div>` : ''}
        <p class="note">${tr(pd ? 'Forrás: Internet Archive. Szerzői jog alól felszabadult (public domain) mű.' : 'Forrás: Internet Archive. Az alkotók Creative Commons licenccel, szabadon terjeszthetően tették közzé.')}</p></div>`;
    const player = $('#film');
    if (player) restorePlayback(player, id);
  } catch { sh.querySelector('.sheet-body').innerHTML = errorBox('Nem sikerült betölteni a filmet. Ellenőrizd az internetkapcsolatot.'); }
}
