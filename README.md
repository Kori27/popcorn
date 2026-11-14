# Sorozatnapló

Telefonra és tabletre tervezett, telepíthető sorozat- és filmkövető alkalmazás (Progressive Web App).

**Élő verzió:** https://kori27.github.io/popcorn/
**Forráskód:** https://github.com/Kori27/popcorn

---

## 1. Az alkalmazás célja

A sorozatnézők információi ma szét vannak szórva: a megnézett részeket fejben kell tartani, az új részek és premierek dátumát külön oldalakon kell keresni, és nem mindig egyértelmű, melyik szolgáltatónál nézhető egy cím. A Sorozatnapló ezeket egy helyre gyűjti, reklámok és átirányítások nélkül:

- követi, hol tartasz az egyes sorozatokban, és mi a következő rész;
- jelzi az új részeket, premiereket és mozibemutatókat;
- megmutatja, hol nézhető legálisan egy cím, a saját előfizetéseid alapján;
- közkincs (public domain) klasszikus filmeket az appon belül le is játszik;
- saját csillagos értékelésekből rangsort készít.

Az app három nyelven (magyar, angol, német) használható, és testre szabható megjelenésű.

## 2. Funkciók

| Fül / rész | Mit tud |
|---|---|
| **Kezdőlap** | „Folytasd” lista a következő meg nem nézett résszel és egy koppintásos „megnézve” gombbal; „Hamarosan” (követett sorozatok részei 14 napra); ajánlások a kiválasztott szolgáltatóidon; népszerű sorozatok. „ÚJ” jelölés az utolsó látogatás óta megjelent részeken. |
| **Nézd most** | Kb. 3 800 közkincs film és régi tévésorozat az Internet Archive-ból, beépített videólejátszóval. Műfaj szerinti szűrés, keresés, lapozás. Ingyenes magyar források (Médiaklikk, RTL+, TV2 Play, Filmio) linkjei. |
| **Érkezik** | Követett sorozatok következő részei napokra bontva; új sorozatok és évadok premierjei 7 napra; magyarországi mozibemutatók (TMDB); a mai streaming- és magyar tévéműsor. |
| **Keresés** | Élő keresés a TVmaze adatbázisában, borítóképes találatokkal. |
| **Listám** | Követett sorozatok csoportosítva (folyamatban / nem kezdted el / naprakész), haladásjelzővel. **Értékeléseim**: 1–5 csillagos saját értékelések rangsora, típus szerinti szűréssel, értékelés vagy dátum szerinti rendezéssel. |
| **Adatlap** | Sorozat: évadok és epizódok kipipálása, „egész évad megnézve”, helyi (magyar/német) cím, beágyazott előzetes, saját értékelés, „Hol nézhető?” panel. Film: lejátszó vagy előzetes, értékelés. |
| **Beállítások** | Nyelv (HU/EN/DE); mód (rendszer/világos/sötét), 6 kiemelőszín, OLED-fekete háttér, szövegméret; előfizetett szolgáltatók; értesítések új részekről; saját TMDB-kulcs. |

További jellemzők:

- **Telepíthető** a kezdőképernyőre (Android és iOS), saját ikonnal, teljes képernyőn fut.
- **Offline is indul**: az app váza a Service Worker gyorsítótárából töltődik, a már letöltött adatok elérhetők; internet nélkül figyelmeztető sáv jelenik meg.
- **Reszponzív**: telefonon alsó menüsáv és teljes képernyős adatlap, 900 px-nél szélesebb kijelzőn (tablet) kétoszlopos elrendezés.
- **Értesítések**: a háttérben futó ellenőrzés (Periodic Background Sync) új részt jelez a követett sorozatokból, ahol a platform támogatja.

## 3. Technikai megoldások

