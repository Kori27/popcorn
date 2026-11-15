// Popcorn · Statistics: watched episodes and films, watch time, monthly chart, favourite genres.
'use strict';

const fmtNum = (n, d = 0) => n.toLocaleString(LOC(), { maximumFractionDigits: d, minimumFractionDigits: d });
const monthKey = t => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };

async function renderStats(v, alive) {
  const box = Object.assign(document.createElement('div'), { className: 'stats' });
  v.appendChild(box);
  const sids = Object.keys(state.watched);
  const seenFilms = Object.values(state.movies).filter(m => m.status === 'seen');
  if (!sids.length && !seenFilms.length) {
    box.innerHTML = `<div class="empty"><h3>${tr('Még nincs mit összesíteni')}</h3><p>${tr('Pipálj ki néhány megnézett részt, vagy jelölj meg egy filmet megnézettként, és itt látod a nézési szokásaidat.')}</p></div>`;
    return;
  }
  box.innerHTML = `<div class="tiles">${Array.from({ length: 4 }, () => '<div><div class="skel" style="height:44px"></div></div>').join('')}</div>`;
  let data;
  try {
    data = await pool(sids, 4, async sid => {
      const [show, eps] = await Promise.all([getShow(sid).catch(() => null), getEps(sid).catch(() => null)]);
      return { sid, show: show || state.follows[sid] || { id: +sid, name: '?' }, eps: eps || [] };
    });
  } catch { if (alive()) box.innerHTML = errorBox(NET_ERR); return; }
  if (!alive()) return;

  // last 12 months, oldest first
  const now = new Date(), months = [];
  for (let i = 11; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push({ key: monthKey(d), d, min: 0, eps: 0, films: 0 }); }
  const byMonth = new Map(months.map(m => [m.key, m]));
  let epCount = 0, epMin = 0, finished = 0, undated = 0;
  const perShow = [], genres = new Map();
  for (const { sid, show, eps } of data) {
    const marks = state.watched[sid] || {}, byId = new Map(eps.map(e => [e.id, e]));
    let n = 0, min = 0;
    for (const [eid, t] of Object.entries(marks)) {
      const rt = byId.get(+eid)?.rt || show.runtime || 0;
      n++; min += rt;
      const m = t > 1e12 ? byMonth.get(monthKey(t)) : null;
      if (m) { m.min += rt; m.eps++; } else if (!(t > 1e12)) undated++;
    }
    epCount += n; epMin += min;
    perShow.push({ show, n, min });
    (show.genres || []).forEach(g => genres.set(g, (genres.get(g) || 0) + n));
    const p = progressOf(+sid, eps);
    if (show.status === 'Ended' && p.aired && !p.next) finished++;
  }
  let filmMin = 0;
  seenFilms.forEach(f => {
    filmMin += f.runtime || 0;
    const m = f.seenAt ? byMonth.get(monthKey(f.seenAt)) : null;
    if (m) { m.min += f.runtime || 0; m.films++; }
  });
  const ratings = Object.values(state.ratings), avg = ratings.length ? ratings.reduce((s, r) => s + r.stars, 0) / ratings.length : 0;
  const hours = (epMin + filmMin) / 60;

  const tiles = [
    [fmtNum(epCount), 'megnézett rész'], [fmtNum(seenFilms.length), 'megnézett film'],
    [fmtNum(hours, hours < 10 ? 1 : 0), 'óra nézés'], [hours >= 24 ? fmtNum(hours / 24, 1) : '–', 'nap egyhuzamban'],
    [fmtNum(Object.keys(state.follows).length), 'követett sorozat'], [fmtNum(finished), 'végignézett sorozat'],
    [ratings.length ? fmtNum(avg, 1) + ' ★' : '–', 'átlagos értékelésed']];

  // monthly chart (single series: hours watched; hover/focus shows the breakdown)
  const maxMin = Math.max(...months.map(m => m.min), 1), maxIdx = months.findIndex(m => m.min === maxMin);
  const mLabel = d => d.toLocaleDateString(LOC(), { month: 'short' }).replace('.', '');
  const bars = months.map((m, i) => {
    const h = m.min / 60, tip = `${d2(m.d)} · ${tr('{h} óra', { h: fmtNum(h, 1) })} · ${tr('{n} rész', { n: m.eps })}${m.films ? ', ' + tr('{n} film', { n: m.films }) : ''}`;
    return `<div class="bar${i < 3 ? ' l' : i > 8 ? ' r' : ''}" tabindex="0" data-tip="${esc(tip)}" aria-label="${esc(tip)}">
      ${i === maxIdx && m.min ? `<span class="v">${fmtNum(h, h < 10 ? 1 : 0)}</span>` : ''}<i style="height:${m.min ? Math.max(m.min / maxMin * 100, 2) : 0}%"></i></div>`;
  }).join('');
  const table = `<details class="tbl"><summary>${tr('Táblázatként')}</summary><table class="data"><thead><tr><th>${tr('Hónap')}</th><th>${tr('Óra')}</th><th>${tr('Rész')}</th><th>${tr('Film')}</th></tr></thead>
    <tbody>${months.slice().reverse().map(m => `<tr><td>${esc(d2(m.d))}</td><td>${fmtNum(m.min / 60, 1)}</td><td>${m.eps}</td><td>${m.films}</td></tr>`).join('')}</tbody></table></details>`;

  const topGenres = [...genres].filter(g => g[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 6), gMax = topGenres[0]?.[1] || 1;
  const topShows = perShow.filter(x => x.n).sort((a, b) => b.n - a.n).slice(0, 5);

  box.innerHTML = `<div class="tiles">${tiles.map(([b, s]) => `<div><b>${b}</b><span>${tr(s)}</span></div>`).join('')}</div>
    <div class="panel"><h3>${tr('Nézési idő havonta')}</h3><p>${tr('Órában, az elmúlt 12 hónapban. Koppints egy oszlopra a részletekért.')}</p>
      <div class="bars" role="img" aria-label="${tr('Nézési idő havonta')}">${bars}</div>
      <div class="bar-labels" aria-hidden="true">${months.map(m => `<span>${esc(mLabel(m.d))}</span>`).join('')}</div>
      ${undated ? `<p class="note">${tr('{n} korábbi jelölésnél nem ismert a dátum, ezek csak az összesítésben szerepelnek.', { n: fmtNum(undated) })}</p>` : ''}
      ${table}</div>
    ${topGenres.length ? `<div class="panel"><h3>${tr('Kedvenc műfajaid')}</h3><p>${tr('A megnézett részek száma alapján.')}</p>
      <div class="hbars">${topGenres.map(([g, n]) => `<div class="hbar"><span>${esc(g)}</span><div class="track"><i style="width:${n / gMax * 100}%"></i></div><b>${tr('{n} rész', { n: fmtNum(n) })}</b></div>`).join('')}</div></div>` : ''}
    ${topShows.length ? `<section><div class="sec-head"><h2>${tr('Legtöbbet nézett sorozataid')}</h2></div><div class="list">${topShows.map(({ show, n, min }, i) => `<div class="row" data-open="${show.id}" style="cursor:pointer">
        ${show.img ? `<img class="thumb" src="${esc(show.img)}" alt="" loading="lazy">` : '<div class="thumb"></div>'}
        <div class="body"><div class="t1"><span class="code">#${i + 1}</span> ${esc(show.name)}</div><div class="t3">${tr('{n} rész', { n: fmtNum(n) })} · ${tr('{h} óra', { h: fmtNum(min / 60, 1) })}</div></div><span></span></div>`).join('')}</div></section>` : ''}`;
}
const d2 = d => d.toLocaleDateString(LOC(), { year: 'numeric', month: 'long' });
