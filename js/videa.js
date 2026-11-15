// Popcorn · Official Videa OpenAPI and PlayerAPI integration.
'use strict';

let videaOpenApi = null;
let videaOpenReady = null;
let videaPlayerApiReady = null;

function loadVideaOpenAPI() {
  if (videaOpenApi) return Promise.resolve(videaOpenApi);
  if (videaOpenReady) return videaOpenReady;
  const key = (state.videaOpenKey || '').trim();
  if (!key) return Promise.reject(new Error('Hiányzik a Videa OpenAPI-kulcs. Nyisd meg a Beállításokat, és mentsd el az OpenAPI-kulcsot.'));
  videaOpenReady = new Promise((resolve, reject) => {
    const callback = '__popcornVideaOpenReady';
    let settled = false;
    const finish = (err, api) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      delete window[callback];
      if (err) { videaOpenReady = null; reject(err); }
      else { videaOpenApi = api; resolve(api); }
    };
    const timer = setTimeout(() => finish(new Error('A Videa OpenAPI nem válaszolt 15 másodpercen belül. Ellenőrizd az internetkapcsolatot, az API-kulcsot és az engedélyezett webhelyet.')), 15000);
    window[callback] = () => {
      try {
        if (!window.VIDEA?.VideaOpenAPI) throw new Error('A Videa OpenAPI betöltődött, de a VIDEA.VideaOpenAPI objektum nem található.');
        finish(null, new VIDEA.VideaOpenAPI());
      } catch (e) { finish(e); }
    };
    const script = document.createElement('script');
    script.src = `https://videa.hu/static/api/open_api_v1.0.2.js?key=${encodeURIComponent(key)}&callback=${callback}`;
    script.onerror = () => finish(new Error('Nem tölthető be a Videa OpenAPI JavaScript-fájl. Ellenőrizd az internetkapcsolatot, a kulcsot és hogy a https://kori27.github.io webhely engedélyezve van-e a Videa beállításaiban.'));
    document.head.appendChild(script);
  });
  return videaOpenReady;
}
function loadVideaPlayerAPI() {
  if (window.VIDEA?.VideaPlayer) return Promise.resolve();
  if (videaPlayerApiReady) return videaPlayerApiReady;
  const key = (state.videaPlayerKey || '').trim();
  if (!key) return Promise.reject(new Error('Hiányzik a Videa PlayerAPI-kulcs.'));
  videaPlayerApiReady = new Promise((resolve, reject) => {
    const callback = '__popcornVideaPlayerReady';
    let settled = false;
    const finish = (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      delete window[callback];
      if (err) { videaPlayerApiReady = null; reject(err); }
      else resolve();
    };
    const timer = setTimeout(() => finish(new Error('A Videa PlayerAPI nem válaszolt 15 másodpercen belül. A videó ettől még lejátszható lehet.')), 15000);
    window[callback] = () => finish();
    const script = document.createElement('script');
    script.src = `https://videa.hu/static/api/player_api_v1.0.3.js?key=${encodeURIComponent(key)}&callback=${callback}`;
    script.onerror = () => finish(new Error('A Videa PlayerAPI nem tölthető be.'));
    document.head.appendChild(script);
  });
  return videaPlayerApiReady;
}

