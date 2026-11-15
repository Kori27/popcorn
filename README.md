# Popcorn
 Korábbi neve: Sorozatnapló.
Telefonra és tabletre tervezett, telepíthető sorozat- és filmkövető alkalmazás (Progressive Web App).

**Élő verzió:** https://kori27.github.io/popcorn/
**Forráskód:** https://github.com/Kori27/popcorn

---

## 1. Az alkalmazás célja

A sorozatnézők információi ma szét vannak szórva: a megnézett részeket fejben kell tartani, az új részek és premierek dátumát külön oldalakon kell keresni, és nem mindig egyértelmű, melyik szolgáltatónál nézhető egy cím. A Popcorn ezeket egy helyre gyűjti, reklámok és átirányítások nélkül:

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
| **Nézd most** | Három rész. *Most nézhető*: valódi, új és népszerű filmek és sorozatok, amelyek Magyarországon most legálisan nézhetők (ingyen, reklámmal vagy az előfizetéseiden), kiemelt filmmel a lista tetején; szűrők: típus, műfaj, megjelenés éve, hogyan (ingyen / reklám nélkül / reklámmal / az előfizetéseimen), nyelv (magyar szolgáltatónál, szinkronnal / magyar film), rendezés (TMDB-kulccsal). *Modern, szabad*: ellenőrzött listából modern, színes, Creative Commons licencű filmek az appon belüli lejátszóval. *Klasszikusok*: kb. 3 800 közkincs film; szűrők: műfaj, nyelv, évtized, rendezés, plusz keresés. Ingyenes magyar források linkjei. |
| **Érkezik** | Követett sorozatok következő részei napokra bontva; új sorozatok és évadok premierjei 7 napra (szűrők: hol – streaming / amerikai TV / magyar TV / az előfizetéseim –, műfaj); magyarországi mozibemutatók (TMDB; szűrők: műfaj, rendezés); a mai streaming- és magyar tévéműsor. |
| **Keresés** | *Sorozatok*: élő keresés a TVmaze adatbázisában (szűrők: állapot, indulás éve, az előfizetéseim, rendezés). *Filmek*: keresés kulcs nélkül, a Wikipédiából és a Wikidatából, magyar vagy eredeti címmel (szűrők: megjelenés éve, rendezés). |
| **Listám** | *Sorozataim*: csoportosítva, haladásjelzővel; szűrők: állapot, az előfizetéseim, rendezés. *Filmjeim*: megnézendő és megnézett filmek, egy koppintással átjelölhetők; szűrés arra, ami az előfizetéseiden elérhető (TMDB-kulccsal). *Értékeléseim*: 1–5 csillagos rangsor; szűrők: típus, legalább hány csillag, rendezés. *Statisztika*: megnézett részek és filmek, nézési idő, végignézett sorozatok, átlagos értékelés, havi nézési idő oszlopdiagramon (táblázatként is), kedvenc műfajok, legtöbbet nézett sorozatok. |
| **Adatlap** | Sorozat: évadok és epizódok kipipálása, „egész évad megnézve”, helyi (magyar/német) cím, beágyazott előzetes, saját értékelés, „Hol nézhető?”. Film: megnézendő / megnéztem gomb, saját értékelés, leírás, rendező, műfaj, előzetes. A „Hol nézhető?” TMDB-kulccsal a pontos magyarországi szolgáltatókat mutatja (előfizetéssel / ingyen / reklámmal / kölcsönözhető / megvásárolható), és kiemeli a saját előfizetéseidet. |
| **Beállítások** | Nyelv (HU/EN/DE); mód (rendszer/világos/sötét), 6 kiemelőszín, OLED-fekete háttér, szövegméret; előfizetett szolgáltatók; értesítések új részekről; saját TMDB-kulcs; **mentés fájlba és visszaállítás fájlból** (pl. telefoncseréhez). |

További jellemzők:

