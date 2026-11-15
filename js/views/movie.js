// Popcorn · Cinema release detail page (TMDB).
'use strict';

/* ---------- Movie detail (TMDB) ---------- */
async function openMovie(id, push = true) {
  if (push) pushSheet({ movie: id }, '#mozi-' + id);
  showSheet();
  const sh = $('#sheet');
  sh.innerHTML = `<div class="sheet-bar">${closeBtnHtml()}</div><div class="sheet-body">${skelRows(3)}</div>`;
  try {
    const m = await tmdb(`/movie/${id}?language=${TLANG()}&append_to_response=videos&include_video_language=${state.lang},en,null`);
    if (location.hash !== '#mozi-' + id) return;
    const t = await pickTrailer(m.videos?.results);
    const facts = [m.release_date ? `<span class="pill accent">${tr('Bemutató')}: ${fmtDate(m.release_date)}</span>` : '', m.runtime ? `<span class="pill neutral">${tr('{n} perc', { n: m.runtime })}</span>` : '',
      m.vote_count > 20 ? `<span class="pill neutral">★ ${m.vote_average.toFixed(1)}</span>` : '', ...(m.genres || []).slice(0, 3).map(g => `<span class="pill neutral">${esc(g.name)}</span>`)].join('');
    sh.innerHTML = `${m.backdrop_path ? backdrop(TIMG + 'w780' + m.backdrop_path, true) : backdrop(m.poster_path ? TIMG + 'w342' + m.poster_path : null)}<div class="sheet-bar">${closeBtnHtml()}</div><div class="sheet-body">
      <div class="hero">${m.poster_path ? `<img class="poster" src="${TIMG}w342${esc(m.poster_path)}" alt="">` : `<div class="poster-ph">${esc(m.title)}</div>`}
        <div style="min-width:0"><h2>${esc(m.title)}</h2>${m.original_title !== m.title ? `<div class="note">${esc(m.original_title)}</div>` : ''}<div class="facts">${facts}</div>
        ${movieActions('mv:' + id, { kind: 'mv', ref: id, title: m.title, img: m.poster_path ? TIMG + 'w154' + m.poster_path : null, year: (m.release_date || '').slice(0, 4), runtime: m.runtime || null, imdb: m.imdb_id || null })}</div></div>
      ${rateWidget('mv:' + id, { kind: 'mv', ref: id, title: m.title, img: m.poster_path ? TIMG + 'w154' + m.poster_path : null })}
      <div class="panel"><h3>${tr('Előzetes')}</h3>${t ? `<button class="yt" data-yt="${esc(t.key)}" aria-label="${tr('Előzetes lejátszása')}" style="background-image:url('https://i.ytimg.com/vi/${esc(t.key)}/hqdefault.jpg')"><span class="play">${ICON.play}</span></button><p class="note">${esc(t.name)}${trailerLangNote(t)}</p>`
        : `<p>${tr('Ehhez a filmhez még nincs előzetes.')}</p><a class="btn ghost" style="text-decoration:none" href="${ytSearch(m.title)}" target="_blank" rel="noopener">${ICON.ext}${tr('Keresés a YouTube-on')}</a>`}</div>
      ${m.overview ? `<p class="summary">${esc(m.overview)}</p>` : `<p class="note">${tr('Leírás még nincs ezen a nyelven.')}</p>`}
      <div class="panel" id="where"><h3>${tr('Hol nézhető?')}</h3><div data-provslot>${providersHtml(undefined)}</div><div class="where"><a href="https://www.justwatch.com/hu/search?q=${encodeURIComponent(m.title)}" target="_blank" rel="noopener"><b>JustWatch</b><small>${tr('Mozik és később a streaming-szolgáltatók')}</small>${ICON.ext}</a></div></div>
      <p class="note">${tr('Adatok és előzetes: TMDB, YouTube.')}</p></div>`;
    fillProviders(providersFor('movie', id), () => location.hash === '#mozi-' + id);
  } catch (e) { sh.querySelector('.sheet-body').innerHTML = keyError(e); }
}

