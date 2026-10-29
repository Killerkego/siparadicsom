# Tesztjegyzőkönyv – Aranyhegy Szálló

A feladatleírás 12.2 és I/14. pontja szerinti ellenőrzés. A játékszabályokat automatikus tesztek
ellenőrzik a backendben (`backend/tests/`), a Python beépített `unittest` moduljával, külön telepítés
nélkül.

**Utolsó futtatás:** 2026. október 29. · **Eredmény: 109 teszt, mind sikeres (OK)** · futási idő kb. 3,5 mp

## Futtatás

A `backend` mappából:

```
.venv/Scripts/python -m unittest discover -s tests -v
```

## Az ellenőrzési lista és a tesztek

| PDF ellenőrzési pont | Tesztek | Eredmény |
|---|---|---|
| Játék indítása 2, 3 és 4 játékossal | `StartTests`: indítás 2/3/4 fővel, azonos kezdőtőke, START-pozíció, üres építkezés, 40 lapos pakli; 1 fővel nem indul, 5. játékos nem csatlakozhat, csak a házigazda indíthat, név kötelező és egyedi | ✅ |
| Játékosok és bábuk kezelése | `FigureTests`: mindenkinek más bábu és szín, foglalt bábut nem lehet választani | ✅ |
| Dobókocka és mozgás | `DiceAndMovementTests`: a kocka 1–6, pontosan a dobott értéknyit lép (1–6), csak a soron lévő dobhat, körönként egyszer, animáció alatt senki, a kör a következőre száll, a tábla végén körbeér | ✅ |
| START-bevétel | `StartBonusTests`: induláskor nincs bónusz, áthaladásért és megállásért van, egy áthaladásért egyszer | ✅ |
| Kötelező és speciális mezők | `FieldTests`: bevételi, kiadási, semleges, kártyahúzó, vásárlási (30% kedvezmény); oktatás, síverseny (döntetlennél újradobás), gambling (nyerés, bukás, kihagyás), felvonó (pénz nélkül nem), csapda (vissza / pénz, saját csapda nem sül el); minden mezőnek van funkciója, legalább 4 kártyahúzó és 3 speciális típus | ✅ |
| Mind a 40 eseménykártya | `CardTests`: 12/12/8/8 elosztás; **mind a 40 lap egyenként kihúzva ténylegesen megváltoztatja a játékállapotot**; extra dobás, körből kimaradás, visszalépés, Lojális ügyfél, Jósnő; a pakli nem ismétel, amíg el nem fogy, utána újrakever | ✅ |
| Pénzügyi műveletek | a mezők, kártyák, START és építkezés tesztjei pontos összegekkel | ✅ |
| Pénzhiány kezelése | `MoneyShortageTests`: hitel kamattal; a START-on áthaladva a kör végén, a mező hatása után törleszt (nem kell rögtön újra hitelt felvenni); önkéntes törlesztés a saját körben dobás előtt (teljes vagy részleges, más körében és döntés közben nem); törlesztés után rögtön nyerhet; a pénz sosem negatív. `BotTests`: a gépi játékos is törleszt | ✅ |
| Építési elemek vásárlása | `BuildingTests`: 8 elem, legalább 2 előfeltétellel, kezdőtőke 20–30%; sikeres vásárlás, körönként egy | ✅ |
| Vásárlási feltételek ellenőrzése | `BuildingTests`: kevés pénz, hiányzó előfeltétel, már meglévő elem (mind elutasítva, okkal), kártyás tiltás, kedvezmény | ✅ |
| Különleges előnyök és hátrányok | `CardTests` és `BuildingTests` (extra dobás, kimaradás, Lojális ügyfél, vásárlási tiltás) | ✅ |
| Győzelmi feltételek | `VictoryTests`: nyer, ha mindhárom teljesül; nem nyer tartozással, kevés pénzzel vagy hiányzó elemmel | ✅ |
| Játék lezárása és új játék | `VictoryTests`: a vége után senki nem dobhat; új játék indítható | ✅ |
| Szezonesemények (saját mechanika, 10.) | `SeasonScheduleTests`, `SeasonEffectTests`: a körök számlálása (kimaradással is), az első esemény a 3. körben, véletlen fajta és véletlen hossz (1–3 kör), amíg tart, új nem indulhat, utána újak jönnek, kétszer egymás után nem ugyanaz; Csúcsszezon +50% a bevételi mezőkön (a Szezonnyitó bulival együtt is), Ellenőrzés +50% a kiadási mezőkön (a Könyvelővel a fele), Hóviharban zárva a felvonó, az esemény után minden visszaáll | ✅ |
| Kilépés játék közben | `EdgeCaseTests`: a soron lévő kilépésekor az utána ülő jön (a sor végén új kör indul, és vele lejárhat a szezonesemény), a kimaradó játékost átugorja; más kilépésekor a soron lévő marad; egyedül maradva az nyer; a függő lapok nem vesznek el | ✅ |
| Lezárhatóság, 2–4 játékos (12.1) | `SimulationTests`: teljes játékok szimulálása (lásd lent) | ✅ |

## Teljes játékok szimulálása

Egy egyszerű bot 2, 3 és 4 játékossal 40–40 teljes játékot játszik végig: mindig a legolcsóbb
megvehető elemet építi, a többi döntést véletlenül hozza. Minden lépés után ellenőrzi, hogy:

- senkinek sem negatív a pénze, és a hitel sem negatív;
- minden bábu érvényes mezőn áll;
- egy elemet csak egyszer és az előfeltételei után lehet megszerezni;
- a 40 kártya egyike sem veszik el (pakli + dobott lapok + döntésre váró lapok = 40);
- a győztes tényleg teljesíti mindhárom győzelmi feltételt.

