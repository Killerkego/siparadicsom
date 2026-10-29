"""A játék beállításai és szabályai: játékosszám, pénzösszegek, építési elemek, animációs idők, tábla."""

import json
from pathlib import Path

MIN_PLAYERS = 2  # a feladatleírás szerint 2–4 játékos; egyedüli kipróbáláshoz átmenetileg 1
MAX_PLAYERS = 4
DEV_MODE = False  # fejlesztői fül a játékban (bárhova lépés, minden épület); teszteléshez állítsd True-ra
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # nincs benne 0/O és 1/I, hogy ne lehessen összekeverni
CODE_LENGTH = 6
PAWN_COLORS = ["#d63031", "#0984e3", "#00b894", "#fdcb6e"]
FIGURE_COUNT = 4  # a bábuk figurái (frontend/src/game/figures.js), mindenkinek más jut
LOG_LENGTH = 8  # ennyi naplóbejegyzést tartunk meg

# A tábla mezői ugyanabból a fájlból, amiből a frontend rajzol
BOARD = json.loads(
    (Path(__file__).resolve().parent.parent / "frontend" / "src" / "data" / "board.json").read_text(encoding="utf-8")
)["fields"]
FIELD_COUNT = len(BOARD)
LIFTS = [f["id"] for f in BOARD if f.get("special") == "felvono"]

# Szabályok, pénz: Hókristály Kredit (HK). A frontend is innen veszi az összegeket.
# Az egyensúlyt szimulációval hangoltuk (TESZTELES.md): egy játék 2 fővel kb. 74, 4 fővel kb. 62 kör,
# a kezdés sorrendje alig számít, és a mezők aránya a kártyákéhoz igazodik (jó lap átl. ~2100 HK,
# rossz lap ~1550 HK). A START és a hozzá kötött kártyák (Helikopter, Gyenge árfolyam) összege a
# kártyaképeken is szerepel, ezért az maradt 2000.
RULES = {
    "start_money": 10000,  # a teljes építkezés 24%-a
    "start_bonus": 2000,  # a START-on áthaladva vagy rálépve
    "race_prize": 1500,  # síverseny győztesének a banktól
    "gamble_prize": 2000,  # gambling: 4-5-6 dobásnál
    "gamble_back": 5,  # gambling: 1-2-3 dobásnál ennyi mezőt vissza (mindig kiadási mezőre)
    "lift_cost": 500,  # felvonó: ennyiért visz át egy másik felvonóhoz
    "school_pay": 500,  # oktatás: amíg nem dob párosat, minden köre elején ennyit kap
    "trap_back": 3,  # csapda: ennyi mezőt vissza (mindig kiadási mezőre)
    "trap_money": 1000,  # csapda: ennyit fizet a csapda lerakójának
    "shop_discount": 30,  # vásárlási mezőn ennyi % kedvezmény az aznapi építkezésre
    "win_money": 7000,  # győzelemhez: minden elem megépítve és legalább ennyi pénz (tartozás nélkül)
    "loan_unit": 1000,  # pénzhiánynál a bank ennyinek a többszörösét adja kölcsön
    "loan_interest": 10,  # a felvett hitelre ennyi % kamat jön, ezt kell visszafizetni
    "income_field": 2200,  # bevételi mezőn ennyit kap
    "expense_field": 1300,  # kiadási mezőn ennyit fizet (pénzhiánynál hitelből)
    "weak_start_bonus": 1000,  # Gyenge árfolyam kártya után a START-on csak ennyi jár
    "season_income_boost": 50,  # Csúcsszezon (szezonesemény): ennyi % plusz a bevételi mezőkön
    "season_expense_boost": 50,  # Ellenőrzés (szezonesemény): ennyi % plusz a kiadási mezőkön
}

# Szezonesemények (seasons.py): az első ebben a körben jön, mindegyik véletlenszerűen ennyi körig tart
# (a határokat is beleértve), utána ennyi kör szünet következik (szintén véletlenszerűen)
SEASON_FIRST_ROUND = 3
SEASON_LENGTH = (1, 3)
SEASON_GAP = (2, 3)

# A felépítendő Aranyhegy Szálló elemei. A játékos minden köre végén legfeljebb egyet vehet meg,
# ha van rá pénze, megvannak az előfeltételei és még nincs meg neki. Összesen 42 000 HK,
# a kezdőtőke ennek 24%-a.
BUILDINGS = [
    {"id": "palya", "name": "Pályarendszer", "price": 3500, "requires": []},
    {"id": "szalloda", "name": "Szálloda", "price": 7500, "requires": []},
    {"id": "felvono", "name": "Felvonó", "price": 5500, "requires": ["palya"]},
    {"id": "etterem", "name": "Étterem", "price": 4000, "requires": ["szalloda"]},
    {"id": "wellness", "name": "Wellness és spa", "price": 5500, "requires": ["szalloda"]},
    {"id": "bar", "name": "Luxusbár", "price": 4000, "requires": ["etterem"]},
    {"id": "lakosztaly", "name": "Luxus lakosztályok", "price": 6500, "requires": ["szalloda", "wellness"]},
    {"id": "helipad", "name": "Helikopter-leszállópálya", "price": 5500, "requires": ["szalloda", "felvono"]},
]
BUILDING_BY_ID = {b["id"]: b for b in BUILDINGS}

# a mozgások animációjának hossza; egyezzen a frontend/src/game/timing.js értékeivel
DICE_MS = 1200
STEP_MS = 300
JUMP_MS = 900
CARD_MS = 1300  # kártyahúzás a mozgás végén (a lap a kamera elé repül; ott marad, amíg le nem okézzák)
RACE_ROUND_MS = 2600  # síverseny: egy dobási kör (a kockák gurulnak, aztán látszik, ki dobta a legtöbbet)
RACE_RESULT_MS = 2400  # síverseny: a győztes kihirdetése a körök után
