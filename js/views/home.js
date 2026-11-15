// Popcorn · Home tab: continue watching, coming up, recommendations.
'use strict';

/* ---------- Home ---------- */
async function renderHome(v, alive) {
  const ids = Object.keys(state.follows);
  if (!ids.length) {
    v.innerHTML = `<div id="featured"></div>
      <div class="welcome-panel">
        <span class="welcome-kicker">${tr('A következő kedvenced itt kezdődik')}</span>
        <h2>${tr('Filmek és sorozatok. Egy helyen.')}</h2>
        <p>${tr('Fedezz fel újdonságokat, keress rá a kedvenceidre, és építsd fel a saját listádat.')}</p>
        <button class="btn primary" data-tab="search">${ICON.search}${tr('Felfedezés')}</button>
      </div>
      ${servicesSection()}
      <section><div class="sec-head"><h2>${tr('Népszerű sorozatok')}</h2></div><div id="pop">${skelGrid(6)}</div></section>`;
    loadPopular(alive); loadOnMine(alive);
    return;
  }
  v.innerHTML = `<div id="featured"></div>
    <section><div class="sec-head"><h2>${tr('Folytasd')}</h2><span class="count" id="nextCount"></span></div><div id="next">${skelRows(3)}</div></section>
    <section><div class="sec-head"><h2>${tr('Hamarosan')}</h2><span class="count">${tr('következő 14 nap')}</span></div><div id="soon">${skelRows(2)}</div></section>
    ${servicesSection()}
    <section><div class="sec-head"><h2>${tr('Népszerű sorozatok')}</h2></div><div id="pop">${skelGrid(6)}</div></section>`;
  loadOnMine(alive);
  let data;
  try { data = await pool(ids, 4, async id => ({ show: state.follows[id], eps: await getEps(id) || [] })); }
  catch { if (alive()) { $('#next').innerHTML = errorBox(NET_ERR); $('#soon').innerHTML = ''; } return; }
  if (!alive()) return;
  const next = [], soon = [], end = addDays(today(), 14);
  let fresh = 0;
  for (const { show, eps } of data) {
    const p = progressOf(show.id, eps);
    if (p.next) next.push({ show, ep: p.next, left: p.aired - p.watched });
    regular(eps).filter(e => !aired(e) && e.date && e.date <= end).forEach(e => soon.push({ show, ep: e }));
    fresh += regular(eps).filter(e => aired(e) && isNew(e) && !isWatched(show.id, e.id)).length;
  }
  if (fresh && !renderHome.announced) { renderHome.announced = true; toast(fresh === 1 ? tr('1 új rész jelent meg, amióta legutóbb itt jártál') : tr('{n} új rész jelent meg, amióta legutóbb itt jártál', { n: fresh })); }
  state.lastVisit = Date.now(); ls.set('sn.state', state);
  next.sort((a, b) => (b.ep.date || '').localeCompare(a.ep.date || ''));
  $('#nextCount').textContent = next.length ? tr('{n} sorozat', { n: next.length }) : '';
  $('#next').innerHTML = next.length ? `<div class="list">${next.map(({ show, ep, left }) => `
    <div class="row">
      <img class="thumb" src="${esc(show.img || '')}" alt="" data-open="${show.id}" loading="lazy">
      <div class="body" data-open="${show.id}">
        <div class="t1">${esc(show.name)}${isNew(ep) ? '<span class="new-dot">' + tr('ÚJ') + '</span>' : ''}</div>
        <div class="t2"><span class="code">${code(ep)}</span> · ${esc(ep.name)}</div>
        <div class="t3">${left > 1 ? tr('még {n} rész vár rád', { n: left }) : tr('az utolsó megjelent rész')} · ${fmtDate(ep.date)}${mine(show) ? ` · <b style="color:var(--ok)">${esc(mine(show).name)}</b>` : ''}</div>
      </div>
      <button class="check" data-ep="${show.id}:${ep.id}" aria-pressed="false" aria-label="${esc(code(ep))} ${tr('megnézve')}">${ICON.check}</button>
    </div>`).join('')}</div>`
    : `<div class="empty"><h3>${tr('Mindennel naprakész vagy')}</h3><p>${tr('A követett sorozataid összes megjelent részét megnézted. Ha új rész jön, itt jelenik meg.')}</p></div>`;
  soon.sort((a, b) => (a.ep.stamp || a.ep.date).localeCompare(b.ep.stamp || b.ep.date));
  $('#soon').innerHTML = soon.length ? groupByDay(soon) : `<p class="note">${tr('A követett sorozataidnak nincs új része a következő két hétben.')}</p>`;
  loadPopular(alive);
}
const isNew = e => !!e.stamp && Date.parse(e.stamp) > prevVisit && aired(e);
function servicesSection() {
  if (!state.services.length) return `<div class="panel"><h3>${tr('Mire fizetsz elő?')}</h3>
    <p>${tr('Jelöld be a szolgáltatóidat, és az app kiemeli azokat a sorozatokat, amelyeket nálad meg tudsz nézni.')}</p>
    <div><button class="btn soft" data-settings>${tr('Szolgáltatók kiválasztása')}</button></div></div>`;
  return `<section><div class="sec-head"><h2>${tr('A szolgáltatóidon')}</h2><span class="count">${esc(SERVICES.filter(s => state.services.includes(s.id)).map(s => s.name).join(', '))}</span></div><div id="onmine">${skelGrid(3)}</div></section>`;
}
async function loadOnMine(alive) {
  if (!state.services.length || !$('#onmine')) return;
  try {
    const [pop, web] = await Promise.all([getPopular(), api(`/schedule/web?date=${today()}`, 3 * H, a => a.map(x => slimShow(x._embedded?.show || x.show))).catch(() => [])]);
    if (!alive() || !$('#onmine')) return;
    const seen = new Set(), list = [...pop, ...(web || []).filter(s => (s?.weight || 0) >= 80).sort((a, b) => (b.weight || 0) - (a.weight || 0))]
      .filter(s => s && mine(s) && !state.follows[s.id] && !seen.has(s.id) && seen.add(s.id)).slice(0, 12);
    $('#onmine').innerHTML = list.length ? `<div class="rail">${list.map(s => showCard(s)).join('')}</div>`
      : `<p class="note">${tr('Most nincs új ajánlás a szolgáltatóidon. Keress rá egy sorozatra, és az adatlapján látod, hol nézhető.')}</p>`;
  } catch { if (alive() && $('#onmine')) $('#onmine').innerHTML = errorBox(NET_ERR); }
}
async function loadPopular(alive) {
  try {
    const list = await getPopular();
    if (!alive()) return;
    const featured = $('#featured');
    if (featured && list.length) {
      const pick = list.find(s => s.img) || list[0];
      featured.innerHTML = `<button class="feature feature-home" data-open="${pick.id}" style="background-image:url('${esc(pick.img || '')}')" aria-label="${esc(pick.name)}"><span class="feature-text"><span class="kicker">${tr('Kiemelt ajánlat')}</span><b>${esc(pick.name)}</b><span class="feature-meta">${esc([year(pick), (pick.genres || []).slice(0, 2).join(' · '), pick.rating ? '★ ' + pick.rating : ''].filter(Boolean).join('  •  '))}</span><span class="feature-desc">${esc(pick.summary || tr('Fedezd fel a sorozatot'))}</span><span class="feature-cta">${ICON.play} ${tr('Adatlap megnyitása')}</span></span></button>`;
    }
    $('#pop').innerHTML = list.length ? `<div class="rail">${list.map(s => showCard(s)).join('')}</div>` : errorBox(NET_ERR);
  } catch { if (alive()) $('#pop').innerHTML = errorBox(NET_ERR); }
}
function groupByDay(items, withTime = true, premiere = false) {
  const days = new Map();
  items.forEach(it => { const d = it.ep.date; if (!days.has(d)) days.set(d, []); days.get(d).push(it); });
  return [...days].map(([d, arr]) => `<div class="day"><h3><b>${dayLabel(d)}</b> · ${fmtDate(d)}</h3><div class="list">
    ${arr.map(({ show, ep }) => {
      const time = withTime && ep.stamp ? new Date(ep.stamp).toLocaleTimeString(LOC(), { hour: '2-digit', minute: '2-digit' }) : '';
      return `<div class="row">
        <img class="thumb" src="${esc(show.img || '')}" alt="" data-open="${show.id}" loading="lazy">
        <div class="body" data-open="${show.id}"><div class="t1">${esc(show.name)}</div>
        <div class="t2">${premiere ? `<span class="pill ${ep.s === 1 ? 'accent' : 'neutral'}">${ep.s === 1 ? tr('Új sorozat') : ep.s > 1900 ? tr('{n}-es kiadás', { n: ep.s }) : tr('{n}. évad', { n: ep.s })}</span> ${esc((show.genres || []).slice(0, 2).join(', '))}` : `<span class="code">${code(ep)}</span> · ${esc(ep.name)}`}</div>
        <div class="t3">${[time, show.network].filter(Boolean).map(esc).join(' · ')}</div></div>
        ${state.follows[show.id] ? `<span class="pill accent">${tr('Követed')}</span>` : ''}</div>`;
    }).join('')}</div></div>`).join('');
}

