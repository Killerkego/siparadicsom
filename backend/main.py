"""Síparadicsom backend: játék létrehozása kóddal, csatlakozás, lobbi, indítás, dobások és a
speciális mezők szabályai.

A frontend `npm run dev` parancsa magától elindítja. Külön futtatás a projekt gyökeréből:
    backend/.venv/Scripts/python -m uvicorn main:app --app-dir backend --port 8000 --reload --reload-dir backend
"""

import json
import secrets
import time
import uuid
from pathlib import Path
from typing import Annotated

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, StringConstraints

MIN_PLAYERS = 1  # tesztelés miatt egyedül is indítható; a kész játékhoz állítsd 2-re
MAX_PLAYERS = 6
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # nincs benne 0/O és 1/I, hogy ne lehessen összekeverni
CODE_LENGTH = 6
PAWN_COLORS = ["#d63031", "#0984e3", "#00b894", "#fdcb6e", "#6c5ce7", "#e17055"]

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


def now_ms() -> int:
    return int(time.time() * 1000)


def dice() -> int:
    return secrets.randbelow(6) + 1


def dobott(value: int) -> str:
    """'dobott' elé a szám tárgyragos alakja: 1-et, 2-t, 3-at, ..."""
    return {1: "1-et", 2: "2-t", 3: "3-at", 4: "4-et", 5: "5-öt", 6: "6-ot"}[value] + " dobott"


app = FastAPI(title="Síparadicsom")

# A játékok a memóriában vannak, a szerver újraindításakor elvesznek.
games: dict[str, dict] = {}
connections: dict[str, set[WebSocket]] = {}

PlayerName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=20)]


class PlayerIn(BaseModel):
    name: PlayerName


class PlayerRef(BaseModel):
    player_id: str


class ChoiceIn(BaseModel):
    player_id: str
    choice: str


def new_code() -> str:
    while True:
        code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))
        if code not in games:
            return code


def new_player(game: dict | None, name: str) -> dict:
    used = {p["color"] for p in game["players"]} if game else set()
    color = next(c for c in PAWN_COLORS if c not in used)
    return {
        "id": uuid.uuid4().hex,
        "name": name,
        "color": color,
        "position": 0,
        "money": RULES["start_money"],
        "in_school": False,
        "buildings": [],  # a megépített elemek azonosítói, vásárlási sorrendben
    }


def get_game(code: str) -> dict:
    game = games.get(code.upper())
    if game is None:
        raise HTTPException(404, "Nincs ilyen kódú játék.")
    return game


def find_player(game: dict, player_id: str) -> dict | None:
    return next((p for p in game["players"] if p["id"] == player_id), None)


def public_state(game: dict) -> dict:
    players = game["players"]
    return {
        "code": game["code"],
        "status": game["status"],  # "lobby", "playing" vagy "finished"
        "host_id": game["host_id"],
        "players": players,
        "turn_player_id": players[game["turn"]]["id"] if game["status"] == "playing" else None,
        "winner_id": game["winner_id"],
        # az utolsó mozgás (dobás és/vagy lépések); az "at" időponthoz igazítva mindenkinél egyszerre fut
        "last_action": game["last_action"],
        "pending": game["pending"],  # döntésre vár: gamble / lift / trap mező vagy build (építkezés a kör végén)
        "traps": game["traps"],  # mező sorszáma (szövegként) -> ki rakta le és milyet
        "log": game["log"],
        "rules": RULES,
        "buildings": BUILDINGS,
        "server_time": now_ms(),  # ebből számolja a kliens, mennyit siet/késik az órája
        "min_players": MIN_PLAYERS,
        "max_players": MAX_PLAYERS,
    }


async def broadcast(game: dict) -> None:
    """Minden csatlakozott böngészőnek elküldi a játék új állapotát."""
    sockets = connections.get(game["code"], set())
    state = public_state(game)
    for ws in list(sockets):
        try:
            await ws.send_json(state)
        except Exception:
            sockets.discard(ws)


def joined_response(game: dict, player: dict) -> dict:
    return {"player_id": player["id"], "game": public_state(game)}


# --- játékmenet ---


def add_log(game: dict, text: str) -> None:
    game["log"] = (game["log"] + [text])[-8:]


def action_duration(action: dict) -> int:
    moves = sum(JUMP_MS if m["type"] == "jump" else abs(m["steps"]) * STEP_MS for m in action["moves"])
    return (DICE_MS if action["dice"] else 0) + moves


