// Sorozatnapló · Exact streaming providers in Hungary (TMDB watch providers, data by JustWatch). Needs a TMDB key.
'use strict';

const PROVIDER_MATCH = { netflix: /netflix/i, hbo: /hbo|^max\b/i, disney: /disney/i, apple: /apple tv/i, prime: /amazon|prime video/i, sky: /skyshowtime/i, rtl: /^rtl/i, tv2: /tv2|tv 2/i, mtva: /m[ée]diaklikk/i };
const PROVIDER_GROUPS = [['flatrate', 'Előfizetéssel'], ['free', 'Ingyen'], ['ads', 'Ingyen, reklámokkal'], ['rent', 'Kölcsönözhető'], ['buy', 'Megvásárolható']];
const providerService = p => Object.keys(PROVIDER_MATCH).find(k => PROVIDER_MATCH[k].test(p.provider_name)) || null;

async function tmdbTvId(s) {
  let id = null;
  if (s.imdb) id = (await tmdb(`/find/${s.imdb}?external_source=imdb_id`, 7 * DAY)).tv_results?.[0]?.id;
  if (!id) id = (await tmdb(`/search/tv?query=${encodeURIComponent(s.name)}${s.premiered ? '&first_air_date_year=' + s.premiered.slice(0, 4) : ''}`, 7 * DAY)).results?.[0]?.id;
  return id || null;
}
const tmdbMovieIdByImdb = async imdb => imdb ? (await tmdb(`/find/${imdb}?external_source=imdb_id`, 7 * DAY)).movie_results?.[0]?.id || null : null;
async function providersFor(kind, id) {
  if (!id) return null;
  return (await tmdb(`/${kind}/${id}/watch/providers`, DAY)).results?.HU || null;
}
/** The user's own services that offer the title (subscription or free). */
function myProviders(hu) {
  if (!hu || typeof hu !== 'object') return [];
  const ids = new Set();
  ['flatrate', 'free', 'ads'].forEach(g => (hu[g] || []).forEach(p => { const k = providerService(p); if (k && state.services.includes(k)) ids.add(k); }));
  return SERVICES.filter(s => ids.has(s.id));
}
/** hu: undefined = loading, 'nokey' | 'badkey' | 'error', null = not available, otherwise TMDB's HU entry. */
function providersHtml(hu) {
  if (hu === undefined) return `<div class="skel" style="height:40px"></div>`;
  if (hu === 'nokey') return `<p>${tr('A pontos szolgáltató-listához add meg az ingyenes TMDB-kulcsot a Beállításokban. Addig a JustWatch-on nézheted meg.')}</p>`;
  if (hu === 'badkey') return errorBox('A megadott TMDB-kulcs nem érvényes. Ellenőrizd a Beállításokban.');
  if (hu === 'error') return `<p>${tr('A szolgáltató-adatokat most nem sikerült betölteni.')}</p>`;
  const groups = PROVIDER_GROUPS.filter(([g]) => hu?.[g]?.length);
  if (!groups.length) return `<p>${tr('Magyarországon most egyik szolgáltatónál sem található.')}</p>`;
  return groups.map(([g, label]) => `<div class="prov"><span class="label">${tr(label)}</span><div class="prov-list">${hu[g].map(p => {
      const k = providerService(p), my = k && state.services.includes(k);
      return `<span class="prov-item${my ? ' mine' : ''}">${p.logo_path ? `<img src="${TIMG}w92${esc(p.logo_path)}" alt="" loading="lazy">` : ''}${esc(p.provider_name)}${my ? ICON.check : ''}</span>`;
    }).join('')}</div></div>`).join('')
    + `<p class="note">${tr('Szolgáltató-adatok: JustWatch (a TMDB-n keresztül).')}</p>`;
}
async function resolveProviders(promise) {
  try { return await promise; } catch (e) { return e.message === 'badkey' ? 'badkey' : 'error'; }
}
async function fillProviders(promise, stillHere) {
  const r = await resolveProviders(promise);
  if (stillHere()) document.querySelectorAll('#sheet [data-provslot]').forEach(s => { s.innerHTML = providersHtml(r); });
  return r;
}
