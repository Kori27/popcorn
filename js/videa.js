// Popcorn · Official Videa OpenAPI and PlayerAPI integration.
'use strict';

let videaOpenApi = null;
let videaOpenReady = null;
let videaPlayerApiReady = null;

function loadVideaOpenAPI() {
  if (videaOpenApi) return Promise.resolve(videaOpenApi);
  if (videaOpenReady) return videaOpenReady;
  const key = (state.videaOpenKey || '').trim();
  if (!key) return Promise.reject(new Error(tr('Hiányzik a Videa OpenAPI-kulcs. A Beállításokban add meg.')));
  videaOpenReady = new Promise((resolve, reject) => {
    const callback = '__popcornVideaOpenReady';
    window[callback] = () => {
      try { videaOpenApi = new VIDEA.VideaOpenAPI(); resolve(videaOpenApi); }
      catch (e) { reject(e); }
      finally { delete window[callback]; }
    };
    const script = document.createElement('script');
    script.src = `https://videa.hu/static/api/open_api_v1.0.2.js?key=${encodeURIComponent(key)}&callback=${callback}`;
    script.onerror = () => { videaOpenReady = null; reject(new Error(tr('A Videa OpenAPI nem tölthető be. Ellenőrizd a kulcsot és az engedélyezett webhelyet.'))); };
    document.head.appendChild(script);
  });
  return videaOpenReady;
}

function loadVideaPlayerAPI() {
  if (window.VIDEA?.VideaPlayer) return Promise.resolve();
  if (videaPlayerApiReady) return videaPlayerApiReady;
  const key = (state.videaPlayerKey || '').trim();
  if (!key) return Promise.reject(new Error(tr('Hiányzik a Videa PlayerAPI-kulcs. A Beállításokban add meg.')));
  videaPlayerApiReady = new Promise((resolve, reject) => {
    const callback = '__popcornVideaPlayerReady';
    window[callback] = () => { delete window[callback]; resolve(); };
    const script = document.createElement('script');
    script.src = `https://videa.hu/static/api/player_api_v1.0.3.js?key=${encodeURIComponent(key)}&callback=${callback}`;
    script.onerror = () => { videaPlayerApiReady = null; reject(new Error(tr('A Videa PlayerAPI nem tölthető be.'))); };
    document.head.appendChild(script);
  });
  return videaPlayerApiReady;
}

async function searchVideaVideos(query, page = 1) {
  const api = await loadVideaOpenAPI();
  return api.searchVideos(query, page);
}

async function getVideaVideo(videoId) {
  const api = await loadVideaOpenAPI();
  return api.getVideoData(videoId, 0, 576);
}

async function playVidea(videoId, push = true) {
  if (!/^[A-Za-z0-9]{16}$/.test(videoId)) { toast(tr('Érvénytelen Videa-videóazonosító.')); return; }
  if (push) pushSheet({ videa: videoId }, '#videa-' + videoId);
  showSheet();
  const sh = $('#sheet'), here = () => location.hash === '#videa-' + videoId;
  const link = `<a class="iconbtn" href="https://videa.hu/videok/${videoId}" target="_blank" rel="noopener" aria-label="${tr('Megnyitás a Videán')}">${ICON.ext}</a>`;
  sh.innerHTML = `<div class="sheet-bar">${closeBtnHtml()}${link}</div><div class="sheet-body"><div class="videa-embed skel"></div>${skelRows(1)}</div>`;
  try {
    const [data] = await Promise.all([getVideaVideo(videoId), loadVideaPlayerAPI()]);
    if (!here()) return;
    const embed = data.oembed_data?.html || '';
    const match = embed.match(/src=["'](https:\/\/videa\.hu\/player\?[^"']+)["']/i);
    if (!match) throw new Error(tr('A Videa nem adott vissza beágyazható lejátszót ehhez a videóhoz.'));
    sh.innerHTML = `<div class="sheet-bar">${closeBtnHtml()}${link}</div>
      <div class="sheet-body"><div id="videaEmbed" class="videa-embed"></div>
      <div><h2 style="font:800 22px/1.2 var(--font-display);margin:0 0 6px">${esc(data.title || tr('Videa-videó'))}</h2>
      ${data.channel?.name ? `<div class="note">${esc(data.channel.name)}</div>` : ''}</div>
      <p class="note">${tr('A hivatalos Videa-lejátszó jelenik meg. A videó elérhetőségét és beágyazhatóságát a Videa, illetve a feltöltő beállításai határozzák meg.')}</p></div>`;
    const url = new URL(match[1].replace(/&amp;/g, '&'));
    url.searchParams.set('enableJsApi', '1');
    url.searchParams.set('apiKey', state.videaPlayerKey);
    const iframe = document.createElement('iframe');
    iframe.id = 'videa_player_iframe';
    iframe.src = url.toString();
    iframe.title = data.title || tr('Videa-videó');
    iframe.allow = 'autoplay; fullscreen; picture-in-picture';
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    $('#videaEmbed').appendChild(iframe);
    // PlayerAPI control object on the official embed; the native Videa controls stay available
    try { new VIDEA.VideaPlayer({ iframeID: 'videa_player_iframe', events: { onKeyError: () => toast(tr('A Videa PlayerAPI-kulcs vagy az engedélyezett webhely nem megfelelő.')) } }); } catch {}
  } catch (e) {
    if (here()) sh.querySelector('.sheet-body').innerHTML = errorBox(e?.message || 'Nem sikerült megnyitni a Videa-videót.');
  }
}

async function saveVideaKey(which) {
  const msg = $('#videaKeyMsg');
  if (which === 'clear') {
    state.videaOpenKey = ''; state.videaPlayerKey = ''; save();
    toast(tr('Videa-kulcsok törölve')); return renderSettings();
  }
  const id = which === 'open' ? 'videaOpenKey' : 'videaPlayerKey';
  const key = ($('#' + id)?.value || '').trim();
  if (!key) { if (msg) msg.textContent = tr('Írd be a kulcsot a mezőbe.'); return; }
  if (which === 'open') state.videaOpenKey = key; else state.videaPlayerKey = key;
  save();
  toast(tr('Videa-kulcs elmentve ezen az eszközön.'));
  renderSettings();
}
