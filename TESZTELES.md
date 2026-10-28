# Tesztjegyzőkönyv – Síparadicsom

A feladatleírás 12.2 és I/14. pontja szerinti ellenőrzés. A játékszabályokat automatikus tesztek
ellenőrzik a backendben (`backend/tests/`), a Python beépített `unittest` moduljával, külön telepítés
nélkül.

**Utolsó futtatás:** 2026. október 28. · **Eredmény: 62 teszt, mind sikeres (OK)** · futási idő kb. 2,5 mp

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
| Pénzhiány kezelése | `MoneyShortageTests`: hitel kamattal, a START-on törleszt, a pénz sosem negatív | ✅ |
| Építési elemek vásárlása | `BuildingTests`: 8 elem, legalább 2 előfeltétellel, kezdőtőke 20–30%; sikeres vásárlás, körönként egy | ✅ |
| Vásárlási feltételek ellenőrzése | `BuildingTests`: kevés pénz, hiányzó előfeltétel, már meglévő elem (mind elutasítva, okkal), kártyás tiltás, kedvezmény | ✅ |
| Különleges előnyök és hátrányok | `CardTests` és `BuildingTests` (extra dobás, kimaradás, Lojális ügyfél, vásárlási tiltás) | ✅ |
| Győzelmi feltételek | `VictoryTests`: nyer, ha mindhárom teljesül; nem nyer tartozással, kevés pénzzel vagy hiányzó elemmel | ✅ |
| Játék lezárása és új játék | `VictoryTests`: a vége után senki nem dobhat; új játék indítható | ✅ |
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
| 2 | 40 / 40 | 80 kör | 40 kör | 152 kör |
| 3 | 40 / 40 | 69 kör | 35 kör | 101 kör |
| 4 | 40 / 40 | 63 kör | 33 kör | 96 kör |

(Egy kör = mindenki egyszer dob.) Egyetlen játék sem akadt el, és szabálytalan állapot sem keletkezett.

## A tesztelés közben talált és javított hibák

- **Egyedül is indítható volt a játék** (`MIN_PLAYERS = 1`), a feladatleírás szerint legalább 2 játékos
  kell. Javítva: `MIN_PLAYERS = 2`.
- **A csapda és a bukott gambling pozitív mezőre is visszaküldhetett** (bevételi mező, síverseny), és a
  célmező hatása nem érvényesült. Javítva: a tábla úgy van kirakva, hogy mindig kiadási mezőre küldjön
  vissza, és ott a kiadást is le kell fizetni.

## Szabályok, amelyeket a tesztek rögzítenek

- Kártyával elért mező (előre, hátra, START, helycsere) hatása nem érvényesül, csak a START-pénz.
  Csapdás és gamblinges visszalépésnél viszont a célmező (kiadási) hatása érvényesül.
- Tartozással lehet vásárolni, ha van rá készpénz, de nyerni csak tartozás nélkül lehet; a hitelt a bank
  a START-on vonja le.
- Az „Egyszer nem vásárolhatsz épületet” hatású lapok a lap húzásának körében tiltják a vásárlást.
