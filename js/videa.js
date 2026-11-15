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

async function playVidea(videoId) {
  if (!/^[A-Za-z0-9]{16}$/.test(videoId)) { toast('Érvénytelen Videa-videóazonosító.'); return; }

  const sh = $('#sheet');
  sh.hidden = false;
  sh.scrollTop = 0;
  sh.innerHTML = `<div class="sheet-bar"><button class="iconbtn" data-close aria-label="Bezárás">${ICON.back}</button></div>
    <div class="sheet-body"><h2>Videa-videó betöltése…</h2><div class="videa-embed" id="videaEmbed"></div>
    <p class="note" id="videaPlayerStatus" aria-live="polite">A hivatalos Videa-lejátszó betöltése folyamatban…</p></div>`;

  try {
    // A videó adata és a hivatalos embed az elsődleges. A PlayerAPI nem feltétele a lejátszásnak.
    const data = await getVideaVideo(videoId);
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
            onReady: () => {
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
