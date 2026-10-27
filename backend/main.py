"""Síparadicsom backend: játék létrehozása kóddal, csatlakozás, lobbi, indítás és a dobások.

A frontend `npm run dev` parancsa magától elindítja. Külön futtatás a projekt gyökeréből:
    backend/.venv/Scripts/python -m uvicorn main:app --app-dir backend --port 8000 --reload --reload-dir backend
"""

import secrets
import time
import uuid
from typing import Annotated

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, StringConstraints

MIN_PLAYERS = 1  # tesztelés miatt egyedül is indítható; a kész játékhoz állítsd 2-re
MAX_PLAYERS = 6
FIELD_COUNT = 40
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # nincs benne 0/O és 1/I, hogy ne lehessen összekeverni
CODE_LENGTH = 6
PAWN_COLORS = ["#d63031", "#0984e3", "#00b894", "#fdcb6e", "#6c5ce7", "#e17055"]
# a dobás animációjának hossza; egyezzen a frontend/src/game/timing.js értékeivel
DICE_MS = 1200
STEP_MS = 300


def now_ms() -> int:
    return int(time.time() * 1000)

app = FastAPI(title="Síparadicsom")

# A játékok a memóriában vannak, a szerver újraindításakor elvesznek.
games: dict[str, dict] = {}
connections: dict[str, set[WebSocket]] = {}

PlayerName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=20)]


class PlayerIn(BaseModel):
    name: PlayerName


class PlayerRef(BaseModel):
    player_id: str


def new_code() -> str:
    while True:
        code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))
        if code not in games:
            return code


def new_player(game: dict | None, name: str) -> dict:
    used = {p["color"] for p in game["players"]} if game else set()
    color = next(c for c in PAWN_COLORS if c not in used)
    return {"id": uuid.uuid4().hex, "name": name, "color": color, "position": 0}


def get_game(code: str) -> dict:
    game = games.get(code.upper())
    if game is None:
        raise HTTPException(404, "Nincs ilyen kódú játék.")
    return game


def public_state(game: dict) -> dict:
    players = game["players"]
    return {
        "code": game["code"],
        "status": game["status"],  # "lobby" vagy "playing"
        "host_id": game["host_id"],
        "players": players,
        "turn_player_id": players[game["turn"]]["id"] if game["status"] == "playing" else None,
        # az utolsó dobás; az "at" időponthoz igazítva mindenkinél egyszerre fut az animáció
        "last_roll": game["last_roll"],
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
        "last_roll": None,
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
    """A soron következő játékos dob; a szerver sorsol, lépteti a bábut és továbbadja a kört."""
    game = get_game(code)
    if game["status"] != "playing":
        raise HTTPException(409, "A játék még nem indult el.")
    player = game["players"][game["turn"]]
    if player["id"] != body.player_id:
        raise HTTPException(403, "Nem te következel.")
    last = game["last_roll"]
    if last and now_ms() < last["at"] + DICE_MS + last["value"] * STEP_MS:
        raise HTTPException(409, "Még tart az előző lépés.")
    value = secrets.randbelow(6) + 1
    start = player["position"]
    player["position"] = (start + value) % FIELD_COUNT
    game["last_roll"] = {
        "seq": (last or {}).get("seq", 0) + 1,
        "player_id": player["id"],
        "value": value,
        "from": start,
        "to": player["position"],
        "at": now_ms(),
    }
    game["turn"] = (game["turn"] + 1) % len(game["players"])
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