async function searchVideaVideos(query, page = 1) {
  const api = await loadVideaOpenAPI();
  if (typeof api.searchVideos !== 'function') {
    throw new Error('A Videa OpenAPI betöltődött, de a keresési funkció nem érhető el.');
  }

  const diagnostics = {
    query,
    general: { status: 'not-run', count: null, response: null, error: null },
    tag: { status: 'not-run', count: null, response: null, error: null }
  };
  const preview = value => {
    try { return JSON.stringify(value, (key, val) => /key|token|secret|password/i.test(key) ? '[rejtve]' : val).slice(0, 1800); }
    catch { return String(value).slice(0, 1800); }
  };

  let generalResponse = null;
  try {
    generalResponse = await api.searchVideos(query, page);
    diagnostics.general.status = 'ok';
    diagnostics.general.count = Array.isArray(generalResponse?.videos) ? generalResponse.videos.length : null;
    diagnostics.general.response = preview(generalResponse);
  } catch (error) {
    diagnostics.general.status = 'error';
    diagnostics.general.error = String(error?.message || error);
  }

  let tagResponse = null;
  if (typeof api.getTagVideos === 'function') {
    try {
      tagResponse = await api.getTagVideos(query, 'upload_date', page);
      diagnostics.tag.status = 'ok';
      diagnostics.tag.count = Array.isArray(tagResponse?.videos) ? tagResponse.videos.length : null;
      diagnostics.tag.response = preview(tagResponse);
    } catch (error) {
      diagnostics.tag.status = 'error';
      diagnostics.tag.error = String(error?.message || error);
    }
  } else {
    diagnostics.tag.status = 'unavailable';
  }

  const generalVideos = Array.isArray(generalResponse?.videos) ? generalResponse.videos : [];
  const tagVideos = Array.isArray(tagResponse?.videos) ? tagResponse.videos : [];
  const selected = generalVideos.length ? generalResponse : tagVideos.length ? tagResponse : generalResponse;
  if (selected && typeof selected === 'object') {
    return { ...selected, _popcornDiagnostics: diagnostics, _popcornFallback: selected === tagResponse ? 'tag' : 'general' };
  }
  if (diagnostics.general.status === 'error' && diagnostics.tag.status === 'error') {
    throw new Error('A Videa általános és címkekeresése is hibát adott. Részletek a diagnosztikai panelen: ' + diagnostics.general.error + ' / ' + diagnostics.tag.error);
  }
  return { videos: [], totalhits: 0, _popcornDiagnostics: diagnostics };
}

async function getVideaVideo(videoId) {
  const api = await loadVideaOpenAPI();
  return api.getVideoData(videoId, 0, 576);
}


let videaProgressTimer = null;
let activeVideaPlayer = null;
let activeVideaId = null;
function toggleVideaFav(id) {
  const existing = state.videaFavs[id];
  if (existing) {
    delete state.videaFavs[id];
    toast('Eltávolítva a Videa-kedvencek közül.');
  } else {
    const history = state.videaHistory[id] || {};
    const card = document.querySelector(`[data-videa-card="${CSS.escape(id)}"]`);
    const title = card?.querySelector('.name')?.textContent || history.title || 'Videa-videó';
    const img = card?.querySelector('img')?.src || history.thumbnail || '';
    const duration = Number(card?.dataset.duration || history.duration || 0);
    state.videaFavs[id] = { id, title, thumbnail: img, duration, durationText: card?.querySelector('.meta')?.textContent || '', updated: Date.now() };
    toast('Hozzáadva a Videa-kedvencekhez.');
  }
  save();
  document.querySelectorAll(`[data-videa-fav="${CSS.escape(id)}"]`).forEach(b => {
    const on = !!state.videaFavs[id];
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
    b.setAttribute('aria-label', on ? 'Eltávolítás a kedvencekből' : 'Kedvencnek jelölés');
  });
  if (tab === 'home') render();
}
function saveVideaProgress(id, player) {
  if (!id || !player) return;
  try {
    const position = Number(player.getCurrentTime?.() || 0);
    const duration = Number(player.getDuration?.() || 0);
    if (!Number.isFinite(position) || position < 0) return;
    const prev = state.videaHistory[id] || {};
    state.videaHistory[id] = { ...prev, id, position, duration: duration || prev.duration || 0, updated: Date.now() };
    if (position > 30 && duration > 0 && position >= duration - 30) state.videaHistory[id].completed = true;
    else state.videaHistory[id].completed = false;
    save();
  } catch {}
}
function startVideaProgress(id, player) {
  activeVideaPlayer = player; activeVideaId = id;
  clearInterval(videaProgressTimer);
  const saved = state.videaHistory[id];
  const resume = Number(saved?.position || 0);
  try {
    const duration = Number(player.getDuration?.() || saved?.duration || 0);
    if (resume > 15 && (!duration || resume < duration - 30)) player.seekTo?.(resume);
  } catch {}
  saveVideaProgress(id, player);
  videaProgressTimer = setInterval(() => {
    if (activeVideaId !== id || !document.getElementById('videa_player_iframe')) { clearInterval(videaProgressTimer); return; }
    saveVideaProgress(id, player);
  }, 5000);
}