- **Telepíthető** a kezdőképernyőre (Android és iOS), saját ikonnal, teljes képernyőn fut.
- **Offline is indul**: az app váza a Service Worker gyorsítótárából töltődik, a már letöltött adatok elérhetők; internet nélkül figyelmeztető sáv jelenik meg.
- **Reszponzív, minden méretre**: telefonon alsó menüsáv és teljes képernyős adatlap; tableten (900 px felett) az adatlap jobb oldali panelként nyílik, de csak amíg meg van nyitva; laptopon és monitoron (1100 px felett) bal oldali menü, nagyobb poszterrács és szélesebb tartalom. Semmi nem lóg ki oldalra, a szűrő- és görgetősávok a lapszélhez igazodnak.
- **Megjelenés:** lágy kiemelőszínű háttérderengés, színes aktív fülválasztók, poszterek értékelés-jelvénnyel és finom mozgással, elmosott borító- vagy jelenetkép az adatlapok tetején.
- **Szűrők** minden listán: kompakt legördülő választók, az aktív szűrő kiemelve, „Alaphelyzet” gombbal; a beállított szűrőket az app megjegyzi.
- **Értesítések**: a háttérben futó ellenőrzés (Periodic Background Sync) új részt jelez a követett sorozatokból, ahol a platform támogatja.

## 3. Technikai megoldások

