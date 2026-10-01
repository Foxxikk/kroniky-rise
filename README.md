# Kroniky Říše

Realtimová fantasy strategie pro **Meta Quest 3** – ve VR, v MR i na PC. Stavíš základnu, těžíš zlato a dřevo,
cvičíš armádu, vedeš hrdinu a porážíš Klan Popela. Celé bojiště je živá miniatura na válečném stole,
kterou ovládáš rukama.

Hra je inspirovaná žánrem klasických RTS 3. generace (základna + hrdina + divočina). Názvy, frakce, mapa a zvuky
jsou vlastní. Modely postav a budov: **KayKit** – Character Pack: Adventurers, Character Pack: Skeletons
a Medieval Hexagon Pack od **Kaye Lousberga** ([kaylousberg.com](https://kaylousberg.com), licence **CC0**).
Modely rukou: WebXR Input Profiles (MIT), three.js (MIT).

**Hrát:** otevři web v prohlížeči Meta Questu → *Hrát ve VR* (nebo *v MR*). Na PC funguje myš a klávesnice.

---

## Jak je to promyšlené pro VR

Klasická RTS stojí na myši: obdélník výběru, pravé tlačítko, minimapa, desítky klávesových zkratek. Ve VR nic z toho
nemáš – zato máš dvě ruce, hloubku a stůl. Proto:

| Na PC | Ve VR v Kronikách Říše | Proč |
|---|---|---|
| Kamera + minimapa | **Celá mapa na stole** (≈1,3 m). Žádná minimapa, žádné posouvání kamery – rozhlédneš se hlavou. | Přehled je v VR zadarmo. Minimapa by byla jen další panel. |
| Obdélník výběru | **Štětec výběru** – štípni a táhni prsty po stole, jednotky pod štětcem se přidávají. | Kreslit rukou je přirozenější než rozkládat obdélník ve 3D. |
| Klik na jednotku | **Štípnutí přímo na figurku** (ruka těsně nad stolem = přímý dotek, jinak paprsek). Dvojí štípnutí = všechny stejné. | Na blízko „bereš“ figurky jako na deskovce, na dálku míříš. |
| Pravé tlačítko | **Štípnutí do mapy s výběrem** = chytrý rozkaz (pohyb / útok / těžba / stavba). Barva kurzoru předem ukáže, co se stane. | Jedno gesto na všechno, žádné režimy. |
| Příkazová karta vpravo dole | **Velitelská karta na levé dlani** – otoč dlaň k sobě; pravým prstem ťukneš na tlačítko. | Karta je vždy „po ruce“, ale nepřekáží, když ji nepotřebuješ. |
| Rychlé ruce a zkratky | **Taktický čas** – když máš kartu otevřenou, hra jede na 35 %. | Ve VR nejde klikat tak rychle jako myší; zpomalení dá prostor na mikro bez pauzy. |
| Kolečko myši, posun | **Zlatá madla** na bližší hraně stolu: jedno = posun, obě = zoom a otočení. | Mapa se nikdy nepohne omylem při výběru či rozkazu. |
| Kontrolní skupiny Ctrl+1–3 | **Tři sloty na kartě** – klepni = vyber, podrž = ulož. | Stejná funkce bez klávesnice. |
| Hlášky v rohu | **Nápis nad protější hranou stolu** + prostorový zvuk + zavibrování ovladače. | Upozornění slyšíš z místa, kde se bojuje. |

Ovladače fungují taky: spoušť = štípnutí, grip = posun kdekoli (oba gripy = zoom/otočení), pravá páčka = otáčení
po krocích a zoom kolem bodu pod paprskem, levá páčka = posun, **X** = karta, **Y** = menu, **A** = zrušit výběr.

## Obsah hry (v1)

- **Suroviny:** zlato (doly), dřevo (lesy – kácení mění krajinu), jídlo (farmy, limit 60).
- **Budovy:** Radnice, Farma (větrný mlýn), Kasárna, Oltář hrdinů, Síň válečníků, Strážní věž. Stavějí dělníci, víc dělníků = rychleji.
- **Jednotky:** Dělník, Pěšák, Lučištník, Válečník + **hrdina** Strážce (mág) (úrovně 1–5, aura brnění,
  *Svaté světlo* – léčení, *Hromový úder* – plošné poškození a zpomalení). Padlého hrdinu oživíš v oltáři.
- **Divočina:** tábory vlků a Kamenného strážce hlídají rozšiřující doly a poklad uprostřed mapy; dávají hrdinovi zkušenosti.
- **Soupeř:** AI Klanu Popela těží, staví podle plánu, cvičí, čistí tábory a útočí ve vlnách, brání základnu, hrdina kouzlí.
  Tři obtížnosti (Lehká / Střední / Těžká).
- **Mlha války:** neprozkoumaná krajina je temná, prozkoumaná šedne, vidíš jen to, na co dohlédnou tvé jednotky.
- **Mapa:** *Údolí Rozcestí* 48×48, dvě základny, 4 doly, 3 tábory, lesy a skály.

## Ovládání na PC

Levé tlačítko výběr (obdélník, dvojklik = stejný typ) · pravé rozkaz · **A** útočný pochod · **S** stůj · **D** drž pozici ·
**Q/E** kouzla hrdiny · **W** dělník, **P/L/R/H** jednotky a hrdina, **F/K/O/V/N/T** stavby (podle výběru) · **Ctrl+1–3** skupiny ·
**F1** nečinní dělníci · **F2** armáda · **F3** hrdina · **Mezerník** k poslednímu poplachu · kolečko zoom ·
šipky/okraj obrazovky posun · prostřední tlačítko nebo **[ ]** natočení · **Alt** všechny ukazatele zdraví · **Esc** zrušit/pauza.

## Technika

- Vanilla JS ES moduly, bez buildu. three.js r186 vendorovaný v `vendor/three/` + import map. Statický hosting (Vercel).
- `src/game.js` – logika v lokálních souřadnicích mapy (stejná pro PC/VR/MR), `src/ai.js` – soupeř, `src/pathfind.js` – A* s vyhlazením,
  `src/world.js` – vykreslení (InstancedMesh pro jednotky, stromy, střely; mlha války v shaderu), `src/models.js` – procedurální modely,
  `src/ui.js` – velitelská karta (PC DOM i VR canvas), `src/main.js` – režimy a vstupy, `src/audio.js` – předrenderované zvuky.
- Výkon: ~65 draw callů, ~110 tis. trojúhelníků pro celou mapu; herní logika ~0,03 ms/snímek.
- **Test ve VR bez brýlí:** `test/xr.py` spustí hru v emulátoru Meta Quest 3 (IWER od Mety, ruce i ovladače), např.
  `python3 test/xr.py /tmp/snimek test/xr_click.js` nebo `XRMODE=controller python3 test/xr.py /tmp/s test/xr_ctrl.js`.
- Testy bez brýlí: `test/sim.mjs` (celý zápas AI vs. bot v Node), `test/shot.py` + `test/*.js` (Playwright, včetně falešných XR rukou).
  Spuštění: `node --experimental-default-type=module test/sim.mjs normal good`.
- Háčky: `window.__app`, `window.__game`, `?autostart` (rovnou PC hra), testovací režim na úvodní obrazovce (nekonečné suroviny, rychlé stavění).

---

## Novinky v5 – hudba, vylepšení, konec hry

- **Hudba** (převzatý engine z Obrany Království, předrenderované smyčky – na Questu se nesekají): v klidu pastorální melodie,
  při boji rychlejší s bicími, při útoku na tvou základnu nejvyšší napětí. Zapnutí/vypnutí v pauze (VR i PC).
- **Vylepšení v Síni válečníků** (2 úrovně každé): 🗡 Ostřejší čepele (+3 útok na blízko), 🛡 Pevnější zbroj (+1 brnění),
  🏹 Napjaté tětivy (+3 útok lučištníků i věží). Zkoumá se ve frontě jako výcvik; Klan Popela se zbrojí také (po 6. minutě).
- **Konec hry:** hodnocení 1–3 ⭐ (podle ztrát a času), **rekord** nejrychlejšího vítězství pro každou obtížnost,
  ohňostroj nad tvou základnou, silné zavibrování ovladačů. Ve VR i na PC.
- Kvalita: menu ve VR má výšku podle obsahu (žádná prázdná plocha), prosvětlený strop stanu.
- Celý průchod ověřen v emulátoru Questu 3 i s **ovladači** (spoušť do menu a na mapu, karta nad levým ovladačem,
  výcvik z karty, Y = pauza, vítězné menu).

## Novinky v4 – VR opravdu funguje + výuka

- **Oprava: ve VR stála hra.** Úvodní menu se umisťovalo dřív, než brýle poslaly polohu hlavy → skončilo na podlaze,
  hra čekala v pauze a nikdo se nehýbal. Teď se menu ukáže až s prvním snímkem z brýlí v úrovni očí, a když se otočíš jinam,
  připluje zpátky před tebe.
- **Stůl jako kosočtverec:** tvoje radnice je ~55 cm přímo před tebou, Klan Popela na protějším rohu. Zlatá madla jsou po stranách
  bližšího rohu (fungují pro jakékoli natočení desky).
- **Interaktivní výuka** (VR i PC, 10 kroků): vyber dělníka → velitelská karta → farma → kasárna → pěšáci → štětec výběru → rozkaz
  a formace → tábor vlků. Každý krok se splní sám, jakmile ho uděláš; zlatá šipka ukazuje kam, tlačítko na kartě bliká.
  Během výuky Klan Popela čeká a dostaneš zásobu surovin navíc. Ve VR ji spustíš v úvodním menu, na PC čipem 🎓 Výuka.
- **Oprava chyb kreslení se stíny** na Questu (stínová mapa se vytvářela pozdě) a světlejší neprozkoumaná mapa.
- Testováno v **emulátoru Meta Quest 3** (IWER od Mety): spuštění VR tlačítkem, štípnutí rukou do menu, výuka, šipky, panely.

## Novinky v3 – VR na prvním místě

- **Do bitvy (velitelský pohled):** tlačítko 👁 na kartě (nebo **B** na ovladači) tě přenese přímo na bojiště –
  mapa se zvětší na měřítko 1 políčko = 30 cm, zem je na tvé podlaze a hrdina ti sahá po kolena. Můžeš fyzicky chodit mezi
  vojáky a velet jim zblízka. Pohled drží hrdinu: když odběhne, přeneseš se k němu přes krátké zatmění (žádné plynulé
  posouvání kamery = žádná nevolnost). Levá páčka = krok se zatměním, pravá = otočení po 30°. 🗺 **Zpět ke stolu** tě vrátí.
- **Kreslení formace:** s vybranou armádou táhni **pravou rukou** čáru po mapě – vojáci se na ni rovnoměrně rozestaví
  čelem vpřed (při krátké čáře ve více řadách). Během tažení vidíš čáru i tečky budoucích míst. **Levou rukou** tažení
  pořád funguje jako štětec výběru. Na PC totéž pravým tlačítkem tažením.
- **Kouzlo v dlani:** když zvolíš kouzlo hrdiny, v akční ruce ti září koule (modrá hrom, zelená léčení), jemně vibruje,
  a po štípnutí odletí na cíl.
- **Poplachové majáky:** při útoku vyroste nad místem červený světelný sloup viditelný přes celý stůl a na kartě se objeví
  ⚠ **K poplachu** – u stolu místo plynule přiblíží, v bitvě tě tam přenese.

## Novinky v2 – grafika na maximum

- **Detailní CC0 modely KayKit místo vlastních kostiček:** Aliance Svítání jsou dobrodruzi (rytíř, lučištnice s kuší,
  barbar se sekerou, mág jako hrdina), Klan Popela je armáda **kostlivců**. Budovy jsou středověké stavby ve dvou barvách
  (modrá / červená): hrad, větrný mlýn s točícími se lopatkami, kasárna, kostel jako oltář, kovárna, strážní věž.
  Rozestavěné budovy mají lešení, zničené zůstanou jako trosky. Zlatý důl, stromy, skály i hory kolem mapy jsou z téhož balíku.
- **Plné animace postav** (stání, chůze, útok, kouzlo, smrt) zapečené do textury → stovky jednotek ve pár draw callech.
- **Krajina:** kresba trávy v terénu, tisíce stébel a květin ve větru, stromy se vlní, přes mapu plují stíny mraků,
  obrys postav proti světlu, hory kolem mapy jako dioráma.
- **Stíny** (budovy, stromy i animované postavy) – přizpůsobí se desce i ve VR.
- **Nastavení grafiky** Nízká / Střední / Vysoká / Ultra (rozlišení, foveace, 72/90 Hz, stíny, hustota trávy, mraky)
  + **ukazatel FPS** – v pauze na PC i ve VR. Quest začíná na Střední.
- Rytíř je teď **Válečník** (barbar s obouruční sekerou) ze **Síně válečníků**.

Stahuje se asi 6 MB modelů (komprimované), animace se zapékají při spuštění (pár sekund, ukazatel na úvodní obrazovce).
**Netestováno na Questu** – hlavně zajímá plynulost na Střední; kdyby se trhalo, přepni na Nízkou a dej vědět FPS.

## Novinky v1

První hratelná verze.

- Celá hra od úvodní obrazovky po vítězství/porážku: ekonomika, stavění, výcvik, boj, hrdina se dvěma kouzly a úrovněmi,
  tábory divočiny s pokladem, AI soupeř ve třech obtížnostech, mlha války.
- VR ovládání postavené od začátku pro ruce: štípnutí na figurku, štětec výběru, chytrý rozkaz štípnutím do mapy,
  velitelská karta na levé dlani, taktický čas, zlatá madla na posun a zoom, skupiny na kartě, šťouchání prstem do tlačítek.
- VR prostředí: válečný stan s lucernami, stůl, nápis se surovinami nad protější hranou stolu. MR: bojiště nad tvým stolem.
- PC: klasické RTS ovládání, minimapa, příkazová karta s klávesovými zkratkami, obdélník výběru.
- Vlastní low-poly modely pro obě frakce (Aliance Svítání modrá, Klan Popela červená s rohy a tesáky), stavby s lešením během výstavby.
- Předrenderované zvuky (souboje, těžba, stavění, kouzla, poplach), prostorově podle místa na stole.

**Zatím netestováno na Questu** – ovládání rukama je ověřené jen simulací v prohlížeči. Nejvíc mě zajímá:
jestli je karta na dlani pohodlná, jestli štětec výběru chytá, co chceš, a jak jsou figurky velké (madly se dá mapa zvětšit).

### Co dál (návrhy)
- Vstup do hrdiny v 1. osobě (vedeš armádu zevnitř bitvy, kouzla gestem).
- MR: položení na skutečný stůl přes detekci ploch, bojiště přes celý pokoj.
- Hudba po vrstvách (klid / boj), víc map, druhá hratelná frakce, kampaň s příběhem.
- Nastavení grafiky a ukazatel FPS jako v Obraně Království.