def animating(game: dict) -> bool:
    action = game["last_action"]
    return action is not None and now_ms() < action["at"] + action_duration(action)


def record_action(game: dict, player: dict, dice_value: int | None, moves: list[dict]) -> None:
    """Elmenti a mozgást, amit minden böngésző ugyanabban az időben lejátszik."""
    if dice_value is None and not moves:
        return
    game["last_action"] = {
        "seq": (game["last_action"] or {}).get("seq", 0) + 1,
        "at": now_ms(),
        "player_id": player["id"],
        "dice": dice_value,
        "moves": moves,
    }


def walk(game: dict, player: dict, steps: int) -> dict:
    """Előre (pozitív) vagy hátra (negatív) lépteti a bábut. Előre a START-on át bónusz jár."""
    start = player["position"]
    if steps > 0 and start + steps >= FIELD_COUNT:
        player["money"] += RULES["start_bonus"]
        add_log(game, f"{player['name']} áthaladt a START-on: +{RULES['start_bonus']} HK.")
    player["position"] = (start + steps) % FIELD_COUNT
    return {"type": "walk", "from": start, "steps": steps}


def end_turn(game: dict) -> None:
    game["pending"] = None
    game["turn"] = (game["turn"] + 1) % len(game["players"])


def build_price(building: dict, discount: int) -> int:
    """a vételár a kedvezménnyel, 50 HK-ra kerekítve"""
    return round(building["price"] * (100 - discount) / 100 / 50) * 50


def build_problem(player: dict, building: dict, discount: int) -> str | None:
    """Miért nem veheti meg most a játékos az elemet (None, ha megveheti)."""
    if building["id"] in player["buildings"]:
        return f"A(z) {building['name']} már megvan."
    missing = [BUILDING_BY_ID[r]["name"] for r in building["requires"] if r not in player["buildings"]]
    if missing:
        return f"A(z) {building['name']} előfeltétele: {', '.join(missing)}."
    if player["money"] < build_price(building, discount):
        return f"Nincs elég pénzed: a(z) {building['name']} {build_price(building, discount)} HK."
    return None


def finish_turn(game: dict, player: dict) -> None:
    """A kör vége: ha van megvehető elem, a játékos dönthet róla, különben jön a következő."""
    discount = RULES["shop_discount"] if BOARD[player["position"]]["type"] == "vasarlas" else 0
    options = [b["id"] for b in BUILDINGS if build_problem(player, b, discount) is None]
    if options:
        game["pending"] = {"type": "build", "player_id": player["id"], "discount": discount, "options": options}
        return
    if discount:
        add_log(game, f"{player['name']} vásárlási mezőn áll, de most nincs megvehető építési elem.")
    close_turn(game, player)


def close_turn(game: dict, player: dict) -> None:
    """Győzelem ellenőrzése a kör végén, utána körváltás."""
    if len(player["buildings"]) == len(BUILDINGS) and player["money"] >= RULES["win_money"]:
        game["status"] = "finished"
        game["winner_id"] = player["id"]
        game["pending"] = None
        add_log(game, f"{player['name']} felépítette a teljes síparadicsomot és nyert!")
        return
    end_turn(game)


def ski_race(game: dict) -> None:
    """Síverseny: mindenki dob, a legmagasabb nyer; döntetlennél az élen állók újra dobnak."""
    contenders = game["players"]
    rounds = []
    while True:
        rolls = {p["id"]: dice() for p in contenders}
        rounds.append(", ".join(f"{p['name']} {rolls[p['id']]}" for p in contenders))
        best = max(rolls.values())
        contenders = [p for p in contenders if rolls[p["id"]] == best]
        if len(contenders) == 1:
            break
    winner = contenders[0]
    winner["money"] += RULES["race_prize"]
    add_log(game, f"Síverseny! {' | '.join(rounds)} → {winner['name']} nyert, +{RULES['race_prize']} HK.")