- **Platform:** Progressive Web App (HTML5, CSS3, modern JavaScript, ES2020+), keretrendszer és build lépés nélkül. Androidon és iOS-en egyaránt fut, telepíthető.
- **Böngésző API-k:** Fetch API, Service Worker és Cache Storage (offline működés), Web App Manifest, Notifications API és Periodic Background Sync, localStorage, History API (vissza gomb kezelése), `matchMedia` (sötét mód, tablet nézet), `Intl` dátumformázás.
- **Külső adatforrások (nyilvános API-k):**
  - [TVmaze](https://www.tvmaze.com/api): sorozatok, epizódok, műsorrend, helyi címek;
  - [Wikipédia](https://www.mediawiki.org/wiki/API:Main_page) és [Wikidata](https://www.wikidata.org/wiki/Wikidata:Data_access): filmek keresése és adatai, kulcs nélkül;
  - [TMDB](https://developer.themoviedb.org/): mozibemutatók, előzetesek, pontos szolgáltatók és az ingyen nézhető címek (saját, ingyenes kulccsal; a szolgáltató-adatok a JustWatch-tól származnak);
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
  filters.js             újrahasznosítható szűrősáv, a szűrők megjegyzése
  trailers.js            beágyazott előzetesek
  providers.js           pontos magyarországi szolgáltatók (TMDB watch providers)
  films.js               filmkövetés: Wikipédia/Wikidata keresés, film-adatlap, megnézendő/megnézve
  backup.js              mentés JSON-fájlba és visszaállítás
  events.js              kattintás-, előzmény- és hibakezelés, offline jelzés
  main.js                indulás
  views/
    shell.js             fülváltás, közös UI-elemek
    home.js              Kezdőlap
    watch.js             Nézd most (ingyen legálisan, szabad licencű és közkincs filmek, lejátszó)
    upcoming.js          Érkezik
    search.js            Keresés
    library.js           Listám: Sorozataim, Filmjeim, Értékeléseim
    stats.js             Statisztika
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

### C) Opcionális: TMDB-kulcs (előzetesek, mozibemutatók, pontos szolgáltatók, ingyen nézhető címek)

1. Ingyenes regisztráció: https://www.themoviedb.org/signup
2. Profil → Beállítások → API → kulcs igénylése (Developer, személyes használat).
3. Az appban: Beállítások → *Előzetesek és mozifilmek* → illeszd be az „API Read Access Token” értéket → *Mentés* (az app ellenőrzi a kulcsot).

Kulcs nélkül minden más működik, a filmkeresés és -követés is. Ilyenkor az előzetesnél YouTube-keresés link jelenik meg, a „Hol nézhető?” pedig a JustWatch-ra és az eredeti csatorna alapján becsült szolgáltatóra támaszkodik.

## 5. Ismert hibák és korlátok

- **Szolgáltatók kulcs nélkül:** TMDB-kulcs nélkül az app az eredeti csatorna alapján becsüli, melyik szolgáltatónál fut egy sorozat (pl. HBO → HBO Max); ez Magyarországon nem mindig pontos. Kulccsal a pontos lista jelenik meg.
- **Most nézhető címek:** a friss filmek és sorozatok a szolgáltató saját oldalán vagy appjában indulnak; az appon belül csak a közkincs és a szabad licencű filmek játszhatók le.
- **Magyar szinkron:** egyik nyilvános adatbázis sem tárolja, van-e egy címnek magyar szinkronja. A „magyar szolgáltatónál (szinkronnal)” szűrő az RTL+, TV2 Play, Médiaklikk és Filmio kínálatára szűr, amely szinte mindig magyar hangú; ez közelítés, nem garancia.
- **Filmkeresés:** a Wikipédia keresőjére épül, ezért a nagyon rövid vagy gyakori szavakból álló címeknél a találat nem mindig az első helyen van; a megjelenési év a Wikidata legkorábbi dátuma (fesztiválbemutató is lehet).
- **RTL+ és TV2 Play keresés:** ezek az oldalak nem fogadják el a keresőszót linkben, ezért csak a keresőjük nyílik meg, a címet be kell gépelni.
- **Háttér-értesítések:** csak Androidon, Chrome-ban, telepített appal működnek, és a rendszer dönti el, milyen gyakran fut az ellenőrzés (általában naponta). iOS-en és más böngészőkben az új részeket az app megnyitásakor jelzi („ÚJ” jelölés és üzenet).
- **Közkincs filmek:** többnyire régi, angol nyelvű filmek; a szabad licencű modern filmek listája kicsi (11 film), mert az Internet Archive licenc-jelölése nem megbízható, ezért kézzel ellenőrzött címek kerültek bele. Felirat nem jeleníthető meg, mert az Internet Archive nem engedi a feliratfájlok közvetlen betöltését más oldalról. Néhány tételnek már nincs lejátszható változata (erről üzenet jelenik meg).
- **Leírások nyelve:** a TVmaze sorozatleírásai többnyire angolok, ezeket az app nem fordítja.
- **Adatok tárolása:** a lista, a filmek, a megnézett részek és az értékelések csak az adott eszközön vannak (localStorage). Nincs automatikus szinkronizálás; telefoncseréhez a Beállításokban fájlba menthetők és visszatölthetők.
- **Statisztika:** a havi bontás a jelen verzió óta rögzített jelölésekből készül; a korábban kipipált részek dátuma nem ismert, ezek csak az összesítésben szerepelnek.
- **Magyar tévéműsor:** a TVmaze-ben a magyar csatornák műsora hiányos, ezért a „Ma: magyar TV” nézet gyakran csak néhány címet mutat.

## 6. Jövőbeli fejlesztési lehetőségek

- **Közösségi értékelések:** az értékelések adatszerkezete (`kind`, `ref`, `stars`, `at`) már most megosztható formájú; egy egyszerű backend és bejelentkezés után mások értékelései és átlagai is megjelenhetnének.
- **Felhős szinkronizálás** több eszköz között (pl. Firebase vagy saját API).
- **Szerveroldali push-értesítések** (Web Push), hogy iOS-en is működjenek a háttér-értesítések.
- **Natív csomagolás** Capacitorral (Android APK / iOS app), áruházi terjesztéshez.
- **Feliratok** egy kis proxyn keresztül a közkincs filmekhez.
- **Automatikus tesztek** (pl. Playwright) és ES-modulokra épülő build.

## 7. Bemutató (kb. 5 perc)

1. **Indítás telefonról** a kezdőképernyő-ikonról: telepíthető, teljes képernyős app.
2. **Keresés:** sorozat keresése, adatlap megnyitása, *Listára teszem*.
3. **Haladás követése:** néhány rész kipipálása, *Egész évad megnézve*; a Kezdőlapon megjelenik a „Folytasd” sor a következő résszel.
4. **Értékelés:** csillagok az adatlapon → *Listám → Értékeléseim* rangsor.
5. **Nézd most:** *Most nézhető* szűrőkkel (pl. Nyelv: magyar szolgáltatónál), egy cím szolgáltatója; *Modern, szabad* film elindítása az appon belül.
6. **Filmek:** Keresés → Filmek → „Dűne” → *Megnézendő*, majd *Listám → Filmjeim* és *Statisztika*.
7. **Érkezik:** premierek és mozibemutatók, egy előzetes lejátszása.
8. **Beállítások:** nyelvváltás angolra vagy németre, sötét mód, kiemelőszín, OLED: azonnal látszik a változás.
9. **Tablet nézet:** a böngészőablak szélesítése, kétoszlopos elrendezés.
10. **Mentés:** Beállítások → *Mentés fájlba*.
11. **Offline:** repülő üzemmódban is elindul, figyelmeztető sávval.

## 8. Adatforrások és jogok

Sorozatadatok: TVmaze (CC BY-SA). Film- és előzetes-adatok: TMDB („This product uses the TMDB API but is not endorsed or certified by TMDB.”). Filmadatok kulcs nélkül: Wikipédia és Wikidata (CC BY-SA / CC0). Szolgáltató-adatok: JustWatch, a TMDB-n keresztül. Lejátszható filmek: Internet Archive, kizárólag közkincs (public domain) és kézzel ellenőrzött, Creative Commons licencű tételek. Az app saját tartalmat nem tárol és nem terjeszt.

## 9. Popcorn – katalógus és lejátszás

Az app két külön dolgot kezel:

- **Katalógus és adatlapok:** sorozatadatok a TVmaze-ből, filmadatok a Wikidatából és a Wikipédiából. Ezek leírást, posztert és keresést adnak, teljes filmet nem.
- **Lejátszható tartalom:** a „Nézd most” részben az Internet Archive közkincs vagy ellenőrzött Creative Commons videói. A beépített lejátszó csak ténylegesen elérhető videófájlt játszik le.

A magyarországi streaming-elérhetőséghez, a szolgáltatók kínálatához és több TMDB-funkcióhoz TMDB API-kulcs kell, ezt a Beállításokban lehet megadni. GitHub Pages-en a böngészőben megadott kulcs nem titkos: személyes használatnál is a saját felelősségedre használd, és ne tedd bele a forráskódba.

**Feliratok:** a lejátszó felkínálja a forrás WebVTT (`.vtt`) feliratait a böngésző saját feliratválasztójában. Az Internet Archive azonban jelenleg nem engedi a feliratfájlok betöltését más oldalról (CORS), ezért ezek a legtöbb böngészőben nem jelennek meg. A projekt nem készít olyan hangsávot vagy feliratot, amelyet a forrás nem ad.

**Lejátszás folytatása:** az Internet Archive-ból lejátszott filmeknél az app megjegyzi, hol tartasz. Ha bezárod az adatlapot, majd később visszatérsz ugyanahhoz a filmhez, a lejátszó onnan folytatja. A pozíció a böngésző helyi tárhelyén marad, a film végén törlődik. Másik eszközre nem szinkronizálódik, és a böngészőadatok törlésével elveszhet.

## 10. Fiókok és szinkronizálás (Firebase)

Bejelentkezés után a sorozatlista, a megnézett részek, az értékelések, a filmek és a kiválasztott szolgáltatók a felhasználó fiókjába mentődnek, és minden eszközén ugyanazok. A téma, a nyelv és a TMDB-kulcs eszközönként külön marad.

- **Bejelentkezés:** Google-fiókkal vagy e-mail-címmel és jelszóval (regisztráció, megerősítő e-mail, elfelejtett jelszó).
- **Első belépés egy eszközön:** az eszközön lévő adatok és a fiókban lévők összefésülődnek, így semmi nem vész el. Egy résznél a korábbi megtekintési dátum, értékelésnél és filmnél az újabb változat marad meg.
- **Utána:** minden változás kb. 1,5 másodperc múlva felkerül a felhőbe, a másik eszközön pedig azonnal megjelenik.
- **Kijelentkezés:** az adatok az eszközön megmaradnak. **Fióktörlés:** a felhőben tárolt adatok véglegesen törlődnek.
- **Adatvédelem:** minden felhasználó egyetlen dokumentuma a `users/{uid}` útvonalon van; a `firestore.rules` szabályai szerint csak ő olvashatja és írhatja.
- **Firebase nélkül** (üres `js/firebase-config.js`) a fiókok ki vannak kapcsolva, és az app minden más funkciója ugyanúgy működik.

### Fiókok beállítása

1. [Firebase console](https://console.firebase.google.com/): új projekt (az ingyenes Spark csomag elég).
2. **Add app → Web (`</>`)**, név: Popcorn, Hosting nélkül. A kapott `firebaseConfig` értékeit (`apiKey`, `authDomain`, `projectId`, `appId`) írd be a `js/firebase-config.js` fájlba. Ezek nyilvános azonosítók, nem titkos kulcsok; a védelmet a szabályok adják.
3. **Authentication → Sign-in method:** kapcsold be a *Google* és az *Email/Password* módot.
4. **Authentication → Settings → Authorized domains:** add hozzá a `kori27.github.io` domaint (helyi futtatáshoz a `localhost` alapból engedélyezett).
5. **Firestore Database → Create database** (európai hely, *production mode*), majd a **Rules** fülre másold be a `firestore.rules` tartalmát, és *Publish*.

Ismert korlát: ha két eszközön egyszerre, internet nélkül módosítasz, a később szinkronizált eszköz változata nyer.

**Ingyenes magyar források:** a Médiaklikk, az RTL+, a TV2 Play és a Filmio külső linkként nyílik. Az RTL+ és a TV2 Play tiltja a beágyazást (`X-Frame-Options: SAMEORIGIN`); a Médiaklikk lejátszója beágyazva nem indul el, a Filmio pedig bejelentkezést kér, ami beágyazott ablakban (harmadik féltől származó sütik, Google-belépés) nem megbízható.

**Új verzió kiadása:** módosítás után futtasd a `node bump-version.js` parancsot. Ez minden CSS- és JS-hivatkozásnak új `?v=` számot ad, és átnevezi a Service Worker gyorsítótárát, így a böngészők biztosan az összetartozó HTML-, CSS- és JS-fájlokat töltik be (a GitHub Pages néhány percig a régi fájlokat is kiszolgálhatja).

## 11. „Mit nézzek ma?”

A Kezdőlapon és a „Nézd most” fül tetején lévő gombbal nyílik. Először választani kell, hogy **film** vagy **sorozat** legyen, aztán három mód közül:

- **🎲 Pörgetés:** posztercsík pörög, lassul, és megáll egy címen. Minden címnek van „ritkasága” az értékelése alapján (Gyakori, Ritka, Epikus, Legendás, színes kerettel); a ritkább ritkábban jön ki.
- **❤️ Húzogatós:** kártyák egyesével; jobbra húzás (vagy ♥, illetve → billentyű) = tetszik, balra (✕, ←) = nem. Két kedvelés után egyre inkább a kedvelt műfajokhoz hasonlót mutat; 12 kártya után (vagy az „Ajánlások most” gombra) ajánlásokat ad.
- **⚔️ Párbaj:** hét körön át két cím közül kell választani (a kettő lehetőleg más műfajú), a végén a választások alapján ajánl.

A megnézett címek is megjelennek, de „Már megnézve” (film) vagy „Már nézted” (sorozat, ha van kipipált része) jelzéssel. Források: sorozatok a TVmaze-ből (népszerű, 7 feletti értékelésű címek), filmek TMDB-kulccsal a TMDB népszerű filmjeiből, kulcs nélkül a Wikidatából (kb. 500 ismert film magyar címmel, poszter a Wikipédiából). Az ajánlás a kedvelt és elutasított címek műfajaiból számolt súlyok alapján történik.

**Előzetesek:** az app YouTube oEmbed-del ellenőrzi, hogy a TMDB-ben szereplő videó létezik-e még; a törölt videókat átugorja, és a következő elérhetőt (lehetőleg magyart) mutatja.

## 12. Kedvencek

- A sorozatok és filmek adatlapján a **♥ Kedvencnek jelölöm** gombbal kedvencet jelölhetsz. A lista a **Listám → Kedvenceim** alatt van, és a fiókkal szinkronizálódik, illetve a mentésbe is bekerül.
- A Kezdőlap **Ez is érdekelhet** sora a kedvencek műfajai alapján ajánl (a legújabb kedvenc számít a legtöbbet). Kulccsal a filmekhez a TMDB saját „hasonló filmek” listáját is használja. A kártyán ♥ jelzi, melyik kedvenced miatt kaptad az ajánlást. A már követett, megnézett vagy kedvelt címeket kihagyja.


## 2026. november – Videa-lejátszó javítás (v33)

- A Videa hivatalos beágyazott lejátszója már a PlayerAPI betöltésétől függetlenül jelenik meg.
- A PlayerAPI opcionális vezérlőréteg; a betöltési vagy kulcshiba nem akadályozza meg a videó beágyazását.
- A lejátszó iframe-jét az OpenAPI által visszaadott hivatalos oEmbed HTML-ből olvassuk ki, és ellenőrizzük a Videa-domain címet.
- Részletesebb hibaüzenet jelenik meg, ha nincs beágyazó kód vagy a PlayerAPI nem válaszol.

Megjegyzés: a Videa vagy a feltöltő által letiltott videók beágyazását ez a javítás nem kerüli meg.
