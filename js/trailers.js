// Popcorn · TMDB access and in-app YouTube trailers.
'use strict';

/* ---------- Trailers (TMDB → YouTube, played inside the app) ---------- */
/** Best YouTube video: the app's language always wins (a Hungarian teaser beats an English trailer), then English. */
function pickTrailer(results) {
  const score = v => (v.iso_639_1 === state.lang ? 100 : v.iso_639_1 === 'en' ? 10 : 0)
    + (v.type === 'Trailer' ? 4 : v.type === 'Teaser' ? 2 : 0) + (v.official ? 1 : 0);
  return (results || []).filter(v => v.site === 'YouTube').sort((a, b) => score(b) - score(a))[0] || null;
}
/** Short note under the trailer about its language. */
const trailerLangNote = t => state.lang === 'en' ? ''
  : t.iso_639_1 === state.lang ? ' · ' + tr('anyanyelvi')
  : ' · ' + tr(t.iso_639_1 === 'en' ? 'angol nyelvű (magyar nem érhető el)' : 'eredeti nyelvű');
async function trailerForShow(s) {
  const id = await tmdbTvId(s);
  if (!id) return null;
  return pickTrailer((await tmdb(`/tv/${id}/videos?language=${TLANG()}&include_video_language=${state.lang},en,null`)).results);
}
const ytSearch = title => `https://www.youtube.com/results?search_query=${encodeURIComponent(title + ' ' + tr('előzetes') + ' trailer')}`;
function trailerPanel() { return `<div class="panel" id="trailerPanel"><h3>${tr('Előzetes')}</h3><div data-tslot><div class="skel" style="aspect-ratio:16/9"></div></div></div>`; }
async function fillTrailer(promise, title) {
  const slot = document.querySelector('#trailerPanel [data-tslot]');
  if (!slot) return;
  if (!tmdbKey()) {
    slot.innerHTML = `<p>${tr('Add meg az ingyenes TMDB-kulcsot a Beállításokban, és az előzetes itt, az appban indul.')}</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn soft" data-settings>${tr('Kulcs megadása')}</button>
      <a class="btn ghost" style="text-decoration:none" href="${ytSearch(title)}" target="_blank" rel="noopener">${ICON.ext}${tr('Keresés a YouTube-on')}</a></div>`;
    return;
  }
  try {
    const t = await promise;
    if (!document.contains(slot)) return;
    slot.innerHTML = t
      ? `<button class="yt" data-yt="${esc(t.key)}" aria-label="${tr('Előzetes lejátszása')}" style="background-image:url('https://i.ytimg.com/vi/${esc(t.key)}/hqdefault.jpg')"><span class="play">${ICON.play}</span></button>
         <p class="note" style="margin-top:8px">${esc(t.name)}${trailerLangNote(t)}</p>`
      : `<p>${tr('Ehhez a címhez nem találtunk előzetest.')}</p><a class="btn ghost" style="text-decoration:none;margin-top:10px" href="${ytSearch(title)}" target="_blank" rel="noopener">${ICON.ext}${tr('Keresés a YouTube-on')}</a>`;
  } catch (e) { if (document.contains(slot)) slot.innerHTML = keyError(e); }
}
function playYouTube(btn) {
  const key = btn.dataset.yt;
  const box = document.createElement('div'); box.className = 'player';
  box.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(key)}?autoplay=1&rel=0&playsinline=1&modestbranding=1" title="${tr('Előzetes')}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
  btn.replaceWith(box);
}

