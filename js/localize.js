// Popcorn · Series in the app's language: translated genres, local summary (TMDB with a key, otherwise
// Wikipedia), local episode titles (TMDB), and search by local or original title (Wikipedia + Wikidata, no key).
'use strict';

/* ---------- TVmaze genres ---------- */
const GENRES = {
  Action: ['Akció', 'Action'], Adult: ['Felnőtt', 'Erwachsene'], Adventure: ['Kaland', 'Abenteuer'], Anime: ['Anime', 'Anime'],
  Children: ['Gyerek', 'Kinder'], Comedy: ['Vígjáték', 'Komödie'], Crime: ['Krimi', 'Krimi'], DIY: ['Barkács', 'Heimwerken'],
  Drama: ['Dráma', 'Drama'], Espionage: ['Kém', 'Spionage'], Family: ['Családi', 'Familie'], Fantasy: ['Fantasy', 'Fantasy'],
  Food: ['Gasztro', 'Essen'], History: ['Történelmi', 'Geschichte'], Horror: ['Horror', 'Horror'], Legal: ['Jogi', 'Justiz'],
  Medical: ['Orvosi', 'Medizin'], Music: ['Zenés', 'Musik'], Mystery: ['Rejtély', 'Mystery'], Nature: ['Természet', 'Natur'],
  Romance: ['Romantikus', 'Romantik'], 'Science-Fiction': ['Sci-fi', 'Science-Fiction'], Sports: ['Sport', 'Sport'],
  Supernatural: ['Természetfeletti', 'Übernatürlich'], Thriller: ['Thriller', 'Thriller'], Travel: ['Utazás', 'Reisen'],
  War: ['Háborús', 'Krieg'], Western: ['Western', 'Western']
};
const genreName = g => state.lang === 'en' ? g : (GENRES[g]?.[state.lang === 'de' ? 1 : 0] || g);

/* ---------- summary and episode titles ---------- */
/** Wikidata item of a TVmaze show (property P8600 = TVmaze series ID). */
const wdForTvmaze = id => api(`${WD_API}?action=query&list=search&srsearch=haswbstatement:P8600=${id}&srlimit=1&format=json&origin=*`, 30 * DAY, d => d.query?.search?.[0]?.title || null);
async function localSummary(show) {
  if (state.lang === 'en') return null;
  if (tmdbKey()) {
    try {
      const tid = await tmdbTvId(show);
      if (tid) {
        const d = await tmdb(`/tv/${tid}?language=${TLANG()}`, 7 * DAY);
        if (d.overview) return { text: d.overview, src: 'TMDB', genres: (d.genres || []).map(g => g.name) };
      }
    } catch {}
  }
  try {
    const q = await wdForTvmaze(show.id);
    if (!q) return null;
    const page = (await wdEntities([q]))?.[0]?.links?.[state.lang];
    if (!page) return null;
    const text = await api(`https://${state.lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(page)}&prop=extracts&exintro=1&explaintext=1&exsentences=5&format=json&formatversion=2&origin=*`,
      7 * DAY, d => d.query?.pages?.[0]?.extract || '');
    return text ? { text, src: 'Wikipédia' } : null;
  } catch { return null; }
}
// TMDB fills untranslated titles with placeholders like "3. epizód" / "Episode 3": keep the original then
const GENERIC_EP = /^(\d+\.\s*(epizód|rész|folge)|episode\s*\d+|folge\s*\d+)$/i;
/** Local titles and plot summaries of one season, by episode number: { names: {n: …}, plots: {n: …} }. */
async function localEpisodes(show, season) {
  const empty = { names: {}, plots: {} };
  if (state.lang === 'en' || !tmdbKey() || season == null) return empty;
  try {
    const tid = await tmdbTvId(show);
    if (!tid) return empty;
    const d = await tmdb(`/tv/${tid}/season/${season}?language=${TLANG()}`, 7 * DAY);
    const out = { names: {}, plots: {} };
    (d.episodes || []).forEach(e => {
      if (e.name && !GENERIC_EP.test(e.name.trim())) out.names[e.episode_number] = e.name;
      if (e.overview) out.plots[e.episode_number] = e.overview;
    });
    return out;
  } catch { return empty; }
}

/* ---------- search by local title ---------- */
/** Finds TVmaze shows whose Wikipedia article (in the app's language, or English) matches the query. */
async function searchShowsLocal(query) {
  const wikis = state.lang === 'en' ? ['en'] : [state.lang, 'en'];
  const lists = await Promise.all(wikis.map(w => api(`https://${w}.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=10&prop=pageprops&ppprop=wikibase_item&format=json&formatversion=2&origin=*`,
    6 * H, d => (d.query?.pages || []).sort((a, b) => a.index - b.index).map(p => p.pageprops?.wikibase_item).filter(Boolean)).catch(() => [])));
  const ids = [...new Set(lists.flat())].slice(0, 20);
  if (!ids.length) return [];
  const withTv = await api(`${WD_API}?action=wbgetentities&ids=${ids.join('|')}&props=claims&format=json&origin=*`, 7 * DAY,
    d => Object.values(d.entities || {}).map(e => ({ q: e.id, tv: e.claims?.P8600?.[0]?.mainsnak?.datavalue?.value })).filter(x => x.tv));
  const order = new Map(ids.map((q, i) => [q, i]));
  withTv.sort((a, b) => order.get(a.q) - order.get(b.q));
  const shows = await pool(withTv.slice(0, 8), 4, x => getShow(+x.tv).catch(() => null));
  return shows.filter(Boolean);
}
