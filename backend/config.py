"""A játék beállításai és szabályai: játékosszám, pénzösszegek, építési elemek, animációs idők, tábla."""

import json
from pathlib import Path

MIN_PLAYERS = 1  # tesztelés miatt egyedül is indítható; a kész játékhoz állítsd 2-re
MAX_PLAYERS = 4
DEV_MODE = True  # fejlesztői fül a játékban (bárhova lépés, minden épület); a kész játékhoz állítsd False-ra
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
RULES = {
    "start_money": 6000,
    "start_bonus": 2000,  # a START-on áthaladva vagy rálépve
    "race_prize": 1000,  # síverseny győztesének a banktól
    "gamble_prize": 1500,  # gambling: 4-5-6 dobásnál
    "gamble_back": 5,  # gambling: 1-2-3 dobásnál ennyi mezőt vissza
    "lift_cost": 500,  # felvonó: ennyiért visz át egy másik felvonóhoz
    "school_pay": 300,  # oktatás: amíg nem dob párosat, minden köre elején ennyit kap
    "trap_back": 3,  # csapda: ennyi mezőt vissza
    "trap_money": 800,  # csapda: ennyit fizet a csapda lerakójának
    "shop_discount": 30,  # vásárlási mezőn ennyi % kedvezmény az aznapi építkezésre
    "win_money": 5000,  # győzelemhez: minden elem megépítve és legalább ennyi pénz (tartozás nélkül)
    "loan_unit": 1000,  # pénzhiánynál a bank ennyinek a többszörösét adja kölcsön
    "loan_interest": 10,  # a felvett hitelre ennyi % kamat jön, ezt kell visszafizetni
    "income_field": 1000,  # bevételi mezőn ennyit kap
    "expense_field": 900,  # kiadási mezőn ennyit fizet (pénzhiánynál hitelből)
    "weak_start_bonus": 1000,  # Gyenge árfolyam kártya után a START-on csak ennyi jár
}

# A felépítendő síparadicsom elemei. A játékos minden köre végén legfeljebb egyet vehet meg,
# ha van rá pénze, megvannak az előfeltételei és még nincs meg neki. Összesen 26 000 HK,
# a kezdőtőke ennek kb. 23%-a.
BUILDINGS = [
    {"id": "palya", "name": "Pályarendszer", "price": 2000, "requires": []},
    {"id": "szalloda", "name": "Szálloda", "price": 4500, "requires": []},
    {"id": "felvono", "name": "Felvonó", "price": 3500, "requires": ["palya"]},
    {"id": "etterem", "name": "Étterem", "price": 2500, "requires": ["szalloda"]},
    {"id": "wellness", "name": "Wellness és spa", "price": 3500, "requires": ["szalloda"]},
    {"id": "bar", "name": "Luxusbár", "price": 2500, "requires": ["etterem"]},
    {"id": "lakosztaly", "name": "Luxus lakosztályok", "price": 4000, "requires": ["szalloda", "wellness"]},
    {"id": "helipad", "name": "Helikopter-leszállópálya", "price": 3500, "requires": ["szalloda", "felvono"]},
]
BUILDING_BY_ID = {b["id"]: b for b in BUILDINGS}

# a mozgások animációjának hossza; egyezzen a frontend/src/game/timing.js értékeivel
DICE_MS = 1200
STEP_MS = 300
JUMP_MS = 900
CARD_MS = 1300  # kártyahúzás a mozgás végén (a lap a kamera elé repül; ott marad, amíg le nem okézzák)