- **Platform:** Progressive Web App (HTML5, CSS3, modern JavaScript, ES2020+), keretrendszer és build lépés nélkül. Androidon és iOS-en egyaránt fut, telepíthető.
- **Böngésző API-k:** Fetch API, Service Worker és Cache Storage (offline működés), Web App Manifest, Notifications API és Periodic Background Sync, localStorage, History API (vissza gomb kezelése), `matchMedia` (sötét mód, tablet nézet), `Intl` dátumformázás.
- **Külső adatforrások (nyilvános API-k):**
  - [TVmaze](https://www.tvmaze.com/api): sorozatok, epizódok, műsorrend, helyi címek;
  - [TMDB](https://developer.themoviedb.org/): mozibemutatók, előzetesek (saját, ingyenes kulccsal);
  - [Internet Archive](https://archive.org/developers/): közkincs filmek keresése és lejátszása;
  - YouTube (`youtube-nocookie.com`): az előzetesek beágyazott lejátszása.
- **Gyorsítótárazás:** minden API-válasz lecsupaszítva, lejárati idővel kerül a localStorage-ba; hálózati hiba esetén a régi adat jelenik meg. Ha a tárhely megtelik, az app csak a gyorsítótárat üríti, a felhasználó adatait nem.
- **Hibakezelés:** minden hálózati hívásnál érthető hibaüzenet jelenik meg, és van újrapróbálkozás a 429-es (túl sok kérés) válasznál. Globális `error` és `unhandledrejection` kezelő, offline jelzés, és a TMDB-kulcs ellenőrzése mentéskor.
- **Témázás:** CSS custom property tokenek; világos és sötét paletta, futás közben cserélhető kiemelőszínnel.
- **Többnyelvűség:** saját, könnyű `tr()` függvény. A magyar szöveg a kulcs, az angol és a német fordítás szótárból jön; a dátumok, a helyi címek és a TMDB-adatok is a választott nyelvet követik.
- **Hosting:** GitHub Pages (HTTPS, ami a telepíthetőséghez szükséges).

### Projektszerkezet

```
index.html               az app váza (fejléc, tartalom, alsó menü)
manifest.webmanifest     telepítési adatok (név, ikonok, színek)
sw.js                    Service Worker: offline gyorsítótár, háttér-értesítések
serve.js                 kis helyi szerver a futtatáshoz (Node.js, függőség nélkül)
css/app.css              stílusok, téma-tokenek, reszponzív elrendezés
icons/                   alkalmazásikonok
js/
  core.js                közös konstansok, DOM-segédek, ikonok
  i18n.js                fordítások (hu/en/de) és a tr() függvény
  storage.js             localStorage-réteg és az app állapota
  theme.js               mód, kiemelőszín, OLED, szövegméret
  services.js            streaming-szolgáltatók, Service Worker adatai
  api.js                 gyorsítótárazó fetch-réteg, TVmaze-hívások
  helpers.js             dátumok, haladás számítása, követés és megnézve-jelölés
  trailers.js            TMDB-hívások, beágyazott előzetesek
  events.js              kattintás-, előzmény- és hibakezelés, offline jelzés
  main.js                indulás
  views/
    shell.js             fülváltás, közös UI-elemek
    home.js              Kezdőlap
    watch.js             Nézd most (Internet Archive lejátszó)
    upcoming.js          Érkezik
    search.js            Keresés
    library.js           Listám és Értékeléseim
    detail.js            sorozat-adatlap, kétoszlopos nézet, navigáció
    movie.js             mozifilm-adatlap
    settings.js          Beállítások
```

A szkriptek a fenti sorrendben töltődnek be (`index.html` alja), és közös globális hatókörben dolgoznak; minden fájl egy jól körülhatárolt feladatért felel.

## 4. Telepítés és futtatás

### A) Kipróbálás telefonon (ajánlott)

1. Nyisd meg a telefonon: **https://kori27.github.io/popcorn/**
2. Telepítés:
   - **Android (Chrome):** ⋮ menü → *Alkalmazás telepítése* / *Hozzáadás a kezdőképernyőhöz*;
   - **iPhone (Safari):** Megosztás → *Főképernyőhöz adás*.
3. Indítsd az ikonról: teljes képernyős appként fut.

### B) Futtatás saját gépen

Előfeltétel: [Node.js](https://nodejs.org/) 18 vagy újabb. Más függőség nincs, `npm install` sem kell.

```bash
git clone https://github.com/Kori27/popcorn.git
cd popcorn
node serve.js
```

Ezután böngészőben: **http://localhost:5173**. Telefonméretű nézethez a fejlesztői eszközökben kapcsold be az eszköz-emulációt. Ha nincs Node.js, bármilyen statikus szerver megfelel (pl. `python -m http.server 5173`). A fájlt közvetlenül (`file://`) megnyitva a Service Worker nem működik.

### C) Opcionális: TMDB-kulcs (előzetesek és mozibemutatók)

1. Ingyenes regisztráció: https://www.themoviedb.org/signup
2. Profil → Beállítások → API → kulcs igénylése (Developer, személyes használat).
3. Az appban: Beállítások → *Előzetesek és mozifilmek* → illeszd be az „API Read Access Token” értéket → *Mentés* (az app ellenőrzi a kulcsot).

Kulcs nélkül minden más funkció működik; az előzetesnél ilyenkor YouTube-keresés link jelenik meg.

## 5. Ismert hibák és korlátok

- **Szolgáltató-egyezés becslés:** azt, hogy egy sorozat benne van-e az előfizetésedben, az eredeti csatorna alapján becsüli az app (pl. HBO → HBO Max). Magyarországon egy cím néha máshol fut; a pontos információt a JustWatch-link adja.
- **RTL+ és TV2 Play keresés:** ezek az oldalak nem fogadják el a keresőszót linkben, ezért csak a keresőjük nyílik meg, a címet be kell gépelni.
- **Háttér-értesítések:** csak Androidon, Chrome-ban, telepített appal működnek, és a rendszer dönti el, milyen gyakran fut az ellenőrzés (általában naponta). iOS-en és más böngészőkben az új részeket az app megnyitásakor jelzi („ÚJ” jelölés és üzenet).
- **Közkincs filmek:** többnyire régi, angol nyelvű filmek. Felirat nem jeleníthető meg, mert az Internet Archive nem engedi a feliratfájlok közvetlen betöltését más oldalról. Néhány tételnek már nincs lejátszható változata (erről üzenet jelenik meg).
- **Leírások nyelve:** a TVmaze sorozatleírásai többnyire angolok, ezeket az app nem fordítja.
- **Adatok tárolása:** a lista, a megnézett részek és az értékelések csak az adott eszközön vannak (localStorage). Nincs szinkronizálás, és a böngészőadatok törlése ezeket is törli.
- **Magyar tévéműsor:** a TVmaze-ben a magyar csatornák műsora hiányos, ezért a „Ma: magyar TV” nézet gyakran csak néhány címet mutat.

## 6. Jövőbeli fejlesztési lehetőségek

- **Közösségi értékelések:** az értékelések adatszerkezete (`kind`, `ref`, `stars`, `at`) már most megosztható formájú; egy egyszerű backend és bejelentkezés után mások értékelései és átlagai is megjelenhetnének.
- **Felhős szinkronizálás** több eszköz között (pl. Firebase vagy saját API).
- **Szerveroldali push-értesítések** (Web Push), hogy iOS-en is működjenek a háttér-értesítések.
- **Natív csomagolás** Capacitorral (Android APK / iOS app), áruházi terjesztéshez.
- **Pontos szolgáltató-adatok** egy streaming-elérhetőségi API-val (pl. TMDB „watch providers”).
- **Feliratok** egy kis proxyn keresztül a közkincs filmekhez.
- **Automatikus tesztek** (pl. Playwright) és ES-modulokra épülő build.

## 7. Bemutató (kb. 5 perc)

1. **Indítás telefonról** a kezdőképernyő-ikonról: telepíthető, teljes képernyős app.
2. **Keresés:** sorozat keresése, adatlap megnyitása, *Listára teszem*.
3. **Haladás követése:** néhány rész kipipálása, *Egész évad megnézve*; a Kezdőlapon megjelenik a „Folytasd” sor a következő résszel.
4. **Értékelés:** csillagok az adatlapon → *Listám → Értékeléseim* rangsor.
5. **Nézd most:** műfaj kiválasztása, egy klasszikus film elindítása az appon belül.
6. **Érkezik:** premierek és mozibemutatók, egy előzetes lejátszása.
7. **Beállítások:** nyelvváltás angolra vagy németre, sötét mód, kiemelőszín, OLED: azonnal látszik a változás.
8. **Tablet nézet:** a böngészőablak szélesítése, kétoszlopos elrendezés.
9. **Offline:** repülő üzemmódban is elindul, figyelmeztető sávval.

## 8. Adatforrások és jogok

Sorozatadatok: TVmaze (CC BY-SA). Film- és előzetes-adatok: TMDB („This product uses the TMDB API but is not endorsed or certified by TMDB.”). Lejátszható filmek: Internet Archive, kizárólag közkincs (public domain) licencű tételek. Az app saját tartalmat nem tárol és nem terjeszt.