function videaTitleYear(title) {
  const m = String(title || '').match(/\b(19|20)\d{2}\b/);
  return m ? m[0] : '';
}
function videaCleanTitle(title) {
  return String(title || 'Videa-videó')
    .replace(/\b(19|20)\d{2}\b/g, ' ')
    .replace(/\b(1080p|720p|4k|magyar szinkron|szinkronos|teljes film|hd|full hd)\b/gi, ' ')
    .replace(/[|_[\]()]/g, ' ').replace(/\s+/g, ' ').trim();
}
function videaActions(id, data, match) {
  const want = !!state.videaWant[id], stars = Number(state.videaRatings[id]?.stars || 0);
  const title = data.title || 'Videa-videó';
  const thumb = data.thumbnail || data.thumbnail_url || '';
  const year = match?.release_date?.slice(0,4) || videaTitleYear(title);
  const key = 'videa:' + id;
  return `<div class="actions">
    <button class="btn ${want ? 'soft' : 'primary'}" data-videa-want="${esc(id)}" aria-pressed="${want}">${want ? ICON.check : ICON.plus}${tr('Megnézendő')}</button>
    <button class="btn ${state.videaFavs[id] ? 'soft' : 'ghost'}" data-videa-fav="${esc(id)}" aria-pressed="${!!state.videaFavs[id]}">${ICON.heart}${tr(state.videaFavs[id] ? 'Kedvenc' : 'Kedvencnek jelölöm')}</button>
  </div>
  <div class="panel" data-videa-rating="${esc(id)}"><h3>${tr('Saját értékelésed')}</h3>
    <div class="stars" role="group" aria-label="${tr('Saját értékelésed')}">${[1,2,3,4,5].map(n => `<button class="star${n <= stars ? ' on' : ''}" data-videa-rate="${esc(id)}|${n}" aria-pressed="${n === stars}" aria-label="${tr('{n} csillag',{n})}">★</button>`).join('')}</div>
    <span class="note">${stars ? tr('Értékelve: {n}/5',{n:stars}) : tr('Koppints a csillagokra az értékeléshez.')}</span>
  </div>`;
}
async function enrichVideaDetails(id, data) {
  const slot = document.getElementById('videaMeta');
  if (!slot) return;
  if (!tmdbKey()) {
    slot.innerHTML = `<p class="note">${tr('A film tartalmi leírásához és hivatalos előzeteséhez add meg a TMDB-kulcsot a Beállításokban.')}</p>
      <button class="btn soft" data-settings>${tr('TMDB-kulcs beállítása')}</button>`;
    return;
  }
  const clean = videaCleanTitle(data.title);
  if (!clean) return;
  try {
    const q = await tmdb(`/search/movie?query=${encodeURIComponent(clean)}&language=${TLANG()}&include_adult=false`, 12 * H);
    const year = videaTitleYear(data.title);
    let candidates = q.results || [];
    if (year) candidates = candidates.sort((a,b) => Math.abs(Number((a.release_date||'').slice(0,4))-Number(year)) - Math.abs(Number((b.release_date||'').slice(0,4))-Number(year)));
    const match = candidates.find(x => x.overview) || candidates[0];
    if (!match || !document.getElementById('videaMeta')) {
      slot.innerHTML = `<p class="note">${tr('Ehhez a videóhoz nem találtunk megbízható filmadatlapot. A videó címe és leírása a feltöltőtől függ.')}</p>`;
      return;
    }
    const m = await tmdb(`/movie/${match.id}?language=${TLANG()}&append_to_response=videos`, 12 * H);
    if (!document.getElementById('videaMeta')) return;
    const trailer = await pickTrailer(m.videos?.results);
    const key = 'videa:' + id;
    slot.innerHTML = `${m.overview ? `<p class="summary">${esc(m.overview)}</p>` : `<p class="note">${tr('Ehhez a filmhez nincs elérhető tartalmi leírás.')}</p>`}
      <div class="facts">${m.release_date ? `<span class="pill neutral">${esc(m.release_date.slice(0,4))}</span>` : ''}${m.runtime ? `<span class="pill neutral">${tr('{n} perc',{n:m.runtime})}</span>` : ''}${m.vote_count > 20 ? `<span class="pill neutral">TMDB ★ ${m.vote_average.toFixed(1)}</span>` : ''}${(m.genres||[]).slice(0,3).map(g=>`<span class="pill neutral">${esc(g.name)}</span>`).join('')}</div>
      ${trailer ? `<div class="panel"><h3>${tr('Előzetes')}</h3><button class="yt" data-yt="${esc(trailer.key)}" aria-label="${tr('Előzetes lejátszása')}" style="background-image:url('https://i.ytimg.com/vi/${esc(trailer.key)}/hqdefault.jpg')"><span class="play">${ICON.play}</span></button><p class="note">${esc(trailer.name)}${trailerLangNote(trailer)}</p></div>` : `<div class="panel"><h3>${tr('Előzetes')}</h3><p>${tr('Ehhez a címhez nem találtunk előzetest.')}</p><a class="btn ghost" style="text-decoration:none" href="${ytSearch(m.title)}" target="_blank" rel="noopener">${ICON.ext}${tr('Keresés a YouTube-on')}</a></div>`}
      <p class="note">${tr('A leírás és az előzetes a TMDB adatbázisából származik; a videó és a film egyezése automatikus, ezért ellenőrizd a címet.')}</p>`;
  } catch (e) {
    if (document.getElementById('videaMeta')) slot.innerHTML = `<p class="note">${tr('A filmadatlap most nem tölthető be.')}</p>`;
  }
}
function toggleVideaWant(id) {
  const data = state.videaHistory[id] || {};
  if (state.videaWant[id]) { delete state.videaWant[id]; toast('Eltávolítva a megnézendők közül.'); }
  else { state.videaWant[id] = { id, title: data.title || state.videaFavs[id]?.title || 'Videa-videó', thumbnail: data.thumbnail || state.videaFavs[id]?.thumbnail || '', updated: Date.now() }; toast('Hozzáadva a megnézendőkhöz.'); }
  save();
  const b = document.querySelector(`[data-videa-want="${CSS.escape(id)}"]`);
  if (b) { const on=!!state.videaWant[id]; b.classList.toggle('soft',on); b.classList.toggle('primary',!on); b.setAttribute('aria-pressed',String(on)); b.innerHTML=(on?ICON.check:ICON.plus)+tr('Megnézendő'); }
  if (tab === 'home') render();
}
function setVideaRating(id, stars) {
  if (stars) state.videaRatings[id] = { stars, at: Date.now(), title: state.videaHistory[id]?.title || 'Videa-videó' };
  else delete state.videaRatings[id];
  save();
  const panel = document.querySelector(`[data-videa-rating="${CSS.escape(id)}"]`);
  if (panel) panel.outerHTML = `<div class="panel" data-videa-rating="${esc(id)}"><h3>${tr('Saját értékelésed')}</h3><div class="stars">${[1,2,3,4,5].map(n=>`<button class="star${n<=stars?' on':''}" data-videa-rate="${esc(id)}|${n}" aria-pressed="${n===stars}" aria-label="${tr('{n} csillag',{n})}">★</button>`).join('')}</div><span class="note">${tr('Értékelve: {n}/5',{n:stars})}</span></div>`;
  toast('Értékelés elmentve.');
}

