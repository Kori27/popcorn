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
  if (!key) return Promise.reject(new Error('Hiányzik a Videa PlayerAPI-kulcs. A Beállításokban add meg.'));
  videaPlayerApiReady = new Promise((resolve, reject) => {
    const callback = '__popcornVideaPlayerReady';
    window[callback] = () => { delete window[callback]; resolve(); };
    const script = document.createElement('script');
    script.src = `https://videa.hu/static/api/player_api_v1.0.3.js?key=${encodeURIComponent(key)}&callback=${callback}`;
    script.onerror = () => { videaPlayerApiReady = null; reject(new Error('A Videa PlayerAPI nem tölthető be.')); };
    document.head.appendChild(script);
  });
  return videaPlayerApiReady;
}

async function searchVideaVideos(query, page = 1) {
  const api = await loadVideaOpenAPI();
  if (typeof api.searchVideos !== 'function') {
    throw new Error('A Videa OpenAPI betöltődött, de a keresési funkció nem érhető el. Frissítsd az oldalt, majd próbáld újra.');
  }
  try {
    const response = await api.searchVideos(query, page);
    if (!response || !Array.isArray(response.videos)) {
      throw new Error('A Videa API váratlan választ adott. Próbáld újra később.');
    }
    return response;
  } catch (error) {
    const message = String(error?.message || error || '');
    if (/appId invalid/i.test(message)) {
      throw new Error('A Videa OpenAPI-kulcs érvénytelen. Ellenőrizd, hogy az OpenAPI-kulcsot mentetted-e el (nem a PlayerAPI-kulcsot).');
    }
    if (/origin error/i.test(message)) {
      throw new Error('A Videa nem engedélyezi erről a webhelyről az API használatát. A Videa Beállításokban az OpenAPI-kulcshoz is add hozzá a https://kori27.github.io címet.');
    }
    throw new Error(message || 'A Videa keresési kérése sikertelen. Ellenőrizd az OpenAPI-kulcsot és a webhelyengedélyt.');
  }
}

async function getVideaVideo(videoId) {
  const api = await loadVideaOpenAPI();
  return api.getVideoData(videoId, 0, 576);
}

async function playVidea(videoId) {
  if (!/^[A-Za-z0-9]{16}$/.test(videoId)) { toast('Érvénytelen Videa-videóazonosító.'); return; }
  try {
    const [data] = await Promise.all([getVideaVideo(videoId), loadVideaPlayerAPI()]);
    const sh = $('#sheet');
    sh.hidden = false;
    sh.innerHTML = `<div class="sheet-bar"><button class="iconbtn" data-close aria-label="Bezárás">${ICON.back}</button></div>
      <div class="sheet-body"><h2>${esc(data.title || 'Videa-videó')}</h2>
      <div id="videaEmbed" class="videa-embed"></div>
      <p class="note">A hivatalos Videa-lejátszó jelenik meg. A videó elérhetőségét és beágyazhatóságát a Videa, illetve a feltöltő beállításai határozzák meg.</p>
      </div>`;
    const embed = data.oembed_data?.html || '';
    const match = embed.match(/src=["'](https:\/\/videa\.hu\/player\?[^"']+)["']/i);
    if (!match) throw new Error('A Videa nem adott vissza beágyazható lejátszót ehhez a videóhoz.');
    const url = new URL(match[1]);
    url.searchParams.set('enableJsApi', '1');
    url.searchParams.set('apiKey', state.videaPlayerKey);
    const iframe = document.createElement('iframe');
    iframe.id = 'videa_player_iframe';
    iframe.src = url.toString();
    iframe.title = data.title || 'Videa-lejátszó';
    iframe.allow = 'autoplay; fullscreen; picture-in-picture';
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    $('#videaEmbed').appendChild(iframe);
    // Attach PlayerAPI control object to the official embed; native Videa controls remain available.
    try { new VIDEA.VideaPlayer({ iframeID: 'videa_player_iframe', events: { onKeyError: () => toast('A Videa PlayerAPI-kulcs vagy az engedélyezett webhely nem megfelelő.') } }); } catch {}
  } catch (e) {
    toast(e?.message || 'Nem sikerült megnyitni a Videa-videót.');
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