| Játékosok | Győzelemmel véget ért | Átlagos hossz | Legrövidebb | Leghosszabb |
|---|---|---|---|---|
| 2 | 40 / 40 | 70 kör | 36 kör | 159 kör |
| 3 | 40 / 40 | 66 kör | 40 kör | 120 kör |
| 4 | 40 / 40 | 66 kör | 43 kör | 100 kör |

(Egy kör = mindenki egyszer dob.) Egyetlen játék sem akadt el, és szabálytalan állapot sem keletkezett.

## Játékegyensúly (PDF 8.4 és 12.)

A pénzösszegeket szimulációval hangoltuk: játékosszámonként 150 teljes játék, kétféle bottal
(az egyik mindent elkölt, a másik tartalékot megtart). A cél az volt, hogy a játék hossza ugyanannyi
maradjon, de a bevételek és a kiadások arányosak legyenek egymással és a kártyákkal: az eredeti
értékeknél a mezők (+1000 / −900) jóval gyengébbek voltak a kártyáknál (~2000), és a nettó bevétel
kicsi volt, ezért a játékosok sokszor hitelből éltek.

| Érték | Előtte | Most |
|---|---|---|
| Építési elemek összesen | 26 000 HK | 42 000 HK (az arányok megmaradtak) |
| Kezdőtőke | 6000 HK (23%) | 10 000 HK (24%) |
| Bevételi mező | +1000 HK | +2200 HK |
| Kiadási mező | −900 HK | −1300 HK |
| Győzelemhez szükséges pénz | 5000 HK | 7000 HK |
| Síverseny díja | 1000 HK | 1500 HK |
| Gambling nyereménye | 1500 HK | 2000 HK |
| Csapda (pénz) | 800 HK | 1000 HK |
| Oktatás körönként | 300 HK | 500 HK |
| START, felvonó, hitel (1000-es egység, 10% kamat), kártyák | változatlan | változatlan |

| Mutató (150 játék játékosszámonként) | Előtte | Most |
|---|---|---|
| Átlagos hossz 2 / 3 / 4 fővel | 75 / 68 / 64 kör | 75 / 65 / 62 kör |
| Hitelfelvétel egy játékban, ha mindent elköltenek (2 / 3 / 4 fő) | 13,7 / 18,8 / 24,7 | 12,4 / 15,8 / 20,2 |
| Hitelfelvétel egy játékban, 2000 HK tartalékkal (2 / 3 / 4 fő) | – | 4,7 / 6,5 / 7,7 |
| Győzelmek a kezdési sorrend szerint, 2 fővel | 83 / 67 | 77 / 73 |
| A vesztesek átlagos építkezése a játék végén | 6,4–6,7 / 8 | 6,2–6,9 / 8 |

Indoklás:

- A **mezők a kártyákhoz igazodnak**: egy jó lap átlagosan ~2100 HK-t ér, a bevételi mező 2200-at; egy rossz
  lap ~1550 HK-ba kerül, a kiadási mező 1300-ba. Így egyik mező sem jelentéktelen a kártyák mellett.
- A **bevétel több, mint a kiadás** (2200 : 1300), ezért a játékosok folyamatosan haladnak; a nagyobb
  építési árak tartják meg a játék eredeti hosszát. Aki tartalékot tart, ritkán szorul hitelre,
  aki mindent elkölt, az gyakrabban – a pénzbeosztásnak így valódi szerepe van.
- A **START 2000 HK és a kártyák összegei maradtak**, mert ezek a kártyaképeken is szerepelnek
  (Helikopter transzfer, Gyenge árfolyam, a nyeremény- és veszteségkártyák).
- A kezdési sorrend alig számít, és a vesztesek is többnyire 6–7 elemnél tartanak a végén: a játék szoros.

## A tesztelés közben talált és javított hibák

- **Egyedül is indítható volt a játék** (`MIN_PLAYERS = 1`), a feladatleírás szerint legalább 2 játékos
  kell. Javítva: `MIN_PLAYERS = 2`.
- **A csapda és a bukott gambling pozitív mezőre is visszaküldhetett** (bevételi mező, síverseny), és a
  célmező hatása nem érvényesült. Javítva: a tábla úgy van kirakva, hogy mindig kiadási mezőre küldjön
  vissza, és ott a kiadást is le kell fizetni.
- **A START-on a bank a teljes készpénzt elvihette törlesztésre, még a mező hatása előtt**, így egy
  kiadási mezőn ugyanabban a lépésben újra, kamatra kellett hitelt felvenni (180 szimulált játékban
  118-szor). Javítva: a törlesztés a kör végén, a mező hatása után történik (utána 7-szer).
- **Aki tartozott, csak a START-on törleszthetett**, ezért akkor sem nyerhetett, ha minden más
  feltételt teljesített (27 eset). Javítva: a saját körben, dobás előtt önként is lehet törleszteni
  („Hitel törlesztése” gomb), és a gépi játékosok is így tesznek.

## Szabályok, amelyeket a tesztek rögzítenek

- Kártyával elért mező (előre, hátra, START, helycsere) hatása nem érvényesül, csak a START-pénz.
  Csapdás és gamblinges visszalépésnél viszont a célmező (kiadási) hatása érvényesül.
- Tartozással lehet vásárolni, ha van rá készpénz, de nyerni csak tartozás nélkül lehet. A hitelt a bank
  a START-on áthaladt játékos köre végén vonja le (a mező hatása után, az építkezés előtt), amennyit a
  pénze fedez; a játékos a saját körében, dobás előtt önként is törleszthet.
- Az „Egyszer nem vásárolhatsz épületet” hatású lapok a lap húzásának körében tiltják a vásárlást.