def land(game: dict, player: dict, moves: list[dict]) -> None:
    """A mező hatása, ahová a bábu a dobás után érkezett. Döntésnél a `pending`-be kerül."""
    pos = player["position"]
    special = BOARD[pos].get("special")
    name = player["name"]
    if special == "oktatas":
        player["in_school"] = True
        add_log(game, f"{name} oktatásra került: páros dobással mehet tovább, addig minden körben +{RULES['school_pay']} HK.")
    elif special == "siverseny":
        ski_race(game)
    elif special == "gambling":
        game["pending"] = {"type": "gamble", "player_id": player["id"]}
    elif special == "felvono":
        game["pending"] = {"type": "lift", "player_id": player["id"], "targets": [f for f in LIFTS if f != pos]}
    elif special == "csapda":
        trap = game["traps"].get(str(pos))
        owner = trap and find_player(game, trap["owner"])
        if owner and owner["id"] != player["id"]:
            del game["traps"][str(pos)]
            if trap["kind"] == "back":
                moves.append(walk(game, player, -RULES["trap_back"]))
                add_log(game, f"{name} {owner['name']} csapdájába lépett: {RULES['trap_back']} mezőt vissza.")
            else:
                player["money"] -= RULES["trap_money"]
                owner["money"] += RULES["trap_money"]
                add_log(game, f"{name} {owner['name']} csapdájába lépett: {RULES['trap_money']} HK-t fizet neki.")
        else:
            game["pending"] = {"type": "trap", "player_id": player["id"]}


def acting_player(game: dict, player_id: str) -> dict:
    if game["status"] == "finished":
        raise HTTPException(409, "A játék véget ért.")
    if game["status"] != "playing":
        raise HTTPException(409, "A játék még nem indult el.")
    player = game["players"][game["turn"]]
    if player["id"] != player_id:
        raise HTTPException(403, "Nem te következel.")
    if animating(game):
        raise HTTPException(409, "Még tart az előző lépés.")
    return player


# --- végpontok ---


@app.post("/api/games")
async def create_game(body: PlayerIn):
    code = new_code()
    player = new_player(None, body.name)
    games[code] = {
        "code": code,
        "status": "lobby",
        "host_id": player["id"],
        "players": [player],
        "turn": 0,
        "last_action": None,
        "pending": None,
        "traps": {},
        "log": [],
        "winner_id": None,
    }
    return joined_response(games[code], player)


@app.post("/api/games/{code}/join")
async def join_game(code: str, body: PlayerIn):
    game = get_game(code)
    if game["status"] != "lobby":
        raise HTTPException(409, "Ez a játék már elindult.")
    if len(game["players"]) >= MAX_PLAYERS:
        raise HTTPException(409, "A játék megtelt.")
    if any(p["name"].lower() == body.name.lower() for p in game["players"]):
        raise HTTPException(409, "Ez a név már foglalt ebben a játékban.")
    player = new_player(game, body.name)
    game["players"].append(player)
    await broadcast(game)
    return joined_response(game, player)


@app.get("/api/games/{code}")
async def game_state(code: str):
    return public_state(get_game(code))


@app.post("/api/games/{code}/start")
async def start_game(code: str, body: PlayerRef):
    game = get_game(code)
    if body.player_id != game["host_id"]:
        raise HTTPException(403, "Csak a házigazda indíthatja el a játékot.")
    if game["status"] != "lobby":
        raise HTTPException(409, "A játék már elindult.")
    if len(game["players"]) < MIN_PLAYERS:
        raise HTTPException(409, f"Legalább {MIN_PLAYERS} játékos kell az indításhoz.")
    game["status"] = "playing"
    game["turn"] = 0
    await broadcast(game)
    return public_state(game)


@app.post("/api/games/{code}/roll")
async def roll_dice(code: str, body: PlayerRef):
    """A soron következő játékos dob; a szerver sorsol, lépteti a bábut és alkalmazza a mezőt."""
    game = get_game(code)
    player = acting_player(game, body.player_id)
    if game["pending"]:
        raise HTTPException(409, "Előbb dönts a mezőn.")
    value = dice()
    moves = []
    if player["in_school"]:
        # oktatás: a kör elején fix összeg, és csak páros dobással mehet tovább
        player["money"] += RULES["school_pay"]
        if value % 2:
            add_log(game, f"{player['name']} oktatáson: +{RULES['school_pay']} HK, {dobott(value)} (páratlan), marad.")
            record_action(game, player, value, moves)
            finish_turn(game, player)
            await broadcast(game)
            return public_state(game)
        player["in_school"] = False
        add_log(game, f"{player['name']} oktatáson: +{RULES['school_pay']} HK, {dobott(value)} (páros), mehet tovább.")
    moves.append(walk(game, player, value))
    land(game, player, moves)
    record_action(game, player, value, moves)
    if not game["pending"]:
        finish_turn(game, player)
    await broadcast(game)
    return public_state(game)