async function playVidea(videoId) {
  clearInterval(videaProgressTimer); activeVideaPlayer = null; activeVideaId = null;
  if (!/^[A-Za-z0-9]{16}$/.test(videoId)) { toast('Érvénytelen Videa-videóazonosító.'); return; }

  const sh = $('#sheet');
  sh.hidden = false;
  sh.scrollTop = 0;
  sh.innerHTML = `<div class="sheet-bar"><button class="iconbtn" data-close aria-label="Bezárás">${ICON.back}</button></div>
    <div class="sheet-body"><h2>Videa-videó betöltése…</h2><div id="videaActions"></div><div id="videaMeta"><p class="note">Filmleírás és előzetes keresése…</p></div><div class="videa-embed" id="videaEmbed"></div>
    <p class="note" id="videaPlayerStatus" aria-live="polite">A hivatalos Videa-lejátszó betöltése folyamatban…</p></div>`;

  try {
    // A videó adata és a hivatalos embed az elsődleges. A PlayerAPI nem feltétele a lejátszásnak.
    const data = await getVideaVideo(videoId);
    const prior = state.videaHistory[videoId] || {};
    state.videaHistory[videoId] = { ...prior, id: videoId, title: data.title || prior.title || 'Videa-videó',
      thumbnail: data.thumbnail || data.thumbnail_url || prior.thumbnail || '', updated: Date.now() };
    save();
    const actionSlot = $('#videaActions');
    if (actionSlot) actionSlot.innerHTML = videaActions(videoId, data, null);
    enrichVideaDetails(videoId, data);
    const embedHtml = data?.oembed_data?.html || '';
    const parsed = new DOMParser().parseFromString(embedHtml, 'text/html');
    const sourceFrame = parsed.querySelector('iframe');
    const rawSrc = sourceFrame?.getAttribute('src');
    if (!rawSrc) throw new Error('A Videa nem adott vissza beágyazható lejátszót ehhez a videóhoz.');

    const url = new URL(rawSrc, 'https://videa.hu/');
    if (url.hostname !== 'videa.hu' && !url.hostname.endsWith('.videa.hu')) {
      throw new Error('A Videa visszaadott beágyazó címe nem érvényes Videa-lejátszó.');
    }
    url.searchParams.set('enableJsApi', '1');
    if (state.videaPlayerKey) url.searchParams.set('apiKey', state.videaPlayerKey);

    const iframe = document.createElement('iframe');
    iframe.id = 'videa_player_iframe';
    iframe.src = url.toString();
    iframe.title = data.title || 'Videa-lejátszó';
    iframe.allow = 'autoplay; fullscreen; picture-in-picture';
    iframe.allowFullscreen = true;
    iframe.loading = 'eager';
    iframe.setAttribute('webkitallowfullscreen', 'webkitallowfullscreen');
    iframe.setAttribute('mozallowfullscreen', 'mozallowfullscreen');
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    $('#videaEmbed').appendChild(iframe);

    const title = sh.querySelector('h2');
    if (title) title.textContent = data.title || 'Videa-videó';
    const status = $('#videaPlayerStatus');
    if (status) status.textContent = 'A Videa hivatalos lejátszója betöltődik. Ha a feltöltő letiltotta a beágyazást, a videó itt nem lesz lejátszható.';

    // A PlayerAPI csak opcionális vezérlés; hibája nem távolíthatja el és nem akadályozhatja a lejátszót.
    if (state.videaPlayerKey) {
      loadVideaPlayerAPI().then(() => {
        if (!document.getElementById('videa_player_iframe') || !window.VIDEA?.VideaPlayer) return;
        new VIDEA.VideaPlayer({
          iframeID: 'videa_player_iframe',
          events: {
            onReady: (player) => {
              startVideaProgress(videoId, player);
              const note = $('#videaPlayerStatus');
              if (note) note.textContent = 'A Videa-lejátszó készen áll.';
            },
            onKeyError: () => {
              const note = $('#videaPlayerStatus');
              if (note) note.textContent = 'A PlayerAPI-kulcsot a Videa nem fogadta el. A hivatalos lejátszó ettől még működhet.';
            }
          }
        });
      }).catch(error => {
        const note = $('#videaPlayerStatus');
        if (note) note.textContent = `${error.message} A videó megjelenítése ettől függetlenül megpróbálható.`;
      });
    } else if ($('#videaPlayerStatus')) {
      $('#videaPlayerStatus').textContent = 'A hivatalos lejátszó betöltődik. A PlayerAPI-kulcs opcionális a videó megjelenítéséhez.';
    }
  } catch (e) {
    const body = sh.querySelector('.sheet-body');
    if (body) body.innerHTML = `<h2>Nem sikerült betölteni a Videa-videót</h2><p class="note">${esc(e?.message || 'Ismeretlen hiba.')}</p>
      <p><a class="btn ghost" href="https://videa.hu/videok/${encodeURIComponent(videoId)}" target="_blank" rel="noopener noreferrer">Megnyitás a Videán</a></p>`;
  }
}

async function saveVideaKey(which) {
  const msg = $('#videaKeyMsg');
  if (which === 'clear') {
    state.videaOpenKey = ''; state.videaPlayerKey = ''; save();
    toast('Videa-kulcsok törölve'); return renderSettings();
  }
  const id = which === 'open' ? 'videaOpenKey' : 'videaPlayerKey';
  const key = ($('#' + id)?.value || '').trim();
  if (!key) { if (msg) msg.textContent = 'Írd be a kulcsot a mezőbe.'; return; }
  if (which === 'open') state.videaOpenKey = key; else state.videaPlayerKey = key;
  save();
  toast('Videa-kulcs elmentve ezen az eszközön.');
  renderSettings();
}