@app.post("/api/games/{code}/choose")
async def choose(code: str, body: ChoiceIn):
    """Döntés a speciális mezőn (gambling, felvonó, csapda), utána az építkezés, végül a következő játékos."""
    game = get_game(code)
    player = acting_player(game, body.player_id)
    pending = game["pending"]
    if not pending:
        raise HTTPException(409, "Most nincs mit eldönteni.")
    name = player["name"]
    choice = body.choice

    if pending["type"] == "build":
        if choice == "no":
            add_log(game, f"{name} most nem épített.")
        else:
            building = BUILDING_BY_ID.get(choice)
            if building is None:
                raise HTTPException(422, "Nincs ilyen építési elem.")
            problem = build_problem(player, building, pending["discount"])
            if problem:
                raise HTTPException(409, problem)
            price = build_price(building, pending["discount"])
            player["money"] -= price
            player["buildings"].append(building["id"])
            sale = f", {pending['discount']}% kedvezménnyel" if pending["discount"] else ""
            add_log(game, f"{name} megépítette: {building['name']} (-{price} HK{sale}).")
        close_turn(game, player)
        await broadcast(game)
        return public_state(game)

    if pending["type"] == "gamble":
        if choice == "no":
            add_log(game, f"{name} nem kockáztatott a gamblingon.")
        elif choice == "yes":
            value = dice()
            moves = []
            if value <= 3:
                moves.append(walk(game, player, -RULES["gamble_back"]))
                add_log(game, f"{name} kockáztatott, {dobott(value)}: bukta, {RULES['gamble_back']} mezőt vissza.")
            else:
                player["money"] += RULES["gamble_prize"]
                add_log(game, f"{name} kockáztatott, {dobott(value)}: nyert, +{RULES['gamble_prize']} HK.")
            record_action(game, player, value, moves)
        else:
            raise HTTPException(422, "Igen vagy nem?")

    elif pending["type"] == "lift":
        if choice == "no":
            add_log(game, f"{name} nem szállt fel a felvonóra.")
        else:
            target = int(choice) if choice.isdigit() else None
            if target not in pending["targets"]:
                raise HTTPException(422, "Nincs ilyen felvonó.")
            if player["money"] < RULES["lift_cost"]:
                raise HTTPException(409, "Nincs elég pénzed a felvonóra.")
            player["money"] -= RULES["lift_cost"]
            moves = [{"type": "jump", "from": player["position"], "to": target}]
            player["position"] = target
            record_action(game, player, None, moves)
            add_log(game, f"{name} felvonóval átment a #{target} mezőre (-{RULES['lift_cost']} HK).")

    elif pending["type"] == "trap":
        if choice not in ("back", "money"):
            raise HTTPException(422, "Mezők vissza vagy pénz?")
        game["traps"][str(player["position"])] = {"owner": player["id"], "kind": choice}
        add_log(game, f"{name} csapdát rakott a #{player['position']} mezőre.")

    game["pending"] = None
    finish_turn(game, player)
    await broadcast(game)
    return public_state(game)


@app.post("/api/games/{code}/leave")
async def leave_game(code: str, body: PlayerRef):
    game = get_game(code)
    index = next((i for i, p in enumerate(game["players"]) if p["id"] == body.player_id), None)
    if index is None:
        return {"ok": True}
    game["players"].pop(index)
    if not game["players"]:
        del games[game["code"]]
        connections.pop(game["code"], None)
        return {"ok": True}
    if game["host_id"] == body.player_id:
        game["host_id"] = game["players"][0]["id"]  # a következő játékos lesz a házigazda
    if game["pending"] and game["pending"]["player_id"] == body.player_id:
        game["pending"] = None
    game["traps"] = {f: t for f, t in game["traps"].items() if t["owner"] != body.player_id}
    # a kör annál marad, aki eddig is következett volna
    if index < game["turn"]:
        game["turn"] -= 1
    game["turn"] %= len(game["players"])
    await broadcast(game)
    return {"ok": True}


@app.websocket("/ws/games/{code}")
async def game_socket(ws: WebSocket, code: str, player_id: str):
    await ws.accept()
    game = games.get(code.upper())
    if game is None or all(p["id"] != player_id for p in game["players"]):
        await ws.close(code=4404)  # a kliens ebből tudja, hogy a játék vagy a játékos már nem létezik
        return
    sockets = connections.setdefault(game["code"], set())
    sockets.add(ws)
    await ws.send_json(public_state(game))
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        sockets.discard(ws)
